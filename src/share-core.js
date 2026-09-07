'use strict'

/**
 * @weibaohui/dsh-file-share — share-core
 *
 * 与宿主（cordis/dsh）无关的「目录共享」核心：
 *  - 一个 root 目录（绝对路径）作为共享根；
 *  - resolveSafe 家族保证所有磁盘路径都落在 root 内（词法边界 + 符号链接真实路径边界）；
 *  - 纯 node:http 路由：列表 / 下载 / 上传 / 新建文件夹 / 改名 / 删除 + 内置单页 HTML；
 *  - 可选的 token 门禁（timing-safe）、每 IP 限流、只读模式、敏感文件隐藏。
 *
 * 同一份核心被两个面复用（见 src/index.js）：
 *  1. 独立共享服务器（端口上，走 token 门禁 + 限流，HTML 页给手机/其他电脑浏览器用）；
 *  2. 宿主同源路由 /dsh-file-share/api（不重复门禁，给 dsh Web 客户端 UI 用）。
 */

const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const zlib = require('node:zlib')

const VERSION = '0.1.0'
const MAX_LIST_ENTRIES = 5000
const MAX_ZIP_ENTRIES = 4000
const MAX_ZIP_UNCOMPRESSED = 128 * 1024 * 1024

/** 名称级别的敏感匹配：出现在任何一层路径段即拒绝列目录 / 下载 / 删除 / 上传。 */
const SENSITIVE_PATTERNS = [
  /^\.env(\.|$)/,
  /^\.git$/, /^\.svn$/, /^\.hg$/, /^\.bzr$/,
  /^node_modules$/,
  /\.(pem|key|pfx|p12)$/i,
  /^creds?.*\.(ya?ml|json|txt)$/i,
  /^\.netrc$/,
  /^\.ssh$/, /^\.aws$/, /^\.dsh$/, /^\.trash$/,
]

function isHiddenName(name) {
  return SENSITIVE_PATTERNS.some((re) => re.test(name))
}

function relIsHidden(rel) {
  return String(rel || '').split(/[\\/]/).filter(Boolean).some(isHiddenName)
}

/** 业务错误：带 HTTP status，路由层原样转 JSON。 */
class ShareError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function statOrThrow(abs, missingStatus = 404) {
  try {
    return fs.statSync(abs)
  } catch (e) {
    if (e && e.code === 'ENOENT') throw new ShareError(missingStatus, `不存在: ${path.basename(abs)}`)
    if (e && (e.code === 'EACCES' || e.code === 'EPERM')) throw new ShareError(403, `无权限: ${path.basename(abs)}`)
    throw e
  }
}

/** root 规范化：必须是已存在的绝对目录。空/空白视为未配置。 */
function ensureRoot(root) {
  if (typeof root !== 'string' || root.trim() === '') throw new ShareError(500, '共享根目录未配置')
  const r = path.resolve(root)
  const st = statOrThrow(r, 500)
  if (!st.isDirectory()) throw new ShareError(500, '共享根不是目录')
  return r
}

/** 词法边界：rel 解析后必须仍在 rootAbs 内。 */
function lexicalAbs(rootAbs, rel) {
  const relStr = typeof rel === 'string' && rel !== '' ? rel : '.'
  if (relStr.includes('\0')) throw new ShareError(400, '非法路径')
  if (path.isAbsolute(relStr)) throw new ShareError(400, '不允许绝对路径')
  const abs = path.resolve(rootAbs, relStr)
  const relChk = path.relative(rootAbs, abs)
  if (relChk === '..' || relChk.startsWith('..' + path.sep)) throw new ShareError(400, '路径越界')
  return abs
}

function insideReal(realRoot, realTarget) {
  const r = path.relative(realRoot, realTarget)
  return !(r === '..' || r.startsWith('..' + path.sep))
}

/** 取「已存在路径」的真实（符号链接解析后）最近祖先，用于写路径的边界校验。 */
function realAncestor(abs) {
  let p = abs
  for (;;) {
    try {
      return fs.realpathSync(p)
    } catch {
      const parent = path.dirname(p)
      if (parent === p) throw new ShareError(500, '无法解析路径祖先')
      p = parent
    }
  }
}

