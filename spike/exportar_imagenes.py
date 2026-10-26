import json

from PIL import Image

import reconocer as r
from exportar_escaner_rutas import imagen_completa, rutas

WEB = r.RAIZ / "web"
ANCHO_MINI = 220


def main():
    meta = json.loads((WEB / "catalogo.json").read_text(encoding="utf-8"))
    origen = rutas()
    (WEB / "miniaturas").mkdir(exist_ok=True)
    (WEB / "cartas").mkdir(exist_ok=True)
    total = 0
    for c in meta["cartas"]:
        fuente = origen[c["id"]]
        c["img"] = imagen_completa(c["id"], fuente["crudo"])
        im = Image.open(fuente["ruta"]).convert("RGB")
        mini = im.resize((ANCHO_MINI, round(im.height * ANCHO_MINI / im.width)), Image.LANCZOS)
        destino = WEB / "miniaturas" / f"{c['id']}.jpg"
        mini.save(destino, quality=78, optimize=True, progressive=True)
        total += destino.stat().st_size
        if c["id"].startswith("w-"):
            im.save(WEB / "cartas" / f"{c['id']}.jpg", quality=86, optimize=True, progressive=True)
    (WEB / "catalogo.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(len(meta["cartas"]), "miniaturas,", round(total / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
