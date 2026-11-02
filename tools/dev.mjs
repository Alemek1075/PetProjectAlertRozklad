import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ configFile: path.join(ROOT, 'vite.config.mts') })
await server.listen()
const url = server.resolvedUrls.local[0]
console.log('vite dev server:', url)
const electron = spawn(path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), [ROOT, '--editor'], {
  stdio: 'inherit',
  env: { ...process.env, RA_DEV_URL: url },
})
electron.on('exit', () => server.close().then(() => process.exit(0)))
