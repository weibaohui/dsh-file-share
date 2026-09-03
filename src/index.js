'use strict'

/**
 * @weibaohui/dsh-file-share — Host half
 *
 * 把「任意一个可配置的目录」变成可在线管理的共享区：
 *  - settings 命名空间 dsh-file-share：root(共享根，空=停用) / port / host /
 *    readOnly / hideSensitive / token(留空=启动时自动生成) / maxBytes / limitPerMin；
 *  - 独立 node:http 共享服务器（token 门禁 + 限流 + 路径边界 + 只读），
 *    手机/其他电脑浏览器打开 http://<host>:<port> 即可浏览/上传/下载/建夹/改名/删除；
 *  - 宿主同源路由 /dsh-file-share/api：同一核心、不再重复门禁，给 dsh Web 客户端 UI 用
 *    （上传/下载/管理 + 状态查询，设置页填好 root 后无需重启）；
 *  - file_share_status / file_share_list / file_share_reload 三个模型可调工具；
 *  - 每 2s 一次轻量 reconcile：settings 变化（root/端口/只读/token 等）自动生效。
 *
 * 依赖宿主服务全部可选加载；任何失败只降级日志，不让宿主 boot 失败。
 */

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')

const core = require('./share-core')

const name = 'dsh-file-share'
const inject = ['settings', 'tools', 'webServer']

const VERSION = core.VERSION
const NS = 'dsh-file-share'

const DEFAULTS = {
  root: '',
  port: 3988,
  host: '127.0.0.1',
  token: '',
  readOnly: false,
  hideSensitive: true,
  maxBytes: 0, // 0 = 不限
  limitPerMin: 240,
}

