import json
import sys
from pathlib import Path

import cv2
import numpy as np

VIDEOS = Path(__file__).resolve().parent.parent / "datos" / "videos-foil"
PASO = 3


def cuadros(ruta):
    c = cv2.VideoCapture(str(ruta))
    salida, i = [], 0
    while True:
        ok, fr = c.read()
        if not ok:
            break
        if i % PASO == 0:
            salida.append(fr)
        i += 1
    return salida


def alinear(frames):
    orb = cv2.ORB_create(2500)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    nitidez = [cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() for f in frames]
    centro = len(frames) // 2
    ventana = range(max(0, centro - 15), min(len(frames), centro + 15))
    ancla_i = max(ventana, key=lambda i: nitidez[i])
    ancla = frames[ancla_i]
    ka, da = orb.detectAndCompute(cv2.cvtColor(ancla, cv2.COLOR_BGR2GRAY), None)
    h, w = ancla.shape[:2]
    alineados, votos = [], np.zeros(len(ka), np.int32)
    for fr in frames:
        kf, df = orb.detectAndCompute(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY), None)
        if df is None:
            continue
        buenos = [m for m, n in (p for p in bf.knnMatch(df, da, k=2) if len(p) == 2) if m.distance < 0.75 * n.distance]
        if len(buenos) < 25:
            continue
        src = np.float32([kf[m.queryIdx].pt for m in buenos])
        dst = np.float32([ka[m.trainIdx].pt for m in buenos])
        H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 4.0)
        if H is None or mask.sum() < 25:
            continue
        for m, ok in zip(buenos, mask.ravel()):
            if ok:
                votos[m.trainIdx] += 1
        alineados.append(cv2.warpPerspective(fr, H, (w, h)))
    pts = np.float32([k.pt for k, v in zip(ka, votos) if v >= max(3, 0.3 * len(alineados))])
    mascara = np.zeros((h, w), np.uint8)
    if len(pts) >= 3:
        cv2.fillConvexPoly(mascara, cv2.convexHull(pts).astype(np.int32), 255)
        mascara = cv2.erode(mascara, np.ones((9, 9), np.uint8))
    return alineados, mascara, ancla_i


def rasgos(alineados, mascara):
    m = mascara > 0
    if m.sum() < 2000 or len(alineados) < 15:
        return None
    labs = []
    for fr in alineados:
        lab = cv2.cvtColor(cv2.GaussianBlur(fr, (5, 5), 0), cv2.COLOR_BGR2LAB).astype(np.float32)
        L, a, b = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128
        a -= np.median(a[m])
        b -= np.median(b[m])
        labs.append(np.stack([L[m], a[m], b[m]], 1))
    X = np.stack(labs)
    L, A, B = X[..., 0], X[..., 1], X[..., 2]
    croma = np.hypot(A, B)
    croma_med = np.median(croma, 0)
    var_croma = np.sqrt(A.var(0) + B.var(0))
    neutros = croma_med < 8
    arcoiris = (croma[:, neutros] > 22).any(0).mean() if neutros.sum() > 200 else float("nan")
    tono = np.arctan2(B, A)
    coloreado = croma > 12
    vec = np.where(coloreado, np.exp(1j * tono), 0)
    n = coloreado.sum(0)
    validos = n >= 5
    disp_tono = 1 - np.abs(vec.sum(0)[validos]) / n[validos] if validos.any() else np.array([0.0])
    brillo = L.max(0) - np.median(L, 0)
    altas = brillo > 25
    croma_reflejo = float(np.median((croma.max(0))[altas])) if altas.sum() > 100 else float("nan")
    var_L = L.std(0)
    razon = var_croma / (var_L + 1.0)
    return {
        "razon_croma_brillo_media": round(float(razon.mean()), 3),
        "razon_croma_brillo_p90": round(float(np.percentile(razon, 90)), 3),
        "var_brillo_media": round(float(var_L.mean()), 2),
        "var_croma_p90": round(float(np.percentile(var_croma, 90)), 2),
        "var_croma_media": round(float(var_croma.mean()), 2),
        "arcoiris_en_neutros": round(float(arcoiris), 3),
        "dispersion_tono": round(float(np.mean(disp_tono)), 3),
        "croma_en_reflejos": round(croma_reflejo, 2) if croma_reflejo == croma_reflejo else None,
        "pixeles_neutros": int(neutros.sum()),
        "cuadros": len(alineados),
        "area_carta": int(m.sum()),
    }


def main():
    resultados = {}
    for ruta in sorted(VIDEOS.glob("v*.mp4")):
        frames = cuadros(ruta)
        alineados, mascara, ancla = alinear(frames)
        r = rasgos(alineados, mascara)
        resultados[ruta.stem] = r
        if alineados:
            vis = alineados[len(alineados) // 2].copy()
            vis[mascara == 0] //= 3
            cv2.imwrite(str(VIDEOS / f"mascara-{ruta.stem}.jpg"), cv2.resize(vis, (232, 416)))
        print(ruta.stem, r, flush=True)
    (VIDEOS / "rasgos.json").write_text(json.dumps(resultados, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
