const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

require(path.join(__dirname, '..', 'src', 'main.js'));

app.on('web-contents-created', (_e, wc) => {
  wc.on('console-message', (e, level, message) => {
    const lvl = e.level ?? level;
    const msg = e.message ?? message;
    if (lvl === 'error' || lvl === 3) console.log('renderer error:', msg);
  });
  wc.on('render-process-gone', (_ev, d) => console.log('renderer error: process gone', d.reason));
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.env.SHOT_ONLY || '';

async function pressKeys(win, keys) {
  for (const k of keys.split(',').map((x) => x.trim()).filter(Boolean)) {
    const parts = k.split('+');
    const keyCode = parts.pop();
    const modifiers = parts.map((m) => m.toLowerCase());
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
    await wait(120);
  }
  await wait(400);
}

async function capture(win, file, js, keys) {
  if (js) {
    await win.webContents.executeJavaScript(`(async () => { ${js} })()`);
    await wait(700);
  }
  if (keys) await pressKeys(win, keys);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(file, img.toPNG());
  console.log('saved', file);
}

app.whenReady().then(async () => {
  await wait(2500);
  try {
    if (only !== 'editor') {
      const findPopup = () => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('popup'));
      findPopup()?.removeAllListeners('blur');
      app.emit('second-instance');
      await wait(1600);
      const popup = findPopup();
      popup.removeAllListeners('blur');
      if (!popup.isVisible()) {
        app.emit('second-instance');
        await wait(1200);
      }
      await capture(popup, `${process.env.SHOT_OUT}-popup.png`, process.env.SHOT_POPUP_JS, process.env.SHOT_POPUP_KEYS);
      popup.hide();
    }
    if (only !== 'popup') {
      const { ipcMain } = require('electron');
      ipcMain.emit('open-editor');
      let editor;
      for (let i = 0; i < 50 && !editor?.isVisible(); i++) {
        await wait(100);
        editor = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('editor'));
      }
      const [w, h] = (process.env.SHOT_EDITOR_SIZE || '1440x900').split('x').map(Number);
      editor.unmaximize();
      editor.setSize(w, h);
      editor.center();
      await wait(1800);
      await capture(editor, `${process.env.SHOT_OUT}-editor.png`, process.env.SHOT_EDITOR_JS, process.env.SHOT_EDITOR_KEYS);
    }
  } catch (e) {
    console.error('shot failed:', e);
    process.exitCode = 1;
  }
  app.isQuitting = true;
  app.quit();
});
