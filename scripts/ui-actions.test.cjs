const { readdirSync, readFileSync } = require('node:fs')
const { join, relative } = require('node:path')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')

const webRoot = join(__dirname, '../apps/web/src')

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesIn(path) : entry.name.endsWith('.tsx') ? [path] : []
  })
}

function tagName(node) {
  return node.tagName?.getText()
}

function attribute(node, name) {
  return node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name,
  )
}

function literalAttributeValue(property) {
  if (!property?.initializer) return true
  return ts.isStringLiteral(property.initializer) ? property.initializer.text : undefined
}

function isInsideForm(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxElement(current) && tagName(current.openingElement) === 'form') return true
  }
  return false
}

function location(source, node, file) {
  const point = source.getLineAndCharacterOfPosition(node.getStart(source))
  return `${relative(join(__dirname, '..'), file)}:${point.line + 1}`
}

test('interactive HTML controls have a real action target', () => {
  const failures = []
  for (const file of filesIn(webRoot)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = tagName(node)
        if (tag === 'button' || tag === 'Button') {
          const onClick = attribute(node, 'onClick')
          const type = literalAttributeValue(attribute(node, 'type'))
          const isNativeDefaultSubmit = tag === 'button' && isInsideForm(node) && (type === undefined || type === true)
          const isExplicitSubmit = type === 'submit' && (isInsideForm(node) || Boolean(attribute(node, 'form')))
          const delegatesProps = tag === 'button' && node.attributes.properties.some(ts.isJsxSpreadAttribute)
          if (!onClick && !isNativeDefaultSubmit && !isExplicitSubmit && !delegatesProps) {
            failures.push(`${location(source, node, file)} ${tag} has no action`)
          }
          const expression = onClick?.initializer && ts.isJsxExpression(onClick.initializer)
            ? onClick.initializer.expression
            : undefined
          if (
            expression &&
            (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) &&
            ts.isBlock(expression.body) &&
            expression.body.statements.length === 0
          ) {
            failures.push(`${location(source, node, file)} button has an empty onClick`)
          }
        }
        if (tag === 'a') {
          const href = attribute(node, 'href')
          if (!href || literalAttributeValue(href) === '#') {
            failures.push(`${location(source, node, file)} anchor has no real href`)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.deepEqual(failures, [])
})
