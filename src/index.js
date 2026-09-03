'use strict'

/**
 * @weibaohui/dsh-file-share — Host half (v2: 会话工作区文件管理)
 *
 * 文件管理挂到「会话工作区」上：
 *  - 每个请求带 sessionId；宿主用 ctx.sessions.get(sessionId).header.cwd 解析该会话的
 *    工作区（会话须在本实例的活跃会话存储中——文件 tab 正属于该会话，天然满足），
 *    所有文件操作以该工作区为根（越界由 share-core 双重边界拒绝）；
 *  - 同源路由 /dsh-file-share/api/*（status/list/download/upload/mkdir/rename/delete）
 *    给客户端 conversation.view「文件」tab 用；
 *  - 无独立端口服务器、无 token/限流/settings——只服务本机 dsh Web GUI。
 *
 * share-core 的 routeShare 以 opts.root 为根按 /api/* 分发，这里按「每请求解析出
 * 工作区根」构造 opts 复用，避免重复实现文件操作与路径安全。
 */

const fs = require('node:fs')
const path = require('node:path')

const core = require('./share-core')

const name = 'dsh-file-share'
const inject = ['webServer', 'sessions']
const API_PREFIX = '/dsh-file-share/api'

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function realDir(p) {
  try {
    const r = fs.realpathSync(p)
    return fs.statSync(r).isDirectory() ? r : null
  } catch {
    return null
  }
}

module.exports = {
  name,
  inject,
  version: core.VERSION,

  apply(ctx) {
    const logger = ctx.logger || { info() {}, warn() {}, error() {} }
    const webServer = ctx.webServer
    const sessions = ctx.sessions

    /** sessionId → 会话工作区真实目录（会话须在本实例活跃存储中）。 */
    function workspaceOf(sessionId) {
      if (!sessionId || typeof sessionId !== 'string') {
        return { ok: false, status: 400, error: '缺少 sessionId' }
      }
      let session = null
      let lookupError = null
      try {
        session = sessions && typeof sessions.get === 'function' ? sessions.get(sessionId) : null
      } catch (e) {
        lookupError = String((e && e.message) || e)
      }
      if (lookupError) {
        return { ok: false, status: 404, error: `会话读取失败: ${lookupError}` }
      }
      if (!session) {
        return { ok: false, status: 404, error: '该会话不在本实例的活跃会话中（请先在本实例打开该会话）' }
      }
      const cwd = session.header && session.header.cwd
      if (typeof cwd !== 'string' || !cwd) {
        return { ok: false, status: 404, error: '该会话没有可用的工作区(cwd)' }
      }
      const root = realDir(cwd)
      if (!root) {
        return { ok: false, status: 404, error: `工作区目录不存在或不可访问: ${cwd}` }
      }
      return { ok: true, workspace: cwd, root }
    }

    if (webServer && typeof webServer.register === 'function') {
      ctx.effect(() => {
        webServer.register({
          kind: 'prefix',
          path: API_PREFIX,
          handler: async (req, res) => {
            try {
              const url = new URL(req.url || '/', 'http://dsh.local')
              const p = url.pathname
              if (!p.startsWith(API_PREFIX)) { sendJson(res, 404, { ok: false, error: 'not found' }); return }
              const rest = p.slice(API_PREFIX.length)
              const sessionId = url.searchParams.get('sessionId')

              // 状态 / 工作区探测：统一 200 语义化返回（客户端据此走「不可用」分支）
              if (req.method === 'GET' && (rest === '' || rest === '/' || rest === '/status' || rest === '/session')) {
                const w = workspaceOf(sessionId)
                if (w.ok) sendJson(res, 200, { ok: true, sessionId, workspace: w.workspace, readOnly: false, hideSensitive: true })
                else sendJson(res, 200, { ok: false, error: w.error })
                return
              }

              // 文件操作：以会话工作区为根
              const w = workspaceOf(sessionId)
              if (!w.ok) { sendJson(res, w.status || 400, { ok: false, error: w.error }); return }
              const corePath = '/api' + rest
              const inner = new URL(corePath + (url.search || ''), 'http://dsh.local')
              await core.routeShare(req, res, inner, {
                root: w.root,
                enforceToken: false,
                token: null,
                readOnly: false,
                hideSensitive: true,
                maxBytes: undefined,
                serverRunning: true,
              })
            } catch (e) {
              try { sendJson(res, 500, { ok: false, error: String((e && e.message) || e) }) } catch {}
            }
          },
        })
      }, 'dsh-file-share: workspace api route')
    } else {
      logger.warn('dsh-file-share: webServer 不可用，文件管理 API 未注册')
    }

    // 不 return 任何值——cordis-plugin-loader 把 apply 的返回值当作 disposable/effect。
  },
}
