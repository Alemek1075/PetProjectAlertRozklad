const {
  app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain, shell, dialog, screen, net, nativeTheme,
} = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./lib/store');
const csv = require('./lib/csv');
const Sched = require('./lib/schedule.mjs');
const { alertHoursOpen, normalizeAlertHours } = require('./lib/alert-hours.mjs');
const { fetchActive, summarize, classifyError, errorText } = require('./lib/alerts');
const { assignSubjectColors, sameColors, cleanColors } = require('./lib/subjects');
const { iconPng, TRAY_REPS } = require('./lib/icon');

app.setPath('userData', process.env.RA_DATA_DIR || path.join(app.getPath('appData'), 'RozkladAlert'));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('lang', 'uk');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const POPUP_WIDTH = 400;
const POPUP_GAP = 12;
const OFFLINE_AFTER_MS = 5 * 60_000;
const POLL_MS = 30_000;
const MIN_REFRESH_GAP_MS = 15_000;

let store;
let tray;
let popup;
let editor;
let alerts = {
  status: 'loading', error: null, errorCode: null, errorStatus: null, updatedAt: null, regions: {}, focus: { active: false }, lastClear: null,
};
let lastExportPath = null;
let lastFetchAt = 0;
let pollTimer;
let popupHiddenAt = 0;
let popupContentHeight = 560;
const liveNotifications = new Set();
const firedReminders = new Set();

const newId = () => crypto.randomBytes(6).toString('hex');
const lessonKey = (l) => `${l.day}|${l.start}|${l.week || 'all'}|${l.subject.trim().toLowerCase()}`;
const weekAnchor = () => store.settings.weekAnchor || Sched.defaultAnchor();

function readToken() {
  if (process.env.RA_ALERTS_FIXTURE) return process.env.RA_FIXTURE_TOKEN ?? 'fixture';
  if (store.settings.token.trim()) return store.settings.token.trim();
  const dirs = [
    process.env.PORTABLE_EXECUTABLE_DIR,
    path.dirname(process.execPath),
    app.getAppPath(),
    app.getPath('userData'),
  ].filter(Boolean);
  for (const dir of dirs) {
    for (const name of ['Tocken.txt', 'token.txt', 'Token.txt']) {
      try {
        const t = fs.readFileSync(path.join(dir, name), 'utf8').replace(/^﻿/, '').trim();
        if (t) return t;
      } catch {
      }
    }
  }
  return '';
}

function publicState() {
  return {
    lessons: csv.sortLessons(store.lessons),
    settings: { ...store.settings, weekAnchor: weekAnchor(), token: undefined, hasToken: Boolean(readToken()), tokenFromSettings: Boolean(store.settings.token) },
    alerts: alerts.focus.name ? alerts : { ...alerts, focus: { ...alerts.focus, name: store.settings.region } },
  };
}

function broadcast(origin) {
  const state = publicState();
  for (const w of [popup, editor]) {
    if (w && !w.isDestroyed()) w.webContents.send('state', state, origin || null);
  }
  updateTray();
}

function playSound(kind) {
  if (!store.settings.sound) return;
  if (popup && !popup.isDestroyed()) popup.webContents.send('play-sound', kind);
}

