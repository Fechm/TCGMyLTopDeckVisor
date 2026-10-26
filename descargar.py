import json
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


def slugs_de_ediciones():
    slugs = set()
    for termino in "a e i o u r s n l t dragon oro".split():
        try:
            r = pedir(f"{API}/search", {"entry": termino})
        except Exception:
            continue
        slugs |= {c["edition_slug"] for c in r.get("cards", [])}
        time.sleep(0.3)
    return sorted(slugs)


def main():
    DATOS.mkdir(exist_ok=True)
    hoy = date.today().isoformat()
    ediciones, cartas, catalogos = [], [], None
    for slug in slugs_de_ediciones():
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
        ediciones.append({**ed, "imperio": vigente})
        if vigente:
            cartas += r["cards"]
        time.sleep(0.3)
    (DATOS / "ediciones.json").write_text(json.dumps(ediciones, ensure_ascii=False, indent=1), encoding="utf-8")
    (DATOS / "cartas-imperio.json").write_text(json.dumps(cartas, ensure_ascii=False, indent=1), encoding="utf-8")
    (DATOS / "catalogos.json").write_text(json.dumps(catalogos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(ediciones), "ediciones,", sum(e["imperio"] for e in ediciones), "vigentes en Imperio,", len(cartas), "cartas")
    for e in ediciones:
        if e["imperio"]:
            print(" ", e["slug"], "|", e["title"], "| hasta", e["date_empire_valid"])


if __name__ == "__main__":
    main()
