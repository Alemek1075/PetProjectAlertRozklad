const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXE_NAME = 'RozkladAlert.exe';
const EXE = path.join(ROOT, 'dist', EXE_NAME);
const args = new Set(process.argv.slice(2));

const log = (msg) => console.log(`[${new Date().toLocaleTimeString('uk-UA')}] ${msg}`);

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: true });
  return r.status === 0;
}

function ensureDeps() {
  const electronOk = fs.existsSync(path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'));
  const builderOk = fs.existsSync(path.join(ROOT, 'node_modules', 'electron-builder'));
  if (electronOk && builderOk) return true;
  log('Встановлюю залежності…');
  return run('npm', ['install']) && run('npm', ['rebuild', 'electron']);
}

function isRunning() {
  const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${EXE_NAME}`, '/NH'], { encoding: 'utf8' });
  return (r.stdout || '').toLowerCase().includes(EXE_NAME.toLowerCase());
}

function stopApp() {
  if (!isRunning()) return false;
  log('Закриваю запущений RozkladAlert…');
  spawnSync('taskkill', ['/F', '/T', '/IM', EXE_NAME], { stdio: 'ignore' });
  for (let i = 0; i < 20 && isRunning(); i++) spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 250']);
  return true;
}

function copyToken() {
  for (const name of ['Tocken.txt', 'token.txt']) {
    const src = path.join(ROOT, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(ROOT, 'dist', name));
      return name;
    }
  }
  return null;
}

function build() {
  const started = Date.now();
  if (!ensureDeps()) {
    log('Не вдалося встановити залежності.');
    return false;
  }
  log('Збираю інтерфейс (vite)…');
  if (!run('npx', ['vite', 'build', '--logLevel', 'warn'])) {
    log('Збірка інтерфейсу впала, дивіться лог вище.');
    return false;
  }
  const wasRunning = stopApp();
  log('Збираю exe…');
  if (!run('npx', ['electron-builder', '--win', 'portable'])) {
    log('Збірка впала, дивіться лог вище.');
    return false;
  }
  const token = copyToken();
  const size = (fs.statSync(EXE).size / 1024 / 1024).toFixed(0);
  log(`Готово за ${Math.round((Date.now() - started) / 1000)} с: dist\\${EXE_NAME} (${size} МБ)${token ? `, поруч ${token}` : ', токена поруч немає — вставте його в редакторі'}`);
  if (!args.has('--no-run') && (wasRunning || args.has('--run'))) {
    spawn(EXE, [], { detached: true, stdio: 'ignore' }).unref();
    log('Запустив нову версію.');
  }
  return true;
}

if (!args.has('--watch')) {
  process.exit(build() ? 0 : 1);
}

let timer = null;
let building = false;
let queued = false;

function trigger(file) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (building) { queued = true; return; }
    building = true;
    log(`Зміна: ${file}`);
    build();
    building = false;
    if (queued) { queued = false; trigger('(накопичені зміни)'); }
  }, 1500);
}

build();
fs.watch(path.join(ROOT, 'src'), { recursive: true }, (_e, file) => file && trigger(`src\\${file}`));
fs.watch(path.join(ROOT, 'ui'), { recursive: true }, (_e, file) => file && trigger(`ui\\${file}`));
fs.watch(path.join(ROOT, 'package.json'), () => trigger('package.json'));
log('Стежу за src\\, ui\\ і package.json. Ctrl+C — вийти.');