const NBSP = ' ';
const pad2 = (n) => String(n).padStart(2, '0');
const clock = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const isoClock = (iso) => clock(new Date(iso));
const atTime = (hhmm) => `${hhmm.startsWith('11:') ? 'об' : 'о'}${NBSP}${hhmm}`;
const DAY_ACC = ['', 'у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у п’ятницю', 'у суботу', 'у неділю'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const TYPE_TITLES = {
  air_raid: 'Повітряна тривога',
  artillery_shelling: 'Загроза артобстрілу',
  urban_fights: 'Загроза вуличних боїв',
  chemical: 'Хімічна загроза',
  nuclear: 'Радіаційна загроза',
};
const THREAT_LABELS = {
  tactic_aircraft_activity: 'тактична авіація',
  strategic_aircraft_activity: 'стратегічна авіація',
  mig31k_departure: 'зліт МіГ-31К',
  ballistic_missiles: 'балістика',
  cruise_missiles: 'крилаті ракети',
  unspecified_missiles: 'ракети',
  drones: 'ударні дрони',
  guided_aerial_bombs: 'КАБи',
  air_defense: 'робота ППО',
  unknown: 'невідома загроза',
};

function fmtDuration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}${NBSP}хв`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h >= 24) return h % 24 ? `${Math.floor(h / 24)}${NBSP}д${NBSP}${h % 24}${NBSP}год` : `${Math.floor(h / 24)}${NBSP}д`;
  return r ? `${h}${NBSP}год${NBSP}${r}${NBSP}хв` : `${h}${NBSP}год`;
}

function whereText(region) {
  if (region === 'м. Київ') return 'у Києві';
  if (region === 'м. Севастополь') return 'у Севастополі';
  return `— ${region}`;
}
function withWhere(title, region) {
  const w = whereText(region);
  return w.startsWith('—') ? `${title}${NBSP}${w}` : `${title} ${w}`;
}
const mainType = (focus) => {
  const types = focus.types || [];
  return !types.length || types.includes('air_raid') ? 'air_raid' : types[0];
};
const alertTitle = (focus) => withWhere(TYPE_TITLES[mainType(focus)] || TYPE_TITLES.air_raid, focus.name);
const levelWord = (level) => (level === 'yellow' ? 'жовтий рівень' : 'червоний рівень');
const capitalize = (s) => (s ? s[0].toLocaleUpperCase('uk') + s.slice(1) : s);

function threatsSentence(threats) {
  const list = (threats || []).map((t) => THREAT_LABELS[t] || THREAT_LABELS.unknown).filter((v, i, a) => a.indexOf(v) === i);
  if (!list.length) return '';
  return `${list.length === 1 ? 'Загроза' : 'Загрози'}: ${list.join(', ')}.`;
}
function partialSentence(focus) {
  if (focus.full !== false || !focus.places || !focus.places.length) return '';
  const shown = focus.places.slice(0, 2);
  const rest = focus.places.length - shown.length;
  return `Частково: ${shown.join(', ')}${rest > 0 ? ` і${NBSP}ще${NBSP}${rest}` : ''}.`;
}

function nextWhen(daysAhead, date, start) {
  if (daysAhead <= 0) return atTime(start);
  if (daysAhead === 1) return `завтра ${atTime(start)}`;
  const dow = ((date.getDay() + 6) % 7) + 1;
  if (daysAhead < 7) return `${DAY_ACC[dow]} ${atTime(start)}`;
  return `${DAY_ACC[dow]}, ${date.getDate()}${NBSP}${MONTHS_GEN[date.getMonth()]}, ${atTime(start)}`;
}

function linkService(url) {
  let host = '';
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    host = String(url).toLowerCase();
  }
  if (/^zoom(mtg|us):/i.test(url) || /(^|\.)zoom\.(us|com)$/.test(host)) return 'Zoom';
  if (host === 'meet.google.com') return 'Google Meet';
  if (/^msteams:/i.test(url) || /(^|\.)teams\.(microsoft|live)\.com$/.test(host)) return 'Teams';
  return null;
}

const clip = (s, max) => (s.length > max ? `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…` : s);

const notificationIcons = new Map();
function notificationIcon(state) {
  const key = state || 'normal';
  if (!notificationIcons.has(key)) notificationIcons.set(key, nativeImage.createFromBuffer(iconPng(64, key, { kind: 'app' })));
  return notificationIcons.get(key);
}

function notify({ title, body, onClick, sound, icon = 'normal', sticky = false }) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title, body, silent: true, icon: notificationIcon(icon), timeoutType: sticky ? 'never' : 'default',
  });
  liveNotifications.add(n);
  const drop = () => liveNotifications.delete(n);
  n.on('click', () => { drop(); (onClick || showPopup)(); });
  n.on('close', drop);
  n.show();
  playSound(sound || 'lesson');
}

const taskbarDark = () => nativeTheme.shouldUseDarkColorsForSystemIntegratedUI;

let alertsErrorSince = 0;

function trayState() {
  if (alerts.status === 'error') alertsErrorSince ||= Date.now();
  else alertsErrorSince = 0;
  if (alerts.focus.active) return alerts.focus.level === 'yellow' ? 'yellow' : 'red';
  if (alertsErrorSince && Date.now() - alertsErrorSince > OFFLINE_AFTER_MS) return 'offline';
  return 'normal';
}

function trayImage(state, dark) {
  const img = nativeImage.createEmpty();
  for (const [scaleFactor, size] of TRAY_REPS) {
    img.addRepresentation({ scaleFactor, width: size, height: size, buffer: iconPng(size, state, { taskbarDark: dark }) });
  }
  return img;
}

function trayAlertLine() {
  const f = alerts.focus;
  const region = f.name || store.settings.region;
  if (f.active) {
    const since = f.startedAt ? `з${NBSP}${isoClock(f.startedAt)}` : '';
    const level = `${levelWord(f.level)}${f.full === false ? ', частково' : ''}`;
    const head = mainType(f) === 'air_raid' ? 'Тривога' : TYPE_TITLES[mainType(f)];
    const city = !whereText(region).startsWith('—');
    let line = city
      ? `${head} ${whereText(region)}${since ? ` ${since}` : ''} · ${level}`
      : `${withWhere(head, region)}${since ? `, ${since}` : ''} · ${level}`;
    if (alerts.status === 'error' && alerts.updatedAt) line += ` (дані від${NBSP}${isoClock(alerts.updatedAt)})`;
    return line;
  }
  if (alerts.status === 'error') return 'Немає даних про тривоги';
  if (alerts.status === 'loading') return 'Отримуємо дані про тривоги';
  if (region === 'м. Київ') return 'У Києві тривоги немає';
  if (region === 'м. Севастополь') return 'У Севастополі тривоги немає';
  return `${region}: тривоги немає`;
}

function trayLessonLine(max) {
  const next = Sched.upcoming(store.lessons, weekAnchor());
  if (!next) return null;
  const { lesson: l, current, daysAhead, date } = next;
  let prefix;
  let suffix;
  if (current) {
    const [h, m] = l.end.split(':').map(Number);
    const end = new Date();
    end.setHours(h, m, 0, 0);
    prefix = 'Зараз: ';
    suffix = ` (ще${NBSP}${fmtDuration(Math.max(1, Math.ceil((end - Date.now()) / 60_000)))})`;
  } else {
    prefix = 'Далі: ';
    suffix = daysAhead === 0 ? ` ${nextWhen(0, date, l.start)}` : `, ${nextWhen(daysAhead, date, l.start)}`;
  }
  return `${prefix}${clip(l.subject, Math.max(8, max - prefix.length - suffix.length))}${suffix}`;
}

const TOOLTIP_MAX = 127;
function trayTooltip() {
  const line1 = clip(trayAlertLine(), TOOLTIP_MAX);
  const line2 = trayLessonLine(TOOLTIP_MAX - line1.length - 1);
  return clip(line2 ? `${line1}\n${line2}` : line1, TOOLTIP_MAX);
}

let lastTrayKey = null;
function updateTray() {
  if (!tray) return;
  const state = trayState();
  const dark = taskbarDark();
  const key = `${state}|${dark}`;
  if (key !== lastTrayKey) {
    tray.setImage(trayImage(state, dark));
    lastTrayKey = key;
  }
  tray.setToolTip(trayTooltip());
}

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Відкрити', click: () => showPopup() },
    { label: 'Редактор розкладу', click: () => openEditor() },
    { label: 'Оновити дані про тривоги', click: () => pollAlerts(true) },
    { type: 'separator' },
    { label: 'Звук', type: 'checkbox', checked: store.settings.sound, click: (i) => updateSettings({ sound: i.checked }) },
    { label: 'Запускати з Windows', type: 'checkbox', checked: store.settings.autostart, click: (i) => updateSettings({ autostart: i.checked }) },
    { type: 'separator' },
    { label: 'Вийти', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}

function createTray() {
  const state = trayState();
  const dark = taskbarDark();
  tray = new Tray(trayImage(state, dark));
  lastTrayKey = `${state}|${dark}`;
  tray.on('click', () => togglePopup());
  tray.on('right-click', () => tray.popUpContextMenu(trayMenu()));
  updateTray();
}

function lockNavigation(win) {
  const wc = win.webContents;
  const page = (u) => String(u).split('#')[0];
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e, url) => {
    if (page(e.url || url) !== page(wc.getURL())) e.preventDefault();
  });
}

function loadUi(win, page, hash) {
  if (process.env.RA_DEV_URL) win.loadURL(`${process.env.RA_DEV_URL.replace(/\/$/, '')}/${page}.html${hash ? `#${hash}` : ''}`);
  else win.loadFile(path.join(process.env.RA_UI_DIR || path.join(__dirname, '..', 'build-ui'), `${page}.html`), hash ? { hash } : {});
}

const windowBackground = () => (nativeTheme.shouldUseDarkColors ? '#1e2022' : '#f8f9fb');
const windowForeground = () => (nativeTheme.shouldUseDarkColors ? '#eef0f3' : '#13181e');
const EDITOR_BAR = 44;
const titleBarOverlay = () => ({ color: windowBackground(), symbolColor: windowForeground(), height: EDITOR_BAR });

function createPopup() {
  popup = new BrowserWindow({
    width: POPUP_WIDTH,
    height: 560,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Розклад і тривоги',
    backgroundColor: windowBackground(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  lockNavigation(popup);
  loadUi(popup, 'popup');
  popup.on('show', () => popup.webContents.send('shown'));
  popup.on('hide', () => popup.webContents.send('hidden'));
  popup.on('blur', () => {
    if (popup.webContents.isDevToolsOpened()) return;
    popup.hide();
    popupHiddenAt = Date.now();
  });
  popup.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); popup.hide(); }
  });
}

function positionPopup(height = popupContentHeight) {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x + Math.round(trayBounds.width / 2), y: trayBounds.y + Math.round(trayBounds.height / 2) });
  const wa = display.workArea;
  const b = display.bounds;
  const h = Math.max(1, Math.min(Math.round(height), wa.height - 2 * POPUP_GAP));
  const clampX = (x) => Math.max(wa.x + POPUP_GAP, Math.min(x, wa.x + wa.width - POPUP_WIDTH - POPUP_GAP));
  const clampY = (y) => Math.max(wa.y + POPUP_GAP, Math.min(y, wa.y + wa.height - h - POPUP_GAP));
  const cx = trayBounds.x + trayBounds.width / 2;
  const cy = trayBounds.y + trayBounds.height / 2;
  let x;
  let y;
  if (wa.y + wa.height < b.y + b.height) {
    x = clampX(Math.round(cx - POPUP_WIDTH / 2));
    y = wa.y + wa.height - h - POPUP_GAP;
  } else if (wa.y > b.y) {
    x = clampX(Math.round(cx - POPUP_WIDTH / 2));
    y = wa.y + POPUP_GAP;
  } else if (wa.x > b.x) {
    x = wa.x + POPUP_GAP;
    y = clampY(Math.round(cy - h / 2));
  } else if (wa.x + wa.width < b.x + b.width) {
    x = wa.x + wa.width - POPUP_WIDTH - POPUP_GAP;
    y = clampY(Math.round(cy - h / 2));
  } else {
    x = clampX(Math.round(cx - POPUP_WIDTH / 2));
    y = cy > wa.y + wa.height / 2 ? wa.y + wa.height - h - POPUP_GAP : wa.y + POPUP_GAP;
  }
  popup.setBounds({ x, y, width: POPUP_WIDTH, height: h });
}

function showPopup() {
  positionPopup();
  popup.show();
  popup.focus();
  if (Date.now() - lastFetchAt > MIN_REFRESH_GAP_MS) pollAlerts();
}

function togglePopup() {
  if (popup.isVisible()) popup.hide();
  else if (Date.now() - popupHiddenAt > 250) showPopup();
}

function appWindowIcon() {
  const img = nativeImage.createEmpty();
  for (const [scaleFactor, size] of [[1, 32], [1.25, 40], [1.5, 48], [2, 64]]) {
    img.addRepresentation({ scaleFactor, width: size, height: size, buffer: iconPng(size, 'normal', { kind: 'app' }) });
  }
  return img;
}

const EDITOR_TARGETS = new Set([
  'schedule', 'schedule/list', 'settings', 'settings/reminders', 'settings/weeks', 'settings/alerts', 'settings/token',
  'settings/general', 'settings/csv', 'alert-hours', 'import',
]);

function editorZoomKeys(e, input) {
  if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
  const wc = editor.webContents;
  const level = wc.getZoomLevel();
  if (input.code === 'Equal' || input.code === 'NumpadAdd') wc.setZoomLevel(Math.min(level + 0.5, 3));
  else if (input.code === 'Minus' || input.code === 'NumpadSubtract') wc.setZoomLevel(Math.max(level - 0.5, -3));
  else if (input.code === 'Digit0' || input.code === 'Numpad0') wc.setZoomLevel(0);
  else return;
  e.preventDefault();
}

function openEditor(target) {
  if (!EDITOR_TARGETS.has(target)) target = undefined;
  if (popup.isVisible()) popup.hide();
  if (editor && !editor.isDestroyed()) {
    if (target) editor.webContents.send('navigate', target);
    if (editor.isMinimized()) editor.restore();
    editor.show();
    editor.focus();
    return;
  }
  editor = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    title: 'Розклад — редактор',
    icon: appWindowIcon(),
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarOverlay(),
    autoHideMenuBar: true,
    show: false,
    backgroundColor: windowBackground(),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  editor.setMenu(null);
  lockNavigation(editor);
  loadUi(editor, 'editor', target);
  editor.webContents.on('before-input-event', editorZoomKeys);
  editor.on('page-title-updated', (e) => e.preventDefault());
  editor.once('ready-to-show', () => {
    editor.maximize();
    editor.show();
  });
  editor.on('closed', () => { editor = null; });
}

function syncTheme() {
  const bg = windowBackground();
  if (popup && !popup.isDestroyed()) popup.setBackgroundColor(bg);
  if (editor && !editor.isDestroyed()) {
    editor.setBackgroundColor(bg);
    editor.setTitleBarOverlay(titleBarOverlay());
  }
  updateTray();
}

let pollInFlight = null;
let pollQueued = false;

function pollAlerts(manual = false) {
  if (pollInFlight) {
    if (manual) pollQueued = true;
    return pollInFlight;
  }
  pollInFlight = runPoll(manual).finally(() => {
    pollInFlight = null;
    if (!pollQueued) return undefined;
    pollQueued = false;
    return pollAlerts(true);
  });
  return pollInFlight;
}

async function runPoll(manual) {
  clearTimeout(pollTimer);
  let delay = POLL_MS;
  try {
    const fixture = process.env.RA_ALERTS_FIXTURE;
    const token = readToken();
    if (!token) {
      setAlertsError({ code: 'no-token' });
      broadcast();
      return;
    }
    if (!manual && Date.now() - lastFetchAt < MIN_REFRESH_GAP_MS) {
      delay = MIN_REFRESH_GAP_MS;
      return;
    }
    lastFetchAt = Date.now();
    let payload = null;
    try {
      if (fixture) {
        payload = JSON.parse(fs.readFileSync(fixture, 'utf8'));
        if (payload.__prior) applyAlertsPayload(payload.__prior, payload.__priorAt ? new Date(payload.__priorAt) : new Date(), false);
      } else {
        payload = await fetchActive(net.fetch, token);
      }
      if (payload.__error) throw Object.assign(new Error(payload.__error.message || ''), payload.__error);
      applyAlertsPayload(payload, new Date(), !payload.__prior);
    } catch (e) {
      const err = setAlertsError(e);
      if (err.code === 'rate-limit') delay = 60_000;
    }
    if (fixture && payload && payload.__patch) Object.assign(alerts, payload.__patch);
    broadcast();
  } finally {
    pollTimer = setTimeout(pollAlerts, delay);
  }
}

function applyAlertsPayload(payload, at, announce) {
  const prev = alerts;
  const summary = summarize(payload, store.settings.region);
  let lastClear = prev.lastClear || null;
  if (prev.focus.active && !summary.focus.active && prev.focus.name === summary.focus.name) {
    lastClear = { startedAt: prev.focus.startedAt, endedAt: at.toISOString(), level: prev.focus.level || 'red' };
  }
  alerts = {
    status: 'ok', error: null, errorCode: null, errorStatus: null, updatedAt: at.toISOString(), ...summary, lastClear,
  };
  if (announce && prev.updatedAt) announceChange(prev.focus, alerts.focus, prev.status !== 'ok');
  else alertAnnounced = alerts.focus.active && alertHoursOpen(store.settings.alertHours);
}

function setAlertsError(e) {
  const err = classifyError(e);
  alerts = { ...alerts, status: 'error', error: err.message || errorText(err.code), errorCode: err.code, errorStatus: err.status };
  return err;
}

let alertAnnounced = false;

function announceChange(prev, cur, afterOutage = false) {
  if (!store.settings.alertNotifications || prev.name !== cur.name) {
    alertAnnounced = false;
    return;
  }
  const open = alertHoursOpen(store.settings.alertHours);
  const where = whereText(cur.name);
  const join = (...parts) => parts.filter(Boolean).join(' ');
  const announceStart = (ongoing) => {
    const since = cur.startedAt ? ` · ${ongoing ? 'триває ' : ''}з${NBSP}${isoClock(cur.startedAt)}` : ongoing ? ' · триває' : '';
    notify({
      title: alertTitle(cur),
      body: join(`${capitalize(levelWord(cur.level))}${since}.`, threatsSentence(cur.threats), partialSentence(cur)),
      sound: 'alert',
      icon: cur.level === 'yellow' ? 'yellow' : 'red',
      sticky: cur.level !== 'yellow',
    });
    alertAnnounced = true;
  };
  if (!prev.active && cur.active) {
    alertAnnounced = false;
    if (open) announceStart(false);
  } else if (prev.active && !cur.active) {
    if (alertAnnounced) {
      const endedAt = new Date();
      const lasted = prev.startedAt && !afterOutage
        ? `Тривала ${fmtDuration((endedAt - new Date(prev.startedAt)) / 60_000)} (${isoClock(prev.startedAt)}–${clock(endedAt)}).`
        : '';
      notify({ title: withWhere('Відбій тривоги', cur.name), body: lasted, sound: 'clear', icon: 'normal' });
    }
    alertAnnounced = false;
  } else if (cur.active && !alertAnnounced) {
    if (open) announceStart(true);
  } else if (prev.active && cur.active && prev.level !== cur.level && open) {
    const sep = where.startsWith('—') ? `${NBSP}${where}` : ` ${where}`;
    notify({
      title: `Тривога${sep}: тепер ${levelWord(cur.level)}`,
      body: cur.startedAt ? `Тривога триває з${NBSP}${isoClock(cur.startedAt)}.` : '',
      sound: 'alert',
      icon: cur.level === 'yellow' ? 'yellow' : 'red',
    });
  }
}

function reminderCopy(l, type, before) {
  const service = l.link ? linkService(l.link) : null;
  let action = '';
  if (l.link) {
    if (!service) action = 'натисніть, щоб відкрити посилання';
    else action = type === 'pre' ? `натисніть, щоб відкрити ${service}` : `натисніть, щоб приєднатися в ${service}`;
  }
  return {
    title: type === 'pre' ? `Через ${fmtDuration(before)}: ${l.subject}` : `Почалася пара: ${l.subject}`,
    body: `${l.start}–${l.end}${action ? ` · ${action}` : ''}`,
  };
}

function checkReminders() {
  const now = new Date();
  const dateKey = now.toDateString();
  const { remindBefore, remindAtStart } = store.settings;
  for (const l of Sched.lessonsOn(store.lessons, now, weekAnchor())) {
    if (!l.remind) continue;
    const [h, m] = l.start.split(':').map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    const events = [];
    if (remindBefore > 0) events.push(['pre', start.getTime() - remindBefore * 60_000]);
    if (remindAtStart) events.push(['start', start.getTime()]);
    for (const [type, at] of events) {
      const key = `${dateKey}|${l.id}|${type}`;
      if (firedReminders.has(key)) continue;
      if (now.getTime() >= at && now.getTime() - at < 120_000) {
        firedReminders.add(key);
        notify({
          ...reminderCopy(l, type, remindBefore),
          onClick: l.link ? () => openLink(l.link) : showPopup,
          sound: 'lesson',
        });
      }
    }
  }
  for (const key of firedReminders) if (!key.startsWith(dateKey)) firedReminders.delete(key);
  updateTray();
}

function openLink(url) {
  url = typeof url === 'string' ? url.trim() : '';
  if (!url) return;
  if (!/^(https?|zoommtg|zoomus|msteams):/i.test(url)) url = `https://${url}`;
  shell.openExternal(url).catch(() => {});
}

