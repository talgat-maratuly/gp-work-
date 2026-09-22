const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const code = ts.transpileModule(readFileSync(join(__dirname, '../apps/web/src/lib/roleRoutes.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exportsObject = {}
new Function('exports', 'module', code)(exportsObject, { exports: exportsObject })
const { isSectionFormPath, resolvePostLoginPath, returnPathAfterLogout } = exportsObject

test('section links survive login and logout, including trailing slash, query and hash', () => {
  for (const path of ['/field/scan/PIT-003', '/field/scan/PIT-003/', '/field/scan/PIT-003/?source=qr#form',
    '/work-form/PIT-003/', '/work-form/?objectId=8&sectionId=3', '/work-form?sectionId=3#form']) {
    assert.equal(isSectionFormPath(path), true, path)
    assert.equal(returnPathAfterLogout(path), path)
    for (const role of ['DIRECTOR', 'ADMIN', 'WORKER', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER']) {
      assert.equal(resolvePostLoginPath(role, path), path, `${role}: ${path}`)
    }
    assert.equal(resolvePostLoginPath('ACCOUNTANT', path), '/admin/attendance')
  }
})

test('cabinet and invalid links cannot become shared section return paths', () => {
  for (const path of ['/admin/director', '/field/today', '/field/scan/', '/work-form?sectionId=0',
    '/field/scan/PIT-003/extra', '//outside.example/field/scan/PIT-003', 'https://outside.example/work-form/PIT-003']) {
    assert.equal(isSectionFormPath(path), false, path)
    assert.equal(returnPathAfterLogout(path), undefined)
  }
  assert.equal(resolvePostLoginPath('DIRECTOR', '/field/today'), '/admin/director')
})
