const API = 'https://api.alerts.in.ua/v1/alerts/active.json';

function errorCodeFor(status) {
  if (status === 401) return 'bad-token';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate-limit';
  return 'api';
}

const ERROR_TEXT = {
  'no-token': 'Тривоги не відстежуються',
  'bad-token': 'Токен alerts.in.ua не прийнято',
  forbidden: 'Доступ до alerts.in.ua заборонено',
  'rate-limit': 'Забагато запитів до alerts.in.ua',
  network: 'Немає зв’язку з alerts.in.ua',
  api: 'alerts.in.ua не відповідає',
};

function errorText(code, status) {
  if (code === 'api' && status) return `${ERROR_TEXT.api} (помилка ${status})`;
  return ERROR_TEXT[code] || ERROR_TEXT.network;
}

function classifyError(e) {
  const status = Number.isInteger(e?.status) && e.status > 0 ? e.status : null;
  const code = e?.code && ERROR_TEXT[e.code] ? e.code : status ? errorCodeFor(status) : 'network';
  return { code, status, message: errorText(code, status) };
}

async function fetchActive(fetchImpl, token) {
  const res = await fetchImpl(API, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const code = errorCodeFor(res.status);
    throw Object.assign(new Error(errorText(code, res.status)), { status: res.status, code });
  }
  return res.json();
}

const rank = (level) => (level === 'red' ? 2 : level === 'yellow' ? 1 : 0);
const maxLevel = (alerts) => alerts.reduce((acc, a) => (rank(a.alert_level) > rank(acc) ? a.alert_level : acc), null) || 'red';

function summarize(payload, focusRegion) {
  const alerts = (payload.alerts || []).filter((a) => !a.finished_at);
  const byRegion = new Map();
  for (const a of alerts) {
    const region = a.location_oblast || a.location_title;
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(a);
  }

  const regions = {};
  for (const [name, list] of byRegion) {
    const whole = list.filter((a) => a.location_title === name);
    regions[name] = { level: maxLevel(whole.length ? whole : list), full: whole.length > 0 };
  }

  const list = byRegion.get(focusRegion) || [];
  const whole = list.filter((a) => a.location_title === focusRegion);
  const relevant = whole.length ? whole : list;
  const focus = { name: focusRegion, active: list.length > 0 };
  if (focus.active) {
    focus.full = whole.length > 0;
    focus.level = maxLevel(relevant);
    focus.startedAt = relevant.map((a) => a.started_at).sort()[0];
    focus.types = [...new Set(relevant.map((a) => a.alert_type))];
    focus.threats = [...new Set(relevant.flatMap((a) => (a.threats || []).map((t) => t.threat_type)))];
    focus.places = whole.length ? [] : [...new Set(list.map((a) => a.location_title))];
  }
  return { regions, focus };
}

module.exports = { fetchActive, summarize, classifyError, errorText };
