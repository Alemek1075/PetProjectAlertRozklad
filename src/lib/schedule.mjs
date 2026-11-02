const WEEK_LABELS = { all: 'щотижня', odd: 'чисельник', even: 'знаменник' };
const WEEK_SHORT = { odd: 'чис', even: 'знам' };
const DAY_MS = 86_400_000;

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
const isoDow = (d) => ((d.getDay() + 6) % 7) + 1;
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - (isoDow(d) - 1));
  return d;
}

function defaultAnchor(now = new Date()) {
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return isoDate(mondayOf(new Date(year, 8, 1)));
}

function parseAnchor(anchor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchor || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function weekType(date, anchor) {
  const a = mondayOf(parseAnchor(anchor) || parseAnchor(defaultAnchor(date)));
  const weeks = Math.round((mondayOf(date) - a) / DAY_MS / 7);
  return ((weeks % 2) + 2) % 2 === 0 ? 'odd' : 'even';
}

function anchorFor(date, type) {
  const mon = mondayOf(date);
  if (type === 'even') mon.setDate(mon.getDate() - 7);
  return isoDate(mon);
}

const matchesWeek = (lesson, type) => !lesson.week || lesson.week === 'all' || lesson.week === type;
const hasAlternation = (lessons) => lessons.some((l) => l.week && l.week !== 'all');

function lessonsOn(lessons, date, anchor) {
  const dow = isoDow(date);
  const type = weekType(date, anchor);
  return lessons
    .filter((l) => l.day === dow && matchesWeek(l, type))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function upcoming(lessons, anchor, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  for (let i = 0; i < 14; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    for (const l of lessonsOn(lessons, date, anchor)) {
      if (i === 0 && toMin(l.end) <= nowMin) continue;
      const current = i === 0 && toMin(l.start) <= nowMin;
      return { lesson: l, current, daysAhead: i, date };
    }
  }
  return null;
}

export { WEEK_LABELS, WEEK_SHORT, toMin, isoDow, isoDate, mondayOf, defaultAnchor, weekType, anchorFor, matchesWeek, hasAlternation, lessonsOn, upcoming };
