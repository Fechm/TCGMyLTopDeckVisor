import cv2
import numpy as np

import foil
from foil_vivo import ANCHO, ALTO, N, VENTANA


def rasgos(crops):
    L, A, B = [], [], []
    for c in crops:
        lab = cv2.cvtColor(cv2.blur(c, (3, 3)), cv2.COLOR_BGR2LAB).astype(np.float32)
        a, b = lab[..., 1] - 128, lab[..., 2] - 128
        L.append(lab[..., 0]); A.append(a - np.median(a)); B.append(b - np.median(b))
    L, A, B = np.stack(L)[:, 8:-8, 8:-8], np.stack(A)[:, 8:-8, 8:-8], np.stack(B)[:, 8:-8, 8:-8]
    C = np.hypot(A, B)
    dL = L - np.median(L, 0)
    activos = dL.max(0) > 12
    if activos.sum() < 50:
        return 0.0, 0.0, 0.0
    t = np.argmax(dL, 0)
    ii, jj = np.indices(t.shape)
    c_pico = C[t, ii, jj]
    c_base = np.median(C, 0)
    ganancia = (c_pico - c_base)[activos]
    a_p, b_p = A[t, ii, jj], B[t, ii, jj]
    a_b, b_b = np.median(A, 0), np.median(B, 0)
    giro = np.hypot(a_p - a_b, b_p - b_b)[activos]
    Lz = (L - L.mean(0)) / (L.std(0) + 1e-3)
    Cz = (C - C.mean(0)) / (C.std(0) + 1e-3)
    corr = (Lz * Cz).mean(0)[activos]
    return float(np.median(ganancia)), float(np.percentile(giro, 75)), float(np.median(corr))


def main():
    filas = []
    for ruta in sorted(foil.VIDEOS.glob("v*.mp4")):
        frames = foil.cuadros(ruta)
        alineados, mascara, _ = foil.alinear(frames)
        x, y, w, h = cv2.boundingRect(mascara)
        crops = [cv2.resize(f[y:y + h, x:x + w], (ANCHO, ALTO), interpolation=cv2.INTER_AREA) for f in alineados]
        paso = max(1, VENTANA // foil.PASO // N)
        largo = paso * N
        for ini in range(0, max(1, len(crops) - largo), largo // 2):
            filas.append((ruta.stem, int(ruta.stem[1:]) >= 10, rasgos(crops[ini: ini + largo: paso])))
    ys = np.array([f for _, f, _ in filas])
    X = np.array([r for _, _, r in filas])
    for k, nombre in enumerate(["ganancia de croma en el pico de brillo", "giro de color en el pico (p75)", "correlacion brillo-croma"]):
        x = X[:, k]; p, n = x[ys], x[~ys]
        auc = np.mean([(a > b) + 0.5 * (a == b) for a in p for b in n])
        mejor = max(((x >= t) == ys).mean() for t in np.unique(x))
        print(f"{nombre:40s} AUC {auc:.2f} mejor {mejor:.0%} | normal p50 {np.median(n):.2f} | foil p50 {np.median(p):.2f}")
    por_video = {}
    for v, f, r in filas:
        por_video.setdefault((v, f), []).append(r[0])
    print("ganancia por video:")
    for (v, f), vals in por_video.items():
        print(" ", v, "foil" if f else "normal", np.round(vals, 1).tolist())


if __name__ == "__main__":
    main()
