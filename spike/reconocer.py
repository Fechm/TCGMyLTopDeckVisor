import json
import os
import random
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

RAIZ = Path(__file__).resolve().parent.parent
IMAGENES = RAIZ / "datos" / "imagenes"
MODELO = Path(__file__).parent / "modelos" / os.environ.get("MODELO_ONNX", "mobilenetv2-emb.onnx")
MEDIA = np.array([0.485, 0.456, 0.406], np.float32)
DESV = np.array([0.229, 0.224, 0.225], np.float32)
ARTE = (0.05, 0.10, 0.95, 0.60)


def leer(ruta):
    return cv2.imdecode(np.fromfile(str(ruta), np.uint8), cv2.IMREAD_COLOR)


def fotografiar(carta, rng, dificil=False):
    h, w = carta.shape[:2]
    lienzo_w, lienzo_h = int(w * 1.25), int(h * 1.25)
    fondo = np.full((lienzo_h, lienzo_w, 3), rng.integers(30, 200, 3), np.uint8)
    fondo = cv2.add(fondo, rng.integers(0, 40, fondo.shape, dtype=np.uint8))
    j = 0.10 if dificil else 0.05
    ox, oy = (lienzo_w - w) / 2, (lienzo_h - h) / 2
    origen = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    destino = origen + np.float32([ox, oy]) + rng.uniform(-j, j, (4, 2)).astype(np.float32) * np.float32([w, h])
    m = cv2.getPerspectiveTransform(origen, destino)
    foto = cv2.warpPerspective(carta, m, (lienzo_w, lienzo_h), dst=fondo.copy(), borderMode=cv2.BORDER_TRANSPARENT)
    foto = foto.astype(np.float32)
    foto *= rng.uniform(0.6, 1.3)
    foto += rng.uniform(-35, 35)
    foto *= rng.uniform(0.85, 1.15, 3)
    if rng.random() < (0.8 if dificil else 0.5):
        yy, xx = np.mgrid[0:lienzo_h, 0:lienzo_w]
        cx, cy = rng.uniform(0, lienzo_w), rng.uniform(0, lienzo_h)
        r = rng.uniform(0.15, 0.4) * lienzo_w
        foto += (rng.uniform(80, 200) * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))[..., None]
    foto += rng.normal(0, rng.uniform(2, 10), foto.shape)
    foto = np.clip(foto, 0, 255).astype(np.uint8)
    sigma = rng.uniform(0.3, 2.5 if dificil else 1.5)
    foto = cv2.GaussianBlur(foto, (0, 0), sigma)
    if dificil and rng.random() < 0.5:
        x0 = int(rng.uniform(0.6, 0.85) * lienzo_w)
        y0 = int(rng.uniform(0.6, 0.85) * lienzo_h)
        cv2.ellipse(foto, (x0, y0), (int(0.12 * w), int(0.08 * h)), rng.uniform(0, 180), 0, 360, (150, 170, 210), -1)
    calidad = int(rng.uniform(40, 85))
    foto = cv2.imdecode(cv2.imencode(".jpg", foto, [cv2.IMWRITE_JPEG_QUALITY, calidad])[1], cv2.IMREAD_COLOR)
    margen = rng.uniform(-0.03, 0.03, 4) * np.array([w, h, w, h])
    x1, y1 = int(ox + margen[0]), int(oy + margen[1])
    x2, y2 = int(ox + w + margen[2]), int(oy + h + margen[3])
    return foto[max(0, y1): y2, max(0, x1): x2]


def recorte(img, caja):
    h, w = img.shape[:2]
    x1, y1, x2, y2 = caja
    return img[int(y1 * h): int(y2 * h), int(x1 * w): int(x2 * w)]


class Embedder:
    def __init__(self):
        self.sesion = ort.InferenceSession(str(MODELO))

    def __call__(self, imagenes):
        lote = []
        for img in imagenes:
            x = cv2.resize(img, (224, 224), interpolation=cv2.INTER_AREA)
            x = cv2.cvtColor(x, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
            lote.append(((x - MEDIA) / DESV).transpose(2, 0, 1))
        salida = []
        for i in range(0, len(lote), 64):
            salida.append(self.sesion.run(None, {"input": np.stack(lote[i: i + 64])})[0])
        e = np.concatenate(salida)
        return e / np.linalg.norm(e, axis=1, keepdims=True)


def dhash(imagenes, tam=16):
    salida = []
    for img in imagenes:
        g = cv2.cvtColor(cv2.resize(img, (tam + 1, tam), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        salida.append((g[:, 1:] > g[:, :-1]).flatten().astype(np.float32) * 2 - 1)
    e = np.array(salida)
    return e / np.linalg.norm(e, axis=1, keepdims=True)


def metodos(emb):
    return {
        "dhash_carta": lambda ims: dhash(ims),
        "cnn_carta": lambda ims: emb(ims),
        "cnn_arte": lambda ims: emb([recorte(i, ARTE) for i in ims]),
        "cnn_carta+arte": lambda ims: _concat(emb(ims), emb([recorte(i, ARTE) for i in ims])),
    }


def _concat(a, b):
    e = np.concatenate([a, b], axis=1)
    return e / np.linalg.norm(e, axis=1, keepdims=True)


def main():
    n_pruebas = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    cartas = json.loads((RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
    refs = [(c, IMAGENES / f"{c['ed_edid']}-{c['edid']}.jpg") for c in cartas]
    refs = [(c, r) for c, r in refs if r.exists()]
    nombres = [c["name"] for c, _ in refs]
    imgs = [leer(r) for _, r in refs]
    print(len(imgs), "imagenes de referencia")
    rng = np.random.default_rng(3)
    idx = rng.choice(len(imgs), n_pruebas, replace=False)
    emb = Embedder()
    for dificil in (False, True):
        consultas = [fotografiar(imgs[i], rng, dificil) for i in idx]
        if dificil:
            for k in range(4):
                cv2.imwrite(str(Path(__file__).parent / f"ejemplo-foto-{k}.jpg"), consultas[k])
        print(f"\n== fotos {'dificiles' if dificil else 'normales'} ({n_pruebas})")
        for nombre, f in metodos(emb).items():
            t = time.time()
            base = f(imgs)
            q = f(consultas)
            sim = q @ base.T
            orden = np.argsort(-sim, axis=1)[:, :3]
            top1 = np.mean([nombres[o[0]] == nombres[i] for o, i in zip(orden, idx)])
            top3 = np.mean([nombres[i] in {nombres[j] for j in o} for o, i in zip(orden, idx)])
            exacto = np.mean([o[0] == i for o, i in zip(orden, idx)])
            print(f"  {nombre:16s} top1 {top1:6.1%}  top3 {top3:6.1%}  edicion exacta {exacto:6.1%}  ({time.time() - t:.0f}s)")


if __name__ == "__main__":
    main()
