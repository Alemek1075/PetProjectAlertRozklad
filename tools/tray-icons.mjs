import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { iconRgba, iconPng, appIco } = require(path.join(ROOT, 'src', 'lib', 'icon.js'))

const argv = process.argv.slice(2)
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null)
const outDir = arg('--out')
const appDir = arg('--app')

const SIZES = [16, 20, 24, 32]
const STATES = ['normal', 'yellow', 'red']
const FULL = new Set(['#', 'Y', '!', 'R', 'w'])

const PALETTE = {
  normal: [['#', [255, 255, 255]]],
  yellow: [['#', [255, 255, 255]], ['Y', [0xf2, 0xa6, 0x35]], ['!', [0x1b, 0x1b, 0x1b]]],
  red: [['R', [0xd7, 0x2e, 0x2d]], ['w', [255, 255, 255]]],
}

function ascii(size, state) {
  const buf = iconRgba(size, state, { taskbarDark: true })
  const rows = []
  for (let y = 0; y < size; y++) {
    let row = ''
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const a = buf[i + 3] / 255
      if (a <= 0.05) { row += '.'; continue }
      if (a < 0.85) { row += a >= 0.4 ? '+' : '·'; continue }
      let best = '#', bd = Infinity
      for (const [ch, [r, g, b]] of PALETTE[state]) {
        const d = (buf[i] - r) ** 2 + (buf[i + 1] - g) ** 2 + (buf[i + 2] - b) ** 2
        if (d < bd) { bd = d; best = ch }
      }
      row += bd > 40 ** 2 ? '+' : best
    }
    rows.push(row)
  }
  return rows
}

function references() {
  const md = fs.readFileSync(path.join(ROOT, 'ui', 'DESIGN.md'), 'utf8')
  const at = md.indexOf('Reference output of this geometry')
  const block = md.slice(md.indexOf('```', at) + 3, md.indexOf('```', md.indexOf('```', at) + 3))
  const refs = {}
  let size = null
  for (const line of block.split(/\r?\n/)) {
    const head = line.match(/^(\d+) px/)
    if (head) { size = Number(head[1]); refs[size] = { normal: [], yellow: [], red: [] }; continue }
    const cols = line.trim().split(/\s{2,}/)
    if (size && cols.length === 3 && cols.every((c) => c.length === size)) STATES.forEach((s, k) => refs[size][s].push(cols[k]))
  }
  return refs
}

function diff(mine, ref) {
  let hard = 0, soft = 0
  const marks = mine.map((row, y) => [...row].map((m, x) => {
    const r = ref[y][x]
    if (m === r) return ' '
    const isHard = (FULL.has(r) && m === '.') || (r === '.' && FULL.has(m)) || (FULL.has(r) && FULL.has(m))
    if (isHard) { hard++; return 'X' }
    soft++
    return ' '
  }).join(''))
  return { hard, soft, marks }
}

const refs = references()
let hardTotal = 0
for (const size of SIZES) {
  const pics = STATES.map((s) => ascii(size, s))
  console.log(`\n${size} px   ${STATES.map((s) => s.padEnd(size)).join('  ')}`)
  for (let y = 0; y < size; y++) console.log(`        ${pics.map((p) => p[y]).join('  ')}`)
  if (!refs[size]) { console.log('        (no reference in DESIGN.md for this size)'); continue }
  for (const [k, state] of STATES.entries()) {
    const ref = refs[size][state]
    if (ref.length !== size) { console.log(`        ${state}: reference has ${ref.length} rows`); hardTotal++; continue }
    const d = diff(pics[k], ref)
    hardTotal += d.hard
    console.log(`        ${state}: ${d.hard} hard, ${d.soft} anti-aliasing differences vs DESIGN.md 7.1`)
    if (d.hard) {
      for (let y = 0; y < size; y++) if (d.marks[y].trim()) console.log(`          y${String(y).padStart(2)} mine ${pics[k][y]}  ref ${ref[y]}  ${d.marks[y]}`)
    }
  }
}

