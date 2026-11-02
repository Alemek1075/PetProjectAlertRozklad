const DAY_NAMES = ['', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота', 'Неділя'];

const DAY_PREFIXES = [
  [1, ['пон', 'пн', 'mon', 'пнд']],
  [2, ['вів', 'вт', 'tue', 'вто']],
  [3, ['сер', 'ср', 'wed']],
  [4, ['чет', 'чт', 'thu']],
  [5, ['пят', 'пт', 'fri']],
  [6, ['суб', 'сб', 'sat']],
  [7, ['нед', 'нд', 'sun', 'вос', 'вс']],
];

function parseDay(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/['’ʼ`]/g, '');
  if (!s) return null;
  if (/^[1-7]$/.test(s)) return Number(s);
  for (const [n, prefixes] of DAY_PREFIXES) {
    if (prefixes.some((p) => s.startsWith(p))) return n;
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

function parseTime(raw, defaultDuration) {
  const re = /(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2})(?::\d{2})?)?/;
  const m = String(raw || '').match(re);
  if (!m) return null;
  const h1 = Number(m[1]), m1 = Number(m[2]);
  if (h1 > 23 || m1 > 59) return null;
  const start = `${pad(h1)}:${pad(m1)}`;
  let end;
  if (m[3] !== undefined) {
    const h2 = Number(m[3]), m2 = Number(m[4]);
    if (h2 > 23 || m2 > 59) return null;
    end = `${pad(h2)}:${pad(m2)}`;
  } else {
    end = fromMin(toMin(start) + defaultDuration);
  }
  return { start, end };
}

function parseBool(raw) {
  return /^(так|да|yes|y|true|1|\+|✓|✔|x|х)$/i.test(String(raw || '').trim());
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || '';
  let inQ = false;
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

function parseRowsWithLines(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const delim = detectDelimiter(text);
  const rows = [];
  let row = [], field = '', inQ = false, line = 1, rowLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push({ cells: row, line: rowLine }); row = []; field = '';
      line++; rowLine = line;
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push({ cells: row, line: rowLine }); }
  return rows.filter((r) => r.cells.some((c) => c.trim() !== ''));
}

function parseRows(text) {
  return parseRowsWithLines(text).map((r) => r.cells);
}

function parseWeek(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/['’ʼ`()[\]]/g, '').trim();
  if (!s || /^(щотиж|кожн|обидва|обидві|всі|усі|завжди|all|every|both|-|—)/.test(s)) return 'all';
  if (/^(1|i|ч)$/.test(s) || /^(чис|непарн|верх|odd|num)/.test(s)) return 'odd';
  if (/^(2|ii|з)$/.test(s) || /^(знам|парн|нижн|even|den)/.test(s)) return 'even';
  return null;
}

function weekFromDayCell(raw) {
  const rest = String(raw || '').trim().replace(/^[^\s(/,\-–]+/, '').replace(/^[\s(/,\-–]+/, '');
  return rest ? parseWeek(rest) : null;
}

const HEADER_PATTERNS = {
  day: /^(день|дні|day)/,
  time: /^(час|година|time)/,
  subject: /^(предмет|назва|дисципл|subject|name|пара)/,
  link: /^(посилан|лінк|link|url|zoom|meet)/,
  remind: /^(нагад|remind)/,
  week: /^(тиж|week|чергув|парніст|чис)/,
};

function headerMap(cells) {
  const map = {};
  cells.forEach((c, i) => {
    const s = c.trim().toLowerCase();
    for (const [key, re] of Object.entries(HEADER_PATTERNS)) {
      if (!(key in map) && re.test(s)) { map[key] = i; break; }
    }
  });
  return Object.keys(map).length >= 2 ? map : null;
}

function parseCsv(text, defaultDuration = 80) {
  const lessons = [];
  const issues = [];
  let lastDay = null;
  let cols = null;
  let rows = 0;
  let hasRemindColumn = false;
  parseRowsWithLines(text).forEach(({ cells: rawCells, line }, idx) => {
    const cells = rawCells.map((c) => c.trim());
    if (idx === 0 && !parseTime(cells.join(' '), defaultDuration)) {
      cols = headerMap(cells);
      if (cols) hasRemindColumn = 'remind' in cols;
      return;
    }
    rows++;
    const at = (key, fallback) => (cols ? (key in cols ? cells[cols[key]] ?? '' : undefined) : cells[fallback] ?? '');
    const dayRaw = at('day', 0) ?? '';
    const timeRaw = at('time', 1) ?? '';
    const subject = at('subject', 2) ?? '';
    const link = at('link', 3) ?? '';
    let remindRaw = cols ? at('remind') : undefined;
    let weekRaw = cols ? at('week') : undefined;
    const mapped = new Set(cols ? Object.values(cols) : [0, 1, 2, 3]);
    for (const [i, extra] of cells.entries()) {
      if (mapped.has(i) || !extra) continue;
      if (weekRaw === undefined && parseWeek(extra) && parseWeek(extra) !== 'all' && !/^(1|2|i|ii|ч|з)$/i.test(extra)) weekRaw = extra;
      else if (!cols && remindRaw === undefined) remindRaw = extra;
    }
    if (!cols && cells.length > 4 && remindRaw === undefined) remindRaw = '';
    if (!cols && remindRaw !== undefined) hasRemindColumn = true;

    const issue = (kind, message) => issues.push({ line, kind, message, raw: rawCells });
    const time = parseTime(timeRaw, defaultDuration);
    const day = parseDay(dayRaw) ?? (dayRaw ? null : lastDay);
    if (!time) {
      issue('error', timeRaw ? `Не вдалося розпізнати час «${timeRaw}»` : 'Не вказано час');
      return;
    }
    if (!day) {
      issue('error', dayRaw ? `Не вдалося розпізнати день «${dayRaw}»` : 'Не вказано день');
      return;
    }
    lastDay = day;
    let week = weekRaw ? parseWeek(weekRaw) : null;
    if (weekRaw && !week) issue('warning', `Невідомий тиждень «${weekRaw}», пару додано як щотижневу`);
    week = week || weekFromDayCell(dayRaw) || 'all';
    lessons.push({
      day,
      start: time.start,
      end: time.end,
      subject: subject || 'Без назви',
      link,
      week,
      remind: remindRaw === undefined ? undefined : parseBool(remindRaw),
      line,
    });
  });
  return { lessons, issues, rows, hasRemindColumn };
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(lessons) {
  const lines = [['День', 'Час', 'Предмет', 'Посилання', 'Тиждень', 'Нагадування'].join(',')];
  for (const l of sortLessons(lessons)) {
    const week = l.week === 'odd' ? 'чисельник' : l.week === 'even' ? 'знаменник' : '';
    lines.push([DAY_NAMES[l.day], `${l.start}-${l.end}`, l.subject, l.link, week, l.remind ? 'так' : ''].map(esc).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function sortLessons(lessons) {
  const w = { all: 0, odd: 1, even: 2 };
  return [...lessons].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start) || (w[a.week] || 0) - (w[b.week] || 0));
}

module.exports = { parseCsv, exportCsv, sortLessons, parseDay, parseTime, parseWeek, DAY_NAMES, toMin, fromMin };
