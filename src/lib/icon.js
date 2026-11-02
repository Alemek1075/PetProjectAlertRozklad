const zlib = require('zlib');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const C = {
  glyphOnDark: hex('#ffffff'),
  glyphOnLight: hex('#1b1b1b'),
  amberOnDark: hex('#f2a635'),
  amberOnLight: hex('#c77700'),
  red: hex('#d72e2d'),
  white: hex('#ffffff'),
  ink: hex('#1b1b1b'),
  appBlue: hex('#1e63b8'),
};

const TRAY = {
  16: {
    body: [1, 2, 15, 15], r: 3, stroke: 1, header: 3,
    tabs: [[4, 1, 6, 4], [10, 1, 12, 4]],
    bars: [[4, 7, 12, 9], [4, 10, 9, 12]],
    tri: [[7.5, 15.5], [15.5, 15.5], [11.5, 8.5]], knock: 1, excl: null,
    rule: [4, 5],
  },
  20: {
    body: [1, 3, 19, 19], r: 3.5, stroke: 1, header: 4,
    tabs: [[5, 1, 7, 5], [13, 1, 15, 5]],
    bars: [[5, 9, 15, 11], [5, 13, 11, 15]],
    tri: [[10, 19], [19, 19], [14.5, 11]], knock: 1, excl: null,
    rule: [6, 7],
  },
  24: {
    body: [2, 3, 22, 23], r: 4, stroke: 2, header: 4,
    tabs: [[6, 1, 8, 5], [16, 1, 18, 5]],
    bars: [[6, 11, 18, 13], [6, 16, 13, 18]],
    tri: [[12, 23], [23, 23], [17.5, 13]], knock: 1,
    excl: [[17, 16, 18, 19.5], [17, 20.5, 18, 21.5]],
    rule: [6, 7],
  },
  32: {
    body: [2, 4, 30, 31], r: 5, stroke: 2, header: 6,
    tabs: [[8, 1, 11, 7], [21, 1, 24, 7]],
    bars: [[8, 15, 24, 18], [8, 22, 18, 25]],
    tri: [[16, 31], [31, 31], [23.5, 18]], knock: 1.5,
    excl: [[23, 22, 24, 26.5], [23, 27.5, 24, 28.5]],
    rule: [8, 10],
  },
};

const APP = {
  16: {
    body: [3, 3, 13, 13], r: 1.5, stroke: 1, header: 2, tabs: [],
    bars: [[5, 7, 11, 8], [5, 9, 9, 10]],
  },
  24: {
    body: [5, 5, 19, 19], r: 2, stroke: 1, header: 3, tabs: [],
    bars: [[8, 10, 16, 12], [8, 14, 13, 16]],
  },
  32: {
    body: [7, 9, 25, 25], r: 3, stroke: 2, header: 4,
    tabs: [[10, 6, 12, 10], [20, 6, 22, 10]],
    bars: [[11, 15, 21, 17], [11, 19, 17, 21]],
    tri: [[16, 31], [31, 31], [23.5, 18]], knock: 1.5,
    excl: [[23, 22, 24, 26.5], [23, 27.5, 24, 28.5]],
  },
};

const scaleRect = ([x0, y0, x1, y1], k, size) => {
  const near = (v) => Math.round(v * k);
  const far = (v) => size - Math.round((32 - v) * k);
  return [near(x0), near(y0), far(x1), far(y1)];
};

function appGeometry(size) {
  if (APP[size]) return APP[size];
  if (size < 32) return size < 20 ? APP[16] : APP[24];
  const g = APP[32];
  const k = size / 32;
  const stroke = Math.max(1, Math.round(g.stroke * k));
  return {
    body: scaleRect(g.body, k, size), r: g.r * k, stroke, header: Math.round(g.header * k),
    tabs: g.tabs.map((t) => scaleRect(t, k, size)),
    bars: g.bars.map((b) => scaleRect(b, k, size)),
  };
}

const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1;

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  if (r <= 0) return true;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

