import cv2
import numpy as np

import foil

ANCHO, ALTO, N, VENTANA = 180, 258, 12, 120


def metrica(crops):
    labs = []
    for c in crops:
        lab = cv2.cvtColor(cv2.blur(c, (3, 3)), cv2.COLOR_BGR2LAB).astype(np.float32)
        a, b = lab[..., 1] - 128, lab[..., 2] - 128
        labs.append(np.stack([a - np.median(a), b - np.median(b)], -1))
    X = np.stack(labs)
    var = np.sqrt(X[..., 0].var(0) + X[..., 1].var(0))
    borde = 8
    return float(np.percentile(var[borde:-borde, borde:-borde], 90))


def main():
    filas = []
    for ruta in sorted(foil.VIDEOS.glob("v*.mp4")):
        frames = foil.cuadros(ruta)
        alineados, mascara, _ = foil.alinear(frames)
        x, y, w, h = cv2.boundingRect(mascara)
        crops = [cv2.resize(f[y:y + h, x:x + w], (ANCHO, ALTO), interpolation=cv2.INTER_AREA) for f in alineados]
        valores = []
        paso = max(1, VENTANA // foil.PASO // N)
        largo = paso * N
        for ini in range(0, max(1, len(crops) - largo), largo // 2):
            valores.append(metrica(crops[ini: ini + largo: paso]))
        es_foil = int(ruta.stem[1:]) >= 10
        filas.append((ruta.stem, es_foil, valores))
        print(ruta.stem, "foil" if es_foil else "normal", np.round(valores, 2).tolist())
    todos = [(v, f) for _, f, vs in filas for v in vs]
    xs = np.array([v for v, _ in todos]); ys = np.array([f for _, f in todos])
    p, n = xs[ys], xs[~ys]
    auc = np.mean([(a > b) + 0.5 * (a == b) for a in p for b in n])
    mejor = max(((xs >= t) == ys).mean() for t in np.unique(xs))
    umbral = max(np.unique(xs), key=lambda t: ((xs >= t) == ys).mean())
    print(f"ventanas de 2 s: {len(xs)} | AUC {auc:.2f} | mejor acierto {mejor:.0%} con umbral {umbral:.2f}")
    for t in (umbral - 0.5, umbral, umbral + 0.5):
        print(f"  umbral {t:.2f}: foil detectadas {np.mean(p >= t):.0%} | normales marcadas foil {np.mean(n >= t):.0%}")


if __name__ == "__main__":
    main()
