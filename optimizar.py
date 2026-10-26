import argparse
import json
import random
from collections import Counter
from pathlib import Path

from cartas import RAIZ, cargar, normalizar
from simulador import simular

TAMANO = 50
PRECIOS = Path(r"C:\Privado\TCGMyLMarket\public\data\cartas-imperio.json")


def puntaje(mazo, n, semilla=7):
    r = simular(mazo, n=n, semilla=semilla)
    calidad = sum(c.poder for c in mazo) / len(mazo)
    velocidad = max(0.0, min(10.0, 10 * (1 - (r.turno_victoria - 4) / 8)))
    consistencia = 10 * (0.4 * r.aliado_t2 + 0.4 * r.sin_fallo_oro + 0.2 * (1 - r.mano_muerta))
    roles = Counter(rol for c in mazo for rol in c.roles)
    castigo = max(0, 6 - roles["remocion"]) + max(0, 6 - roles["robo"] - roles["busqueda"])
    aliados = sum(c.tipo == "Aliado" for c in mazo)
    castigo += max(0, 16 - aliados) + max(0, aliados - 24)
    castigo += 5 * max(0, 17 - sum(c.tipo in ("Aliado", "Arma", "Tótem") for c in mazo))
    castigo += 5 * max(0, sum(c.tipo == "Aliado" and c.raza == "0" for c in mazo) - 4)
    total = 0.5 * calidad + 0.3 * velocidad + 0.2 * consistencia - 0.5 * castigo
    return total, {"calidad": calidad, "velocidad": velocidad, "consistencia": consistencia, "sim": r}


def pool(cartas, soporte_max=90, oros_max=30):
    aliados = [c for c in cartas if c.tipo == "Aliado"]
    soporte = sorted([c for c in cartas if c.tipo in ("Talismán", "Tótem", "Arma")], key=lambda c: -c.poder)[:soporte_max]
    oros = sorted([c for c in cartas if c.tipo == "Oro" and not c.basico], key=lambda c: -c.poder)[:oros_max]
    basico = max((c for c in cartas if c.basico), key=lambda c: c.clave)
    return aliados + soporte + oros + [basico], basico


def inicial(candidatos, basico):
    mazo = []
    def agregar(lista, cuantos):
        for c in sorted(lista, key=lambda c: -c.poder):
            while mazo.count(c) < c.max_copias and cuantos > 0:
                mazo.append(c)
                cuantos -= 1
    agregar([c for c in candidatos if c.tipo == "Aliado"], 21)
    agregar([c for c in candidatos if c.tipo in ("Talismán", "Tótem", "Arma")], 11)
    agregar([c for c in candidatos if c.tipo == "Oro" and not c.basico and c.poder > basico.poder], 8)
    mazo += [basico] * (TAMANO - len(mazo))
    return mazo


def optimizar(iteraciones, n_sim, semilla):
    rng = random.Random(semilla)
    candidatos, basico = pool(cargar())
    mazo = inicial(candidatos, basico)
    mejor, _ = puntaje(mazo, n_sim)
    for i in range(iteraciones):
        nuevo = list(mazo)
        for _ in range(rng.choice((1, 1, 2, 3))):
            saliente = rng.randrange(len(nuevo))
            entrante = rng.choice(candidatos)
            if nuevo.count(entrante) >= entrante.max_copias:
                continue
            nuevo[saliente] = entrante
        valor, _ = puntaje(nuevo, n_sim)
        temperatura = 0.15 * (1 - i / iteraciones)
        if valor > mejor or rng.random() < temperatura * 0.2:
            mazo, mejor = nuevo, valor
        if i % 200 == 0:
            print(f"  iteracion {i}: {mejor:.3f}")
    return mazo


def precios():
    if not PRECIOS.exists():
        return {}
    datos = json.loads(PRECIOS.read_text(encoding="utf-8", errors="replace"))
    tabla = {}
    for x in datos:
        valor = x.get("market") or x.get("precio") or None
        if valor and x.get("variante") == "normal":
            clave = normalizar(x["nombre"])
            tabla[clave] = min(valor, tabla.get(clave, valor))
    return tabla


def reporte(mazo, detalle, salida):
    r = detalle["sim"]
    tabla = precios()
    conteo = Counter(mazo)
    lineas = [
        "# Mazo Dragón Imperio — resultado del optimizador",
        "",
        f"- Turno promedio en que ganas sin oposición: **{r.turno_victoria:.1f}**",
        f"- Daño promedio al turno 5: **{r.dano_t5:.1f}** de 42",
        f"- Aliado jugado al turno 2: **{r.aliado_t2:.0%}**",
        f"- Sin turnos sin Oro (T1-T4): **{r.sin_fallo_oro:.0%}**",
        f"- Calidad media de cartas: **{detalle['calidad']:.2f}**/10",
        "",
    ]
    total_precio, sin_precio = 0, 0
    for tipo in ("Aliado", "Talismán", "Tótem", "Arma", "Oro"):
        filas = sorted([(c, n) for c, n in conteo.items() if c.tipo == tipo], key=lambda x: (x[0].coste, -x[0].poder))
        if not filas:
            continue
        lineas += [f"## {tipo}s ({sum(n for _, n in filas)})", "", "| # | Carta | Coste/Fuerza | Puntaje | Edición | Precio c/u |", "|---|---|---|---|---|---|"]
        for c, n in filas:
            p = tabla.get(c.clave)
            if p:
                total_precio += p * n
            elif not c.basico:
                sin_precio += n
            cf = f"{c.coste}/{c.fuerza}" if tipo == "Aliado" else (str(c.coste) if tipo != "Oro" else "-")
            nombre = "Oro sin habilidad (cualquier edición)" if c.basico else c.nombre.title()
            lineas.append(f"| {n} | {nombre} | {cf} | {c.poder:.1f} | {c.edicion} | {'$' + format(int(p), ',') if p else '-'} |")
        lineas.append("")
    lineas.append(f"Costo estimado de singles con precio conocido: **${int(total_precio):,}** ({sin_precio} cartas sin precio en TCGMyLMarket).")
    salida.write_text("\n".join(lineas), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--iteraciones", type=int, default=1500)
    ap.add_argument("--sim", type=int, default=250)
    ap.add_argument("--semilla", type=int, default=1)
    a = ap.parse_args()
    mazo = optimizar(a.iteraciones, a.sim, a.semilla)
    _, detalle = puntaje(mazo, 5000, semilla=99)
    salida = RAIZ / f"mazo-dragon-semilla{a.semilla}.md"
    reporte(mazo, detalle, salida)
    print("listo:", salida)


if __name__ == "__main__":
    main()
