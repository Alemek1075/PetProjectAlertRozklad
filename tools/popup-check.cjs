const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
const fs = require('fs');
const path = require('path');

const SHORT = Number(process.env.SHOT_SHORT) || 0;
if (SHORT) {
  app.once('ready', () => {
    const { screen } = electron;
    const real = screen.getDisplayNearestPoint.bind(screen);
    screen.getDisplayNearestPoint = (pt) => {
      const d = real(pt);
      const bottom = d.workArea.y + d.workArea.height;
      return { ...d, workArea: { ...d.workArea, y: bottom - SHORT, height: SHORT } };
    };
  });
}

require(path.join(__dirname, '..', 'src', 'main.js'));

app.on('web-contents-created', (_e, wc) => {
  wc.on('console-message', (e, level, message) => {
    const lvl = e.level ?? level;
    if (lvl === 'error' || lvl === 3) console.log('renderer error:', e.message ?? message);
  });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const heights = [];
const times = [];
let t0 = Date.now();
ipcMain.on('popup-height', (_e, h) => { heights.push(h); times.push(Date.now() - t0); });
const take = () => { times.length = 0; t0 = Date.now(); return heights.splice(0, heights.length); };
const bounds = (w) => JSON.stringify(w.getBounds());
let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log(`check ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

app.whenReady().then(async () => {
  await wait(2500);
  try {
    const findPopup = () => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('popup'));
    const popup = findPopup();
    popup.removeAllListeners('blur');
    const js = (code) => popup.webContents.executeJavaScript(`(async () => { ${code} })()`);
    const key = (code) => js(`const m = document.querySelector('main'); m.focus();
      m.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', key: '', bubbles: true, cancelable: true }))`);
    const selectedDay = () => js(`return document.querySelector('[role=radio][aria-checked=true]')?.getAttribute('aria-label') ?? null`);
    const show = async () => {
      app.emit('second-instance');
      await wait(900);
    };

    if (SHORT) {
      await js(`Object.defineProperty(screen, 'availHeight', { get: () => ${SHORT}, configurable: true })`);
      await show();
      const before = bounds(popup);
      take();
      popup.hide();
      await wait(500);
      const hiddenReports = take();
      await show();
      const atShow = bounds(popup);
      await wait(800);
      const afterShow = take();
      console.log(`check info: before hide ${before}; reports while hidden ${JSON.stringify(hiddenReports)}; at show ${atShow}; reports after show ${JSON.stringify(afterShow)}; now ${bounds(popup)}`);
      const info = await js(`const b = [...document.querySelectorAll('main button')].find((x) => /Zoom|Meet|Teams|Відкрити/.test(x.textContent) && x.className.includes('bg-primary'));
        const trig = [...document.querySelectorAll('button[aria-expanded]')].find((x) => x.textContent.includes('Мапа тривог'));
        return { joinTop: b ? Math.round(b.getBoundingClientRect().top) : null, mapOpen: trig?.getAttribute('aria-expanded'),
          trigger: trig?.textContent ?? null, gaps: [...document.querySelectorAll('li')].filter((li) => li.textContent.startsWith('вікно') && !li.closest('[inert]')).length,
          innerHeight }`);
      check('#6 short screen: map collapsed', info.mapOpen === 'false', info.trigger);
      check('#6 short screen: no «вікно» rows', info.gaps === 0, `${info.gaps} rows`);
      check('#6 short screen: join visible without scrolling', info.joinTop !== null && info.joinTop < info.innerHeight, `join top ${info.joinTop}, window ${info.innerHeight}`);
      const img = await popup.webContents.capturePage();
      fs.writeFileSync(`${process.env.SHOT_OUT}-short-popup.png`, img.toPNG());
      console.log('saved', `${process.env.SHOT_OUT}-short-popup.png`);
    } else {
      await show();
      await wait(600);

      const start = bounds(popup);
      const moved = [];
      for (let d = 1; d <= 7; d++) {
        await key(`Digit${d}`);
        await wait(250);
        if (bounds(popup) !== start) moved.push(`key ${d}: ${bounds(popup)}`);
        await js(`document.querySelectorAll('[role=radio]')[${d - 1}]?.click()`);
        await wait(250);
        if (bounds(popup) !== start) moved.push(`click ${d}: ${bounds(popup)}`);
      }
      check('#7 day switch keeps the window bounds', moved.length === 0, moved.length ? moved.join('; ') : start);
      await key('KeyT');
      await wait(300);
      take();

      const hasMap = await js(`return !!document.querySelector('section[aria-label="Мапа тривог"]')`);
      if (hasMap) {
        await key('KeyM');
        await wait(900);
        const open = take();
        check('#8 map toggle: one height report', open.length === 1, `reports ${JSON.stringify(open)}`);
        const listBtn = await js(`const b = [...document.querySelectorAll('button')].find((x) => x.textContent.startsWith('Області з тривогою')); b?.click(); return !!b`);
        if (listBtn) {
          await wait(900);
          const list = take();
          check('#8 region list: one height report', list.length === 1, `reports ${JSON.stringify(list)}`);
        }
        await key('KeyM');
        await wait(900);
        const close = take();
        check('#8 map close: one height report', close.length === 1, `reports ${JSON.stringify(close)}`);
      }
      const inAlert = await js(`return !!document.querySelector('.alert-band')`)
      if (process.env.SHOT_CHECK_ALERT && !inAlert) {
        fs.writeFileSync(process.env.RA_ALERTS_FIXTURE, process.env.SHOT_CHECK_ALERT);
        take();
        await key('KeyR');
        await wait(1500);
        const at = times.join('/');
        const alert = take();
        check('#8 alert arriving: one height report', alert.length === 1, `reports ${JSON.stringify(alert)} at ${at} ms`);
      }

      const today = await selectedDay();
      await key('Digit3');
      await key('KeyW');
      if (inAlert) await key('KeyM');
      await wait(300);
      popup.hide();
      await wait(600);
      take();
      app.emit('second-instance');
      const samples = [bounds(popup)];
      for (const gap of [40, 80, 180, 400]) {
        await wait(gap);
        samples.push(bounds(popup));
      }
      const after = take();
      const back = await selectedDay();
      const alertNow = await js(`return !!document.querySelector('.alert-band')`);
      if (alertNow) {
        const mapOpen = await js(`return [...document.querySelectorAll('button[aria-expanded]')].find((x) => x.textContent.includes('Мапа тривог'))?.getAttribute('aria-expanded')`);
        check('#18 alert: map default recomputed on hide (opens when it fits)', mapOpen === 'true', `aria-expanded=${mapOpen}`);
      }
      check('#18 reopens on today', back === today, `${back} (today ${today})`);
      check('#18 no jump after show', new Set(samples).size === 1 && after.length === 0, `bounds ${[...new Set(samples)].join(' → ')}; reports after show ${JSON.stringify(after)}`);
    }
  } catch (e) {
    console.error('check failed:', e);
    failed++;
  }
  console.log(failed ? `check FAILED ${failed}` : 'check done');
  process.exitCode = failed ? 1 : 0;
  app.isQuitting = true;
  app.quit();
});