function applyAutostart() {
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  app.setLoginItemSettings({
    openAtLogin: store.settings.autostart,
    path: exe,
    args: app.isPackaged ? [] : [app.getAppPath()],
  });
}

function applyTheme() {
  const t = store.settings.theme;
  nativeTheme.themeSource = process.env.RA_THEME || (['light', 'dark'].includes(t) ? t : 'system');
  syncTheme();
}

function updateSettings(patch, origin) {
  const prevRegion = store.settings.region;
  const prevToken = readToken();
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in store.settings)) continue;
    store.settings[k] = k === 'subjectColors' ? cleanColors(v) : k === 'alertHours' ? normalizeAlertHours(v) : v;
  }
  if ('subjectColors' in patch) syncSubjectColors();
  store.save();
  if ('autostart' in patch) applyAutostart();
  if ('theme' in patch) applyTheme();
  if (store.settings.region !== prevRegion || readToken() !== prevToken) {
    alerts = { ...alerts, focus: { name: store.settings.region, active: false }, lastClear: null };
    pollAlerts(true);
  }
  broadcast(origin);
}

function normalizeLesson(l) {
  const time = csv.parseTime(`${l.start}${l.end ? `-${l.end}` : ''}`, store.settings.defaultDuration);
  if (!time) return null;
  return {
    id: l.id || newId(),
    day: Math.min(7, Math.max(1, Number(l.day) || 1)),
    start: time.start,
    end: time.end,
    subject: String(l.subject || '').trim() || 'Без назви',
    link: String(l.link || '').trim(),
    week: ['odd', 'even'].includes(l.week) ? l.week : 'all',
    remind: Boolean(l.remind),
  };
}

