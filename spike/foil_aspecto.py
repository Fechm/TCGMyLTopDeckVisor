import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from foil import VIDEOS, alinear, cuadros

SALIDA = Path(sys.argv[1])


def analizar(nombre):
    alineados, mascara, _ = alinear(cuadros(VIDEOS / nombre))
    m = mascara > 0
    lab = np.stack([cv2.cvtColor(f, cv2.COLOR_BGR2LAB).astype(np.float32) for f in alineados])
    base = np.median(lab, axis=0)
    delta = lab - base
    dl, da, db = delta[..., 0], delta[..., 1], delta[..., 2]
    fuerza = np.sqrt(np.maximum(dl, 0) ** 2 + da ** 2 + db ** 2)
    por_cuadro = [(fuerza[k][m] > 18).mean() for k in range(len(alineados))]
    k = int(np.argmax([np.percentile(fuerza[i][m], 95) for i in range(len(alineados))]))
    sel = m & (fuerza[k] > 18)
    resumen = {
        "cuadros": len(alineados),
        "cobertura_mediana": round(float(np.median(por_cuadro)), 3),
        "cobertura_max": round(float(np.max(por_cuadro)), 3),
        "dL": round(float(dl[k][sel].mean()), 1) if sel.any() else 0,
        "da": round(float(da[k][sel].mean()), 1) if sel.any() else 0,
        "db": round(float(db[k][sel].mean()), 1) if sel.any() else 0,
    }
    g = cv2.GaussianBlur(fuerza[k], (0, 0), 6)
    resumen["textura"] = round(float(np.abs(fuerza[k] - g)[m].mean() / max(1e-3, fuerza[k][m].mean())), 2)
    ver = np.clip(128 + delta[k][..., 1:] * 3, 0, 255)
    vis = np.dstack([np.clip(base[..., 0] * 0.4 + np.maximum(dl[k], 0) * 3, 0, 255), ver[..., 0], ver[..., 1]]).astype(np.uint8)
    vis = cv2.cvtColor(vis, cv2.COLOR_LAB2BGR)
    vis[~m] = 0
    real = alineados[k].copy()
    h = 300
    par = np.hstack([cv2.resize(x, (int(x.shape[1] * h / x.shape[0]), h)) for x in (cv2.cvtColor(base.astype(np.uint8), cv2.COLOR_LAB2BGR), real, vis)])
    cv2.imwrite(str(SALIDA / f"aspecto_{nombre[:3]}.jpg"), par)
    return resumen


if __name__ == "__main__":
    res = {v.name: analizar(v.name) for v in sorted(VIDEOS.glob("v*.mp4")) if int(v.name[1:3]) >= 10 or v.name in ("v03.mp4", "v05.mp4")}
    for k, v in res.items():
        print(k, v)
