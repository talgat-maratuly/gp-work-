const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')

const source = readFileSync(join(__dirname, '../apps/web/src/lib/rolePermissions.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const moduleExports = {}
new Function('exports', 'module', compiled)(moduleExports, { exports: moduleExports })
const { ADMIN_ROUTE_ROLES, canAccessRoles } = moduleExports

test('water carrier can open watering but cannot open dashboard or management pages', () => {
  assert.equal(canAccessRoles('WATER_CARRIER', ADMIN_ROUTE_ROLES.watering), true)
  assert.equal(canAccessRoles('WATER_CARRIER', ADMIN_ROUTE_ROLES.dashboard), false)
  assert.equal(canAccessRoles('WATER_CARRIER', ADMIN_ROUTE_ROLES.tasks), false)
})

test('control roles retain read-only operational access', () => {
  for (const role of ['AKIMAT', 'ANTICOR']) {
    assert.equal(canAccessRoles(role, ADMIN_ROUTE_ROLES.dashboard), true)
    assert.equal(canAccessRoles(role, ADMIN_ROUTE_ROLES.evidenceReports), true)
    assert.equal(canAccessRoles(role, ADMIN_ROUTE_ROLES.users), false)
  }
})

test('director inherits every administrator route', () => {
  for (const allowed of Object.values(ADMIN_ROUTE_ROLES)) {
    if (allowed.includes('ADMIN')) assert.equal(canAccessRoles('DIRECTOR', allowed), true)
  }
})
