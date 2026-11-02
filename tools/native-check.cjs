const { app, BrowserWindow, desktopCapturer, screen, ipcMain, nativeTheme } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ra-native-'));
process.env.RA_DATA_DIR = dataDir;
process.env.RA_THEME = 'light';
process.env.RA_ALERTS_FIXTURE = process.env.RA_ALERTS_FIXTURE || path.join(__dirname, 'fixtures', 'alerts-snapshot.json');
require(path.join(__dirname, '..', 'src', 'main.js'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BG = [0xf8, 0xf9, 0xfb];
const MAGENTA = [255, 0, 255];

async function grab() {
  const d = screen.getPrimaryDisplay();
  const size = { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
  const [src] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
  const img = src.thumbnail;
  const { width, height } = img.getSize();
  const bmp = img.toBitmap();
  const k = width / d.size.width;
  return {
    at: Date.now(),
    px(x, y) {
      const X = Math.min(width - 1, Math.round(x * k));
      const Y = Math.min(height - 1, Math.round(y * k));
      const i = (Y * width + X) * 4;
      return [bmp[i + 2], bmp[i + 1], bmp[i]];
    },
    k,
  };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const classify = (c) => (dist(c, BG) < 12 ? 'window' : c[1] < 120 && c[0] > 60 && c[2] > 60 ? 'backdrop/shadow' : 'other');

function backdrop(rect) {
  const w = new BrowserWindow({
    ...rect, frame: false, show: false, focusable: false, skipTaskbar: true, resizable: false, alwaysOnTop: true,
    thickFrame: false, backgroundColor: hex(MAGENTA),
  });
  w.loadURL('data:text/html,<body style="margin:0;background:%23ff00ff"></body>');
  return w;
}

function sampleWhile(x, y, ms, trigger) {
  const ps = `Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1, 1
$g = [System.Drawing.Graphics]::FromImage($bmp)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
[Console]::Out.WriteLine('ready'); [Console]::Out.Flush()
$out = New-Object System.Text.StringBuilder
while ($sw.ElapsedMilliseconds -lt ${ms + 300}) {
  $g.CopyFromScreen(${x}, ${y}, 0, 0, (New-Object System.Drawing.Size 1, 1))
  $c = $bmp.GetPixel(0, 0)
  [void]$out.AppendLine("$($sw.ElapsedMilliseconds) $($c.R) $($c.G) $($c.B)")
}
[Console]::Out.Write($out.ToString())`;
  return new Promise((resolve) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
    let buf = '';
    let t0 = 0;
    p.stdout.on('data', (d) => {
      buf += d;
      if (!t0 && buf.includes('ready')) { t0 = 1; setTimeout(trigger, 150); }
    });
    p.on('close', () => {
      const rows = buf.split(/\r?\n/).filter((l) => /^\d+ \d+ \d+ \d+$/.test(l)).map((l) => l.split(' ').map(Number));
      resolve(rows.filter((r, i) => i === 0 || r.slice(1).join() !== rows[i - 1].slice(1).join()));
    });
  });
}

async function cornerProbe(win) {
  const b = win.getBounds();
  const shot = await grab();
  const inset = 1.5 / shot.k + 0.01;
  const corner = shot.px(b.x + inset, b.y + inset);
  const edge = shot.px(b.x + b.width / 2, b.y + 4);
  return { bounds: b, corner: hex(corner), cornerIs: classify(corner), edgeMid: hex(edge), rounded: classify(corner) !== 'window' };
}

async function testWindow(resizable) {
  const d = screen.getPrimaryDisplay().workArea;
  const rect = { x: d.x + 200, y: d.y + 120, width: 400, height: 300 };
  const back = backdrop({ x: rect.x - 40, y: rect.y - 40, width: rect.width + 80, height: rect.height + 80 });
  await wait(300);
  back.showInactive();
  const w = new BrowserWindow({
    ...rect, frame: false, show: false, resizable, skipTaskbar: true, alwaysOnTop: true, backgroundColor: hex(BG),
  });
  w.loadURL('data:text/html,<body style="margin:0;background:%23f8f9fb"></body>');
  await new Promise((r) => w.once('ready-to-show', r));

  const k = screen.getPrimaryDisplay().scaleFactor;
  const samples = await sampleWhile(Math.round((rect.x + rect.width / 2) * k), Math.round((rect.y + rect.height / 2) * k), 700, () => w.show());
  const frames = samples.map(([ms, r, g, b]) => ({ ms, centre: hex([r, g, b]), d: Math.round(dist([r, g, b], BG)) }));
  await wait(300);
  const corner = await cornerProbe(w);
  w.destroy();
  back.destroy();
  return { resizable, corner, frames };
}

async function realPopup() {
  const popup = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('popup'));
  app.emit('second-instance');
  await wait(1500);
  const b = popup.getBounds();
  const back = backdrop({ x: b.x - 30, y: b.y - 30, width: b.width + 60, height: b.height + 60 });
  await wait(300);
  back.showInactive();
  popup.moveTop();
  await wait(500);
  const probe = await cornerProbe(popup);
  const wa = screen.getDisplayMatching(b).workArea;
  const gaps = { left: b.x - wa.x, right: wa.x + wa.width - (b.x + b.width), top: b.y - wa.y, bottom: wa.y + wa.height - (b.y + b.height) };
  back.destroy();
  popup.hide();
  return { ...probe, width: b.width, gaps, resizableFlag: popup.isResizable() };
}

async function editorEnv() {
  ipcMain.emit('open-editor');
  let editor;
  for (let i = 0; i < 60 && !editor?.isVisible(); i++) {
    await wait(100);
    editor = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('editor'));
  }
  await wait(1200);
  const res = await editor.webContents.executeJavaScript(`(() => {
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;left:0;top:0;height:1px;visibility:hidden;' +
      'width:env(titlebar-area-width, 12345px);margin-left:env(titlebar-area-x, 777px)'
    document.body.append(d)
    const cs = getComputedStyle(d)
    const out = { width: cs.width, x: cs.marginLeft, innerWidth: window.innerWidth,
      wco: navigator.windowControlsOverlay ? { visible: navigator.windowControlsOverlay.visible,
        rect: (({ x, y, width, height }) => ({ x, y, width, height }))(navigator.windowControlsOverlay.getTitlebarAreaRect()) } : null }
    d.remove()
    return out
  })()`);
  const popup = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('popup'));
  const before = { popup: popup.getBackgroundColor(), editor: editor.getBackgroundColor() };
  nativeTheme.themeSource = 'dark';
  await wait(400);
  const after = { popup: popup.getBackgroundColor(), editor: editor.getBackgroundColor() };
  nativeTheme.themeSource = 'light';
  const overlay = editor.getBounds();
  editor.destroy();
  return { ...res, resolves: res.width !== '12345px' && res.x !== '777px', windowWidth: overlay.width, themeSync: { before, after } };
}

