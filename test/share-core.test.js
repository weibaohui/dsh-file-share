'use strict'

const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const core = require('../src/share-core')

let rootDir
let outsideDir

before(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-file-share-core-'))
  outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-file-share-out-'))
  fs.writeFileSync(path.join(rootDir, 'a.txt'), 'hello world')
  fs.mkdirSync(path.join(rootDir, 'sub'))
  fs.writeFileSync(path.join(rootDir, 'sub', 'b.md'), '# b')
  fs.writeFileSync(path.join(rootDir, '.env'), 'SECRET=1')
  fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'outside secret')
  try { fs.symlinkSync(path.join(rootDir, 'a.txt'), path.join(rootDir, 'inlink.txt')) } catch {}
  try { fs.symlinkSync(outsideDir, path.join(rootDir, 'esc')) } catch {}
})

after(() => {
  try { fs.rmSync(rootDir, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(outsideDir, { recursive: true, force: true }) } catch {}
})

function expectShareError(fn, status) {
  assert.throws(fn, (e) => e instanceof core.ShareError && e.status === status, `expected status ${status}, got ${e => e && e.message}`)
}

test('列目录：dirs 在前 + 中文排序；敏感文件默认隐藏', () => {
  const entries = core.listDir(rootDir, '', true)
  const names = entries.map((e) => e.name)
  // dirs 全部排在 files 之前
  const firstFile = entries.findIndex((e) => e.type === 'file')
  assert.ok(firstFile >= 0)
  assert.ok(entries.slice(0, firstFile).every((e) => e.type === 'dir'))
  assert.equal(entries[firstFile].name, 'a.txt') // dirs 之后文件按名排序，a 在 b 前
  assert.ok(!names.includes('.env'), 'hideSensitive 应隐藏 .env')
  assert.ok(names.includes('sub') && names.includes('esc'))
  // hideSensitive=false 时 .env 可见
  const all = core.listDir(rootDir, '', false)
  assert.ok(all.some((e) => e.name === '.env'))
})

test('路径边界：../ 与绝对路径一律 400', () => {
  expectShareError(() => core.resolveExisting(rootDir, '../x'), 400)
  expectShareError(() => core.resolveExisting(rootDir, '/etc/passwd'), 400)
  expectShareError(() => core.listDir(rootDir, 'sub/../../x'), 400)
})

test('符号链接逃逸出 root 被拒绝（读既有文件）', () => {
  expectShareError(() => core.resolveExisting(rootDir, 'esc/secret.txt', 'file'), 400)
  // 指向 root 内的符号链接合法
  const abs = core.resolveExisting(rootDir, 'inlink.txt', 'file')
  assert.equal(fs.readFileSync(abs, 'utf8'), 'hello world')
})

test('敏感名直接访问被 isHiddenName / relIsHidden 覆盖', () => {
  assert.ok(core.isHiddenName('.env'))
  assert.ok(core.isHiddenName('node_modules'))
  assert.ok(core.isHiddenName('creds.yaml'))
  assert.ok(core.isHiddenName('x.pem'))
  assert.ok(!core.isHiddenName('a.txt'))
  assert.ok(core.relIsHidden('sub/.env'))
  assert.ok(!core.relIsHidden('sub/a.txt'))
})

test('新建文件夹 / 改名 / 删除', () => {
  core.mkdirEntry(rootDir, 'newdir')
  assert.ok(fs.statSync(path.join(rootDir, 'newdir')).isDirectory())
  expectShareError(() => core.mkdirEntry(rootDir, 'newdir'), 409)
  core.mkdirEntry(rootDir, 'newdir/child')
  expectShareError(() => core.mkdirEntry(rootDir, 'esc2/node_modules'), 403) // 敏感名拒绝
  core.renameEntry(rootDir, 'a.txt', 'renamed.txt')
  assert.ok(fs.existsSync(path.join(rootDir, 'renamed.txt')))
  expectShareError(() => core.renameEntry(rootDir, 'renamed.txt', 'esc/../..'), 400)
  core.deleteEntry(rootDir, 'newdir')
  assert.ok(!fs.existsSync(path.join(rootDir, 'newdir')))
  expectShareError(() => core.deleteEntry(rootDir, ''), 400) // 不能删共享根
})

test('token 门禁 timing-safe', () => {
  assert.ok(core.tokenOk('abc', 'abc'))
  assert.ok(!core.tokenOk('abc', 'abd'))
  assert.ok(!core.tokenOk('a', 'abc'))
  assert.ok(!core.tokenOk(null, 'abc'))
})

test('创建可写路径：父链越界（根外）被拒', () => {
  const parent = path.dirname(rootDir)
  expectShareError(() => core.resolveCreatable(rootDir, '../evil.txt'), 400)
  expectShareError(() => core.resolveCreatable(rootDir, path.join(parent, 'x.txt')), 400)
})