function syncSubjectColors() {
  const next = assignSubjectColors(store.lessons, store.settings.subjectColors);
  if (sameColors(next, store.settings.subjectColors)) return false;
  store.settings.subjectColors = next;
  return true;
}

function importPreview(text, source) {
  const { lessons, issues, rows, hasRemindColumn } = csv.parseCsv(text, store.settings.defaultDuration);
  const prevByKey = new Map(store.lessons.map((l) => [lessonKey(l), l]));
  const out = lessons.map((l) => {
    const n = { ...l, subject: String(l.subject || '').trim() || 'Без назви', link: String(l.link || '').trim() };
    const prev = prevByKey.get(lessonKey(n));
    if (n.remind === undefined && prev) n.remind = Boolean(prev.remind);
    if (n.remind === undefined) delete n.remind;
    return n;
  });
  return {
    source,
    lessons: out,
    issues,
    rows,
    existingCount: store.lessons.length,
    duplicateLines: out.filter((l) => prevByKey.has(lessonKey(l))).map((l) => l.line),
    hasRemindColumn,
  };
}

async function pickCsv() {
  const win = editor && !editor.isDestroyed() ? editor : undefined;
  const pick = await dialog.showOpenDialog(win, {
    title: 'Імпорт розкладу (CSV)',
    filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
    properties: ['openFile'],
  });
  if (pick.canceled || !pick.filePaths[0]) return { canceled: true };
  const text = fs.readFileSync(pick.filePaths[0], 'utf8');
  return importPreview(text, path.basename(pick.filePaths[0]));
}

