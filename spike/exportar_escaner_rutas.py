import json

import reconocer as r


def imagen_completa(id_carta, crudo):
    if str(id_carta).startswith("w-"):
        return f"cartas/{id_carta}.jpg"
    return f"https://api.myl.cl/static/cards/{crudo['ed_edid']}/{crudo['edid']}.png"


def rutas():
    salida = {}
    for c in json.loads((r.RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8")):
        salida[c["id"]] = {"crudo": c, "ruta": r.IMAGENES / f"{c['ed_edid']}-{c['edid']}.jpg"}
    ruta_esp = r.RAIZ / "datos" / "especiales.json"
    for c in json.loads(ruta_esp.read_text(encoding="utf-8")) if ruta_esp.exists() else []:
        salida[c["id"]] = {"crudo": c, "ruta": r.RAIZ / "datos" / "especiales" / f"{c['id']}.jpg"}
    return salida