app.whenReady().then(async () => {
  await wait(2500);
  const report = { electron: process.versions.electron, os: `${os.type()} ${os.release()}`, scale: screen.getPrimaryDisplay().scaleFactor };
  try {
    report.resizableFalse = await testWindow(false);
    report.resizableTrue = await testWindow(true);
    report.popup = await realPopup();
    report.titlebarEnv = await editorEnv();
  } catch (e) {
    report.error = String(e && e.stack || e);
    process.exitCode = 1;
  }
  const animated = (r) => r.frames.filter((f) => f.d > 12 && f.d < dist(MAGENTA, BG) - 12).length > 1;
  report.summary = {
    '11.4.1 DWM animates show (resizable:true)': report.resizableTrue && animated(report.resizableTrue),
    '11.4.1 DWM animates show (resizable:false)': report.resizableFalse && animated(report.resizableFalse),
    '11.4.2 rounded with resizable:false': report.resizableFalse?.corner.rounded,
    '11.4.2 rounded with resizable:true': report.resizableTrue?.corner.rounded,
    'popup rounded (real app)': report.popup?.rounded,
    '11.4.3 env(titlebar-area-*) resolves': report.titlebarEnv?.resolves,
  };
  console.log(JSON.stringify(report, null, 2));
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {  }
  app.isQuitting = true;
  app.quit();
});
