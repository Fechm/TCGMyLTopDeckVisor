import json

import cv2
import numpy as np

import reconocer as r

ASPECTO = 709 / 1016
ESCALAS = (1.0, 0.9, 0.8, 0.7, 0.6)


def foto_telefono(carta, rng, dificil):
    tarjeta = r.fotografiar(carta, rng, dificil)
    escala = rng.uniform(0.55, 0.92)
    fh = int(tarjeta.shape[0] / escala)
    fw = int(fh * 3 / 4)
    fondo = np.full((fh, fw, 3), rng.integers(30, 200, 3), np.uint8)
    fondo = cv2.add(fondo, rng.integers(0, 40, fondo.shape, dtype=np.uint8))
    th, tw = tarjeta.shape[:2]
    tw2 = min(tw, fw)
    x = int((fw - tw2) / 2 + rng.uniform(-0.08, 0.08) * fw)
    y = int((fh - th) / 2 + rng.uniform(-0.06, 0.06) * fh)
    x, y = max(0, min(fw - tw2, x)), max(0, min(fh - th, y))
    fondo[y:y + th, x:x + tw2] = tarjeta[:, :tw2]
    return fondo


def recortes(img):
    h, w = img.shape[:2]
    salida = []
    for s in ESCALAS:
        ch = h * s
        cw = ch * ASPECTO
        if cw > w:
            cw, ch = w, w / ASPECTO
        for dy in ((0,) if s == 1.0 else (-0.05, 0, 0.05)):
            x0 = (w - cw) / 2
            y0 = min(max(0, (h - ch) / 2 + dy * h), h - ch)
            salida.append(img[int(y0):int(y0 + ch), int(x0):int(x0 + cw)])
    return salida


def main():
    cartas = json.loads((r.RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
    refs = [(c, r.IMAGENES / f"{c['ed_edid']}-{c['edid']}.jpg") for c in cartas]
    refs = [(c, p) for c, p in refs if p.exists()]
    imgs = [r.leer(p) for _, p in refs]
    nom = [c["name"] for c, _ in refs]
    f = r.metodos(r.Embedder())["cnn_carta+arte"]
    base = f(imgs)
    rng = np.random.default_rng(21)
    idx = rng.choice(len(imgs), 250, replace=False)
    for dificil in (False, True):
        sin = con = top3 = 0
        for k, i in enumerate(idx):
            foto = foto_telefono(imgs[i], rng, dificil)
            if k < 2 and dificil:
                cv2.imwrite(f"ejemplo-telefono-{k}.jpg", foto)
            s0 = f([foto])[0] @ base.T
            sin += nom[int(np.argmax(s0))] == nom[i]
            sims = f(recortes(foto)) @ base.T
            mejor = sims.max(axis=0)
            orden = np.argsort(-mejor)
            con += nom[orden[0]] == nom[i]
            top3 += nom[i] in {nom[j] for j in orden[:3]}
        n = len(idx)
        print(f"{'dificiles' if dificil else 'normales '}: foto completa {sin/n:.1%} | multirecorte top1 {con/n:.1%} top3 {top3/n:.1%} ({len(recortes(foto))} recortes)")


if __name__ == "__main__":
    main()
