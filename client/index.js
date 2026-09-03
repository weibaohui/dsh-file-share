'use strict'

/**
 * @weibaohui/dsh-file-share — Client half
 *
 * 在聊天输入框「+」区挂一个「📁 目录」按钮：
 *  点击弹出共享目录管理器（浏览共享根 → 新建文件夹 / 上传 / 下载 / 改名 / 删除）；
 *  点某个文件「插入 @」→ 把 @绝对路径 注入 composer 草稿，让 agent 处理该文件。
 *
 * 数据通道是宿主同源路由 /dsh-file-share/api（无需 LAN token）。
 * 打开状态用模块级 store（侧边栏/composer 重挂载不会吞状态）。
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
.dd-trigger{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;cursor:pointer;transition:background .16s,border-color .16s}
.dd-trigger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent)}
.dd-triggerIcon{font-size:14px;line-height:1}
.dd-backdrop{position:fixed;inset:0;z-index:2147483200;background:rgba(0,0,0,.38)}
.dd-panel{position:fixed;z-index:2147483201;left:50%;top:50%;transform:translate(-50%,-50%);width:min(880px,94vw);height:min(640px,86vh);display:flex;flex-direction:column;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l2));border-radius:14px;box-shadow:var(--dsw-shadow-lv3,0 10px 30px rgba(0,0,0,.3));overflow:hidden}
.dd-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dd-headTitle{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dd-headMeta{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.dd-close{flex:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1}
.dd-close:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}
.dd-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dd-crumb{display:flex;flex-wrap:wrap;gap:2px;align-items:center;min-width:0;flex:1;font-size:13px;color:var(--dsw-alias-label-secondary)}
.dd-crumb a{color:var(--dsw-alias-label-primary);cursor:pointer;text-decoration:none}
.dd-crumb a:hover{color:var(--dsw-alias-brand-primary)}
.dd-btn{font-size:13px;padding:5px 11px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;transition:background .16s,border-color .16s;flex:none}
.dd-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,var(--dsw-alias-border-l2))}
.dd-btn:disabled{opacity:.5;cursor:default}
.dd-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 32%,var(--dsw-alias-border-l2))}
.dd-btn.danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}
.dd-search{flex:none;width:200px;padding:5px 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.dd-body{flex:1;overflow-y:auto;padding:6px 8px}
.dd-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;font-size:13px}
.dd-row:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.dd-ic{flex:none;width:20px;text-align:center}
.dd-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.dd-nm.dir{cursor:pointer;font-weight:500}
.dd-sz{flex:none;width:90px;text-align:right;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:12px;font-variant-numeric:tabular-nums}
.dd-ops{display:flex;gap:6px;flex:none}
.dd-empty{padding:36px 0;text-align:center;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:13px}
.dd-note{padding:6px 12px;font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));border-top:1px solid var(--dsw-alias-border-l2);flex:none}
.dd-hint{font-size:11px;color:var(--dsw-alias-state-error-primary)}
input.dd-file{display:none}
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

/** 注入 composer 草稿（dsh-process insertComposerText 同款机制）。 */
function insertComposerText(scope, sessionId, input, text) {
  const sessions = scope && scope.sessions
  if (!sessions) return false
  let actx
  try { actx = sessions.scope(sessionId) } catch { return false }
  if (actx === undefined || actx === null || typeof actx.bail !== 'function') return false
  const draft = (input && input.draft) || ''
  const at = draft.length
  try {
    return actx.bail(actx, 'slash/input-insert-text', {
      text, span: { start: at, end: at, draftRev: (input && input.draftRev) || 0 },
    }) === true
  } catch { return false }
}

function refocusComposer() {
  try {
    const card = document.querySelector('[data-composer-card]')
    const ta = card && card.querySelector('textarea')
    if (ta && typeof ta.focus === 'function') ta.focus()
  } catch {}
}

/** 模块级 store：弹层开关在重挂载后仍保留。 */
const panelStore = {
  open: false,
  listeners: new Set(),
  set(v) { this.open = Boolean(v); this.listeners.forEach((fn) => fn(this.open)) },
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) },
}

function usePanelOpen() {
  const [open, setOpen] = React.useState(panelStore.open)
  React.useEffect(() => panelStore.subscribe(setOpen), [])
  return [open, (v) => panelStore.set(v)]
}

