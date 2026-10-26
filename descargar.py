import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

API = "https://api.myl.cl/cards"
DATOS = Path(__file__).parent / "datos"
UA = {"User-Agent": "Mozilla/5.0"}


def pedir(url, cuerpo=None, intentos=4):
    datos = urllib.parse.urlencode(cuerpo).encode() if cuerpo else None
    headers = dict(UA)
    if datos:
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8"
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, data=datos, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            if i == intentos - 1:
                raise
            time.sleep(2 * (i + 1))


FORMATOS = {"IMP": "imperio", "PB": "pb", "PE": "pe", "2B": "2b", "FX": "furia"}


def ediciones_del_sitio():
    req = urllib.request.Request("https://tor.myl.cl/views/cards.html", headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", errors="replace")
    return {s: t.strip() for s, t in re.findall(r'<option[^>]*value="([a-z0-9_.\-ñ]+)"[^>]*>([^<]*)', html)}


def slugs_de_ediciones():
    slugs, nombres = set(), {}
    for termino in "a e i o u r s n l t c d m p b g h dragon oro".split():
        try:
            r = pedir(f"{API}/search", {"entry": termino})
        except Exception:
            continue
        for c in r.get("cards", []):
            slugs.add(c["edition_slug"])
            nombres[c["id"]] = c["name"]
        time.sleep(0.3)
    sitio = ediciones_del_sitio()
    slugs |= set(sitio) - {"todas"}
    return sorted(slugs), nombres, sitio


def formato(titulo):
    prefijo = titulo.split(" - ")[0].strip()
    return FORMATOS.get(prefijo, "otros")


def main():
    DATOS.mkdir(exist_ok=True)
    hoy = date.today().isoformat()
    ediciones, cartas, todas, catalogos = [], [], [], None
    slugs, nombres, sitio = slugs_de_ediciones()
    for slug in slugs:
        try:
            r = pedir(f"{API}/edition/{slug}")
        except Exception as e:
            print("fallo", slug, e)
            continue
        if r.get("status") != "OK":
            continue
        ed = r["edition"]
        catalogos = catalogos or {k: r[k] for k in ("races", "rarities", "types", "keywords")}
        vigente = (
            ed["title"].startswith("IMP")
            and (ed.get("date_empire_valid") or "") >= hoy
            and (ed.get("date_release") or "9999") <= hoy
        )
        titulo = sitio.get(slug) or ed["title"]
        ediciones.append({**ed, "imperio": vigente, "formato": "imperio" if vigente else formato(titulo)})
        if vigente:
            cartas += r["cards"]
        for c in r["cards"]:
            todas.append({**c, "nombre_api": nombres.get(c["id"]), "formato": ediciones[-1]["formato"], "ed_titulo": titulo})
        time.sleep(0.3)
    (DATOS / "cartas-todas.json").write_text(json.dumps(todas, ensure_ascii=False), encoding="utf-8")
    (DATOS / "ediciones.json").write_text(json.dumps(ediciones, ensure_ascii=False, indent=1), encoding="utf-8")
    (DATOS / "cartas-imperio.json").write_text(json.dumps(cartas, ensure_ascii=False, indent=1), encoding="utf-8")
    (DATOS / "catalogos.json").write_text(json.dumps(catalogos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(ediciones), "ediciones,", sum(e["imperio"] for e in ediciones), "vigentes en Imperio,", len(cartas), "cartas")
    por_formato = {}
    for c in todas:
        por_formato[c["formato"]] = por_formato.get(c["formato"], 0) + 1
    print("cartas por formato:", por_formato)
    for e in ediciones:
        if e["imperio"]:
            print(" ", e["slug"], "|", e["title"], "| hasta", e["date_empire_valid"])


if __name__ == "__main__":
    main()
