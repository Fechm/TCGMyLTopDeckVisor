import json
import time

import cv2
import numpy as np

import reconocer as r

ANCHO, ALTO, PUNTOS, CANDIDATOS = 360, 516, 300, 12
orb = cv2.ORB_create(PUNTOS)
bf = cv2.BFMatcher(cv2.NORM_HAMMING)


def rasgos(img):
    g = cv2.cvtColor(cv2.resize(img, (ANCHO, ALTO), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
    kp, des = orb.detectAndCompute(g, None)
    pts = np.float32([k.pt for k in kp]) if kp else np.zeros((0, 2), np.float32)
    return pts, des


def inliers(q, ref):
    (pq, dq), (pr, dr) = q, ref
    if dq is None or dr is None or len(dq) < 8 or len(dr) < 8:
        return 0
    buenos = [m for m, n in (p for p in bf.knnMatch(dq, dr, k=2) if len(p) == 2) if m.distance < 0.75 * n.distance]
    if len(buenos) < 8:
        return len(buenos) // 2
    src = np.float32([pq[m.queryIdx] for m in buenos])
    dst = np.float32([pr[m.trainIdx] for m in buenos])
    _, mask = cv2.findHomography(src, dst, cv2.RANSAC, 8.0)
    return int(mask.sum()) if mask is not None else 0


def rutas_catalogo():
    cartas = json.loads((r.RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
    rutas = {c["id"]: r.IMAGENES / f"{c['ed_edid']}-{c['edid']}.jpg" for c in cartas}
    ruta_esp = r.RAIZ / "datos" / "especiales.json"
    for c in json.loads(ruta_esp.read_text(encoding="utf-8")) if ruta_esp.exists() else []:
        rutas[c["id"]] = r.RAIZ / "datos" / "especiales" / f"{c['id']}.jpg"
    return rutas


def main():
    meta = json.loads((r.RAIZ / "web" / "catalogo.json").read_text(encoding="utf-8"))
    n = len(meta["cartas"])
    q8 = np.fromfile(r.RAIZ / "web" / "referencias.bin", np.int8).reshape(n, -1).astype(np.float32)
    base = q8 * np.fromfile(r.RAIZ / "web" / "escalas.bin", np.float32)[:, None]
    rutas = rutas_catalogo()
    imgs = [r.leer(rutas[c["id"]]) for c in meta["cartas"]]
    nombres = [c["nombre"] for c in meta["cartas"]]
    refs_orb = {}
    f = r.metodos(r.Embedder())["cnn_carta+arte"]
    rng = np.random.default_rng(17)
    idx = rng.choice(n, 150, replace=False)
    for dificil in (False, True):
        bien_cnn = bien_orb = 0
        correctas, erroneas, t_orb = [], [], 0.0
        for i in idx:
            foto = r.fotografiar(imgs[i], rng, dificil)
            s = f([foto])[0] @ base.T
            top = np.argsort(-s)[:CANDIDATOS]
            bien_cnn += nombres[top[0]] == nombres[i]
            t = time.time()
            q = rasgos(foto)
            puntajes = []
            for j in top:
                if j not in refs_orb:
                    refs_orb[j] = rasgos(imgs[j])
                puntajes.append((inliers(q, refs_orb[j]), j))
            t_orb += time.time() - t
            puntajes.sort(reverse=True)
            mejor = puntajes[0][1]
            bien_orb += nombres[mejor] == nombres[i]
            otros = [p for p, j in puntajes if nombres[j] != nombres[puntajes[0][1]]]
            (correctas if nombres[mejor] == nombres[i] else erroneas).append((puntajes[0][0], otros[0] if otros else 0))
        k = len(idx)
        print(f"{'dificiles' if dificil else 'normales '}: red {bien_cnn/k:.1%} -> red+ORB {bien_orb/k:.1%} | ORB {1000*t_orb/k:.0f} ms/foto")
        c = np.array(correctas)
        print("  inliers ganador correcto p5/p50:", np.percentile(c[:, 0], [5, 50]).round(), " segundo p95:", np.percentile(c[:, 1], 95).round())
        if erroneas:
            print("  ganador equivocado (inliers, segundo):", erroneas[:8])


if __name__ == "__main__":
    main()
