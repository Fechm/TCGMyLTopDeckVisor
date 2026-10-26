import json
import time

import cv2
import numpy as np

import reconocer as r

cartas = json.loads((r.RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
refs = [(c, r.IMAGENES / f"{c['ed_edid']}-{c['edid']}.jpg") for c in cartas]
refs = [(c, p) for c, p in refs if p.exists()]
imgs = [r.leer(p) for _, p in refs]
nom = [c["name"] for c, _ in refs]
e = r.Embedder()
f = r.metodos(e)["cnn_carta+arte"]
base = f(imgs)
orb = cv2.ORB_create(500)
gris = lambda i: cv2.cvtColor(cv2.resize(i, (240, 344)), cv2.COLOR_BGR2GRAY)
desc_ref = {}


def desc(i):
    return orb.detectAndCompute(gris(i), None)[1]


bf = cv2.BFMatcher(cv2.NORM_HAMMING)


def puntos(dq, j):
    if j not in desc_ref:
        desc_ref[j] = desc(imgs[j])
    dr = desc_ref[j]
    if dq is None or dr is None:
        return 0
    ok = 0
    for par in bf.knnMatch(dq, dr, k=2):
        if len(par) == 2 and par[0].distance < 0.75 * par[1].distance:
            ok += 1
    return ok


rng = np.random.default_rng(5)
idx = rng.choice(len(imgs), 300, replace=False)
for dificil in (False, True):
    a1 = a_orb = a_voto = a_ambos = 0
    t_orb = 0
    for i in idx:
        fotos = [r.fotografiar(imgs[i], rng, dificil) for _ in range(5)]
        q = f(fotos)
        s1 = q[0] @ base.T
        a1 += nom[int(np.argmax(s1))] == nom[i]
        t = time.time()
        top = np.argsort(-s1)[:10]
        dq = desc(fotos[0])
        mejor = max(top, key=lambda j: puntos(dq, j) + 30 * s1[j])
        t_orb += time.time() - t
        a_orb += nom[mejor] == nom[i]
        prom = q.mean(0)
        sv = prom @ base.T
        a_voto += nom[int(np.argmax(sv))] == nom[i]
        top = np.argsort(-sv)[:10]
        mejor = max(top, key=lambda j: puntos(dq, j) + 30 * sv[j])
        a_ambos += nom[mejor] == nom[i]
    n = len(idx)
    print(f"{'dificiles' if dificil else 'normales '}: 1 foto {a1/n:.1%} | +ORB {a_orb/n:.1%} | 5 cuadros {a_voto/n:.1%} | 5 cuadros+ORB {a_ambos/n:.1%} | ORB {1000*t_orb/n:.0f} ms/foto")
