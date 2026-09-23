const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const compiled = ts.transpileModule(readFileSync(join(__dirname, '../apps/web/src/lib/sectionLocation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exportsObject = {}
new Function('exports', 'module', compiled)(exportsObject, { exports: exportsObject })
const { locationPayload, locationDraft, hasSectionLocation, emptyLocation, locationPoint } = exportsObject

test('map point is absent for incomplete/invalid coordinates, while valid zero and decimal comma remain selectable', () => {
  for (const draft of [emptyLocation(), { latitude: '51', longitude: '' }, { latitude: '', longitude: '0' },
    { latitude: '91', longitude: '51' }, { latitude: '51', longitude: '181' }, { latitude: 'NaN', longitude: '0' },
  ]) assert.equal(locationPoint(draft), null)
  assert.deepEqual(locationPoint({ latitude: '0', longitude: '0' }), [0, 0])
  assert.deepEqual(locationPoint({ latitude: '51,2301', longitude: '51,3701', radius: '' }), [51.2301, 51.3701])
})

test('blank draft does not place the section at zero; a configured location cannot silently be cleared', () => {
  assert.deepEqual(locationPayload(emptyLocation()), {})
  assert.throws(() => locationPayload(emptyLocation(), true), /широту и долготу/)
  assert.throws(() => locationPayload({ latitude: '51', longitude: '', radius: '150' }), /широту и долготу/)
})

test('Russian decimal input and valid zero coordinates survive conversion and editing', () => {
  assert.deepEqual(locationPayload({ latitude: '51,2301', longitude: '51,3701', radius: '150' }), { latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 })
  assert.deepEqual(locationPayload(locationDraft({ latitude: 0, longitude: 0, radius_meters: 250 })), { latitude: 0, longitude: 0, radiusMeters: 250 })
})

test('rejects unsafe ranges, non-numbers and fractional radius', () => {
  for (const draft of [
    { latitude: '91', longitude: '51', radius: '150' },
    { latitude: '51', longitude: '-181', radius: '150' },
    { latitude: 'NaN', longitude: '51', radius: '150' },
    { latitude: '51', longitude: '51', radius: '' },
    { latitude: '51', longitude: '51', radius: '10.5' },
    { latitude: '51', longitude: '51', radius: '5001' },
  ]) assert.throws(() => locationPayload(draft))
})

test('readiness reflects missing or invalid location, preserving the legacy 150 m default', () => {
  assert.equal(hasSectionLocation({ latitude: null, longitude: null, radius_meters: null }), false)
  assert.equal(hasSectionLocation({ latitude: 0, longitude: 0, radius_meters: null }), true)
  assert.equal(hasSectionLocation({ latitude: 51, longitude: 51, radius_meters: 0 }), false)
  assert.equal(hasSectionLocation({ latitude: 91, longitude: 51, radius_meters: 150 }), false)
})
