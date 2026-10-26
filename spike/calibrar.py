import json

import cv2
import numpy as np

import reconocer as r

cartas = json.loads((r.RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
refs = [(c, r.IMAGENES / f"{c['ed_edid']}-{c['edid']}.jpg") for c in cartas]
refs = [(c, p) for c, p in refs if p.exists()]
imgs = [r.leer(p) for _, p in refs]
nom = np.array([c["name"] for c, _ in refs])
nombres, idx_nombre = np.unique(nom, return_inverse=True)
f = r.metodos(r.Embedder())["cnn_carta+arte"]
base = f(imgs)


def por_nombre(s):
    out = np.full(len(nombres), -1.0)
    np.maximum.at(out, idx_nombre, s)
    return out


rng = np.random.default_rng(31)
idx = rng.choice(len(imgs), 300, replace=False)
filas = []
for dificil in (False, True):
    for i in idx[:150]:
        s = por_nombre(f([r.fotografiar(imgs[i], rng, dificil)])[0] @ base.T)
        o = np.argsort(-s)
        filas.append(("carta", nombres[o[0]] == nom[i], s[o[0]], s[o[0]] - s[o[1]]))
for k in range(150):
    h, w = 520, 360
    fondo = np.full((h, w, 3), rng.integers(20, 220, 3), np.uint8)
    fondo = cv2.add(fondo, rng.integers(0, 60, fondo.shape, dtype=np.uint8))
    if k % 3 == 0:
        cv2.circle(fondo, (int(rng.uniform(0, w)), int(rng.uniform(0, h))), int(rng.uniform(40, 150)), tuple(int(x) for x in rng.integers(0, 255, 3)), -1)
    if k % 3 == 1:
        fondo = cv2.GaussianBlur(fondo, (0, 0), 6)
    s = por_nombre(f([fondo])[0] @ base.T)
    o = np.argsort(-s)
    filas.append(("vacio", False, s[o[0]], s[o[0]] - s[o[1]]))

for tipo in ("carta", "vacio"):
    xs = [x for x in filas if x[0] == tipo]
    sims = np.array([x[2] for x in xs])
    print(tipo, "sim p5/p50/p95:", np.percentile(sims, [5, 50, 95]).round(3), "margen p50:", np.median([x[3] for x in xs]).round(3))
ok = [x for x in filas if x[0] == "carta" and x[1]]
mal = [x for x in filas if x[0] == "carta" and not x[1]]
print("aciertos", len(ok), "errores", len(mal))
for u in (0.62, 0.65, 0.68, 0.70, 0.72):
    for m in (0.0, 0.02, 0.04):
        acepta_ok = sum(1 for x in ok if x[2] >= u and x[3] >= m)
        acepta_mal = sum(1 for x in mal if x[2] >= u and x[3] >= m)
        acepta_vacio = sum(1 for x in filas if x[0] == "vacio" and x[2] >= u and x[3] >= m)
        print(f"umbral {u:.2f} margen {m:.2f}: acepta correctas {acepta_ok}/{len(ok)}, erroneas {acepta_mal}/{len(mal)}, vacios {acepta_vacio}/150")
