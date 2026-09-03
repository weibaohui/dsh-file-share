'use strict'

const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const core = require('../src/share-core')

const TOKEN = 'test-token-123456'
let rootDir
let outsideDir
let server
let port
let roServer
let roPort

before(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-file-share-http-'))
  outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-file-share-http-out-'))
  fs.writeFileSync(path.join(rootDir, 'hello.txt'), 'hello over http')
  fs.mkdirSync(path.join(rootDir, 'docs'))
  fs.writeFileSync(path.join(rootDir, '.env'), 'TOP=secret')
  fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'outside secret')
  try { fs.symlinkSync(outsideDir, path.join(rootDir, 'esc')) } catch {}
  server = core.createShareServer({ root: rootDir, enforceToken: true, token: TOKEN, readOnly: false, hideSensitive: true })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = server.address().port
  roServer = core.createShareServer({ root: rootDir, enforceToken: true, token: TOKEN, readOnly: true, hideSensitive: true })
  await new Promise((resolve) => roServer.listen(0, '127.0.0.1', resolve))
  roPort = roServer.address().port
})

after(() => {
  try { server && server.close() } catch {}
  try { roServer && roServer.close() } catch {}
  try { fs.rmSync(rootDir, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(outsideDir, { recursive: true, force: true }) } catch {}
})

const base = () => `http://127.0.0.1:${port}`
const roBase = () => `http://127.0.0.1:${roPort}`

async function expectStatus(promise, status) {
  const res = await promise
  assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${await res.text().catch(() => '')}`)
  return res
}

test('无/错 token 一律 401，正确 token 200', async () => {
  await expectStatus(fetch(`${base()}/api/list`), 401)
  await expectStatus(fetch(`${base()}/api/list?token=wrong`), 401)
  const res = await fetch(`${base()}/api/list?token=${TOKEN}`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.entries.some((e) => e.name === 'hello.txt'))
  assert.ok(!body.entries.some((e) => e.name === '.env'), '敏感文件不出现在列表')
})

test('根页面无需 token 即可打开（HTML）', async () => {
  const res = await fetch(`${base()}/`)
  assert.equal(res.status, 200)
  assert.match(await res.text(), /目录共享/)
})

test('上传 → 下载字节一致；同名覆盖 409；敏感名 403', async () => {
  const payload = crypto.randomBytes(4096)
  const up = await fetch(`${base()}/api/upload?path=&name=up.bin&token=${TOKEN}`, { method: 'POST', body: payload })
  assert.equal(up.status, 201)
  const dl = await fetch(`${base()}/api/download?path=up.bin&token=${TOKEN}`)
  assert.equal(dl.status, 200)
  const bytes = Buffer.from(await dl.arrayBuffer())
  assert.deepEqual(bytes, payload)
  const again = await fetch(`${base()}/api/upload?path=&name=up.bin&token=${TOKEN}`, { method: 'POST', body: Buffer.from('x') })
  assert.equal(again.status, 409)
  const hidden = await fetch(`${base()}/api/upload?path=&name=.env&token=${TOKEN}`, { method: 'POST', body: Buffer.from('x') })
  assert.equal(hidden.status, 403)
})

test('上传进子目录 + mkdir + rename + delete 全链路', async () => {
  await expectStatus(fetch(`${base()}/api/mkdir?path=docs%2Fnewdir&token=${TOKEN}`, { method: 'POST' }), 201)
  const up = await fetch(`${base()}/api/upload?path=docs%2Fnewdir&name=f.txt&token=${TOKEN}`, { method: 'POST', body: 'file content' })
  assert.equal(up.status, 201)
  const list = await (await fetch(`${base()}/api/list?path=docs%2Fnewdir&token=${TOKEN}`)).json()
  assert.ok(list.entries.some((e) => e.name === 'f.txt'))
  await expectStatus(fetch(`${base()}/api/rename?from=docs%2Fnewdir%2Ff.txt&to=docs%2Fnewdir%2Fg.txt&token=${TOKEN}`, { method: 'POST' }), 200)
  await expectStatus(fetch(`${base()}/api/delete?path=docs%2Fnewdir%2Fg.txt&token=${TOKEN}`, { method: 'DELETE' }), 200)
  await expectStatus(fetch(`${base()}/api/delete?path=docs%2Fnewdir&token=${TOKEN}`, { method: 'DELETE' }), 200)
})

test('路径越界与敏感直读被拒', async () => {
  await expectStatus(fetch(`${base()}/api/download?path=..%2F..%2Fetc%2Fpasswd&token=${TOKEN}`), 400)
  await expectStatus(fetch(`${base()}/api/download?path=.env&token=${TOKEN}`), 403) // hideSensitive 下敏感文件不可下载
  await expectStatus(fetch(`${base()}/api/download?path=esc%2Fsecret.txt&token=${TOKEN}`), 400)
})

test('只读服务器：读 OK、写 403', async () => {
  const list = await fetch(`${roBase()}/api/list?token=${TOKEN}`)
  assert.equal(list.status, 200)
  await expectStatus(fetch(`${roBase()}/api/upload?path=&name=z.txt&token=${TOKEN}`, { method: 'POST', body: 'x' }), 403)
  await expectStatus(fetch(`${roBase()}/api/mkdir?path=zzz&token=${TOKEN}`, { method: 'POST' }), 403)
  await expectStatus(fetch(`${roBase()}/api/delete?path=hello.txt&token=${TOKEN}`, { method: 'DELETE' }), 403)
  assert.ok(fs.existsSync(path.join(rootDir, 'hello.txt')))
})

test('status 载荷含运行信息', async () => {
  const s = await (await fetch(`${base()}/api/status?token=${TOKEN}`)).json()
  assert.equal(s.root, rootDir)
  assert.equal(s.readOnly, false)
  assert.equal(s.token, TOKEN)
  assert.equal(s.enabled, true)
})