/** 解析已存在条目；kind: 'file' | 'dir' | 'any'。符号链接逃逸出 root 一律拒绝。 */
function resolveExisting(root, rel, kind = 'any') {
  const rootAbs = ensureRoot(root)
  const abs = lexicalAbs(rootAbs, rel)
  const st = statOrThrow(abs)
  if (kind === 'file' && !st.isFile()) throw new ShareError(400, '不是文件')
  if (kind === 'dir' && !st.isDirectory()) throw new ShareError(400, '不是目录')
  const realRoot = fs.realpathSync(rootAbs)
  const real = fs.realpathSync(abs)
  if (!insideReal(realRoot, real)) throw new ShareError(400, '符号链接越界')
  return abs
}

/** 解析「待创建」路径（自身可不存在，父链必须真实落在 root 内）。 */
function resolveCreatable(root, rel) {
  const rootAbs = ensureRoot(root)
  const abs = lexicalAbs(rootAbs, rel)
  const realRoot = fs.realpathSync(rootAbs)
  const anc = realAncestor(abs)
  if (!insideReal(realRoot, anc)) throw new ShareError(400, '路径越界')
  return abs
}

/** 列目录：dirs 在前、名称按中文习惯排序；hideSensitive 时跳过敏感名。 */
function listDir(root, rel, hideSensitive) {
  const abs = resolveExisting(root, rel, 'dir')
  const entries = []
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (hideSensitive && isHiddenName(ent.name)) continue
    let type = ent.isDirectory() ? 'dir' : 'file'
    let size = null
    let mtime = 0
    const full = path.join(abs, ent.name)
    try {
      const s = fs.statSync(full) // 跟随符号链接
      if (s.isDirectory()) type = 'dir'
      else if (s.isFile()) type = 'file'
      else continue
      if (type === 'file') size = s.size
      mtime = Math.round(s.mtimeMs)
    } catch {
      continue
    }
    entries.push({ name: ent.name, type, size, mtime })
    if (entries.length >= MAX_LIST_ENTRIES) break
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh')
  })
  return entries
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.zip': 'application/zip', '.gz': 'application/gzip', '.tar': 'application/x-tar',
  '.7z': 'application/x-7z-compressed', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.wasm': 'application/wasm',
}

function contentType(abs) {
  return MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream'
}

/** 下载：Content-Disposition attachment 流式输出。 */
function sendDownload(req, res, root, rel, hideSensitive) {
  if (hideSensitive && relIsHidden(rel)) throw new ShareError(403, '敏感文件不可下载')
  const abs = resolveExisting(root, rel, 'file')
  const name = path.basename(abs)
  const stat = fs.statSync(abs)
  res.writeHead(200, {
    'content-type': contentType(abs),
    'content-length': stat.size,
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    'cache-control': 'no-store',
  })
  const rs = fs.createReadStream(abs)
  rs.on('error', () => { try { res.destroy() } catch {} })
  rs.pipe(res)
}

// ── zip 打包下载（文件夹 / 多选）────────────────────────────────────────────
// 零依赖：ZIP 结构手写（目录条目 STORE，文件条目 deflateRaw），上限内同步构建。

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function dosDateTime(ms) {
  const d = new Date(ms)
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate())
  return { time: time & 0xFFFF, date: date & 0xFFFF }
}

/** entries: [{ name, data?, isDir?, mtime? }] → Buffer（本地头 + 中央目录 + EOCD，UTF-8 名）。 */
function buildZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const ent of entries) {
    const nameBuf = Buffer.from(ent.name, 'utf8')
    const data = ent.isDir || !ent.data ? Buffer.alloc(0) : ent.data
    const method = ent.isDir ? 0 : 8
    const compressed = ent.isDir ? data : zlib.deflateRawSync(data)
    const { time, date } = dosDateTime(ent.mtime || Date.now())
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 文件名
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc32(data), 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    locals.push(local, nameBuf, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc32(data), 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(ent.isDir ? 0x10 : 0, 38) // MS-DOS 目录位
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)

    offset += 30 + nameBuf.length + compressed.length
  }
  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuf, eocd])
}

/**
 * 收集并响应 zip 下载。rels 为相对工作区的路径（可多个，文件/目录混选）；
 * 目录递归展开，zip 内保留相对路径结构；敏感名按 hideSensitive 过滤/拒绝，
 * 递归中符号链接逃逸出 root 的条目跳过。entries/字节双上限防失控。
 */
