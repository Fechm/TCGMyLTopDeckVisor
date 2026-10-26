import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://myl.fandom.com/es/api.php"
DATOS = Path(__file__).parent / "datos"
UA = {"User-Agent": "Mozilla/5.0 (TCGMyLTopDeckVisor; uso personal)"}
COLECCIONES = [
    ("Lista de cartas de Libertadores", "Cartas Mystery Box: Rapa Nui", "mrn", "Libertadores · Mystery Box Rapa Nui"),
    ("Lista de cartas de Libertadores", "Cartas Mystery Box: Tierra del Fuego", "mtf", "Libertadores · Mystery Box Tierra del Fuego"),
]
TIPOS = {"aliado": "1", "talismán": "2", "talisman": "2", "arma": "3", "tótem": "4", "totem": "4", "oro": "5"}


def api(**p):
    p["format"] = "json"
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(p), headers=UA)
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read())
        except Exception:
            if i == 3:
                raise
            time.sleep(2 * (i + 1))


def wikitexto(pagina):
    return api(action="parse", page=pagina, prop="wikitext", redirects=1)["parse"]["wikitext"]["*"]


def limpiar(valor):
    valor = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", valor)
    valor = re.sub(r"<br\s*/?>", "\n", valor)
    valor = re.sub(r"'{2,}", "", valor)
    valor = re.sub(r"<[^>]+>", "", valor)
    return valor.strip()


def parametros(plantilla):
    partes, nivel, actual = [], 0, ""
    for ch in plantilla:
        if ch in "[{":
            nivel += 1
        elif ch in "]}":
            nivel -= 1
        if ch == "|" and nivel == 0:
            partes.append(actual)
            actual = ""
        else:
            actual += ch
    partes.append(actual)
    salida = {}
    for p in partes[1:]:
        if "=" in p:
            k, v = p.split("=", 1)
            salida[k.strip().lower()] = v.strip()
    return salida


def plantilla_carta(texto):
    i = texto.find("{{Carta")
    if i < 0:
        return None
    nivel, j = 0, i
    while j < len(texto):
        if texto.startswith("{{", j):
            nivel += 1
            j += 2
            continue
        if texto.startswith("}}", j):
            nivel -= 1
            j += 2
            if nivel == 0:
                break
            continue
        j += 1
    return parametros(texto[i + 2: j - 2])


def url_imagen(archivo):
    r = api(action="query", titles="Archivo:" + archivo, prop="imageinfo", iiprop="url")
    for pagina in r["query"]["pages"].values():
        info = pagina.get("imageinfo")
        if info:
            return info[0]["url"]
    return None


TIENDA = Path(r"C:\Privado\TCGMyLMarket\estado\ultimos\mylserena.json")


def imagen_tienda(coleccion, nombre):
    if not TIENDA.exists():
        return None
    datos = json.loads(TIENDA.read_text(encoding="utf-8"))
    items = datos if isinstance(datos, list) else next((v for v in datos.values() if isinstance(v, list)), [])
    buscado = sin_tildes(nombre).replace(" ", "")
    for x in items:
        n = x.get("nombre") or ""
        if coleccion.upper() not in n.upper():
            continue
        if sin_tildes(n.split("(")[0]).replace(" ", "") != buscado:
            continue
        req = urllib.request.Request(x["url"], headers=UA)
        with urllib.request.urlopen(req, timeout=40) as r:
            html = r.read().decode("utf-8", errors="replace")
        m = re.search(r'"image":\s*"(https://cdnx\.jumpseller\.com/mylserena/image/\d+/[^"?]+)', html)
        return m.group(1) if m else x.get("imagen")
    return None


def sin_tildes(t):
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()


def id_raza(razas, texto):
    nombres = [sin_tildes(x.strip()) for x in re.split(r"[/\n,]", texto) if x.strip()]
    if not nombres:
        return "0"
    buscado = "/".join(nombres)
    for r in razas:
        if sin_tildes(r["name"]).replace(" / ", "/").replace(" ", "/") == buscado:
            return r["id"]
    for r in razas:
        if sin_tildes(r["name"]) == nombres[0]:
            return r["id"]
    return "0"


