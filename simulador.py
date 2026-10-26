import random
import re
from dataclasses import dataclass
from functools import lru_cache

from cartas import normalizar_texto

CASTILLO_RIVAL = 42
TURNOS = 12


@dataclass
class Resultado:
    turno_victoria: float
    dano_t5: float
    aliado_t2: float
    sin_fallo_oro: float
    mano_muerta: float


@lru_cache(maxsize=None)
def _bonus_global(carta):
    h = normalizar_texto(carta.habilidad)
    m = re.search(r"tus (demas )?aliados(?: dragon)?[^.]*ganan (\w+) de fuerza", h)
    if not m or "por el turno" in h[m.start(): m.end() + 15]:
        return 0
    return {"un": 1, "1": 1, "dos": 2, "2": 2}.get(m.group(2), 0)


def _coste(carta, oros, en_juego):
    if not carta.reduccion:
        return carta.coste
    tipo, k, minimo = carta.reduccion
    if tipo == "por_oro":
        return max(minimo, carta.coste - k * oros)
    if tipo == "si_dragon":
        return max(1, carta.coste - k) if any(c.tipo == "Aliado" for c in en_juego) else carta.coste
    if tipo == "sin_baratos":
        baratos = any(c.tipo == "Aliado" and c.coste <= 1 for c in en_juego)
        return carta.coste if baratos else max(1, carta.coste - k)
    if tipo == "por_grandes":
        grandes = sum(1 for c in en_juego if c.tipo == "Aliado" and c.coste >= 3)
        return max(minimo, carta.coste - k * grandes)
    return carta.coste


@lru_cache(maxsize=None)
def _robo_soporte(carta):
    h = normalizar_texto(carta.habilidad)
    m = re.search(r"roba (\w+) cartas?", h)
    if not m:
        return 0
    return {"una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5}.get(m.group(1), 1)


@lru_cache(maxsize=None)
def _busca_aliado(carta):
    h = normalizar_texto(carta.habilidad)
    return bool(re.search(r"busca[^.]*aliado[^.]*(mano|juegalo)", h))


def partida(mazo, rng):
    castillo = list(mazo)
    rng.shuffle(castillo)
    iniciales = [c for c in castillo if c.oro_inicial] or [c for c in castillo if c.basico]
    oros = 0
    if iniciales:
        inicial = max(iniciales, key=lambda c: c.poder)
        castillo.remove(inicial)
        oros = 1
    mano, castillo = castillo[:8], castillo[8:]
    if sum(c.tipo == "Oro" for c in mano) <= 1:
        castillo += mano
        rng.shuffle(castillo)
        mano, castillo = castillo[:8], castillo[8:]
    if not any(c.tipo == "Aliado" for c in mano):
        castillo += mano
        rng.shuffle(castillo)
        mano, castillo = castillo[:7], castillo[7:]

    en_juego, dano, dano_t5 = [], 0, 0
    aliado_t2, fallo_oro, turno_victoria, jugadas = False, False, TURNOS + 2, 0

    def robar(n):
        nonlocal castillo
        mano.extend(castillo[:n])
        castillo = castillo[n:]

    for turno in range(1, TURNOS + 1):
        if turno > 1 or rng.random() < 0.5:
            robar(1)
        oro_mano = [c for c in mano if c.tipo == "Oro"]
        if oro_mano:
            elegido = max(oro_mano, key=lambda c: c.poder)
            mano.remove(elegido)
            oros += 1
            robar(elegido.roba_al_entrar)
        elif turno <= 4:
            fallo_oro = True

        bonus = sum(_bonus_global(c) for c in en_juego)
        dano += sum(c.fuerza + bonus for c in en_juego if c.tipo == "Aliado")

        disponible = oros
        while True:
            opciones = [(c, _coste(c, oros, en_juego)) for c in mano if c.tipo != "Oro"]
            opciones = [(c, k) for c, k in opciones if k <= disponible]
            if not opciones:
                break
            carta, k = max(opciones, key=lambda x: (x[0].tipo == "Aliado", x[0].poder))
            mano.remove(carta)
            disponible -= k
            jugadas += 1
            if carta.tipo == "Aliado":
                en_juego.append(carta)
                robar(carta.roba_al_entrar)
                if carta.oro_al_entrar:
                    oros += 1
                if carta.furia:
                    dano += carta.fuerza + sum(_bonus_global(c) for c in en_juego if c is not carta)
                if turno <= 2:
                    aliado_t2 = True
            else:
                if carta.tipo in ("Tótem", "Arma"):
                    en_juego.append(carta)
                robar(_robo_soporte(carta))
                if _busca_aliado(carta):
                    aliados = [c for c in castillo if c.tipo == "Aliado"]
                    if aliados:
                        objetivo = max(aliados, key=lambda c: c.poder)
                        castillo.remove(objetivo)
                        mano.append(objetivo)
        while len(mano) > 8:
            mano.remove(min(mano, key=lambda c: c.poder))
        if turno == 5:
            dano_t5 = dano
        if dano >= CASTILLO_RIVAL and turno_victoria > TURNOS:
            turno_victoria = turno
            break
    muerta = sum(1 for c in mano if c.tipo != "Oro" and c.coste > oros) / max(1, len(mano))
    return turno_victoria, dano_t5 if turno_victoria > 5 else CASTILLO_RIVAL, aliado_t2, not fallo_oro, muerta


def simular(mazo, n=400, semilla=7):
    rng = random.Random(semilla)
    t = d = a = s = m = 0.0
    for _ in range(n):
        tv, d5, a2, so, mu = partida(mazo, rng)
        t += tv
        d += d5
        a += a2
        s += so
        m += mu
    return Resultado(t / n, d / n, a / n, s / n, m / n)
