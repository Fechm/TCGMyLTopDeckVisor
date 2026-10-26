import io
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "datos" / "imagenes"
ANCHO = 360


def bajar(carta):
    ruta = DESTINO / f"{carta['ed_edid']}-{carta['edid']}.jpg"
    if ruta.exists():
        return "ya"
    url = f"https://api.myl.cl/static/cards/{carta['ed_edid']}/{carta['edid']}.png"
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                im = Image.open(io.BytesIO(r.read())).convert("RGB")
            im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)
            im.save(ruta, quality=90)
            return "ok"
        except Exception as e:
            error = e
    return f"fallo {url} {error}"


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    cartas = json.loads((RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
    with ThreadPoolExecutor(8) as ex:
        resultados = list(ex.map(bajar, cartas))
    fallos = [r for r in resultados if r.startswith("fallo")]
    print(len(resultados), "cartas,", len(fallos), "fallos")
    for f in fallos[:10]:
        print(f)


if __name__ == "__main__":
    main()