def filas_de_seccion(texto, titulo):
    i = texto.find("== " + titulo.replace("Cartas ", "Cartas ", 1))
    if i < 0:
        i = texto.find(titulo)
    fin = texto.find("\n==", i + 5)
    seccion = texto[i: fin if fin > 0 else None]
    filas = []
    for bloque in seccion.split("\n|-")[1:]:
        celdas = [c.strip() for c in bloque.strip().split("\n|") if c.strip()]
        celdas = [c.lstrip("|").strip() for c in celdas]
        if len(celdas) >= 3 and re.match(r"^[A-Z]{2,4}\s?\d", celdas[0]):
            enlace = re.search(r"\[\[([^|\]]+)(?:\|([^\]]+))?\]\]", celdas[1])
            if enlace:
                filas.append({
                    "codigo": celdas[0],
                    "pagina": enlace.group(1),
                    "nombre": enlace.group(2) or enlace.group(1),
                    "tipo": limpiar(celdas[2]) if len(celdas) > 2 else "",
                    "raza": limpiar(celdas[4]) if len(celdas) > 5 else "",
                })
    return filas


def completar(cartas):
    reworks = json.loads((Path(__file__).parent / "especiales-reworks.json").read_text(encoding="utf-8"))
    todas = json.loads((DATOS / "cartas-todas.json").read_text(encoding="utf-8"))
    originales = {}
    for c in todas:
        clave = sin_tildes(c["name"]).replace(" ", "")
        if clave not in originales or c["ed_slug"] == "libertadores":
            originales[clave] = c
    for c in cartas:
        if c["codigo"] in reworks:
            c.update(reworks[c["codigo"]])
            c["rework"] = True
            continue
        o = originales.get(sin_tildes(c["name"]).replace(" ", ""))
        if o:
            for campo in ("type", "cost", "damage", "ability", "race", "keywords"):
                if o.get(campo) not in (None, ""):
                    c[campo] = o[campo]
            c["original"] = f"{o['ed_slug']}/{o['edid']}"


def main():
    razas = json.loads((DATOS / "catalogos.json").read_text(encoding="utf-8"))["races"]
    cartas = []
    for lista, seccion, slug, titulo in COLECCIONES:
        filas = filas_de_seccion(wikitexto(lista), seccion)
        print(titulo, len(filas), "cartas")
        for f in filas:
            try:
                p = plantilla_carta(wikitexto(f["pagina"])) or {}
            except Exception:
                p = {}
            p.setdefault("tipo", f["tipo"])
            p.setdefault("raza", f["raza"])
            archivo = re.search(r"(?:Archivo|File|Imagen):([^|\]]+)", p.get("imagen", ""))
            numero = re.sub(r"\D", "", f["codigo"]) or "0"
            cartas.append({
                "id": f"w-{slug}-{numero}",
                "edid": numero.zfill(3),
                "slug": sin_tildes(f["nombre"]).replace(" ", "_"),
                "name": limpiar(p.get("nombre") or f["nombre"]),
                "rarity": "0",
                "race": id_raza(razas, limpiar(p.get("raza", ""))),
                "type": TIPOS.get(sin_tildes(limpiar(p.get("tipo", ""))).replace("talisman", "talisman"), TIPOS.get(limpiar(p.get("tipo", "")).lower(), "")),
                "keywords": None,
                "cost": limpiar(p.get("coste de oro", "")) or None,
                "damage": limpiar(p.get("ataque", p.get("fuerza", ""))) or None,
                "ability": limpiar(p.get("habilidad", "")),
                "ed_edid": slug,
                "ed_slug": slug,
                "ed_titulo": titulo,
                "codigo": f["codigo"],
                "imagen_url": url_imagen(archivo.group(1).strip()) if archivo else imagen_tienda(slug, f["nombre"]),
                "fuente": "https://myl.fandom.com/es/wiki/" + urllib.parse.quote(f["pagina"].replace(" ", "_")),
            })
            time.sleep(0.2)
    completar(cartas)
    (DATOS / "especiales.json").write_text(json.dumps(cartas, ensure_ascii=False, indent=1), encoding="utf-8")
    sin = [c["name"] for c in cartas if not c["imagen_url"] or not c["type"]]
    print(len(cartas), "cartas especiales;", len(sin), "incompletas:", sin)


if __name__ == "__main__":
    main()
