'use strict'

// 模拟宿主 v2 的「每请求按 sessionId 解析工作区根 → routeShare」形态：
// 验证文件操作被各自的会话工作区根隔离、越界被拒。

const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')

const core = require('../src/share-core')

let rootA
let rootB
let server
let port

before(async () => {
  rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-fs-a-'))
  rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-fs-b-'))
  fs.writeFileSync(path.join(rootA, 'only-a.txt'), 'A')
  fs.writeFileSync(path.join(rootB, 'only-b.txt'), 'B')
  const roots = { a: rootA, b: rootB }
  // 与宿主一致：前缀剥掉后拼回 /api，再以解析出的工作区为 root 调 routeShare
  server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x.local')
    const m = /^\/workspace-api(.*)$/.exec(url.pathname)
    if (!m) { res.writeHead(404); res.end('not found'); return }
    const sid = url.searchParams.get('sessionId')
    const root = roots[sid]
    if (!root) { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: '会话不存在' })); return }
    const inner = new URL('/api' + m[1] + (url.search || ''), 'http://x.local')
    core.routeShare(req, res, inner, { root, enforceToken: false, token: null, readOnly: false, hideSensitive: true }).catch(() => {})
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = server.address().port
})

after(() => {
  try { server && server.close() } catch {}
  try { fs.rmSync(rootA, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(rootB, { recursive: true, force: true }) } catch {}
})

const base = () => `http://127.0.0.1:${port}/workspace-api`

test('每个会话只看到自己的工作区：列表隔离 + 上传落到对应根', async () => {
  const la = await (await fetch(`${base()}/list?sessionId=a`)).json()
  assert.ok(la.entries.some((e) => e.name === 'only-a.txt'))
  assert.ok(!la.entries.some((e) => e.name === 'only-b.txt'))
  const lb = await (await fetch(`${base()}/list?sessionId=b`)).json()
  assert.ok(lb.entries.some((e) => e.name === 'only-b.txt'))
  assert.ok(!lb.entries.some((e) => e.name === 'only-a.txt'))

  const up = await fetch(`${base()}/upload?path=&name=up.txt&sessionId=a`, { method: 'POST', body: 'to A' })
  assert.equal(up.status, 201)
  assert.ok(fs.existsSync(path.join(rootA, 'up.txt')))
  assert.ok(!fs.existsSync(path.join(rootB, 'up.txt')))
})

test('越界仍被拒：../../ 逃不出会话工作区', async () => {
  const r = await fetch(`${base()}/download?path=..%2F..%2Fetc%2Fhosts&sessionId=a`)
  assert.equal(r.status, 400)
  const l = await fetch(`${base()}/list?path=..&sessionId=a`)
  assert.equal(l.status, 400)
})

test('无效 sessionId → 404 语义', async () => {
  const r = await fetch(`${base()}/list?sessionId=nope`)
  assert.equal(r.status, 404)
  const body = await r.json()
  assert.equal(body.ok, false)
})