function sheet() {
  const Z = 6
  const states = [...STATES, 'offline']
  const bgs = [[[0x20, 0x20, 0x20], true], [[0xf3, 0xf3, 0xf3], false]]
  const cw = 32 * Z + 56
  const ch = 32 * Z + 16
  const W = bgs.length * states.length * cw
  const H = SIZES.length * ch
  const img = Buffer.alloc(W * H * 4)
  const put = (x, y, [r, g, b], a) => {
    const i = (y * W + x) * 4
    img[i] = Math.round(img[i] * (1 - a) + r * a)
    img[i + 1] = Math.round(img[i + 1] * (1 - a) + g * a)
    img[i + 2] = Math.round(img[i + 2] * (1 - a) + b * a)
    img[i + 3] = 255
  }
  SIZES.forEach((size, row) => {
    bgs.forEach(([bg, dark], half) => {
      states.forEach((state, k) => {
        const left = (half * states.length + k) * cw
        const top = row * ch
        for (let y = top; y < top + ch; y++) for (let x = left; x < left + cw; x++) put(x, y, bg, 1)
        const buf = iconRgba(size, state, { taskbarDark: dark })
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4
            const a = buf[i + 3] / 255
            if (!a) continue
            const c = [buf[i], buf[i + 1], buf[i + 2]]
            put(left + 8 + x, top + 8 + y, c, a)
            for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) put(left + 48 + x * Z + dx, top + 8 + y * Z + dy, c, a)
          }
        }
      })
    })
  })
  return pngRect(W, H, img)
}

function appSheet() {
  const Z = 6
  const W = 1250, H = 3 * 280
  const img = Buffer.alloc(W * H * 4)
  for (let i = 0; i < img.length; i += 4) { img[i] = img[i + 1] = img[i + 2] = 0x80; img[i + 3] = 255 }
  const blit = (buf, size, left, top, z) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const a = buf[i + 3] / 255
      if (!a) continue
      for (let dy = 0; dy < z; dy++) for (let dx = 0; dx < z; dx++) {
        const j = ((top + y * z + dy) * W + left + x * z + dx) * 4
        for (let c = 0; c < 3; c++) img[j + c] = Math.round(img[j + c] * (1 - a) + buf[i + c] * a)
      }
    }
  }
  STATES.forEach((state, row) => {
    const top = row * 280 + 10
    let left = 10
    for (const size of [16, 24, 32, 48, 64, 256]) { blit(iconRgba(size, state, { kind: 'app' }), size, left, top, 1); left += size + 10 }
    let l2 = left + 20
    for (const size of [16, 24, 32]) { blit(iconRgba(size, state, { kind: 'app' }), size, l2, top, Z); l2 += size * Z + 20 }
    blit(iconRgba(64, state, { kind: 'app' }), 64, l2, top, 3)
  })
  return pngRect(W, H, img)
}

function pngRect(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const out = Buffer.alloc(td.length + 8)
    out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE(crc(td), td.length + 4)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const size of SIZES) {
    for (const state of [...STATES, 'offline']) {
      for (const dark of [true, false]) fs.writeFileSync(path.join(outDir, `tray-${size}-${state}-${dark ? 'dark' : 'light'}.png`), iconPng(size, state, { taskbarDark: dark }))
    }
  }
  for (const size of [16, 24, 32, 48, 64, 256]) {
    for (const state of STATES) fs.writeFileSync(path.join(outDir, `app-${size}-${state}.png`), iconPng(size, state, { kind: 'app' }))
  }
  fs.writeFileSync(path.join(outDir, 'sheet.png'), sheet())
  fs.writeFileSync(path.join(outDir, 'app-sheet.png'), appSheet())
  console.log(`\nPNGs → ${outDir}`)
}

if (appDir) {
  fs.mkdirSync(appDir, { recursive: true })
  fs.writeFileSync(path.join(appDir, 'icon.png'), iconPng(512, 'normal', { kind: 'app' }))
  fs.writeFileSync(path.join(appDir, 'icon.ico'), appIco('normal'))
  console.log(`\napp icon → ${path.join(appDir, 'icon.png')}, icon.ico`)
}

console.log(hardTotal ? `\n${hardTotal} hard mismatch(es)` : '\nmatches DESIGN.md 7.1 within anti-aliasing')
process.exit(hardTotal ? 1 : 0)
