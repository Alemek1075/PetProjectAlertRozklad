const fs = require('fs');
const path = require('path');
const { defaultAlertHours, normalizeAlertHours } = require('./alert-hours.mjs');

const DEFAULT_SETTINGS = {
  region: 'м. Київ',
  remindBefore: 5,
  remindAtStart: true,
  sound: true,
  alertNotifications: true,
  alertHours: defaultAlertHours(),
  defaultDuration: 80,
  autostart: false,
  weekAnchor: '',
  theme: 'system',
  showMap: false,
  token: '',
  subjectColors: {},
};

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'data.json');
    let data = {};
    try {
      data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
    }
    this.lessons = Array.isArray(data.lessons) ? data.lessons : [];
    this.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    this.settings.alertHours = normalizeAlertHours(this.settings.alertHours);
    if (!this.settings.subjectColors || typeof this.settings.subjectColors !== 'object') this.settings.subjectColors = {};
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify({ lessons: this.lessons, settings: this.settings }, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, DEFAULT_SETTINGS };
