const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const source = readFileSync(join(__dirname, '../apps/web/src/lib/attendanceSummary.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exportsForTest = {}
new Function('exports', compiled)(exportsForTest)
const { attendanceSummary } = exportsForTest

test('counts people once across days, distinguishes namesakes and totals completed time only', () => {
  const rows = [
    { userId: 1, workerFullName: 'Same name', status: 'COMPLETED', workedHours: 8.25 },
    { userId: 1, workerFullName: 'Renamed', status: 'COMPLETED', workedHours: 7.5 },
    { userId: 2, workerFullName: 'Same name', status: 'ON_DUTY', workedHours: null },
  ]
  assert.deepEqual(attendanceSummary(rows), { people: 2, open: 1, completed: 2, hours: 15.75 })
  assert.deepEqual(attendanceSummary([]), { people: 0, open: 0, completed: 0, hours: 0 })
})

test('groups legacy unlinked marks by name without collapsing identified employees', () => {
  assert.equal(attendanceSummary([
    { userId: null, workerFullName: 'Old employee', status: 'COMPLETED', workedHours: 1 },
    { userId: null, workerFullName: ' OLD EMPLOYEE ', status: 'COMPLETED', workedHours: 2 },
    { userId: 4, workerFullName: 'Old employee', status: 'COMPLETED', workedHours: 3 },
  ]).people, 2)
})