function sendDownloadZip(res, root, rels, opts) {
  const hideSensitive = opts.hideSensitive !== false
  const maxEntries = opts.zipMaxEntries > 0 ? opts.zipMaxEntries : MAX_ZIP_ENTRIES
  const maxBytes = opts.zipMaxBytes > 0 ? opts.zipMaxBytes : MAX_ZIP_UNCOMPRESSED
  const uniq = [...new Set((Array.isArray(rels) ? rels : []).map((r) => String(r || '').replace(/^\/+|\/+$/g, '')).filter(Boolean))]
  if (uniq.length === 0) throw new ShareError(400, '未选择要下载的路径')

  const realRoot = fs.realpathSync(ensureRoot(root))
  const entries = []
  let total = 0
  const addFile = (abs, zipName, st) => {
    if (entries.length >= maxEntries) throw new ShareError(413, `条目数超过上限 ${maxEntries}，请分批下载`)
    const data = fs.readFileSync(abs)
    total += data.length
    if (total > maxBytes) throw new ShareError(413, `总大小超过上限 ${Math.round(maxBytes / 1048576)}MB，请分批下载`)
    entries.push({ name: zipName, data, mtime: st.mtimeMs })
  }
  const addDir = (zipName, mtime) => {
    if (entries.length >= maxEntries) throw new ShareError(413, `条目数超过上限 ${maxEntries}，请分批下载`)
    entries.push({ name: zipName, isDir: true, mtime })
  }
  const walk = (abs, zipName, depth) => {
    if (depth > 32) return
    addDir(zipName + '/', fs.statSync(abs).mtimeMs)
    let names = []
    try { names = fs.readdirSync(abs) } catch { return }
    for (const name of names) {
      if (hideSensitive && isHiddenName(name)) continue
      const child = path.join(abs, name)
      try {
        if (!insideReal(realRoot, fs.realpathSync(child))) continue // 符号链接逃逸，跳过
      } catch { continue }
      let st
      try { st = fs.statSync(child) } catch { continue }
      if (st.isDirectory()) walk(child, zipName + '/' + name, depth + 1)
      else if (st.isFile()) addFile(child, zipName + '/' + name, st)
    }
  }

  for (const rel of uniq) {
    if (hideSensitive && relIsHidden(rel)) throw new ShareError(403, `敏感路径不可下载: ${rel}`)
    const abs = resolveExisting(root, rel)
    const st = fs.statSync(abs)
    if (st.isDirectory()) walk(abs, rel, 0)
    else if (st.isFile()) addFile(abs, rel, st)
  }
  if (entries.length === 0) throw new ShareError(404, '所选路径没有可下载的内容')

  const zip = buildZip(entries)
  let name = String(opts.name || '').replace(/[\\/]/g, '').trim()
  if (name.length > 100) name = name.slice(0, 100)
  if (!name) name = uniq.length === 1 ? `${path.basename(uniq[0]) || 'download'}.zip` : 'download.zip'
  if (!/\.zip$/i.test(name)) name += '.zip'
  res.writeHead(200, {
    'content-type': 'application/zip',
    'content-length': zip.length,
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    'cache-control': 'no-store',
  })
  res.end(zip)
}

