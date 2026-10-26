import io
import json
import os
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).parent
sys.path.insert(0, str(RAIZ / "spike"))

CODICE = "https://codicetcg.org/api"
SUPABASE = os.environ.get("SUPABASE_URL", "https://nzehvfrlbmltxfqkovtu.supabase.co")
CLAVE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
UA = {"User-Agent": "Mozilla/5.0 (TCGMyLTopDeckVisor; actualizacion diaria)"}
LOTE_HUELLAS = 40


def pedir(url, binario=False, intentos=4):
    url = urllib.parse.quote(url, safe=":/?=&%")
    for i in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                datos = r.read()
            return datos if binario else json.loads(datos.decode("utf-8"))
        except Exception:
            if i == intentos - 1:
                raise
            time.sleep(3 * (i + 1))


def supabase(metodo, ruta, cuerpo=None, extra=None):
    cabeceras = {"apikey": CLAVE, "Authorization": f"Bearer {CLAVE}", "Content-Type": "application/json"}
    cabeceras.update(extra or {})
    datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(f"{SUPABASE}/rest/v1/{ruta}", data=datos, headers=cabeceras, method=metodo)
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                texto = r.read().decode("utf-8")
                return json.loads(texto) if texto else None
        except urllib.error.HTTPError as e:
            detalle = e.read().decode("utf-8", errors="replace")[:500]
            if e.code < 500 or i == 3:
                raise RuntimeError(f"{metodo} {ruta} -> {e.code}: {detalle}") from None
        except urllib.error.URLError:
            if i == 3:
                raise
        time.sleep(3 * (i + 1))


def upsert(tabla, filas, conflicto):
    for i in range(0, len(filas), 500):
        supabase("POST", f"{tabla}?on_conflict={conflicto}", filas[i: i + 500],
                 {"Prefer": "resolution=merge-duplicates,return=minimal"})


def todos(ruta):
    salida, desde = [], 0
    while True:
        lote = supabase("GET", ruta, extra={"Range": f"{desde}-{desde + 999}"})
        salida += lote
        if len(lote) < 1000:
            return salida
        desde += 1000


def clave(nombre):
    return "".join(ch for ch in unicodedata.normalize("NFKD", nombre or "").lower() if ch.isalnum())


def entero(valor):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def main():
    temporadas = sorted(pedir(f"{CODICE}/temporadas?bloque=IMP"), key=lambda t: int(t["id"]))
    vigente = temporadas[-1]
    cartas, ediciones, en_temporadas = {}, {}, {}
    for t in temporadas:
        datos = pedir(f"{CODICE}/cartas?temporada={t['id']}&mode=full")
        for eid, nombre in datos["dictionaries"]["e"].items():
            ediciones[int(eid)] = {"id": int(eid), "nombre": nombre, "bloque": "IMP"}
        razas = datos["dictionaries"]["r"]
        for c in datos["cards"]:
            en_temporadas.setdefault(c["u"], set()).add(int(t["id"]))
            cartas[c["u"]] = {
                "id": c["u"],
                "nombre": c["n"],
                "nombre_clave": clave(c["n"]),
                "edicion_id": entero(c.get("e")),
                "bloque": "IMP",
                "tipo": {"1": "Aliado", "2": "Talismán", "3": "Arma", "4": "Tótem", "5": "Oro", "6": "Monumento"}.get(str(c.get("t")), ""),
                "coste": entero(c.get("c")),
                "fuerza": entero(c.get("z")),
                "razas": [razas.get(str(r), str(r)) for r in (c.get("r") or [])],
                "rareza": c.get("f"),
                "numero": entero(c.get("d")),
                "habilidad": c.get("h"),
                "imagen": c.get("i"),
            }
        time.sleep(1)
    for u, fila in cartas.items():
        fila["temporadas"] = sorted(en_temporadas[u])
    print(f"Códice: {len(temporadas)} temporadas, {len(cartas)} cartas IMP, vigente {vigente['id']} ({vigente['nombre']})")

    usadas = {c["edicion_id"] for c in cartas.values()}
    upsert("ediciones", [e for k, e in ediciones.items() if k in usadas], "id")
    upsert("cartas", list(cartas.values()), "id")
    supabase("POST", "temporada_vigente?on_conflict=bloque",
             [{"bloque": "IMP", "temporada": int(vigente["id"]), "nombre": vigente["nombre"]}],
             {"Prefer": "resolution=merge-duplicates,return=minimal"})

    ban = pedir(f"{CODICE}/banlist?bloque=IMP&format=Standard")
    limites = {}
    for b in ban:
        limite = 0 if b.get("status") == "banned" else entero(b.get("limit"))
        if limite is None:
            continue
        k = clave(b["name"])
        limites[k] = {"nombre_clave": k, "nombre": b["name"], "limite": min(limite, limites.get(k, {"limite": 3})["limite"])}
    supabase("DELETE", "banlist?nombre_clave=neq.__ninguna__", extra={"Prefer": "return=minimal"})
    upsert("banlist", list(limites.values()), "nombre_clave")
    print(f"banlist: {len(limites)} cartas")

    con_huella = {f["carta_id"] for f in todos("huellas?select=carta_id")}
    pendientes = [c for u, c in cartas.items() if int(vigente["id"]) in c["temporadas"] and u not in con_huella]
    print(f"huellas existentes: {len(con_huella)}, por calcular: {len(pendientes)}")
    if not pendientes:
        return

    import reconocer as r
    embebedor = r.metodos(r.Embedder())["cnn_carta+arte"]
    for i in range(0, len(pendientes), LOTE_HUELLAS):
        lote = pendientes[i: i + LOTE_HUELLAS]
        imagenes, ids = [], []
        for c in lote:
            try:
                im = Image.open(io.BytesIO(pedir(c["imagen"], binario=True))).convert("RGB")
            except Exception as e:
                print("  sin imagen", c["id"], e)
                continue
            if im.width > 709:
                im = im.resize((709, round(im.height * 709 / im.width)), Image.LANCZOS)
            imagenes.append(np.array(im)[:, :, ::-1].copy())
            ids.append(c["id"])
        if not imagenes:
            continue
        vectores = embebedor(imagenes)
        filas = [{"carta_id": u, "vector": "[" + ",".join(f"{x:.5f}" for x in v) + "]"} for u, v in zip(ids, vectores)]
        upsert("huellas", filas, "carta_id")
        print(f"  huellas {i + len(lote)}/{len(pendientes)}")


if __name__ == "__main__":
    main()