/** 主管理器面板。 */
function DirManager({ onClose, composerScopeRef, sessionId, input }) {
  const h = React.createElement
  const [status, setStatus] = React.useState(null)
  const [cur, setCur] = React.useState('')
  const [entries, setEntries] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const [error, setError] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [hint, setHint] = React.useState(null)

  const load = async (rel, silent) => {
    if (!silent) setError(null)
    try {
      const st = await readJson(await fetch(`${API}/status`))
      setStatus(st)
      if (!st.enabled) { setEntries([]); return }
      const d = await readJson(await fetch(`${API}/list?path=${encodeURIComponent(rel || '')}`))
      setCur(d.dir || '')
      setEntries(d.entries || [])
      if (st.error) setError(st.error)
    } catch (e) {
      setEntries([])
      if (!silent) setError(String((e && e.message) || e))
    }
  }

  React.useEffect(() => {
    void load('', true)
    const onKey = (e) => { if (e.key === 'Escape' && !(e.isComposing === true)) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const act = async (url, opts) => {
    setBusy(true); setError(null)
    try { await readJson(await fetch(url, opts)); return true }
    catch (e) { setError(String((e && e.message) || e)); return false }
    finally { setBusy(false) }
  }

  const enter = (name) => { setQuery(''); void load(joinRel(cur, name)) }
  const go = (rel) => { setQuery(''); void load(rel) }

  const mkdir = async () => {
    const n = window.prompt('新建文件夹名：')
    if (!n || !n.trim()) return
    const name = n.trim()
    if (await act(`${API}/mkdir?path=${encodeURIComponent(joinRel(cur, name))}`, { method: 'POST' })) void load(cur, true)
  }

  const upload = async (files) => {
    if (!files || !files.length) return
    setBusy(true)
    for (const f of Array.from(files)) {
      try {
        const r = await fetch(`${API}/upload?path=${encodeURIComponent(cur)}&name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f })
        const payload = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((payload && payload.error) || `HTTP ${r.status}`)
      } catch (e) {
        setError(`上传 ${f.name} 失败：${(e && e.message) || e}`)
      }
    }
    setBusy(false)
    void load(cur, true)
  }

  const rename = async (rel, oldName) => {
    const n = window.prompt('改名为：', oldName)
    if (!n || !n.trim() || n.trim() === oldName) return
    const idx = rel.lastIndexOf('/')
    const base = idx >= 0 ? rel.slice(0, idx) : ''
    if (await act(`${API}/rename?from=${encodeURIComponent(rel)}&to=${encodeURIComponent(joinRel(base, n.trim()))}`, { method: 'POST' })) void load(cur, true)
  }

  const remove = async (rel, name, isDir) => {
    if (!window.confirm(`删除 ${name} ？${isDir ? '（目录及其全部内容）' : ''}`)) return
    if (await act(`${API}/delete?path=${encodeURIComponent(rel)}`, { method: 'DELETE' })) void load(cur, true)
  }

  const insertAt = async (rel, name) => {
    if (!status || !status.root) { setHint('目录共享未启用，无法引用文件'); return }
    const abs = status.root.replace(/\/+$/, '') + '/' + joinRel(rel, name)
    const scope = composerScopeRef ? composerScopeRef() : null
    const ok = insertComposerText(scope, sessionId, input, `@${abs} `)
    if (ok) { onClose(); refocusComposer() }
    else setHint('注入失败：请手动把路径贴进输入框')
  }

  const crumb = (dir) => {
    const parts = dir ? dir.split('/').filter(Boolean) : []
    const nodes = []
    let acc = ''
    nodes.push(h('a', { key: 'root', onClick: () => go('') }, '共享根'))
    parts.forEach((p, i) => {
      acc = joinRel(acc, p)
      nodes.push(h('span', { key: 'sep' + i }, ' / '))
      nodes.push(h('a', { key: i, onClick: () => go(acc) }, p))
    })
    return nodes
  }

  const q = query.trim().toLowerCase()
  const shown = (entries || []).filter((e) => !q || e.name.toLowerCase().includes(q))

  if (status && !status.enabled) {
    return h('div', { className: 'dd-backdrop', onClick: onClose },
      h('div', { className: 'dd-panel', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'dd-head' },
          h('span', { className: 'dd-headTitle' }, '📁 目录共享'),
          h('span', { className: 'dd-headMeta' }, '未启用'),
          h('button', { className: 'dd-close', onClick: onClose }, '✕'),
        ),
        h('div', { className: 'dd-empty' }, '共享根目录未配置：请在 设置 → dsh-file-share → root 填一个绝对路径，稍候自动生效。'),
      ),
    )
  }

  return h('div', { className: 'dd-backdrop', onClick: onClose },
    h('div', { className: 'dd-panel', onClick: (e) => e.stopPropagation() },
      h('div', { className: 'dd-head' },
        h('span', { className: 'dd-headTitle' }, '📁 目录共享'),
        h('span', { className: 'dd-headMeta', title: status ? status.root : '' },
          status ? `${status.root}${status.running ? '' : '（服务器未运行）'}${status.readOnly ? ' · 只读' : ''}` : '加载中…'),
        h('button', { className: 'dd-close', onClick: onClose }, '✕'),
      ),
      h('div', { className: 'dd-toolbar' },
        h('div', { className: 'dd-crumb' }, crumb(cur)),
        h('input', {
          className: 'dd-search', placeholder: '过滤当前目录…', value: query,
          onChange: (e) => setQuery(e.target.value),
        }),
        h('button', { className: 'dd-btn', disabled: busy, onClick: () => void load(cur) }, '刷新'),
        !(status && status.readOnly) && h('button', { className: 'dd-btn', disabled: busy, onClick: () => void mkdir() }, '新建文件夹'),
        !(status && status.readOnly) && h('label', { className: 'dd-btn', style: { cursor: 'pointer' } },
          '上传',
          h('input', { type: 'file', multiple: true, className: 'dd-file', onChange: (e) => { void upload(e.target.files); e.target.value = '' } }),
        ),
      ),
      h('div', { className: 'dd-body' },
        error && h('div', { className: 'dd-empty', style: { color: 'var(--dsw-alias-state-error-primary)', padding: '10px 0' } }, error),
        !error && entries === null && h('div', { className: 'dd-empty' }, '加载中…'),
        !error && entries !== null && shown.length === 0 && h('div', { className: 'dd-empty' }, query ? '无匹配项' : '（空目录）'),
        !error && shown.map((e) => {
          const rel = joinRel(cur, e.name)
          const isDir = e.type === 'dir'
          return h('div', { key: rel, className: 'dd-row' },
            h('span', { className: 'dd-ic' }, isDir ? '📁' : '📄'),
            h('span', { className: 'dd-nm' + (isDir ? ' dir' : ''), title: e.name, onClick: isDir ? () => enter(e.name) : undefined }, e.name),
            h('span', { className: 'dd-sz' }, isDir ? '' : fmtSize(e.size)),
            h('span', { className: 'dd-ops' },
              isDir
                ? null
                : h('button', { className: 'dd-btn', onClick: () => void insertAt(cur, e.name) }, '插入 @'),
              h('a', { className: 'dd-btn', style: { textDecoration: 'none', display: 'inline-block' }, href: `${API}/download?path=${encodeURIComponent(rel)}` }, '下载'),
              !(status && status.readOnly) && h('button', { className: 'dd-btn', onClick: () => void rename(rel, e.name) }, '改名'),
              !(status && status.readOnly) && h('button', { className: 'dd-btn danger', onClick: () => void remove(rel, e.name, isDir) }, '删除'),
            ),
          )
        }),
      ),
      h('div', { className: 'dd-note' },
        hint ? h('span', { className: 'dd-hint' }, hint)
          : (status && status.url ? `浏览器共享地址：${status.url}（访问口令见设置或调用 file_share_status 查询）` : '浏览器共享服务器未运行（检查设置里的 host/port 与错误提示）'),
      ),
    ),
  )
}

/** composer「+」区入口按钮。 */
function FileShareButton({ composerScopeRef, sessionId, input }) {
  const h = React.createElement
  const [open, setOpen] = usePanelOpen()
  return h(React.Fragment, null,
    h('button', {
      type: 'button', className: 'dd-trigger', title: '目录共享：浏览/上传/下载共享根的文件，或把文件 @ 进对话',
      onClick: () => setOpen(true),
    },
      h('span', { className: 'dd-triggerIcon' }, '📁'),
      h('span', null, '目录'),
    ),
    open && h(DirManager, {
      onClose: () => setOpen(false),
      composerScopeRef,
      sessionId,
      input,
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

    let composerScope = null
    try {
      if (typeof ctx.inject === 'function') {
        ctx.inject(['inputTriggers', 'sessions'], (scope) => { composerScope = scope })
      }
    } catch (e) { /* inputTriggers/sessions 缺失时按钮仍在，注入会失败并提示 */ }

    if (typeof slots.inject === 'function') {
      slots.inject('conversation.input.left', () => slots.register(
        { name: 'conversation.input.left', id: '@weibaohui/dsh-file-share', order: 64, label: () => '目录' },
        (apiProps) => React.createElement(FileShareButton, {
          composerScopeRef: () => composerScope,
          sessionId: apiProps && apiProps.sessionId,
          input: apiProps && apiProps.input,
        }),
      ))
    }
  },
}
