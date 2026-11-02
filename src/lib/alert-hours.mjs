const MODES = ['all', 'off', 'hours'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

function defaultAlertHours() {
  return {
    enabled: false,
    days: Array.from({ length: 7 }, () => ({ mode: 'all', ranges: [{ start: '08:00', end: '18:00' }] })),
  };
}

function normalizeAlertHours(v) {
  const def = defaultAlertHours();
  if (!v || typeof v !== 'object') return def;
  const days = def.days.map((d, i) => {
    const src = Array.isArray(v.days) ? v.days[i] : null;
    if (!src || typeof src !== 'object') return d;
    const ranges = Array.isArray(src.ranges)
      ? src.ranges
          .filter((r) => r && HHMM.test(r.start) && HHMM.test(r.end))
          .slice(0, 6)
          .map((r) => ({ start: r.start, end: r.end }))
      : d.ranges;
    return { mode: MODES.includes(src.mode) ? src.mode : 'all', ranges };
  });
  return { enabled: Boolean(v.enabled), days };
}

function alertHoursOpen(ah, now = new Date()) {
  if (!ah || !ah.enabled || !Array.isArray(ah.days)) return true;
  const t = now.getHours() * 60 + now.getMinutes();
  const d = (now.getDay() + 6) % 7;
  const today = ah.days[d];
  const yesterday = ah.days[(d + 6) % 7];
  if (!today || today.mode === 'all') return true;
  if (today.mode === 'hours') {
    for (const r of today.ranges || []) {
      const s = toMin(r.start);
      const e = toMin(r.end);
      if (s < e ? t >= s && t < e : t >= s) return true;
    }
  }
  if (yesterday && yesterday.mode === 'hours') {
    for (const r of yesterday.ranges || []) {
      const s = toMin(r.start);
      const e = toMin(r.end);
      if (s >= e && t < e) return true;
    }
  }
  return false;
}

export { defaultAlertHours, normalizeAlertHours, alertHoursOpen };
