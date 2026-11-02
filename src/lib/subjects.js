const UNNAMED = 'без назви';

const subjectKey = (subject) => String(subject ?? '').trim().toLocaleLowerCase('uk').replace(/\s+/g, ' ');

function uniqueKeysInOrder(lessons) {
  const sorted = [...lessons].sort((a, b) => a.day - b.day || String(a.start).localeCompare(String(b.start)));
  const seen = new Set();
  const keys = [];
  for (const l of sorted) {
    const k = subjectKey(l.subject);
    if (!k || k === UNNAMED || seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
  }
  return keys;
}

function assignSubjectColors(lessons, prev) {
  const old = prev && typeof prev === 'object' ? prev : {};
  const keys = uniqueKeysInOrder(lessons);
  const next = {};
  for (const k of keys) if (Number.isInteger(old[k]) && old[k] >= 1 && old[k] <= 10) next[k] = old[k];
  const count = Array(11).fill(0);
  for (const k in next) count[next[k]]++;
  for (const k of keys) {
    if (k in next) continue;
    let best = 1;
    for (let i = 2; i <= 9; i++) if (count[i] < count[best]) best = i;
    next[k] = best;
    count[best]++;
  }
  return next;
}

function sameColors(a, b) {
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

function cleanColors(colors) {
  const out = {};
  if (!colors || typeof colors !== 'object') return out;
  for (const [k, v] of Object.entries(colors)) {
    const key = subjectKey(k);
    if (key && Number.isInteger(v) && v >= 1 && v <= 10) out[key] = v;
  }
  return out;
}

module.exports = { subjectKey, assignSubjectColors, sameColors, cleanColors };