/** 上传：原始 body 流式落盘（临时文件 + 原子 rename），拒绝覆盖与敏感名。 */
async function receiveUpload(req, res, root, dirRel, rawName, opts) {
  const dirAbs = resolveExisting(root, dirRel || '', 'dir')
  const clean = path.basename(String(rawName || '').replace(/\\/g, '/')).trim()
  if (!clean || clean === '.' || clean === '..') throw new ShareError(400, '非法文件名')
  if (opts.hideSensitive && isHiddenName(clean)) throw new ShareError(403, '敏感文件名不可上传')
  const target = path.join(dirAbs, clean)
  if (fs.existsSync(target)) throw new ShareError(409, '同名文件已存在')
  const tmp = `${target}.dsh-tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
  let received = 0
  const out = fs.createWriteStream(tmp, { flags: 'wx' })
  try {
    for await (const chunk of req) {
      received += chunk.length
      if (opts.maxBytes && received > opts.maxBytes) {
        out.destroy()
        throw new ShareError(413, `超过大小上限 ${opts.maxBytes} 字节`)
      }
      if (!out.write(chunk)) {
        await new Promise((resolve, reject) => {
          out.once('drain', resolve)
          out.once('error', reject)
        })
      }
    }
    await new Promise((resolve, reject) => {
      out.end(() => resolve())
      out.on('error', reject)
    })
    fs.renameSync(tmp, target)
    return { name: clean, size: received }
  } catch (e) {
    try { out.destroy() } catch {}
    try { fs.rmSync(tmp, { force: true }) } catch {}
    throw e
  }
}

/** 新建文件夹：rel 的父链须已存在（支持 a/b 多级但最后一段是新目录）。 */
function mkdirEntry(root, rel) {
  if (!rel || rel === '.' || rel === '/') throw new ShareError(400, '目录名不能为空')
  if (relIsHidden(rel)) throw new ShareError(403, '敏感目录名不可创建')
  const abs = resolveCreatable(root, rel)
  if (fs.existsSync(abs)) throw new ShareError(409, '已存在')
  fs.mkdirSync(abs, { recursive: false })
  return { path: rel }
}

/** 改名 / 移动（同盘 rename）。 */
function renameEntry(root, fromRel, toRel) {
  if (!fromRel || !toRel || fromRel === toRel) throw new ShareError(400, '改名参数不合法')
  if (relIsHidden(toRel)) throw new ShareError(403, '敏感名称不可用')
  const fromAbs = resolveExisting(root, fromRel)
  const toAbs = resolveCreatable(root, toRel)
  if (fs.existsSync(toAbs)) throw new ShareError(409, '目标已存在')
  fs.renameSync(fromAbs, toAbs)
  return { from: fromRel, to: toRel }
}

/** 删除（目录递归）。root 自身不可删。 */
function deleteEntry(root, rel) {
  if (!rel || rel === '.' || rel === '/') throw new ShareError(400, '不能删除共享根')
  if (relIsHidden(rel)) throw new ShareError(403, '敏感路径不可删除')
  const abs = resolveExisting(root, rel)
  fs.rmSync(abs, { recursive: true, force: false })
  return { path: rel }
}

/** token 门禁：timing-safe 比较。 */
function tokenOk(got, want) {
  if (!want || typeof got !== 'string') return false
  const a = Buffer.from(got)
  const b = Buffer.from(want)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function extractToken(req, url) {
  const q = url.searchParams.get('token')
  if (q) return q
  const h = req.headers['x-token']
  if (h) return Array.isArray(h) ? h[0] : h
  const cookie = req.headers.cookie || ''
  const m = /(?:^|;\s*)dsh-file-share-token=([^;]+)/.exec(cookie)
  return m ? decodeURIComponent(m[1]) : null
}

/** 每 IP 滑动窗口限流；limitPerMin<=0 视为不限。 */
function makeLimiter(limitPerMin) {
  const limit = Number(limitPerMin)
  if (!(limit > 0)) return () => null
  const hits = new Map()
  return function limiter(ip) {
    const now = Date.now()
    const arr = (hits.get(ip) || []).filter((t) => now - t < 60000)
    if (arr.length >= limit) {
      hits.set(ip, arr)
      return new ShareError(429, '请求过于频繁')
    }
    arr.push(now)
    hits.set(ip, arr)
    return null
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function applyCors(res) {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type, x-token')
}

/** 供宿主与测试读取的运行状态。 */
function statusPayload(opts) {
  return {
    version: VERSION,
    enabled: Boolean(opts.root && String(opts.root).trim()),
    running: opts.serverRunning !== false,
    root: opts.root || '',
    readOnly: Boolean(opts.readOnly),
    hideSensitive: opts.hideSensitive !== false,
    port: opts.port != null ? opts.port : null,
    host: opts.host || '127.0.0.1',
    url: opts.publicUrl || null,
    token: opts.enforceToken ? opts.token || null : null,
    maxBytes: opts.maxBytes || null,
  }
}

const HTML_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>目录共享 · dsh-file-share</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font:14px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg)}
:root{--bg:#f5f6f8;--fg:#1f2328;--muted:#656d76;--card:#fff;--line:#d8dee4;--accent:#0969da;--danger:#cf222e}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8b949e;--card:#161b22;--line:#30363d;--accent:#4493f8;--danger:#f85149}}
.wrap{max-width:960px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:0 0 4px}
.meta{color:var(--muted);font-size:12px;margin-bottom:12px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.crumb{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);min-height:34px;flex:1;word-break:break-all}
.crumb a{color:var(--accent);cursor:pointer;text-decoration:none}
.btn{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.danger{color:var(--danger);border-color:var(--danger)}
.row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:none}
.row:hover{background:color-mix(in srgb,var(--accent) 6%,transparent)}
.lst{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:12px}
.ic{width:22px;flex:none}
.nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm.folder{color:var(--accent);cursor:pointer}
.sz{color:var(--muted);font-size:12px;width:90px;text-align:right;flex:none;font-variant-numeric:tabular-nums}
.ops{display:flex;gap:6px;flex:none}
.ops button{font-size:12px}
.empty{color:var(--muted);padding:24px;text-align:center}
.gate{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9}
.gate-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;width:min(360px,90vw)}
.gate-card input{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);margin:10px 0}
.msg{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:8px 14px;border-radius:8px;font-size:13px;z-index:10;opacity:0;transition:opacity .2s}
.msg.show{opacity:1}
input[type=file]{display:none}
</style>
</head>
<body>
<div class="wrap">
  <h1>📁 目录共享</h1>
  <div class="meta" id="meta">…</div>
  <div class="bar">
    <div class="crumb" id="crumb"></div>
    <button class="btn" onclick="refresh()">刷新</button>
    <button class="btn" id="btnUpload" onclick="pickUpload()">上传</button>
    <button class="btn" id="btnMkdir" onclick="mkdirNow()">新建文件夹</button>
    <input type="file" id="file" multiple onchange="doUpload(this.files)">
  </div>
  <div class="lst" id="list"></div>
  <div class="empty" id="empty" style="display:none">（空目录）</div>
</div>
<div class="gate" id="gate" style="display:none">
  <div class="gate-card">
    <b>需要访问口令</b>
    <input type="password" id="tokenInput" placeholder="输入 token 或口令">
    <button class="btn primary" style="width:100%" onclick="submitToken()">进入</button>
  </div>
</div>
<div class="msg" id="msg"></div>
<script>
var cur = ''
var tok = new URLSearchParams(location.search).get('token') || sessionStorage.getItem('dsh-file-share-token') || ''
function qs(extra){ var p=new URLSearchParams(extra); if(tok) p.set('token',tok); return p.toString() }
function join(a,b){ return (a? a + '/' : '') + b }
function enc(v){ return encodeURIComponent(v) }
async function j(f){ var r=await f; if(r.status===401){ showGate(); throw new Error('unauthorized') }
  var t=await r.json(); if(!r.ok) throw new Error(t.error||('HTTP '+r.status)); return t }
function showGate(){ document.getElementById('gate').style.display='flex'; try{document.getElementById('tokenInput').focus()}catch(e){} }
async function submitToken(){ tok=document.getElementById('tokenInput').value.trim(); if(!tok) return
  sessionStorage.setItem('dsh-file-share-token',tok); document.getElementById('gate').style.display='none'; refresh() }
function toast(s){ var m=document.getElementById('msg'); m.textContent=s; m.classList.add('show'); setTimeout(function(){m.classList.remove('show')},1800) }
function fmt(n){ if(n==null) return ''; if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB' }
async function refresh(){
  try{ var meta=await j(fetch('/api/status?'+qs()))
    metaReadOnly=meta.readOnly
    document.getElementById('meta').textContent='根目录: '+meta.root+(meta.readOnly?' · 只读':'')+(meta.hideSensitive?' · 隐藏敏感文件':'')
    var btns=document.querySelectorAll('#btnUpload,#btnMkdir'); btns.forEach(function(b){b.style.display=meta.readOnly?'none':''})
    var d=await j(fetch('/api/list?path='+enc(cur)+'&'+qs()))
    renderCrumb(d.dir); renderList(d.entries)
  }catch(e){ document.getElementById('list').innerHTML='<div class="empty">加载失败: '+e.message+'</div>' }
}
function renderCrumb(dir){
  var el=document.getElementById('crumb'); el.innerHTML=''
  var parts=dir?dir.split('/').filter(Boolean):[]
  var acc=''
  function push(label,rel){ var a=document.createElement('a'); a.textContent=label; a.onclick=function(){cur=rel;refresh()}; el.appendChild(a); el.appendChild(document.createTextNode(' / ')) }
  push('根', ''); parts.forEach(function(p,i){acc=join(acc,p);push(p,acc)})
  if(el.lastChild) el.removeChild(el.lastChild)
}
function renderList(entries){
  var el=document.getElementById('list'); el.innerHTML=''
  document.getElementById('empty').style.display=(!entries||entries.length===0)?'':'none'
  if(!entries||entries.length===0) return
  entries.forEach(function(e){
    var r=document.createElement('div'); r.className='row'
    var ic=document.createElement('span'); ic.className='ic'; ic.textContent=e.type==='dir'?'📁':'📄'; r.appendChild(ic)
    var nm=document.createElement('span'); nm.className='nm'+(e.type==='dir'?' folder':''); nm.textContent=e.name; nm.title=e.name
    if(e.type==='dir') nm.onclick=function(){cur=join(cur,e.name);refresh()}
    r.appendChild(nm)
    var sz=document.createElement('span'); sz.className='sz'; sz.textContent=e.type==='dir'?'':fmt(e.size); r.appendChild(sz)
    var ops=document.createElement('span'); ops.className='ops'
    var dl=document.createElement('button'); dl.className='btn'; dl.textContent='下载'; dl.onclick=function(){ var u=e.type==='dir'?'/api/download-zip?path=':'/api/download?path='; location.href=u+enc(join(cur,e.name))+'&'+qs() }
    ops.appendChild(dl)
    if(!metaReadOnly){
      var rn=document.createElement('button'); rn.className='btn'; rn.textContent='改名'; rn.onclick=function(){renameNow(join(cur,e.name),e.name)}
      ops.appendChild(rn)
      var de=document.createElement('button'); de.className='btn danger'; de.textContent='删除'; de.onclick=function(){if(confirm('删除 '+e.name+' ？'+(e.type==='dir'?'（含全部内容）':''))) delNow(join(cur,e.name))}
      ops.appendChild(de)
    }
    r.appendChild(ops); el.appendChild(r)
  })
}
function pickUpload(){ document.getElementById('file').click() }
async function doUpload(files){
  if(!files||!files.length) return
  for(var i=0;i<files.length;i++){ var f=files[i]; try{
    await j(fetch('/api/upload?path='+enc(cur)+'&name='+enc(f.name)+'&'+qs(),{method:'POST',body:f}))
    toast('已上传 '+f.name)
  }catch(e){ toast('上传 '+f.name+' 失败: '+e.message) } }
  refresh()
}
async function mkdirNow(){ var n=prompt('新建文件夹名:'); if(!n) return
  try{ await j(fetch('/api/mkdir?path='+enc(join(cur,n))+'&'+qs(),{method:'POST'})); refresh() }catch(e){ alert(e.message) } }
async function renameNow(rel,oldName){ var n=prompt('改名为:',oldName); if(!n||n===oldName) return
  var idx=rel.lastIndexOf('/'); var base=idx>=0?rel.slice(0,idx):''
  try{ await j(fetch('/api/rename?from='+enc(rel)+'&to='+enc(join(base,n))+'&'+qs(),{method:'POST'})); refresh() }catch(e){ alert(e.message) } }
async function delNow(rel){ try{ await j(fetch('/api/delete?path='+enc(rel)+'&'+qs(),{method:'DELETE'})); refresh() }catch(e){ alert(e.message) } }
var metaReadOnly=false
refresh()
</script>
</body>
</html>
`

/**
 * 统一路由分发（不校验 token；由调用方决定是否先过门禁）。
 * 同一个 url 对象被两个入口复用：
 *  - LAN 独立端口：handleRequest() 解析 + 限流 + token 门禁后调用；
 *  - 宿主同源 /dsh-file-share/api：把 req.url 的前缀剥掉后直接调用（无重复门禁）。
 * opts: { root, readOnly, hideSensitive, port, host, publicUrl, maxBytes, serverRunning }
 */
async function routeShare(req, res, url, opts) {
  applyCors(res)
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const p = url.pathname.replace(/\/+$/, '') || '/'
  try {
    if (req.method === 'GET' && p === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(HTML_PAGE)
      return
    }
    if (req.method === 'GET' && p === '/api/status') { sendJson(res, 200, statusPayload(opts)); return }
    if (req.method === 'GET' && p === '/api/list') {
      const rel = url.searchParams.get('path') || ''
      sendJson(res, 200, { root: path.resolve(opts.root || ''), dir: rel.replace(/^\/+/, ''), entries: listDir(opts.root, rel, opts.hideSensitive !== false) })
      return
    }
    if (req.method === 'GET' && p === '/api/download') {
      sendDownload(req, res, opts.root, url.searchParams.get('path') || '', opts.hideSensitive !== false)
      return
    }
    if (req.method === 'GET' && p === '/api/download-zip') {
      sendDownloadZip(res, opts.root, url.searchParams.getAll('path'), {
        hideSensitive: opts.hideSensitive !== false,
        zipMaxEntries: opts.zipMaxEntries,
        zipMaxBytes: opts.zipMaxBytes,
        name: url.searchParams.get('name') || '',
      })
      return
    }
    if (req.method === 'POST' && p === '/api/upload') {
      if (opts.readOnly) { sendJson(res, 403, { error: 'read-only' }); return }
      const result = await receiveUpload(req, res, opts.root, url.searchParams.get('path') || '', url.searchParams.get('name') || '', { hideSensitive: opts.hideSensitive !== false, maxBytes: opts.maxBytes })
      sendJson(res, 201, result)
      return
    }
    if (req.method === 'POST' && p === '/api/mkdir') {
      if (opts.readOnly) { sendJson(res, 403, { error: 'read-only' }); return }
      sendJson(res, 201, mkdirEntry(opts.root, url.searchParams.get('path') || ''))
      return
    }
    if (req.method === 'POST' && p === '/api/rename') {
      if (opts.readOnly) { sendJson(res, 403, { error: 'read-only' }); return }
      sendJson(res, 200, renameEntry(opts.root, url.searchParams.get('from') || '', url.searchParams.get('to') || ''))
      return
    }
    if (req.method === 'DELETE' && p === '/api/delete') {
      if (opts.readOnly) { sendJson(res, 403, { error: 'read-only' }); return }
      sendJson(res, 200, deleteEntry(opts.root, url.searchParams.get('path') || ''))
      return
    }
    sendJson(res, 404, { error: 'not found' })
  } catch (e) {
    if (e instanceof ShareError) { sendJson(res, e.status, { error: e.message }); return }
    sendJson(res, 500, { error: String((e && e.message) || e) })
  }
}

/** 独立共享服务器入口：解析 + 每 IP 限流 + token 门禁 → routeShare。 */
async function handleRequest(req, res, opts) {
  let url
  try { url = new URL(req.url || '/', 'http://share.local') } catch { sendJson(res, 400, { error: 'bad url' }); return }
  const p = url.pathname.replace(/\/+$/, '') || '/'
  if (opts.enforceToken !== false) {
    const limiter = makeLimiter(opts.limitPerMin)
    const limitErr = limiter(req.socket.remoteAddress || '?')
    if (limitErr) { sendJson(res, limitErr.status, { error: limitErr.message }); return }
    const ok = tokenOk(extractToken(req, url), opts.token)
    if (!ok) {
      if (p === '/') { // 页面本身先给出来，由页面 JS 引导输口令
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(HTML_PAGE)
        return
      }
      sendJson(res, 401, { error: 'unauthorized' })
      return
    }
  }
  await routeShare(req, res, url, opts)
}

/** 独立共享服务器工厂（listen 由调用方控制）。 */
function createShareServer(opts) {
  return http.createServer((req, res) => {
    handleRequest(req, res, opts).catch((e) => {
      try { sendJson(res, 500, { error: String((e && e.message) || e) }) } catch {}
    })
  })
}

module.exports = {
  VERSION, MAX_LIST_ENTRIES, MAX_ZIP_ENTRIES, MAX_ZIP_UNCOMPRESSED, ShareError,
  isHiddenName, relIsHidden, ensureRoot,
  resolveExisting, resolveCreatable,
  listDir, sendDownload, sendDownloadZip, buildZip, receiveUpload, mkdirEntry, renameEntry, deleteEntry,
  tokenOk, extractToken, makeLimiter, statusPayload,
  routeShare, handleRequest, createShareServer, HTML_PAGE,
}
