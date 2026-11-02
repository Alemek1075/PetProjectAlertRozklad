import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'alerts-snapshot.json'), 'utf8'))

const argv = process.argv.slice(2)
const opts = { out: 'shots', only: '', build: true, size: '1440x900', popupJs: '', editorJs: '', check: false, short: '', popupKeys: '', editorKeys: '' }
const specs = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--out') opts.out = argv[++i]
  else if (a === '--only') opts.only = argv[++i]
  else if (a === '--no-build') opts.build = false
  else if (a === '--size') opts.size = argv[++i]
  else if (a === '--popup-js') opts.popupJs = argv[++i]
  else if (a === '--editor-js') opts.editorJs = argv[++i]
  else if (a === '--popup-keys') opts.popupKeys = argv[++i]
  else if (a === '--editor-keys') opts.editorKeys = argv[++i]
  else if (a === '--check') opts.check = true
  else if (a === '--short') opts.short = argv[++i]
  else specs.push(a)
}
const DEFAULT = ['quiet:light', 'quiet:dark', 'alert-red:dark', 'alert-yellow:light', 'partial:light', 'error:dark', 'empty:light', 'quiet-map:dark']

const pad = (n) => String(n).padStart(2, '0')
const hm = (min) => {
  const m = Math.max(0, Math.min(23 * 60 + 55, Math.round(min / 5) * 5))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}
let idSeq = 0
const L = (day, start, end, subject, link = '', week = 'all', remind = false) =>
  ({ id: `fx${++idSeq}`, day, start, end, subject, link, week, remind })

function lessonsFixture() {
  const now = new Date()
  const today = ((now.getDay() + 6) % 7) + 1
  const nm = now.getHours() * 60 + now.getMinutes()
  const week = [
    L(1, '08:30', '09:50', 'Математичний аналіз', 'https://zoom.us/j/81234567890', 'all', true),
    L(1, '10:10', '11:30', 'Англійська мова', 'https://meet.google.com/abc-defg-hij'),
    L(1, '11:50', '13:10', 'Дискретна математика', 'https://zoom.us/j/84455667788', 'odd'),
    L(1, '11:50', '13:10', 'Фізика', '', 'even'),
    L(2, '10:10', '11:30', 'Алгоритми та структури даних', 'https://meet.google.com/xyz-abcd-efg', 'all', true),
    L(2, '11:50', '13:10', 'Операційні системи', 'https://teams.microsoft.com/l/meetup-join/abc'),
    L(3, '08:30', '09:50', 'Історія України', 'https://meet.google.com/his-tory-ukr', 'even'),
    L(3, '10:10', '11:30', 'Бази даних', 'https://zoom.us/j/89990001112', 'all', true),
    L(5, '13:30', '14:50', 'Теорія ймовірностей', 'https://zoom.us/j/87776665554'),
    L(5, '15:00', '16:20', 'Веб-технології', 'https://meet.google.com/web-tech-dev', 'odd'),
  ].filter((l) => l.day !== today)
  week.push(
    L(today, hm(nm - 190), hm(nm - 110), 'Філософія', 'https://meet.google.com/phi-loso-phy'),
    L(today, hm(nm - 35), hm(nm + 45), 'Бази даних', 'https://zoom.us/j/89990001112', 'all', true),
    L(today, hm(nm + 65), hm(nm + 145), 'Англійська мова', 'https://meet.google.com/abc-defg-hij', 'odd'),
    L(today, hm(nm + 65), hm(nm + 145), 'Історія України', 'https://meet.google.com/his-tory-ukr', 'even'),
    L(today, hm(nm + 165), hm(nm + 245), 'Алгоритми та структури даних', '', 'all', true),
  )
  return week
}

const weekendFixture = () => {
  const today = ((new Date().getDay() + 6) % 7) + 1
  return lessonsFixture().filter((l) => l.day !== today)
}

const doneTodayFixture = () => {
  const now = new Date()
  const today = ((now.getDay() + 6) % 7) + 1
  const nm = now.getHours() * 60 + now.getMinutes()
  return [
    ...lessonsFixture().filter((l) => l.day !== today),
    L(today, hm(nm - 260), hm(nm - 180), 'Філософія', 'https://meet.google.com/phi-loso-phy'),
    L(today, hm(nm - 160), hm(nm - 80), 'Бази даних', 'https://zoom.us/j/89990001112', 'all', true),
  ]
}

