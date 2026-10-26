import io
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).parent
DATOS = RAIZ / "datos"
IMAGENES = DATOS / "imagenes-codice"
API = "https://codicetcg.org/api"
UA = {"User-Agent": "Mozilla/5.0 (TCGMyLTopDeckVisor; uso personal, descarga unica)"}


def pedir(url, binario=False, intentos=4):
    url = urllib.parse.quote(url, safe=":/?=&%")
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                datos = r.read()
            return datos if binario else json.loads(datos.decode("utf-8"))
        except Exception:
            if i == intentos - 1:
                raise
            time.sleep(3 * (i + 1))


def temporada_vigente():
    temporadas = pedir(f"{API}/temporadas?bloque=IMP")
    return max(temporadas, key=lambda t: int(t["id"]))


def bajar_imagen(carta):
    destino = IMAGENES / f"{carta['u']}.jpg"
    if destino.exists():
        return "ya"
    try:
        im = Image.open(io.BytesIO(pedir(carta["i"], binario=True))).convert("RGB")
        if im.width > 709:
            im = im.resize((709, round(im.height * 709 / im.width)), Image.LANCZOS)
        im.save(destino, quality=90)
        return "ok"
    except Exception as e:
        return f"fallo {carta['u']} {e}"


def banlist_desde(codice):
    prohibidas, limitadas = set(), {}
    for x in codice:
        if x.get("status") == "banned" or x.get("limit") == 0:
            prohibidas.add(x["name"])
        elif x.get("limit") is not None:
            limitadas[x["name"]] = min(int(x["limit"]), limitadas.get(x["name"], 3))
    return {
        "fuente": "https://codicetcg.org/IMP/banlist (api/banlist, formato Standard)",
        "prohibidas": sorted(prohibidas),
        "limitadas": dict(sorted(limitadas.items())),
    }


def main():
    DATOS.mkdir(exist_ok=True)
    IMAGENES.mkdir(exist_ok=True)
    temporada = temporada_vigente()
    datos = pedir(f"{API}/cartas?temporada={temporada['id']}&mode=full")
    datos["temporada"] = temporada
    (DATOS / "codice-cartas.json").write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
    ban = pedir(f"{API}/banlist?bloque=IMP&format=Standard")
    (DATOS / "codice-banlist.json").write_text(json.dumps(ban, ensure_ascii=False), encoding="utf-8")
    (RAIZ / "banlist.json").write_text(json.dumps(banlist_desde(ban), ensure_ascii=False, indent=2), encoding="utf-8")
    cartas = datos["cards"]
    print(f"temporada {temporada['id']} ({temporada.get('nombre')}): {len(cartas)} cartas, banlist {len(ban)} entradas")
    with ThreadPoolExecutor(4) as ex:
        resultados = list(ex.map(bajar_imagen, cartas))
    fallos = [r for r in resultados if r.startswith("fallo")]
    print(len(resultados) - len(fallos), "imagenes,", len(fallos), "fallos")
    for f in fallos[:10]:
        print(" ", f)


if __name__ == "__main__":
    main()
