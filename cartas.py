import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

RAIZ = Path(__file__).parent
TIPOS = {"1": "Aliado", "2": "Talismán", "3": "Arma", "4": "Tótem", "5": "Oro"}
NUMEROS = {"un": 1, "una": 1, "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7}


def normalizar(texto):
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", texto.lower())


def numero(palabra):
    return NUMEROS.get(palabra, int(palabra) if palabra.isdigit() else 1)


@dataclass
class Carta:
    nombre: str
    clave: str
    tipo: str
    raza: str
    coste: int
    fuerza: int
    habilidad: str
    edicion: str
    rareza: str
    max_copias: int = 3
    poder: float = 0.0
    roles: set = field(default_factory=set)
    furia: bool = False
    roba_al_entrar: int = 0
    oro_al_entrar: int = 0
    reduccion: tuple = ()
    oro_inicial: bool = False
    basico: bool = False

    def __hash__(self):
        return hash(self.clave)


def _reduccion(h):
    m = re.search(r"reduce su coste en (\w+) oros? por cada oro que controles(?:[^.]*?minimo de (\w+))?", h)
    if m:
        return ("por_oro", numero(m.group(1)), numero(m.group(2)) if m.group(2) else 1)
    m = re.search(r"reduce su coste en (\w+) oros? si controlas aliados dragon", h) or re.search(
        r"si controlas dragones reduce su coste en (\w+) oro", h
    )
    if m:
        return ("si_dragon", numero(m.group(1)), 0)
    m = re.search(r"reduce su coste en (\w+) oros? si no controlas aliados de coste 1 o menos", h) or re.search(
        r"si no controlas aliados de coste 1 o menos, reduce su coste en (\w+) oro", h
    )
    if m:
        return ("sin_baratos", numero(m.group(1)), 0)
    m = re.search(r"reduce su coste en (\w+) oros? por cada aliado de coste 3 o mas que controles(?:[^.]*?minimo de (\w+))?", h)
    if m:
        return ("por_grandes", numero(m.group(1)), numero(m.group(2)) if m.group(2) else 1)
    return ()


def _valorar(c, h):
    p = 0.0
    roles = set()
    for n in re.findall(r"roba (\w+) cartas?", h):
        p += 1.1 * numero(n)
        roles.add("robo")
    if re.search(r"busca[^.]*(ponla|ponlo|ponerla|ponerlo) en tu mano|busca[^.]*juegalo", h):
        p += 2.0
        roles.add("busqueda")
    if re.search(r"destruye|destierra (hasta )?(una|dos|tres|todas|todos)[^.]*(oponente|en juego|que no sea oro)|anula", h):
        p += 2.0
        roles.add("remocion")
    if re.search(r"(destruye|destierra) todas? (las|los) (demas )?(cartas|aliados)", h):
        p += 1.5
        roles.add("barrida")
    if re.search(r"genera (un|dos) oros?|en tu oro pagado|en tu reserva|reduce su coste", h):
        p += 1.3
        roles.add("aceleracion")
    if re.search(r"pierden? su habilidad|no puede utilizar habilidades|cuesta un oro adicional|no puede atacar", h):
        p += 1.2
        roles.add("control")
    if re.search(r"prev[ie]n|no puede ser (anulado|afectado)|no se puede anular", h):
        p += 0.7
        roles.add("proteccion")
    if re.search(r"(baraja|destierra)[^.]*cementerio", h):
        p += 0.5
        roles.add("cementerio")
    p += sum(0.3 * numero(n) for n in re.findall(r"bota (\w+) cartas?", h))
    for clave, valor in (("furia", 1.0), ("imbloqueable", 1.5), ("indestructible", 1.0), ("indesterrable", 0.6), ("exhumar", 1.0)):
        if clave in h:
            p += valor
    if "en tu fase final, destierra este aliado" in h:
        p -= 2.5
    if c.tipo == "Aliado":
        p += 0.6 * (c.fuerza - c.coste)
        roles.add("aliado")
    elif c.tipo in ("Talismán", "Tótem", "Arma"):
        p -= 0.4 * max(0, c.coste - 2)
    return round(p, 2), roles


def _crear(x, banlist):
    h = normalizar_texto(x.get("ability"))
    tipo = TIPOS.get(x["type"], "?")
    c = Carta(
        nombre=x["name"],
        clave=normalizar(x["name"]),
        tipo=tipo,
        raza=x["race"],
        coste=int(x["cost"]) if (x.get("cost") or "").isdigit() else 0,
        fuerza=int(x["damage"]) if (x.get("damage") or "").isdigit() else 0,
        habilidad=x.get("ability") or "",
        edicion=x["ed_slug"],
        rareza=x["rarity"],
    )
    c.basico = tipo == "Oro" and not h
    c.max_copias = 99 if c.basico else (1 if h.startswith("unica") else 3)
    c.max_copias = min(c.max_copias, banlist.get(c.clave, c.max_copias))
    c.furia = bool(re.search(r"(^|\. )furia", h))
    m = re.search(r"cuando entra en juego[^.]*roba (hasta )?(\w+) cartas?", h)
    c.roba_al_entrar = numero(m.group(2)) if m else 0
    c.oro_al_entrar = 1 if re.search(r"cuando entra en juego[^.]*(oro pagado|genera un oro)", h) else 0
    c.reduccion = _reduccion(h)
    c.oro_inicial = "oro inicial" in h
    c.poder, c.roles = _valorar(c, h)
    if c.basico:
        c.poder = 3.0
    return c


def normalizar_texto(texto):
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", texto).strip()


def cargar(razas_aliados=("0", "11", "37", "44", "49", "51")):
    crudas = json.loads((RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
    ruta_especiales = RAIZ / "datos" / "especiales.json"
    especiales = json.loads(ruta_especiales.read_text(encoding="utf-8")) if ruta_especiales.exists() else []
    reworks = {normalizar(x["name"]) for x in especiales if x.get("rework")}
    crudas = [x for x in crudas if normalizar(x["name"]) not in reworks] + especiales
    ban = json.loads((RAIZ / "banlist.json").read_text(encoding="utf-8"))
    limites = {normalizar(n): 0 for n in ban["prohibidas"]}
    limites.update({normalizar(n): v for n, v in ban["limitadas"].items()})
    ajustes = json.loads((RAIZ / "valoraciones.json").read_text(encoding="utf-8"))
    ajustes = {normalizar(k): v for k, v in ajustes.items() if not k.startswith("_")}
    por_nombre = {}
    for x in crudas:
        if x["type"] not in TIPOS:
            continue
        if x["type"] == "1" and x["race"] not in razas_aliados:
            continue
        c = _crear(x, limites)
        if c.max_copias == 0:
            continue
        if c.clave in ajustes:
            c.poder = ajustes[c.clave]
        previa = por_nombre.get(c.clave)
        if not previa or len(c.habilidad) > len(previa.habilidad):
            por_nombre[c.clave] = c
    return list(por_nombre.values())