// ── 宿主依赖加载（schemastery / defineTool，从宿主安装目录解析，规避 pnpm 软链）──
function loadFromHost(relPath) {
  for (const prefix of [process.env.DSH_GLOBAL_PREFIX, path.join(os.homedir(), '.local')].filter(Boolean)) {
    const hostCopy = path.join(prefix, 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', relPath)
    try { return createRequire(hostCopy)(hostCopy) } catch (e) { /* try next prefix */ }
  }
  return null
}

function loadSchemastery() {
  // schemastery 的 CJS 导出即 Schema 函数本身（module.exports = Schema），
  // 静态方法 .string/.object/.boolean 挂在它上面；没有 .Schema 属性。
  const m = loadFromHost('@deepseek-ai/schemastery/lib/index.cjs')
  return m && typeof m.string === 'function' && typeof m.object === 'function' ? m : null
}

function loadDefineTool() {
  const m = loadFromHost('@deepseek-ai/dsh-tools/lib/index.js')
  return m && typeof m.defineTool === 'function' ? m.defineTool : null
}

function buildSettingsSchema(Schema) {
  if (!Schema) return null
  try {
    return Schema.object({
      root: Schema.string().description('共享根目录（绝对路径；留空=停用共享服务器）'),
      port: Schema.number().min(1024).max(65535).default(DEFAULTS.port).description('共享服务器监听端口'),
      host: Schema.string().default(DEFAULTS.host).description('监听地址：127.0.0.1=仅本机；0.0.0.0=局域网可见'),
      token: Schema.string().description('访问口令（留空=每次启动自动生成随机口令）'),
      readOnly: Schema.boolean().default(DEFAULTS.readOnly).description('只读模式：禁止上传/新建/改名/删除'),
      hideSensitive: Schema.boolean().default(DEFAULTS.hideSensitive).description('隐藏 .env/.git/node_modules/*.pem 等敏感文件'),
      maxBytes: Schema.number().default(DEFAULTS.maxBytes).description('单文件上传上限字节（0=不限）'),
      limitPerMin: Schema.number().default(DEFAULTS.limitPerMin).description('每 IP 每分钟请求上限（0=不限）'),
    })
  } catch (e) {
    return null
  }
}

function runtimeToken() {
  return crypto.randomBytes(12).toString('hex') // 24 hex chars
}

module.exports = {
  name,
  inject,
  version: VERSION,

  apply(ctx, config = {}) {
    const logger = ctx.logger || { info() {}, warn() {}, error() {} }
    const webServer = ctx.webServer
    const Schema = loadSchemastery()
    const defineTool = loadDefineTool()

    // ── settings 命名空间 ─────────────────────────────────────────────
    let settingsScope = null
    if (ctx.settings && typeof ctx.settings.register === 'function') {
      try {
        settingsScope = ctx.settings.register(NS, buildSettingsSchema(Schema), { base: { ...DEFAULTS, ...config } })
      } catch (e) {
        logger.warn(`dsh-file-share: settings register 失败: ${e && e.message}`)
      }
    }
    const effective = () => {
      if (settingsScope && typeof settingsScope.get === 'function') {
        const v = settingsScope.get()
        if (v && typeof v === 'object') return { ...DEFAULTS, ...config, ...v }
      }
      return { ...DEFAULTS, ...config }
    }

    // ── 共享服务器生命周期 ─────────────────────────────────────────────
    const share = { server: null, listening: false, token: null, key: '', error: null, lastFailAt: 0, reconciling: false }
    const statusNow = () => {
      const eff = effective()
      const rootStr = String(eff.root || '').trim()
      return {
        version: VERSION,
        enabled: Boolean(rootStr),
        running: Boolean(rootStr) && share.listening,
        root: rootStr,
        readOnly: Boolean(eff.readOnly),
        hideSensitive: eff.hideSensitive !== false,
        host: eff.host,
        port: eff.port,
        maxBytes: eff.maxBytes || 0,
        token: share.token, // 自动生成或用户配置；仅在已配置 root 时有意义
        url: rootStr ? `http://${eff.host}:${eff.port}` : null,
        error: share.error || (rootStr && !share.listening ? '共享服务器未在监听（可能端口被占用）' : null),
      }
    }

    const stopServer = () => new Promise((resolve) => {
      if (!share.server) { share.listening = false; resolve(); return }
      const s = share.server
      share.server = null
      share.listening = false
      share.token = null
      try { s.close(() => resolve()) } catch (e) { resolve() }
      // 兜底：close 若无活动连接立即回调；若卡住由 gc/进程兜底，不阻塞 reconcile
      setTimeout(() => { try { s.closeAllConnections && s.closeAllConnections() } catch {} }, 1500).unref()
    })

    const startServer = async (eff, rootStr) => {
      const port = Number(eff.port) || DEFAULTS.port
      const host = String(eff.host || DEFAULTS.host)
      const token = String(eff.token || '').trim() || runtimeToken()
      const opts = {
        root: rootStr,
        enforceToken: true,
        token,
        readOnly: Boolean(eff.readOnly),
        hideSensitive: eff.hideSensitive !== false,
        maxBytes: eff.maxBytes > 0 ? eff.maxBytes : undefined,
        limitPerMin: Number(eff.limitPerMin) || 0,
        port,
        host,
        publicUrl: `http://${host}:${port}`,
        serverRunning: true,
      }
      const server = core.createShareServer(opts)
      share.server = server
      share.token = token
      share.error = null
      server.on('error', (e) => {
        share.error = String((e && e.message) || e)
        share.listening = false
        share.lastFailAt = Date.now()
        logger.warn(`dsh-file-share: 共享服务器错误: ${share.error}`)
      })
      await new Promise((resolve) => {
        server.listen(port, host, () => {
          share.listening = true
          share.error = null
          const addr = server.address()
          logger.info(`dsh-file-share: 共享服务器已启动 http://${host}:${addr && addr.port} 根=${rootStr}`)
          resolve()
        })
        server.once('error', resolve) // 让 listen 失败也能继续 reconcile（错误由 error 回调记录）
      })
    }

    const reconcile = async (force = false) => {
      if (share.reconciling) return
      share.reconciling = true
      try {
        const eff = effective()
        const rootStr = String(eff.root || '').trim()
        const key = rootStr ? [rootStr, eff.port, eff.host, eff.readOnly, eff.hideSensitive, eff.token, eff.maxBytes, eff.limitPerMin].join('|') : 'off'
        const changed = force || key !== share.key
        if (rootStr && (changed || (!share.listening && Date.now() - share.lastFailAt > 10000))) {
          if (share.server) await stopServer()
          share.key = key
          await startServer(eff, rootStr)
        } else if (!rootStr) {
          if (share.server) await stopServer()
          share.key = 'off'
          share.error = null
        }
      } catch (e) {
        logger.warn(`dsh-file-share: reconcile 失败: ${e && e.message}`)
      } finally {
        share.reconciling = false
      }
    }

    // 每 2s 轻量对齐 settings（root/端口/只读/token 变更自动生效，无需重启宿主）
    const timer = setInterval(() => { void reconcile() }, 2000)
    timer.unref && timer.unref()

    // ── 工具注册 ──────────────────────────────────────────────────────
    const disposers = []
    if (defineTool && ctx.tools && typeof ctx.tools.register === 'function') {
      const defs = []
      defs.push(defineTool({
        name: 'file_share_status',
        description: '查询「目录共享」插件的共享服务器状态：是否启用、共享根目录、访问地址与口令、只读/隐藏敏感文件等。想用浏览器给别人传文件前先查这里拿地址和 token。',
        timeoutMs: 10000,
        parameters: {},
        output: {
          schema: { type: 'object', additionalProperties: true, properties: { enabled: { type: 'boolean' }, running: { type: 'boolean' } } },
          render(args, value) {
            const s = value
            const lines = []
            if (!s.enabled) lines.push('目录共享未启用：请在设置里给 dsh-file-share.root 填一个绝对路径作为共享根。')
            else if (!s.running) lines.push(`共享服务器未运行：${s.error || ''}`)
            else {
              lines.push(`共享根: ${s.root}`)
              lines.push(`访问地址: ${s.url}?token=${s.token}`)
              lines.push(`只读: ${s.readOnly ? '是' : '否'} · 隐藏敏感文件: ${s.hideSensitive ? '是' : '否'} · 单文件上限: ${s.maxBytes ? s.maxBytes + 'B' : '不限'}`)
              lines.push('把上面的完整地址（含 token）发给对方，用浏览器即可浏览/上传/下载。')
            }
            return [{ type: 'text', text: lines.join('\n') }]
          },
        },
        async execute() { return statusNow() },
      }))
      defs.push(defineTool({
        name: 'file_share_list',
        description: '列出「目录共享」共享根下某个子目录的内容（不越出共享根）。参数 dir 为相对共享根的路径，空串=根目录。',
        timeoutMs: 15000,
        parameters: {
          dir: { type: 'string', description: '相对共享根的目录路径（空串=根目录）' },
        },
        output: {
          schema: {
            type: 'object', additionalProperties: true,
            properties: {
              root: { type: 'string' }, dir: { type: 'string' },
              entries: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
          render(args, value) {
            if (!value.root) return [{ type: 'text', text: '目录共享未启用（root 未配置）。' }]
            const head = `共享根 ${value.root}${value.dir ? '/' + value.dir : ''}`
            if (!value.entries || value.entries.length === 0) return [{ type: 'text', text: head + '\n（空目录）' }]
            const lines = value.entries.slice(0, 40).map((e) => `${e.type === 'dir' ? '[D]' : '   '} ${e.name}${e.type === 'file' ? '  ' + (e.size != null ? e.size + 'B' : '') : ''}`)
            return [{ type: 'text', text: [head, ...lines, value.entries.length > 40 ? `… 共 ${value.entries.length} 项` : ''].filter(Boolean).join('\n') }]
          },
        },
        async execute(args) {
          const st = statusNow()
          if (!st.enabled) return { root: '', dir: '', entries: [] }
          try {
            const entries = core.listDir(st.root, String(args.dir || ''), st.hideSensitive)
            return { root: st.root, dir: String(args.dir || '').replace(/^\/+/, ''), entries: entries.slice(0, 200) }
          } catch (e) {
            return { root: st.root, dir: String(args.dir || ''), error: String((e && e.message) || e), entries: [] }
          }
        },
      }))
      defs.push(defineTool({
        name: 'file_share_reload',
        description: '立即按最新设置重建「目录共享」的共享服务器（改了 root/端口/口令等设置后，不想等 2 秒自动生效时可手动触发）。返回重建后的状态。',
        timeoutMs: 30000,
        parameters: {},
        output: {
          schema: { type: 'object', additionalProperties: true, properties: { enabled: { type: 'boolean' }, running: { type: 'boolean' } } },
          render(args, value) {
            return [{ type: 'text', text: value.running ? `共享服务器已重建：${value.url}?token=${value.token}` : (value.enabled ? `重建未成功：${value.error || ''}` : '目录共享未启用（root 未配置）。') }]
          },
        },
        async execute() {
          await reconcile(true)
          return statusNow()
        },
      }))
      for (const def of defs) {
        try { disposers.push(ctx.tools.register(def)) } catch (e) {
          logger.warn(`dsh-file-share: register tool ${def && def.name} 失败: ${e && e.message}`)
        }
      }
    } else {
      logger.warn('dsh-file-share: defineTool 或 ctx.tools 不可用，file_share_* 工具未注册')
    }

    // ── systemPrompt 段（可选；缺服务时跳过）─────────────────────────
    let systemPrompt = null
    try { if (typeof ctx.get === 'function') systemPrompt = ctx.get('systemPrompt') } catch (e) {}
    if (systemPrompt && typeof systemPrompt.section === 'function') {
      ctx.effect(() => {
        systemPrompt.section({
          name: 'dsh-file-share',
          order: 62,
          text: '可用 file_share_status / file_share_list 工具查询「目录共享」插件的共享目录与访问口令；file_share_status 返回的 http://…?token=… 地址可发给用户，用浏览器即可浏览/上传/下载共享根下的文件。',
        })
      }, 'dsh-file-share: prompt section')
    }

    // ── 宿主同源路由 /dsh-file-share/api（给 dsh Web 客户端 UI，无重复门禁）─
    if (webServer && typeof webServer.register === 'function') {
      ctx.effect(() => {
        webServer.register({
          kind: 'prefix',
          path: '/dsh-file-share/api',
          handler: async (req, res) => {
            const sendJson = (status, payload) => {
              const body = JSON.stringify(payload)
              res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' })
              res.end(body)
            }
            try {
              const url = new URL(req.url || '/', 'http://dsh.local')
              const p = url.pathname
              const rest = p.startsWith('/dsh-file-share/api') ? p.slice('/dsh-file-share/api'.length) : p
              if (!p.startsWith('/dsh-file-share/api')) { sendJson(404, { error: 'not found' }); return }
              const eff = effective()
              const rootStr = String(eff.root || '').trim()
              if (req.method === 'GET' && (rest === '' || rest === '/' || rest === '/status')) { sendJson(200, statusNow()); return }
              if (!rootStr) { sendJson(503, { error: '共享根目录未配置：请在设置 dsh-file-share.root 填绝对路径' }); return }
              // 核心路由以 /api/* 为基准；同源挂载点剥掉前缀后要拼回 /api
              const corePath = '/api' + rest
              const inner = new URL(corePath + (url.search || ''), 'http://dsh.local')
              await core.routeShare(req, res, inner, {
                root: rootStr,
                enforceToken: false,
                token: null,
                readOnly: Boolean(eff.readOnly),
                hideSensitive: eff.hideSensitive !== false,
                maxBytes: eff.maxBytes > 0 ? eff.maxBytes : undefined,
                serverRunning: Boolean(share.listening),
                port: eff.port,
                host: eff.host,
                publicUrl: `http://${eff.host}:${eff.port}`,
              })
            } catch (e) {
              try { sendJson(500, { error: String((e && e.message) || e) }) } catch {}
            }
          },
        })
      }, 'dsh-file-share: same-origin api route')
    }

    // ── cleanup ──────────────────────────────────────────────────────
    ctx.effect(() => () => {
      clearInterval(timer)
      for (const d of disposers) { try { d() } catch {} }
      try { if (share.server) share.server.close() } catch {}
    }, 'dsh-file-share: cleanup')

    // 启动对齐一次（root 已配置则直接起服务器）
    void reconcile()

    // 不 return 任何值——cordis-plugin-loader 把 apply 的返回值当作 disposable/effect。
  },
}