const sign = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
function inTriangle(x, y, [a, b, c]) {
  const p = [x, y];
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function segDist(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
const triDist = (x, y, [a, b, c]) => Math.min(segDist(x, y, a, b), segDist(x, y, b, c), segDist(x, y, c, a));

function inGlyph(x, y, g) {
  const [x0, y0, x1, y1] = g.body;
  if (g.tabs.some((t) => inRect(x, y, t))) return true;
  if (!inRoundRect(x, y, x0, y0, x1, y1, g.r)) return false;
  if (y < y0 + g.header) return true;
  const s = g.stroke;
  if (!inRoundRect(x, y, x0 + s, y0 + s, x1 - s, y1 - s, Math.max(0, g.r - s))) return true;
  return g.bars.some((b) => inRect(x, y, b));
}

function trayPaint(size, state, taskbarDark) {
  const g = TRAY[size] || TRAY[size <= 18 ? 16 : size <= 22 ? 20 : size <= 28 ? 24 : 32];
  const glyph = taskbarDark ? C.glyphOnDark : C.glyphOnLight;
  if (state === 'red') {
    const [x0, , x1] = g.body;
    const inset = g.stroke + 1;
    const rule = [x0 + inset, g.rule[0], x1 - inset, g.rule[1]];
    return (x, y) => {
      const tile = g.tabs.some((t) => inRect(x, y, t)) || inRoundRect(x, y, ...g.body, g.r);
      if (!tile) return null;
      if (inRect(x, y, rule) || g.bars.some((b) => inRect(x, y, b))) return C.white;
      return C.red;
    };
  }
  if (state === 'yellow') {
    const amber = taskbarDark ? C.amberOnDark : C.amberOnLight;
    const mark = taskbarDark ? C.ink : C.white;
    return (x, y) => {
      if (inTriangle(x, y, g.tri)) return g.excl && g.excl.some((e) => inRect(x, y, e)) ? mark : amber;
      if (triDist(x, y, g.tri) <= g.knock) return null;
      return inGlyph(x, y, g) ? glyph : null;
    };
  }
  return (x, y) => (inGlyph(x, y, g) ? glyph : null);
}

function appPaint(size, state) {
  const g = appGeometry(size);
  const bg = state === 'red' ? C.red : C.appBlue;
  const r = size * 0.22;
  const k = size / 32;
  const b32 = APP[32];
  const badge = state === 'yellow'
    ? { tri: b32.tri.map(([x, y]) => [x * k, y * k]), knock: b32.knock * k, excl: b32.excl.map((e) => e.map((v) => v * k)) }
    : null;
  return (x, y) => {
    if (badge) {
      if (inTriangle(x, y, badge.tri)) return badge.excl.some((e) => inRect(x, y, e)) ? C.ink : C.amberOnDark;
      if (triDist(x, y, badge.tri) <= badge.knock) return null;
    }
    if (!inRoundRect(x, y, 0, 0, size, size, r)) return null;
    return inGlyph(x, y, g) ? C.white : bg;
  };
}

const SS = 4;

function raster(size, paint, alpha = 1) {
  const buf = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = paint(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a++;
        }
      }
      if (!a) continue;
      const i = (py * size + px) * 4;
      buf[i] = Math.round(r / a);
      buf[i + 1] = Math.round(g / a);
      buf[i + 2] = Math.round(b / a);
      buf[i + 3] = Math.round((a / n) * 255 * alpha);
    }
  }
  return buf;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head[e] = size >= 256 ? 0 : size;
    head[e + 1] = size >= 256 ? 0 : size;
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.png)]);
}

const STATES = ['normal', 'yellow', 'red', 'offline'];

function iconRgba(size, state = 'normal', { kind = 'tray', taskbarDark = true } = {}) {
  if (!STATES.includes(state)) state = 'normal';
  if (kind === 'app') return raster(size, appPaint(size, state === 'offline' ? 'normal' : state), state === 'offline' ? 0.55 : 1);
  return raster(size, trayPaint(size, state === 'offline' ? 'normal' : state, taskbarDark), state === 'offline' ? 0.55 : 1);
}

function iconPng(size, state = 'normal', opts = {}) {
  return encodePng(size, iconRgba(size, state, opts));
}

const ICO_SIZES = [16, 24, 32, 48, 64, 256];
const appIco = (state = 'normal') => encodeIco(ICO_SIZES.map((size) => ({ size, png: iconPng(size, state, { kind: 'app' }) })));

const TRAY_REPS = [[1, 16], [1.25, 20], [1.5, 24], [2, 32]];

module.exports = { iconPng, iconRgba, appIco, encodePng, TRAY_REPS, ICO_SIZES };
