import json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = {
    "Autonomous Republic of Crimea": "Автономна Республіка Крим",
    "Volyn Oblast": "Волинська область",
    "Vinnytsia Oblast": "Вінницька область",
    "Dnipropetrovsk Oblast": "Дніпропетровська область",
    "Donetsk Oblast": "Донецька область",
    "Zhytomyr Oblast": "Житомирська область",
    "Zakarpattia Oblast": "Закарпатська область",
    "Zaporizhia Oblast": "Запорізька область",
    "Ivano-Frankivsk Oblast": "Івано-Франківська область",
    "Kyiv": "м. Київ",
    "Kyiv Oblast": "Київська область",
    "Kirovohrad Oblast": "Кіровоградська область",
    "Luhansk Oblast": "Луганська область",
    "Lviv Oblast": "Львівська область",
    "Mykolaiv Oblast": "Миколаївська область",
    "Odessa Oblast": "Одеська область",
    "Poltava Oblast": "Полтавська область",
    "Rivne Oblast": "Рівненська область",
    "Sevastopol": "м. Севастополь",
    "Sumy Oblast": "Сумська область",
    "Ternopil Oblast": "Тернопільська область",
    "Kharkiv Oblast": "Харківська область",
    "Kherson Oblast": "Херсонська область",
    "Khmelnytskyi Oblast": "Хмельницька область",
    "Cherkasy Oblast": "Черкаська область",
    "Chernivtsi Oblast": "Чернівецька область",
    "Chernihiv Oblast": "Чернігівська область",
}
WIDTH = 1000
TOL = 0.6

def polys(g):
    return g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]

def dp(pts, tol):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    idx, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm if norm > 1e-9 else math.hypot(x - x1, y - y1)
        if d > dmax:
            idx, dmax = i, d
    if dmax > tol:
        return dp(pts[: idx + 1], tol)[:-1] + dp(pts[idx:], tol)
    return [pts[0], pts[-1]]

data = json.loads((ROOT / "tools" / "ukr.geojson").read_text(encoding="utf-8"))
feats = data["features"]
lons = [p[0] for f in feats for poly in polys(f["geometry"]) for ring in poly for p in ring]
lats = [p[1] for f in feats for poly in polys(f["geometry"]) for ring in poly for p in ring]
k = math.cos(math.radians((min(lats) + max(lats)) / 2))
minx, maxx = min(lons) * k, max(lons) * k
miny, maxy = min(lats), max(lats)
scale = WIDTH / (maxx - minx)
height = round((maxy - miny) * scale)

def proj(p):
    return ((p[0] * k - minx) * scale, (maxy - p[1]) * scale)

out = {}
for f in feats:
    name = NAMES[f["properties"]["shapeName"]]
    d = []
    cx = cy = n = 0
    for poly in polys(f["geometry"]):
        for ring in poly[:1]:
            pts = dp([proj(p) for p in ring], TOL)
            if len(pts) < 3:
                continue
            d.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
            for x, y in pts:
                cx += x; cy += y; n += 1
    out[name] = {"d": "".join(d), "cx": round(cx / n, 1), "cy": round(cy / n, 1)}

order = sorted(out, key=lambda s: s in ("м. Київ", "м. Севастополь"))
data = {"width": WIDTH, "height": height, "regions": {n: out[n] for n in order}}
dest = ROOT / "ui" / "src" / "assets" / "ua-map.json"
dest.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
print("ok", WIDTH, height, dest.stat().st_size // 1024, "KB")
