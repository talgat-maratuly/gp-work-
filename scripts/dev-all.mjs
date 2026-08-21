#!/usr/bin/env node
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const { concurrently } = require('concurrently')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

console.log('\n▶ gp-work dev: API :3002 · Web :5173\n')

const { result } = concurrently(
  [
    { command: 'npm run dev:api', name: 'api', prefixColor: 'yellow' },
    { command: 'npm run dev:web', name: 'web', prefixColor: 'green' },
  ],
  {
    cwd: root,
    killOthersOn: 'failure',
  },
)

result.then(
  () => process.exit(0),
  () => process.exit(1),
)
