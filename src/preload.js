const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, map) => (cb) => {
  const listener = (_e, ...args) => cb(...(map ? map(...args) : args));
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('get-state'),
  whoami: () => ipcRenderer.invoke('whoami'),
  onState: on('state', (state, origin) => [state, origin ?? null]),
  onShown: on('shown', () => []),
  onHidden: on('hidden', () => []),
  onNavigate: on('navigate', (target) => [target]),
  onPlaySound: on('play-sound', (kind) => [kind]),
  saveLessons: (lessons) => ipcRenderer.invoke('save-lessons', lessons),
  setRemind: (id, value) => ipcRenderer.invoke('set-remind', id, value),
  saveSettings: (patch) => ipcRenderer.invoke('save-settings', patch),
  pickCsv: () => ipcRenderer.invoke('pick-csv'),
  parseCsvText: (text, source) => ipcRenderer.invoke('parse-csv-text', String(text ?? ''), String(source ?? '')),
  applyImport: (lessons, mode) => ipcRenderer.invoke('apply-import', lessons, mode),
  exportCsv: () => ipcRenderer.invoke('export-csv'),
  revealInFolder: (path) => ipcRenderer.send('reveal-in-folder', path),
  refreshAlerts: () => ipcRenderer.invoke('refresh-alerts'),
  openLink: (url) => ipcRenderer.send('open-link', url),
  openEditor: (target) => ipcRenderer.send('open-editor', typeof target === 'string' ? target : undefined),
  hidePopup: () => ipcRenderer.send('hide-popup'),
  testSound: (kind) => ipcRenderer.send('test-sound', kind),
  popupHeight: (h) => ipcRenderer.send('popup-height', h),
});
