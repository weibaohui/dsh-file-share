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
    .fs-root{display:flex;flex-direction:column;gap:10px;height:100%;min-height:240px;color:var(--dsw-alias-label-primary)}
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
    .fs-body{flex:1;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:6px}
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
    .fs-note{padding:5px 8px;font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));border-top:1px solid var(--dsw-alias-border-l2)}
    input.fs-file{display:none}
    .fs-spin{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:12px;padding:8px}
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

    /** @绝对路径 → composer（工作区文件可被宿主 file-reference 解析）。 */
    function insertFileRef(sessionId, abs) {
      const text = '@' + abs + ' '
      try {
        const card = document.querySelector('[data-composer-card]')
        const ta = card && card.querySelector('textarea')
        if (ta && typeof document.execCommand === 'function') {
          ta.focus()
          const len = ta.value ? ta.value.length : 0
          try { ta.setSelectionRange(len, len) } catch {}
          if (document.execCommand('insertText', false, text)) return 'ok'
        }
      } catch {}
      try { navigator.clipboard.writeText(text) } catch {}
      return 'copied'
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
        setWs(null); setError(null); setCur(''); setChildren({}); setOpen({})
        fetch(`${API}/status?${S(sessionId)}`)
          .then(readJson)
          .then((s) => { setWs(s); return loadDir('', true) })
          .then(() => {})
          .catch((e) => setError(String((e && e.message) || e)))
      }, [sessionId, reloadTick])

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
        if (result === 'ok') setHint(`已把 @${joinRel(rel, name)} 插入输入框`)
        else setHint('无法自动插入，已复制到剪贴板，请在输入框粘贴')
        setTimeout(() => setHint(null), 3500)
      }

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
            h('span', { className: 'fs-caret', onClick: () => toggle(sub, d.name) }, isOpen ? '▾' : '▸'),
            h('span', { className: 'fs-ic' }, '📁'),
            h('span', { className: 'fs-nm dir', title: d.name, onClick: () => toggle(sub, d.name) }, d.name),
            h('span', { className: 'fs-ops' },
              h('button', { onClick: (e) => { e.stopPropagation(); toggle(sub, d.name) } }, '进入'),
              h('button', { onClick: (e) => { e.stopPropagation(); rename(sub, d.name) } }, '改名'),
              h('button', { className: 'danger', onClick: (e) => { e.stopPropagation(); remove(sub, d.name, true) } }, '删除'),
            ),
          ))
          if (isOpen) rows.push(...renderLevel(sub))
        }
        for (const f of shownFiles) {
          const rel2 = joinRel(rel, f.name)
          rows.push(h('div', { key: 'f:' + rel2, className: 'fs-row', style: { paddingLeft: 6 + (rel.split('/').filter(Boolean).length + 1) * 16 } },
            h('span', { className: 'fs-caret' }),
            h('span', { className: 'fs-ic' }, '📄'),
            h('span', { className: 'fs-nm', title: f.name }, f.name),
            h('span', { className: 'fs-sz' }, fmtSize(f.size)),
            h('span', { className: 'fs-ops' },
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
        h('div', { className: 'fs-body' },
          error && h('div', { className: 'fs-empty', style: { color: 'var(--dsw-alias-state-error-primary)' } }, error),
          !error && !rootChildrenLoaded && h('div', { className: 'fs-spin' }, '加载目录树…'),
          !error && rootChildrenLoaded && renderLevel('').length === 0 && h('div', { className: 'fs-empty' }, query ? '无匹配项' : '（空目录）'),
          renderLevel(''),
        ),
        h('div', { className: 'fs-note' },
          hint || '上传/新建作用于当前目录（点击目录名展开并切换）；文件行悬停出现「下载 / @ / 改名 / 删除」。'),
      )
    }

    module.exports = {
      name: '@weibaohui/dsh-file-share',
      inject: ['slots'],

      apply(ctx) {
        const slots = ctx.get('slots')
        if (slots === undefined) return
        // 不 return 任何值（cordis-plugin-loader 把 apply 返回值当 disposable/effect）。

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
