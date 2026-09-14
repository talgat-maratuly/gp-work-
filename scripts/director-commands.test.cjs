const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
function load(file) {
  const compiled = ts.transpileModule(readFileSync(join(__dirname, '../apps/web/src/lib/', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('exports', 'module', compiled)(exports, { exports })
  return exports
}
const { prepareDirectorCommand: prepare, businessDate } = load('directorCommands.ts')
const { homePathForRole, resolvePostLoginPath, isSectionFormPath } = load('roleRoutes.ts')
const catalog = {
  sections: [{ id: 1, code: 'S-001', name: 'Север', objectName: 'Парк' }, { id: 2, code: 'S-002', name: 'Север', objectName: 'Сквер' }],
  workTypes: [{ id: 1, name: 'Полив' }],
  assignees: [{ id: 10, fullName: 'Иван Иванов' }, { id: 11, fullName: 'Пётр Петров' }], tasks: [],
}
test('director lands in own workspace including stale admin return link', () => {
  assert.equal(homePathForRole('DIRECTOR'), '/admin/director')
  assert.equal(resolvePostLoginPath('DIRECTOR', '/admin'), '/admin/director')
  assert.equal(homePathForRole('ADMIN'), '/admin')
  assert.equal(homePathForRole('WORKER'), '/field/today')
})
test('section QR destinations survive login without granting access to other field screens', () => {
  for (const path of ['/field/scan/S-001', '/work-form/S-001', '/work-form?objectId=3&sectionId=8']) assert.equal(isSectionFormPath(path), true)
  for (const path of [undefined, '/admin', '/field/scan/', '/work-form?sectionId=no', '/work-form?sectionId=0', '//other.example/work-form/S-001']) assert.equal(isSectionFormPath(path), false)
  for (const role of ['ADMIN', 'DIRECTOR', 'AKIMAT', 'ANTICOR']) {
    for (const path of ['/field/scan/S-001', '/work-form/S-001', '/work-form?objectId=3&sectionId=8']) {
      assert.equal(resolvePostLoginPath(role, path), path)
    }
    for (const path of ['/field/today', '/field/scan/', '/field/tasks/1']) {
      assert.equal(resolvePostLoginPath(role, path), homePathForRole(role))
    }
  }
  assert.equal(resolvePostLoginPath('ACCOUNTANT', '/field/scan/S-001'), '/admin/attendance')
  assert.equal(resolvePostLoginPath('WORKER', '/work-form?sectionId=8'), '/work-form?sectionId=8')
})
test('recognizes explicit assignment, section code and tomorrow across year boundary', () => {
  const d = prepare('Полив S-001 Иван Иванов завтра', catalog, '2026-12-31')
  assert.equal(d.sectionId, '1'); assert.equal(d.workTypeId, '1')
  assert.equal(d.assigneeUserId, '10'); assert.equal(d.dueDate, '2027-01-01')
})
test('does not guess ambiguous section, partial employee name or multiple deadlines', () => {
  const d = prepare('Полив Север Иван сегодня завтра', catalog)
  assert.equal(d.sectionId, ''); assert.equal(d.assigneeUserId, ''); assert.equal(d.dueDate, '')
  assert.equal(prepare('Полив Сквер Север', catalog).sectionId, '2')
  assert.equal(prepare('S-001 S-002', catalog).sectionId, '')
  assert.equal(prepare('S-0011', catalog).sectionId, '')
})
test('validates dates and uses business timezone', () => {
  assert.equal(prepare('2026-02-30', catalog).dueDate, '')
  assert.equal(prepare('2026-09-12', catalog).dueDate, '2026-09-12')
  assert.equal(prepare('завтра 2026-09-12', catalog).dueDate, '')
  assert.equal(businessDate(new Date('2026-09-10T20:01:00Z')), '2026-09-11')
})
test('recommends only active known verified executors and balances open workload', () => {
  const tasks = [
    { sectionId: 1, workTypeId: 1, assigneeUserId: 10, status: 'VERIFIED' },
    { sectionId: 1, workTypeId: 1, assigneeUserId: 11, status: 'VERIFIED' },
    { sectionId: 1, workTypeId: 1, assigneeUserId: 10, status: 'IN_PROGRESS' },
  ]
  assert.equal(prepare('Полив S-001 автоматически', { ...catalog, tasks }).assigneeUserId, '11')
  assert.equal(prepare('Полив S-001 Иван', { ...catalog, tasks }).assigneeUserId, '')
  assert.equal(prepare('Полив S-002 автоматически', { ...catalog, tasks }).assigneeUserId, '')
  assert.equal(prepare('Полив S-001 Иван Иванов', { ...catalog, tasks }).assigneeUserId, '10')
  assert.equal(prepare('Полив S-001 Иван Иванов Пётр Петров автоматически', { ...catalog, tasks }).assigneeUserId, '')
  assert.equal(prepare('Полив S-001 автоматически', { ...catalog, tasks, assignees: [] }).assigneeUserId, '')
})
