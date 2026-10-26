import json
import shutil
import struct
import unicodedata

import numpy as np
from PIL import Image

import multirecorte as mr
import orb
import reconocer as r

RAIZ = r.RAIZ
WEB = RAIZ / "web"
IMAGENES = RAIZ / "datos" / "imagenes-codice"
TIPOS = {"1": "Aliado", "2": "Talismán", "3": "Arma", "4": "Tótem", "5": "Oro", "6": "Monumento"}
ANCHO_MINI, ANCHO_GRANDE = 220, 400


def clave(nombre):
    return "".join(ch for ch in unicodedata.normalize("NFKD", nombre or "").lower() if ch.isalnum())


def limpiar(carpeta):
    if carpeta.exists():
        shutil.rmtree(carpeta)
    carpeta.mkdir()


def main():
    datos = json.loads((RAIZ / "datos" / "codice-cartas.json").read_text(encoding="utf-8"))
    dic = datos["dictionaries"]
    cartas = [c for c in datos["cards"] if (IMAGENES / f"{c['u']}.jpg").exists()]
    print(len(cartas), "de", len(datos["cards"]), "cartas con imagen")
    imgs = [r.leer(IMAGENES / f"{c['u']}.jpg") for c in cartas]

    f = r.metodos(r.Embedder())["cnn_carta+arte"]
    base = f(imgs).astype(np.float32)
    escala = np.abs(base).max(axis=1, keepdims=True) / 127
    np.round(base / escala).astype(np.int8).tofile(WEB / "referencias.bin")
    escala.astype(np.float32).tofile(WEB / "escalas.bin")
    shutil.copy(r.MODELO, WEB / "modelo.onnx")

    for carpeta in ("orb", "miniaturas", "cartas"):
        limpiar(WEB / carpeta)
    entradas = []
    for i, (c, img) in enumerate(zip(cartas, imgs)):
        pts, des = orb.rasgos(img)
        n = 0 if des is None else len(des)
        coords = np.round(pts[:n] * 16).astype(np.uint16) if n else np.zeros((0, 2), np.uint16)
        (WEB / "orb" / f"{i}.bin").write_bytes(struct.pack("<H", n) + coords.tobytes() + (des.tobytes() if n else b""))
        im = Image.open(IMAGENES / f"{c['u']}.jpg").convert("RGB")
        for ancho, carpeta, calidad in ((ANCHO_MINI, "miniaturas", 78), (ANCHO_GRANDE, "cartas", 72)):
            im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS).save(
                WEB / carpeta / f"{c['u']}.jpg", quality=calidad, optimize=True, progressive=True)
        razas = [dic["r"].get(str(x), "") for x in (c.get("r") or [])]
        entradas.append({
            "id": c["u"],
            "nombre": c["n"],
            "edicion": dic["e"].get(str(c["e"]), str(c["e"])),
            "tipo": TIPOS.get(str(c["t"]), ""),
            "coste": c.get("c"),
            "fuerza": c.get("z"),
            "raza": "/".join(x for x in razas if x and x != "Sin raza") if str(c["t"]) == "1" else "",
            "rareza": c.get("f") or "",
            "img": f"cartas/{c['u']}.jpg",
        })
    meta = {"dim": base.shape[1], "arte": r.ARTE, "escalas": mr.ESCALAS, "fuente": "Códice TCG (codicetcg.org)",
            "temporada": datos.get("temporada", {}).get("nombre"), "cartas": entradas}
    (WEB / "catalogo.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    anterior = RAIZ / "datos" / "catalogo-api-anterior.json"
    if anterior.exists():
        por_nombre = {}
        for e in entradas:
            por_nombre.setdefault(clave(e["nombre"]), []).append(e)
        migracion = {}
        for v in json.loads(anterior.read_text(encoding="utf-8"))["cartas"]:
            opciones = por_nombre.get(clave(v["nombre"]))
            if opciones:
                misma = [o for o in opciones if clave(v["edicion"]).startswith(clave(o["edicion"])[:6])]
                migracion[str(v["id"])] = (misma or opciones)[0]["id"]
        (WEB / "migracion.json").write_text(json.dumps(migracion, separators=(",", ":")), encoding="utf-8")
        print(len(migracion), "ids antiguos con equivalente nuevo")
    print(len(entradas), "cartas exportadas")


if __name__ == "__main__":
    main()
