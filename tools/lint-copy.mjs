import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APOSTROPHE = /[А-Яа-яІіЇїЄєҐґ]'[А-Яа-яІіЇїЄєҐґ]/
let problems = 0

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* files(p)
    else if (/\.(tsx?|m?js|cjs|css|html)$/.test(e.name)) yield p
  }
}

for (const f of [...files(path.join(ROOT, 'ui', 'src')), ...files(path.join(ROOT, 'src'))]) {
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (APOSTROPHE.test(line)) {
      problems++
      console.log(`${path.relative(ROOT, f)}:${i + 1}: ASCII apostrophe, use ’ (U+2019): ${line.trim().slice(0, 100)}`)
    }
  })
}

function table(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const m = src.match(new RegExp(`const ${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!m) throw new Error(`${file}: ${name} not found`)
  const entries = [...m[1].matchAll(/(\w+):\s*'([^']*)'/g)]
  if (entries.length < 5) throw new Error(`${file}: ${name} looks empty`)
  return Object.fromEntries(entries.map((x) => [x[1], x[2]]))
}
for (const name of ['TYPE_TITLES', 'THREAT_LABELS']) {
  const a = table('src/main.js', name)
  const b = table('ui/src/lib/alerts-copy.ts', name)
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[k] !== b[k]) {
      problems++
      console.log(`${name}.${k}: src/main.js «${a[k] ?? '—'}» ≠ ui/src/lib/alerts-copy.ts «${b[k] ?? '—'}»`)
    }
  }
}

console.log(problems ? `${problems} problem(s)` : 'copy lint: ok')
process.exit(problems ? 1 : 0)