function applyImport(list, mode) {
  mode = mode === 'append' ? 'append' : 'replace';
  const prevByKey = new Map(store.lessons.map((l) => [lessonKey(l), l]));
  const imported = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const n = normalizeLesson({ ...raw, id: undefined });
    if (!n) continue;
    n.remind = typeof raw.remind === 'boolean' ? raw.remind : Boolean(prevByKey.get(lessonKey(n))?.remind);
    imported.push(n);
  }
  let added = imported.length;
  let skippedDuplicates = 0;
  if (mode === 'replace') {
    store.lessons = imported;
  } else {
    const fresh = imported.filter((l) => !prevByKey.has(lessonKey(l)));
    skippedDuplicates = imported.length - fresh.length;
    added = fresh.length;
    store.lessons = [...store.lessons, ...fresh];
  }
  syncSubjectColors();
  store.save();
  broadcast();
  return { added, skippedDuplicates, mode };
}

async function exportCsvDialog() {
  const win = editor && !editor.isDestroyed() ? editor : undefined;
  const r = await dialog.showSaveDialog(win, {
    title: 'Експорт розкладу (CSV)',
    defaultPath: path.join(app.getPath('documents'), 'rozklad.csv'),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (r.canceled || !r.filePath) return { canceled: true };
  fs.writeFileSync(r.filePath, csv.exportCsv(store.lessons), 'utf8');
  lastExportPath = r.filePath;
  return { path: r.filePath, count: store.lessons.length };
}

ipcMain.handle('get-state', () => publicState());
ipcMain.handle('whoami', (e) => e.sender.id);
ipcMain.handle('save-lessons', (e, lessons) => {
  store.lessons = (Array.isArray(lessons) ? lessons : []).map(normalizeLesson).filter(Boolean);
  syncSubjectColors();
  store.save();
  broadcast(e.sender.id);
  return publicState();
});
ipcMain.handle('set-remind', (e, id, value) => {
  const l = store.lessons.find((x) => x.id === id);
  if (l) { l.remind = Boolean(value); store.save(); broadcast(); }
});
ipcMain.handle('save-settings', (e, patch) => { updateSettings(patch, e.sender.id); return publicState(); });
ipcMain.handle('pick-csv', () => pickCsv());
ipcMain.handle('parse-csv-text', (e, text, source) => importPreview(String(text ?? ''), String(source || 'Буфер обміну')));
ipcMain.handle('apply-import', (e, lessons, mode) => applyImport(lessons, mode));
ipcMain.handle('export-csv', () => exportCsvDialog());
ipcMain.on('reveal-in-folder', (e, p) => { if (p && p === lastExportPath) shell.showItemInFolder(p); });
ipcMain.handle('refresh-alerts', () => pollAlerts(true));
ipcMain.on('open-link', (e, url) => { openLink(url); if (popup.isVisible()) popup.hide(); });
ipcMain.on('open-editor', (e, target) => openEditor(typeof target === 'string' ? target : undefined));
ipcMain.on('hide-popup', () => popup.hide());
ipcMain.on('test-sound', (e, kind) => { if (popup) popup.webContents.send('play-sound', kind || 'lesson'); });
ipcMain.on('popup-height', (e, h) => {
  if (!popup || !(h > 0)) return;
  popupContentHeight = h;
  if (popup.isVisible() && Math.abs(popup.getBounds().height - h) >= 2) positionPopup(h);
});

app.on('second-instance', () => { if (popup && tray) showPopup(); });
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { app.isQuitting = true; });

app.whenReady().then(() => {
  app.setAppUserModelId(app.isPackaged ? 'ua.rozklad.alert' : process.execPath);
  store = new Store(app.getPath('userData'));
  if (syncSubjectColors()) store.save();
  applyTheme();
  createPopup();
  createTray();
  nativeTheme.on('updated', syncTheme);
  applyAutostart();
  pollAlerts(true);
  checkReminders();
  setInterval(checkReminders, 15_000);
  if (process.argv.includes('--editor')) openEditor();
});
