/* Generated from client/index.js by scripts/build-client.mjs — do not edit by hand.
 * Regenerate with: npm run build:client
 */
window.__ModuleLoader__.load({
  id: "@weibaohui/dsh-file-share",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })
    var React = require("react")
    'use strict'

    /**
     * @weibaohui/dsh-file-share — Client half (v2: 会话工作区文件管理 tab)
     *
     * 在对话区顶部 tab（conversation.view）注册「文件」：
     *  点开显示当前会话工作区的目录树，就地管理——
     *  上传（到当前目录）/ 下载 / 新建文件夹 / 改名 / 删除 / 搜索过滤 / 树形展开；
     *  文件行「@」把 @绝对路径 注入 composer，让 agent 直接处理该文件。
     *
     * 数据通道：宿主同源路由 /dsh-file-share/api（带 sessionId，服务端以会话工作区为根）。
     */

    const API = '/dsh-file-share/api'

    const styles = {
      _head: null,
      insert(css) {
        if (typeof document === 'undefined') return
        if (!this._head) {
          const style = document.createElement('style')
          style.setAttribute('data-plugin', 'dsh-file-share')
          document.head.appendChild(style)
          this._head = style
        }
        this._head.textContent = css
      },
    }

    styles.insert(`
    .fs-root{display:flex;flex-direction:column;gap:14px;padding:16px 20px;overflow:hidden;height:100%;min-height:240px;color:var(--dsw-alias-label-primary);box-sizing:border-box}
    .fs-head{display:flex;flex-direction:column;gap:6px}
    .fs-title{font-size:14px;font-weight:600;margin:0;display:flex;align-items:center;gap:8px}
    .fs-path{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));word-break:break-all;font-family:var(--ds-font-family-code,ui-monospace,monospace)}
    .fs-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .fs-cur{font-size:12px;color:var(--dsw-alias-label-secondary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .fs-btn{font-size:12px;padding:4px 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;transition:background .16s,border-color .16s;flex:none}
    .fs-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,var(--dsw-alias-border-l2))}
    .fs-btn:disabled{opacity:.5;cursor:default}
    .fs-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 32%,var(--dsw-alias-border-l2))}
    .fs-search{width:160px;padding:4px 9px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;flex:none}
    .fs-body{flex:1;min-height:0;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:6px}
    .fs-row{display:flex;align-items:center;gap:6px;border-radius:7px;padding:3px 6px;font-size:13px;line-height:1.9}
    .fs-row:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent)}
    .fs-row[data-cur="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
    .fs-caret{flex:none;width:14px;text-align:center;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));cursor:pointer;user-select:none;font-size:11px}
    .fs-ic{flex:none;width:18px;text-align:center}
    .fs-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}
    .fs-nm.dir{cursor:pointer;font-weight:500}
    .fs-sz{flex:none;width:72px;text-align:right;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;font-variant-numeric:tabular-nums}
    .fs-ops{display:none;gap:5px;flex:none}
    .fs-row:hover .fs-ops{display:flex}
    .fs-ops a,.fs-ops button{font-size:11px;padding:1px 7px;border-radius:6px;text-decoration:none;color:var(--dsw-alias-label-secondary);border:1px solid transparent;background:transparent;cursor:pointer}
    .fs-ops a:hover,.fs-ops button:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent)}
    .fs-ops .at{color:var(--dsw-alias-brand-primary)}
    .fs-ops .danger{color:var(--dsw-alias-state-error-primary)}
    .fs-empty{padding:30px 0;text-align:center;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:12px}
    .fs-check{flex:none;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;margin:0 2px}
    .fs-selbar{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-border-l2));border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent);font-size:12px;flex:none}
    .fs-selbar .spacer{flex:1}
    .fs-selbar .muted{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
    .fs-note{padding:5px 8px;font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));border-top:1px solid var(--dsw-alias-border-l2)}
    input.fs-file{display:none}
    .fs-spin{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:12px;padding:8px}
    /* 预览浮层 */
    .fs-pv-backdrop{position:fixed;inset:0;z-index:2147483200;background:rgba(0,0,0,.42)}
    .fs-pv{position:fixed;z-index:2147483201;left:50%;top:50%;transform:translate(-50%,-50%);width:min(860px,92vw);height:min(70vh,560px);display:flex;flex-direction:column;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l2));border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 10px 30px rgba(0,0,0,.3));overflow:hidden}
    .fs-pv-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
    .fs-pv-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .fs-pv-sub{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));flex:none;font-variant-numeric:tabular-nums}
    .fs-pv-body{flex:1;min-height:0;overflow:auto;padding:12px 14px;background:var(--dsw-alias-bg-layer-1)}
    .fs-pv-body pre{margin:0;font:12px/1.7 var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;tab-size:2}
    .fs-pv-body img{max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto}
    .fs-pv-empty{padding:36px 0;text-align:center;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:13px}
    .fs-pv-foot{display:flex;gap:8px;align-items:center;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l2);flex:none}
    .fs-pv-foot .spacer{flex:1}
    `)

    async function readJson(response) {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error((payload && payload.error) || `HTTP ${response.status}`)
      return payload
    }

    function fmtSize(n) {
      if (n == null) return ''
      if (n < 1024) return n + ' B'
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1048576).toFixed(1) + ' MB'
    }

    function joinRel(a, b) { return (a ? a + '/' : '') + b }

    const S = (sid, extra) => {
      const p = new URLSearchParams(extra || {})
      p.set('sessionId', sid)
      return p.toString()
    }

    let sessionsSvc = null // 会话服务（@ 成功后切回对话 tab；动态 inject）

    /** @绝对路径 → composer（工作区文件可被宿主 file-reference 解析）。\n *  composer 双形态兼容：textarea（旧）/ contenteditable 输入区（2026-09 新组合——只找 textarea 会静默退化成剪贴板，dsh-kb v0.3.1 同款修法）。 */
    function insertFileRef(sessionId, abs) {
      const text = '@' + abs + ' '
      try {
        const card = document.querySelector('[data-composer-card]')
        const ta = card && card.querySelector('textarea')
        const ce = card && (card.querySelector('[contenteditable="true"]') || card.querySelector('[contenteditable=""]'))
        if (typeof document.execCommand === 'function' && (ta || ce)) {
          if (ta) {
            ta.focus()
            const len = ta.value ? ta.value.length : 0
            try { ta.setSelectionRange(len, len) } catch {}
          } else if (ce) {
            ce.focus()
            const sel = window.getSelection()
            const range = document.createRange()
            range.selectNodeContents(ce)
            range.collapse(false) // 光标到末尾
            sel.removeAllRanges()
            sel.addRange(range)
          }
          if (document.execCommand('insertText', false, text)) return 'ok'
        }
      } catch {}
      try { navigator.clipboard.writeText(text) } catch {}
      return 'copied'
    }

    const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'])
    const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'csv', 'tsv', 'env', 'xml', 'html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue', 'svelte', 'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cc', 'sh', 'bash', 'zsh', 'fish', 'sql', 'ps1', 'bat', 'cmake', 'dockerfile', 'makefile', 'properties', 'gitignore', 'editorconfig'])
    const TEXT_PREVIEW_LIMIT = 512 * 1024
    const IMAGE_PREVIEW_LIMIT = 32 * 1024 * 1024

    function extOf(name) {
      const i = String(name || '').lastIndexOf('.')
      return i >= 0 ? String(name).slice(i + 1).toLowerCase() : ''
    }

    /** 文件预览浮层：文本/代码直显、图片内联、超限或不支持给下载/@。 */
    function FilePreviewOverlay(props) {
      const h = React.createElement
      const { sessionId, workspace, rel, name, size, onClose, onAt } = props
      const ext = extOf(name)
      const kind = IMAGE_EXT.has(ext) ? 'img' : (TEXT_EXT.has(ext) || ext === '' ? 'text' : 'unknown')
      const [state, setState] = React.useState({ status: 'loading' })

      React.useEffect(() => {
        let alive = true
        let objectUrl = null
        setState({ status: 'loading' })
        const run = async () => {
          try {
            const isImg = kind === 'img'
            const limit = isImg ? IMAGE_PREVIEW_LIMIT : TEXT_PREVIEW_LIMIT
            if (typeof size === 'number' && size > limit) { if (alive) setState({ status: 'too-big', kind }); return }
            const res = await fetch(`${API}/download?path=${encodeURIComponent(rel)}&${S(sessionId)}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const blob = await res.blob()
            if (!alive) return
            if (isImg) {
              objectUrl = URL.createObjectURL(blob)
              setState({ status: 'img', url: objectUrl })
            } else if (kind === 'text') {
              setState({ status: 'text', text: await blob.text() })
            } else {
              setState({ status: 'unknown' })
            }
          } catch (e) {
            if (alive) setState({ status: 'error', message: String((e && e.message) || e) })
          }
        }
        void run()
        return () => { alive = false; if (objectUrl) { try { URL.revokeObjectURL(objectUrl) } catch {} } }
      }, [rel, name])

      React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !(e.isComposing === true)) onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [])

      const body = () => {
        if (state.status === 'loading') return h('div', { className: 'fs-pv-empty' }, '加载预览…')
        if (state.status === 'text') return h('pre', null, state.text)
        if (state.status === 'img') return h('img', { src: state.url, alt: name })
        if (state.status === 'too-big') return h('div', { className: 'fs-pv-empty' }, `文件过大（${fmtSize(size)}），不支持在线预览，请下载或 @ 给 agent 查看。`)
        if (state.status === 'unknown') return h('div', { className: 'fs-pv-empty' }, `暂不支持预览 .${ext} 类型，请下载或 @ 给 agent 处理。`)
        return h('div', { className: 'fs-pv-empty' }, `预览失败：${state.message || ''}`)
      }

      return h('div', { className: 'fs-pv-backdrop', onClick: onClose },
        h('div', { className: 'fs-pv', onClick: (e) => e.stopPropagation() },
          h('div', { className: 'fs-pv-head' },
            h('span', { className: 'fs-pv-title', title: rel }, name),
            h('span', { className: 'fs-pv-sub' }, size != null ? fmtSize(size) : ''),
            h('button', { className: 'fs-btn', onClick: onClose }, '✕'),
          ),
          h('div', { className: 'fs-pv-body' }, body()),
          h('div', { className: 'fs-pv-foot' },
            h('a', { className: 'fs-btn', style: { textDecoration: 'none' }, href: `${API}/download?path=${encodeURIComponent(rel)}&${S(sessionId)}` }, '下载'),
            h('button', { className: 'fs-btn', style: { color: 'var(--dsw-alias-brand-primary)' }, onClick: () => onAt(rel, name) }, '@ 给 agent'),
            h('span', { className: 'spacer' }),
            h('span', { className: 'fs-path', style: { maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' } }, workspace ? `${workspace}/${rel}` : rel),
          ),
        ),
      )
    }

    /** conversation.view「文件」tab。 */
    function FileManagerTab(props) {
      const h = React.createElement
      const sessionId = props && props.sessionId
      const [ws, setWs] = React.useState(null)          // { ok, workspace }
      const [cur, setCur] = React.useState('')          // 当前目录（相对工作区）
      const [children, setChildren] = React.useState({}) // rel → {dirs, files} 懒加载缓存
      const [open, setOpen] = React.useState({})         // rel → true 展开
      const [query, setQuery] = React.useState('')
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [hint, setHint] = React.useState(null)
      const [reloadTick, setReloadTick] = React.useState(0)
      const [preview, setPreview] = React.useState(null) // { rel, name, size }
      const [sel, setSel] = React.useState(() => new Set()) // 勾选待打包的相对路径（文件/目录混选）

      const loadDir = async (rel, silent) => {
        if (!sessionId) return null
        if (!silent) setError(null)
        try {
          const d = await readJson(await fetch(`${API}/list?path=${encodeURIComponent(rel || '')}&${S(sessionId)}`))
          const entries = d.entries || []
          setChildren((prev) => ({ ...prev, [rel || '']: { dirs: entries.filter((e) => e.type === 'dir'), files: entries.filter((e) => e.type === 'file') } }))
          return d
        } catch (e) {
          if (!silent) setError(String((e && e.message) || e))
          return null
        }
      }

      React.useEffect(() => {
        if (!sessionId) return
        setWs(null); setError(null); setCur(''); setChildren({}); setOpen({}); setSel(new Set())
        fetch(`${API}/status?${S(sessionId)}`)
          .then(readJson)
          .then((s) => { setWs(s); return loadDir('', true) })
          .then(() => {})
          .catch((e) => setError(String((e && e.message) || e)))
      }, [sessionId, reloadTick])

      const toggleSel = (rel) => {
        setSel((prev) => {
          const next = new Set(prev)
          if (next.has(rel)) next.delete(rel)
          else next.add(rel)
          return next
        })
      }

      /** 打包下载（fetch→blob）：成功触发浏览器下载，失败在面板内报错，不用导航顶掉页面。 */
      const zipDownload = async (rels) => {
        const p = new URLSearchParams()
        for (const rel of rels) p.append('path', rel)
        p.set('sessionId', sessionId)
        setBusy(true); setError(null)
        try {
          const res = await fetch(`${API}/download-zip?${p.toString()}`)
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}))
            throw new Error((payload && payload.error) || `HTTP ${res.status}`)
          }
          const blob = await res.blob()
          let filename = 'download.zip'
          const m = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') || '')
          if (m) { try { filename = decodeURIComponent(m[1]) } catch {} }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => { try { URL.revokeObjectURL(url) } catch {} }, 5000)
          setHint(`已打包下载 ${filename}（${rels.length} 项）`)
          setTimeout(() => setHint(null), 3500)
        } catch (e) {
          setError(`打包下载失败：${(e && e.message) || e}`)
        } finally {
          setBusy(false)
        }
      }

      const toggle = (rel, name) => {
        const key = rel
        setCur(rel)
        if (open[key]) { setOpen((o) => ({ ...o, [key]: false })); return }
        setOpen((o) => ({ ...o, [key]: true }))
        if (!children[key]) void loadDir(rel, true)
      }

      const act = async (url, opts) => {
        setBusy(true); setError(null)
        try { await readJson(await fetch(url, opts)); return true }
        catch (e) { setError(String((e && e.message) || e)); return false }
        finally { setBusy(false) }
      }

      const mkdir = async () => {
        const n = window.prompt('新建文件夹名：')
        if (!n || !n.trim()) return
        const name = n.trim()
        const target = joinRel(cur, name)
        if (await act(`${API}/mkdir?path=${encodeURIComponent(target)}&${S(sessionId)}`, { method: 'POST' })) {
          if (open[cur] || !cur) await loadDir(cur, true)
        }
      }

      const upload = async (files) => {
        if (!files || !files.length) return
        setBusy(true)
        for (const f of Array.from(files)) {
          try {
            const r = await fetch(`${API}/upload?path=${encodeURIComponent(cur)}&name=${encodeURIComponent(f.name)}&${S(sessionId)}`, { method: 'POST', body: f })
            const payload = await r.json().catch(() => ({}))
            if (!r.ok) throw new Error((payload && payload.error) || `HTTP ${r.status}`)
          } catch (e) {
            setError(`上传 ${f.name} 失败：${(e && e.message) || e}`)
          }
        }
        setBusy(false)
        if (open[cur] || !cur) await loadDir(cur, true)
      }

      const rename = async (rel, name) => {
        const n = window.prompt('改名为：', name)
        if (!n || !n.trim() || n.trim() === name) return
        const idx = rel.lastIndexOf('/')
        const base = idx >= 0 ? rel.slice(0, idx) : ''
        if (await act(`${API}/rename?from=${encodeURIComponent(rel)}&to=${encodeURIComponent(joinRel(base, n.trim()))}&${S(sessionId)}`, { method: 'POST' })) {
          await loadDir(base, true)
        }
      }

      const remove = async (rel, name, isDir) => {
        if (!window.confirm(`删除 ${name} ？${isDir ? '（目录及其全部内容）' : ''}`)) return
        const parent = rel.indexOf('/') >= 0 ? rel.slice(0, rel.lastIndexOf('/')) : ''
        if (await act(`${API}/delete?path=${encodeURIComponent(rel)}&${S(sessionId)}`, { method: 'DELETE' })) {
          if (isDir) { setOpen((o) => { const n = { ...o }; delete n[rel]; return n }); setChildren((c) => { const n = { ...c }; delete n[rel]; return n }) }
          await loadDir(parent, true)
        }
      }

      const atRef = (rel, name) => {
        if (!ws || !ws.workspace) { setHint('工作区不可用'); return }
        const abs = ws.workspace.replace(/\/+$/, '') + '/' + joinRel(rel, name)
        const result = insertFileRef(sessionId, abs)
        if (result === 'ok') {
          // 切回对话 tab（会话深链 open 对当前会话即激活对话视图），草稿已就位
          try { if (sessionsSvc && typeof sessionsSvc.open === 'function') sessionsSvc.open(sessionId) } catch {}
        } else {
          setHint('无法自动插入，已复制到剪贴板，请在输入框粘贴')
          setTimeout(() => setHint(null), 3500)
        }
      }

      const openPreview = (rel, name, size) => setPreview({ rel, name, size })

      if (!sessionId) return h('div', { className: 'fs-root' }, h('p', { className: 'fs-empty' }, '无会话上下文'))
      if (!ws && !error) return h('div', { className: 'fs-root' }, h('div', { className: 'fs-spin' }, '加载工作区…'))
      if (ws && !ws.ok) {
        return h('div', { className: 'fs-root' },
          h('div', { className: 'fs-empty' }, `工作区不可用：${ws.error || ''}`),
        )
      }

      const q = query.trim().toLowerCase()
      const match = (name) => !q || name.toLowerCase().includes(q)

      /** 渲染 rel 目录的一层（dirs 在前；dirs 有子层则递归到 open 状态）。 */
      const renderLevel = (rel) => {
        const node = children[rel || '']
        const rows = []
        if (!node) return rows
        const shownDirs = node.dirs.filter((d) => match(d.name))
        const shownFiles = node.files.filter((f) => match(f.name))
        for (const d of shownDirs) {
          const sub = joinRel(rel, d.name)
          const isOpen = Boolean(open[sub])
          const isCur = cur === sub
          rows.push(h('div', { key: 'd:' + sub, className: 'fs-row', 'data-cur': isCur, style: { paddingLeft: 6 + rel.split('/').filter(Boolean).length * 16 } },
            h('input', { type: 'checkbox', className: 'fs-check', title: '选择以便打包下载', checked: sel.has(sub), onClick: (e) => e.stopPropagation(), onChange: () => toggleSel(sub) }),
            h('span', { className: 'fs-caret', onClick: () => toggle(sub, d.name) }, isOpen ? '▾' : '▸'),
            h('span', { className: 'fs-ic' }, '📁'),
            h('span', { className: 'fs-nm dir', title: d.name, onClick: () => toggle(sub, d.name) }, d.name),
            h('span', { className: 'fs-ops' },
              h('button', { onClick: (e) => { e.stopPropagation(); toggle(sub, d.name) } }, '进入'),
              h('button', { className: 'at', title: '@ 目录给 agent', onClick: (e) => { e.stopPropagation(); atRef(rel, d.name) } }, '@'),
              h('button', { disabled: busy, onClick: (e) => { e.stopPropagation(); void zipDownload([sub]) } }, '下载'),
              h('button', { onClick: (e) => { e.stopPropagation(); rename(sub, d.name) } }, '改名'),
              h('button', { className: 'danger', onClick: (e) => { e.stopPropagation(); remove(sub, d.name, true) } }, '删除'),
            ),
          ))
          if (isOpen) rows.push(...renderLevel(sub))
        }
        for (const f of shownFiles) {
          const rel2 = joinRel(rel, f.name)
          rows.push(h('div', { key: 'f:' + rel2, className: 'fs-row', style: { paddingLeft: 6 + (rel.split('/').filter(Boolean).length + 1) * 16 } },
            h('input', { type: 'checkbox', className: 'fs-check', title: '选择以便打包下载', checked: sel.has(rel2), onClick: (e) => e.stopPropagation(), onChange: () => toggleSel(rel2) }),
            h('span', { className: 'fs-caret' }),
            h('span', { className: 'fs-ic' }, '📄'),
            h('span', { className: 'fs-nm', title: `${f.name}（点击预览）`, style: { cursor: 'pointer' }, onClick: () => openPreview(rel2, f.name, f.size) }, f.name),
            h('span', { className: 'fs-sz' }, fmtSize(f.size)),
            h('span', { className: 'fs-ops' },
              h('button', { onClick: () => openPreview(rel2, f.name, f.size) }, '预览'),
              h('a', { href: `${API}/download?path=${encodeURIComponent(rel2)}&${S(sessionId)}` }, '下载'),
              h('button', { className: 'at', onClick: () => atRef(rel, f.name) }, '@'),
              h('button', { onClick: () => rename(rel2, f.name) }, '改名'),
              h('button', { className: 'danger', onClick: () => remove(rel2, f.name, false) }, '删除'),
            ),
          ))
        }
        return rows
      }

      const crumbParts = cur ? cur.split('/').filter(Boolean) : []
      const crumb = () => {
        const nodes = [h('a', { key: 'root', style: { cursor: 'pointer', color: 'var(--dsw-alias-brand-primary)' }, onClick: () => setCur('') }, '工作区')]
        let acc = ''
        crumbParts.forEach((p, i) => {
          acc = joinRel(acc, p)
          nodes.push(h('span', { key: 'sep' + i }, ' / '))
          nodes.push(h('a', { key: i, style: { cursor: 'pointer' }, onClick: () => setCur(acc) }, p))
        })
        return nodes
      }

      const rootChildrenLoaded = Boolean(children[''])

      return h('div', { className: 'fs-root' },
        h('div', { className: 'fs-head' },
          h('p', { className: 'fs-title' }, '📁 文件', h('span', { style: { fontSize: '11px', fontWeight: 400, color: 'var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))' } }, ws && ws.workspace ? '会话工作区' : '')),
          ws && ws.workspace && h('div', { className: 'fs-path', title: ws.workspace }, ws.workspace),
        ),
        h('div', { className: 'fs-bar' },
          h('div', { className: 'fs-cur' }, crumb()),
          h('input', { className: 'fs-search', placeholder: '过滤名称…', value: query, onChange: (e) => setQuery(e.target.value) }),
          h('button', { className: 'fs-btn', disabled: busy, onClick: () => setReloadTick((t) => t + 1) }, '刷新'),
          h('button', { className: 'fs-btn', disabled: busy, onClick: () => void mkdir() }, '新建文件夹'),
          h('label', { className: 'fs-btn', style: { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }, title: '上传到当前目录' },
            '上传', h('input', { type: 'file', multiple: true, className: 'fs-file', onChange: (e) => { void upload(e.target.files); e.target.value = '' } }),
          ),
        ),
        sel.size > 0 && h('div', { className: 'fs-selbar' },
          h('span', null, `已选 ${sel.size} 项`),
          h('button', { className: 'fs-btn', disabled: busy, style: { color: 'var(--dsw-alias-brand-primary)' }, onClick: () => void zipDownload([...sel]) }, '打包下载'),
          h('button', { className: 'fs-btn', disabled: busy, onClick: () => setSel(new Set()) }, '取消'),
          h('span', { className: 'spacer' }),
          h('span', { className: 'muted' }, '文件与文件夹可混选，打包为 zip（保留目录结构）'),
        ),
        h('div', { className: 'fs-body' },
          error && h('div', { className: 'fs-empty', style: { color: 'var(--dsw-alias-state-error-primary)' } }, error),
          !error && !rootChildrenLoaded && h('div', { className: 'fs-spin' }, '加载目录树…'),
          !error && rootChildrenLoaded && renderLevel('').length === 0 && h('div', { className: 'fs-empty' }, query ? '无匹配项' : '（空目录）'),
          renderLevel(''),
        ),
        h('div', { className: 'fs-note' },
          hint || '点击文件名或行内「预览」查看内容；悬停文件行可 下载 / @ / 改名 / 删除，悬停目录行可 整目录打包下载；勾选多项后可批量打包下载。'),
        preview && h(FilePreviewOverlay, {
          sessionId,
          workspace: ws && ws.workspace,
          rel: preview.rel,
          name: preview.name,
          size: preview.size,
          onClose: () => setPreview(null),
          onAt: atRef,
        }),
      )
    }

    module.exports = {
      name: '@weibaohui/dsh-file-share',
      inject: ['slots'],

      apply(ctx) {
        const slots = ctx.get('slots')
        if (slots === undefined) return
        // 不 return 任何值（cordis-plugin-loader 把 apply 返回值当 disposable/effect）。

        // 会话服务：@ 之后 sessions.open(sessionId) 切回对话 tab（动态 inject）
        try {
          if (typeof ctx.inject === 'function') ctx.inject(['sessions'], (scope) => { sessionsSvc = scope && scope.sessions })
        } catch (e) { console.error('[dsh-file-share] sessions inject:', e) }

        if (typeof slots.inject === 'function') {
          slots.inject('conversation.view', () => slots.register(
            { name: 'conversation.view', id: '@weibaohui/dsh-file-share', order: 27, label: () => '文件' },
            (props) => React.createElement(FileManagerTab, props),
          ))
        }
      },
    }

    return module.exports
  }
})