const PASTE_CSV = [
  'День\tЧас\tПредмет\tПосилання\tТиждень',
  'Пн\t08:30-09:50\tМатематичний аналіз\thttps://zoom.us/j/81234567890\t',
  '\t10:10-11:30\tАнглійська мова\thttps://meet.google.com/abc-defg-hij\tчисельник',
  'Вт\t8.3\tФізика\t\tзнаменник',
  'Ср\t08:30\tІсторія України\thttps://meet.google.com/his-tory-ukr\tверхній-нижній',
  'Ср\t10:10\tБази даних\thttps://zoom.us/j/89990001112\t',
  'Пт\t13:30-14:50\tТеорія ймовірностей\thttps://zoom.us/j/87776665554\t',
].join('\n')
const LONG_PASTE_CSV = ['День\tЧас\tПредмет\tПосилання\tТиждень', ...Array.from({ length: 25 }, (_, i) =>
  `${['Пн', 'Вт', 'Ср', 'Чт', 'Пт'][i % 5]}\t${8 + (i % 6)}:30-${9 + (i % 6)}:50\tПредмет ${i + 1} (лекція) · Викладач\t\t${['', 'чисельник', 'знаменник'][i % 3]}`)].join('\n')
const pasteJs = (text) => `
  const dt = new DataTransfer(); dt.setData('text/plain', ${JSON.stringify(text)});
  document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));`
const popupKey = (code) => `
  const m = document.querySelector('main') || document.body; m.focus?.();
  m.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', key: '', bubbles: true, cancelable: true }));`

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString()
const withoutKyiv = (alerts) => alerts.filter((a) => a.location_oblast !== 'м. Київ')
const kyivAlert = (level, startedMin, threats) => ({
  id: 999001, location_title: 'м. Київ', location_type: 'city', started_at: minutesAgo(startedMin), finished_at: null,
  updated_at: minutesAgo(1), alert_type: 'air_raid', location_oblast: 'м. Київ', location_uid: '31', notes: null,
  country: null, alert_level: level, location_title_en: 'Kyiv', location_oblast_uid: 31,
  threats: threats.map((t) => ({ threat_type: t, level, started_at: minutesAgo(startedMin) })),
})

const quietAlerts = () => ({ alerts: withoutKyiv(SNAPSHOT.alerts) })
const redKyivAlerts = (startedMin = 47) => ({ alerts: [...withoutKyiv(SNAPSHOT.alerts), kyivAlert('red', startedMin, ['ballistic_missiles', 'drones'])] })

const SCENARIOS = {
  quiet: () => ({ alerts: { alerts: withoutKyiv(SNAPSHOT.alerts) } }),
  'quiet-map': () => ({ alerts: { alerts: withoutKyiv(SNAPSHOT.alerts) }, settings: { showMap: true } }),
  'alert-red': () => ({ alerts: { alerts: [...withoutKyiv(SNAPSHOT.alerts), kyivAlert('red', 47, ['ballistic_missiles', 'drones'])] } }),
  'alert-yellow': () => ({ alerts: { alerts: [...withoutKyiv(SNAPSHOT.alerts), kyivAlert('yellow', 12, ['drones'])] } }),
  partial: () => ({
    settings: { region: 'Київська область' },
    alerts: {
      alerts: [
        ...SNAPSHOT.alerts.filter((a) => a.location_oblast !== 'Київська область'),
        { ...kyivAlert('red', 25, ['drones']), id: 999002, location_title: 'Бучанський район', location_type: 'raion', location_oblast: 'Київська область', location_uid: '1001' },
        { ...kyivAlert('red', 18, []), id: 999003, location_title: 'Броварський район', location_type: 'raion', location_oblast: 'Київська область', location_uid: '1002' },
      ],
    },
  }),
  error: () => ({ alerts: { __error: { status: 401, message: 'Невірний токен alerts.in.ua' } } }),
  empty: () => ({ lessons: [], alerts: { alerts: withoutKyiv(SNAPSHOT.alerts) } }),
  plain: () => ({ lessons: lessonsFixture().filter((l) => l.week !== 'even').map((l) => ({ ...l, week: 'all' })), alerts: { alerts: withoutKyiv(SNAPSHOT.alerts) } }),

  weekend: () => ({ lessons: weekendFixture(), alerts: quietAlerts() }),
  'done-today': () => ({ lessons: doneTodayFixture(), alerts: quietAlerts() }),
  'next-week': () => ({ alerts: quietAlerts(), popupJs: popupKey('KeyW') }),
  'stale-alert': () => ({ alerts: { __prior: redKyivAlerts(55), __priorAt: minutesAgo(8), __error: { code: 'network' } } }),
  'stale-quiet': () => ({ alerts: { ...quietAlerts(), __patch: { updatedAt: minutesAgo(7) } } }),
  'all-clear': () => ({ alerts: { __prior: redKyivAlerts(68), __priorAt: minutesAgo(1), ...quietAlerts() } }),
  'all-clear-old': () => ({
    alerts: { ...quietAlerts(), __patch: { lastClear: { startedAt: minutesAgo(98), endedAt: minutesAgo(30), level: 'red' } } },
  }),
  'no-token': () => ({ alerts: quietAlerts(), env: { RA_FIXTURE_TOKEN: '' } }),
  'bad-token': () => ({ alerts: { __error: { status: 401 } } }),
  forbidden: () => ({ alerts: { __error: { status: 403 } } }),
  'rate-limit': () => ({ alerts: { __error: { status: 429 } } }),
  network: () => ({ alerts: { __prior: quietAlerts(), __priorAt: minutesAgo(4), __error: { code: 'network' } } }),
  'api-error': () => ({ alerts: { __error: { status: 502 } } }),
  'long-region': () => ({
    settings: { region: 'Дніпропетровська область' },
    alerts: {
      alerts: [
        ...SNAPSHOT.alerts.filter((a) => a.location_oblast !== 'Дніпропетровська область'),
        { ...kyivAlert('red', 65, ['ballistic_missiles', 'guided_aerial_bombs']), id: 999004, location_title: 'Дніпропетровська область', location_type: 'oblast', location_oblast: 'Дніпропетровська область', location_uid: '9' },
      ],
    },
  }),
  'import-preview': () => ({ alerts: quietAlerts(), editorJs: pasteJs(PASTE_CSV) }),
  'editor-list': () => ({ alerts: quietAlerts(), editorJs: `location.hash = '#schedule/list'` }),
  'import-long': () => ({ alerts: quietAlerts(), editorJs: pasteJs(LONG_PASTE_CSV) }),
}

const uiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozklad-ui-'))
if (opts.build) {
  console.log('building UI…')
  const r = spawnSync('npx', ['vite', 'build', '--logLevel', 'warn'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, RA_UI_OUT: uiDir, RA_UI_ENTRIES: opts.only || 'popup,editor' },
  })
  if (r.status !== 0) process.exit(r.status || 1)
} else {
  fs.cpSync(path.join(ROOT, 'build-ui'), uiDir, { recursive: true })
}
const outDir = path.resolve(ROOT, opts.out)
fs.mkdirSync(outDir, { recursive: true })

const runs = (specs.length ? specs : DEFAULT).flatMap((s) => {
  const [name, theme] = s.split(':')
  if (!SCENARIOS[name]) {
    console.error(`unknown scenario "${name}". Known: ${Object.keys(SCENARIOS).join(', ')}`)
    process.exit(1)
  }
  return (theme ? [theme] : ['light', 'dark']).map((t) => ({ name, theme: t }))
})

let failed = 0
for (const { name, theme } of runs) {
  const sc = SCENARIOS[name]()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rozklad-shot-'))
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({
    lessons: sc.lessons ?? lessonsFixture(),
    settings: { region: 'м. Київ', ...(sc.settings || {}) },
  }))
  const fixture = path.join(dir, 'alerts.json')
  fs.writeFileSync(fixture, JSON.stringify(sc.alerts))
  const entry = opts.check ? 'popup-check.cjs' : 'shots-entry.cjs'
  const r = spawnSync(ELECTRON, [path.join(ROOT, 'tools', entry)], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,
    env: {
      ...process.env,
      RA_DATA_DIR: dir,
      RA_ALERTS_FIXTURE: fixture,
      RA_THEME: theme,
      RA_UI_DIR: uiDir,
      SHOT_OUT: path.join(outDir, `${name}-${theme}`),
      SHOT_ONLY: opts.only,
      ...(sc.env || {}),
      SHOT_POPUP_JS: [sc.popupJs, opts.popupJs].filter(Boolean).join(';\n'),
      SHOT_EDITOR_JS: [sc.editorJs, opts.editorJs].filter(Boolean).join(';\n'),
      SHOT_EDITOR_SIZE: opts.size,
      SHOT_SHORT: opts.short,
      SHOT_POPUP_KEYS: opts.popupKeys,
      SHOT_EDITOR_KEYS: opts.editorKeys,
      SHOT_CHECK_ALERT: opts.check ? JSON.stringify(redKyivAlerts(1)) : '',
    },
  })
  const lines = `${r.stdout || ''}${r.stderr || ''}`.split(/\r?\n/).filter((l) => /saved|shot failed|renderer error|Error|Uncaught|^check/.test(l))
  console.log(`${name}:${theme}`, lines.length ? `\n  ${lines.join('\n  ')}` : '(no output)')
  if (r.status !== 0 || !lines.some((l) => l.startsWith(opts.check ? 'check done' : 'saved'))) failed++
  fs.rmSync(dir, { recursive: true, force: true })
}
fs.rmSync(uiDir, { recursive: true, force: true })
console.log(failed ? `${failed} run(s) failed` : `done → ${outDir}`)
process.exit(failed ? 1 : 0)
