import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, CATALOGO, N } from "./ayuda-duelo.mjs";
import { resolver, impuestoSinPagar } from "../web/duelo/efectos.js";
import { costeDe } from "../web/duelo/motor.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const noNulo = (v) => v !== null;
const esNulo = (v) => v === null;
const legal = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);

function drenar(e) {
  for (let i = 0; i < 50 && e.pendiente; i++) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  return e;
}

function avanzarHasta(e, pred) {
  for (let i = 0; i < 400 && !pred(e) && e.ganador === null; i++) {
    if (e.pendiente) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
    else {
      const l = accionesLegales(e);
      const a = l.find((x) => ["terminar", "pasar", "noResponder", "finAtaque", "finBloqueo"].includes(x.tipo)) ?? l[0];
      e = aplicar(e, a);
    }
  }
  return e;
}

function sale(e, uid) {
  N.mover(e, uid, "cementerio");
  resolver(e);
}

function dados(semilla) {
  const t = { azar: semilla };
  return [0, 1, 2].map(() => Math.floor(N.azar(t) * 6) + 1);
}

function semillaCon(pred) {
  for (let s = 1; s < 5000; s++) if (pred(dados(s))) return s;
  throw new Error("sin semilla");
}

const pares = (r) => r.filter((x) => x % 2 === 0).length;

test("Ama del Tyn: al entrar busca un Tótem de coste 3 o menos en tu Castillo y lo juega sin pagar", () => {
  let e = mesa();
  oros(e, 0, 5);
  const ama = poner(e, 0, "mano", "Ama del Tyn");
  const carfax = poner(e, 0, "castillo", "Abadía de Carfax");
  e = sinRespuesta(aplicar(e, jugar(ama)));
  assert.equal(zonaDe(e, ama), "apoyo");
  e = elegir(e, noNulo);
  assert.equal(zonaDe(e, carfax), "apoyo");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ama del Tyn: no juega un Tótem de coste mayor a 3", () => {
  let e = mesa();
  oros(e, 0, 5);
  const ama = poner(e, 0, "mano", "Ama del Tyn");
  const otra = poner(e, 0, "castillo", "Ama del Tyn");
  e = sinRespuesta(aplicar(e, jugar(ama)));
  e = drenar(e);
  assert.equal(zonaDe(e, otra), "castillo");
});

test("Ama del Tyn: los Aliados de coste 1 o menos no disparan sus habilidades al entrar", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Ama del Tyn");
  oros(e, 0, 1);
  const bandidos = poner(e, 0, "mano", "Bandidos Szgany");
  e = sinRespuesta(aplicar(e, jugar(bandidos)));
  assert.equal(zonaDe(e, bandidos), "defensa");
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Ama del Tyn: sin ella los Aliados de coste 1 sí disparan al entrar", () => {
  let e = mesa();
  oros(e, 0, 1);
  const bandidos = poner(e, 0, "mano", "Bandidos Szgany");
  e = sinRespuesta(aplicar(e, jugar(bandidos)));
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Ama del Tyn: los Aliados de coste 2 o más siguen disparando al entrar", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Ama del Tyn");
  oros(e, 0, 2);
  const jab = poner(e, 0, "mano", "Jabberwocky");
  const tope = e.jugadores[1].castillo[0];
  e = sinRespuesta(aplicar(e, jugar(jab)));
  assert.equal(zonaDe(e, tope), "pagado");
});

test("Amo de las Cadenas: no puedes controlar más copias de esta carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const propio = poner(e, 0, "defensa", "Amo de las Cadenas");
  const copia = poner(e, 0, "mano", "Amo de las Cadenas");
  assert.ok(!legal(e, copia));
  N.mover(e, propio, "cementerio");
  assert.ok(legal(e, copia));
});

test("Amo de las Cadenas: cuando ataca, puedes elegir un Aliado oponente que debe bloquearlo", () => {
  let e = mesa();
  const amo = poner(e, 0, "defensa", "Amo de las Cadenas");
  const a = poner(e, 1, "defensa", "Sir Persival");
  const b = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: amo }, true, a);
  e = aplicar(e, { tipo: "finAtaque" });
  const l = accionesLegales(e);
  assert.deepEqual(l, [{ tipo: "bloquear", uid: a, atacante: amo }]);
  assert.ok(!l.some((x) => x.uid === b));
});

test("Amo de las Cadenas: la elección al atacar es opcional", () => {
  let e = mesa();
  const amo = poner(e, 0, "defensa", "Amo de las Cadenas");
  const a = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: amo }, false);
  e = aplicar(e, { tipo: "finAtaque" });
  assert.ok(accionesLegales(e).some((x) => x.tipo === "finBloqueo"));
  assert.ok(accionesLegales(e).some((x) => x.tipo === "bloquear" && x.uid === a));
});

test("Amo de las Cadenas: cuando buscas un Aliado puedes jugarlo desde tu mano sin pagar", () => {
  let e = mesa();
  oros(e, 0, 1);
  const amo = poner(e, 0, "mano", "Amo de las Cadenas");
  const aliado = poner(e, 0, "castillo", "Sir Persival");
  const gui = poner(e, 0, "mano", "Guillatún");
  e = sinRespuesta(aplicar(e, jugar(gui)));
  e = elegir(e, true);
  e = elegir(e, aliado);
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(zonaDe(e, amo), "defensa");
});

test("Amo de las Cadenas: no puede portar Armas", () => {
  const e = mesa();
  oros(e, 0, 1);
  const amo = poner(e, 0, "defensa", "Amo de las Cadenas");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === arma && a.portador === amo));
});

test("Azi Demoniaco: una vez en tu turno se convierte en un Oro en tu Oro Pagado que no puede salir del juego", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Demoniaco");
  e = aplicar(e, habilidad(azi, "Azi Demoniaco"));
  assert.equal(zonaDe(e, azi), "pagado");
  assert.equal(N.carta(e, azi).tipo, "Oro");
  assert.equal(N.puedeSalir(e, azi), false);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === azi));
});

test("Azi Demoniaco: en tu Fase Final como Oro puedes Desterrar una carta de un Cementerio", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Demoniaco");
  const v = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, habilidad(azi, "Azi Demoniaco"));
  e = hacer(e, { tipo: "terminar" }, "Desterrar");
  assert.equal(zonaDe(e, v), "destierro");
});

test("Azi Demoniaco: en tu Fase Final como Oro puedes Barajar una carta de un Cementerio", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Demoniaco");
  const v = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, habilidad(azi, "Azi Demoniaco"));
  e = hacer(e, { tipo: "terminar" }, "Barajar");
  assert.equal(zonaDe(e, v), "castillo");
});

test("Azi Demoniaco: sin convertir no dispara en la Fase Final", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Azi Demoniaco");
  poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
});

test("Azi Demoniaco: vuelve a ser Aliado al comienzo de tu próximo turno", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Demoniaco");
  e = aplicar(e, habilidad(azi, "Azi Demoniaco"));
  e = avanzarHasta(e, (x) => x.turno === 3 && x.fase === "vigilia");
  assert.equal(e.turno, 3);
  assert.equal(zonaDe(e, azi), "defensa");
  assert.equal(N.carta(e, azi).tipo, "Aliado");
});

test("Bandidos Szgany: tiene Furia", () => {
  const e = mesa();
  assert.ok(N.tiene(e, poner(e, 0, "defensa", "Bandidos Szgany"), "Furia"));
});

test("Bandidos Szgany: al entrar en juego tu oponente Bota tres cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Bandidos Szgany");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Bandidos Szgany: al atacar tu oponente Bota tres cartas", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "Bandidos Szgany");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: b });
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Bandidos Szgany: cuando tu oponente fuera a Botar una carta, Bota dos", () => {
  const e = mesa();
  assert.equal(N.quitarDelCastillo(e, 1, 1, "cementerio"), 1);
  poner(e, 0, "defensa", "Bandidos Szgany");
  assert.equal(N.quitarDelCastillo(e, 1, 1, "cementerio"), 2);
  assert.equal(N.quitarDelCastillo(e, 1, 3, "cementerio"), 3);
  assert.equal(N.quitarDelCastillo(e, 0, 1, "cementerio"), 1);
});

test("Bandidos Szgany: tus Aliados Bandido ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Bandidos Szgany");
  const x = poner(e, 0, "defensa", "Sir Persival");
  e.catalogo = { ...e.catalogo, bandido: { ...CATALOGO[id("Sir Persival")], id: "bandido", razas: ["Bandido"] } };
  e.instancias[x] = "bandido";
  assert.equal(N.fuerza(e, x), 3);
});

test("Blajini: tiene Furia y Exhumar", () => {
  const e = mesa();
  const b = poner(e, 0, "defensa", "Blajini");
  assert.ok(N.tiene(e, b, "Furia"));
  assert.ok(N.tiene(e, b, "Exhumar"));
});

test("Blajini: al entrar desde la mano un jugador Bota tres cartas y subes una carta que no sea Talismán de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const bl = poner(e, 0, "mano", "Blajini");
  const aliado = poner(e, 0, "cementerio", "Sir Persival");
  const tal = poner(e, 0, "cementerio", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(bl)));
  e = elegir(e, "Castillo oponente");
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(zonaDe(e, tal), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Blajini: el jugador que Bota puede ser tú", () => {
  let e = mesa();
  oros(e, 0, 2);
  const bl = poner(e, 0, "mano", "Blajini");
  poner(e, 0, "cementerio", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(bl)));
  e = elegir(e, "tu Castillo");
  assert.equal(e.jugadores[0].castillo.length, 27);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Blajini: al entrar desde el Cementerio roba dos cartas y puede Descartar una", () => {
  let e = mesa();
  oros(e, 0, 2);
  const bl = poner(e, 0, "cementerio", "Blajini");
  const aliado = poner(e, 0, "cementerio", "Sir Persival");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === bl && a.desde === "cementerio"));
  e = sinRespuesta(aplicar(e, jugar(bl, { desde: "cementerio" })));
  assert.equal(zonaDe(e, bl), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
  e = elegir(e, esNulo);
  assert.equal(e.jugadores[0].mano.length, 2);
  e = elegir(e, "Castillo oponente");
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Blajini: al entrar desde el Cementerio puede Descartar una carta robada", () => {
  let e = mesa();
  oros(e, 0, 2);
  const bl = poner(e, 0, "cementerio", "Blajini");
  e = sinRespuesta(aplicar(e, jugar(bl, { desde: "cementerio" })));
  const [primera] = e.jugadores[0].mano;
  e = elegir(e, primera);
  assert.equal(zonaDe(e, primera), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Blajini: al salir del juego un jugador Bota tres cartas y subes una carta que no sea Talismán de tu Cementerio", () => {
  let e = mesa();
  const bl = poner(e, 0, "defensa", "Blajini");
  sale(e, bl);
  e = elegir(e, "Castillo oponente");
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(zonaDe(e, bl), "mano");
});

test("Camino del Inca: sólo puedes controlar una copia", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Camino del Inca");
  const copia = poner(e, 0, "mano", "Camino del Inca");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === copia));
});

test("Camino del Inca: en tu Reserva, jugar cartas sin pagar su coste cuesta un Oro adicional", () => {
  const e = mesa();
  assert.equal(impuestoSinPagar(e, 0), 0);
  const camino = poner(e, 0, "reserva", "Camino del Inca");
  assert.equal(impuestoSinPagar(e, 0), 1);
  e.jugadores[0].reserva = [];
  e.jugadores[0].pagado.push(camino);
  assert.equal(impuestoSinPagar(e, 0), 0);
});

test("Camino del Inca: el Tótem jugado sin pagar cuesta un Oro adicional", () => {
  let e = mesa();
  oros(e, 0, 5);
  const camino = poner(e, 0, "reserva", "Camino del Inca");
  const ama = poner(e, 0, "mano", "Ama del Tyn");
  const carfax = poner(e, 0, "castillo", "Abadía de Carfax");
  e = sinRespuesta(aplicar(e, jugar(ama)));
  e = elegir(e, noNulo);
  assert.equal(zonaDe(e, carfax), "apoyo");
  assert.equal(zonaDe(e, camino), "pagado");
});

test("Camino del Inca: no se cobra el impuesto al jugar pagando el coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "reserva", "Camino del Inca");
  const b = poner(e, 0, "mano", "Bandidos Szgany");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(zonaDe(e, b), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("Cathach: al entrar puedes Barajar dos cartas de tu Cementerio en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 3);
  const ch = poner(e, 0, "mano", "Cathach");
  const a = poner(e, 0, "cementerio", "Sir Persival");
  const b = poner(e, 0, "cementerio", "Valefor");
  const c = poner(e, 0, "cementerio", "Guardia Real");
  e = sinRespuesta(aplicar(e, jugar(ch)));
  e = elegir(e, true);
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(e.jugadores[0].castillo.length, 32);
});

test("Cathach: la barajada es opcional", () => {
  let e = mesa();
  oros(e, 0, 3);
  const ch = poner(e, 0, "mano", "Cathach");
  const a = poner(e, 0, "cementerio", "Sir Persival");
  poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ch)));
  e = elegir(e, false);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(e.pendiente, null);
});

test("Cathach: los Aliados oponentes pierden 1 de Fuerza mientras sólo controles Aliados Dragón", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Cathach");
  poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Sir Persival");
  assert.equal(N.fuerza(e, rival), 1);
});

test("Cathach: no resta Fuerza si controlas un Aliado que no es Dragón", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Cathach");
  poner(e, 0, "defensa", "Guardia Real");
  const rival = poner(e, 1, "defensa", "Sir Persival");
  assert.equal(N.fuerza(e, rival), 2);
});

test("Cathach: no resta Fuerza a tus propios Aliados", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Cathach");
  const propio = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, propio), 3);
});

test("Comer Insectos: destruye hasta dos cartas con habilidad de coste 1 o más que controles y tus Aliados ganan tanta Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Sir Galahad");
  const c = poner(e, 0, "defensa", "Guardia Real");
  const ci = poner(e, 0, "mano", "Comer Insectos");
  e = sinRespuesta(aplicar(e, jugar(ci)));
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(N.fuerza(e, c), 5);
  assert.equal(zonaDe(e, ci), "cementerio");
});

test("Comer Insectos: con una sola carta destruida los Aliados ganan 1 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "defensa", "Valefor");
  const c = poner(e, 0, "defensa", "Guardia Real");
  const ci = poner(e, 0, "mano", "Comer Insectos");
  e = sinRespuesta(aplicar(e, jugar(ci)));
  e = elegir(e, a);
  e = elegir(e, esNulo);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(N.fuerza(e, c), 4);
});

test("Comer Insectos: sin destruir nada no ganan Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const c = poner(e, 0, "defensa", "Guardia Real");
  const ci = poner(e, 0, "mano", "Comer Insectos");
  e = sinRespuesta(aplicar(e, jugar(ci)));
  e = elegir(e, esNulo);
  assert.equal(N.fuerza(e, c), 3);
});

test("Comer Insectos: no elige cartas de coste 0 ni cartas que controla el oponente ni Indestructibles", () => {
  let e = mesa();
  oros(e, 0, 1);
  const mecha = poner(e, 0, "defensa", "Mecha-Daikaiju");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  const ci = poner(e, 0, "mano", "Comer Insectos");
  e = sinRespuesta(aplicar(e, jugar(ci)));
  const v = e.pendiente.opciones.map((o) => o.valor);
  assert.deepEqual(v, [valefor, null]);
  assert.ok(!v.includes(mecha));
  assert.ok(!v.includes(rival));
});

test("Comer Insectos: Exhumar, se juega desde el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ci = poner(e, 0, "cementerio", "Comer Insectos");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === ci && a.desde === "cementerio"));
  e = sinRespuesta(aplicar(e, jugar(ci, { desde: "cementerio" })));
  assert.equal(zonaDe(e, ci), "destierro");
});

test("Comer Insectos: el daño de tus Aliados no puede ser prevenido", () => {
  let e = mesa();
  oros(e, 0, 1);
  const x = poner(e, 0, "defensa", "Guardia Real");
  e.efectos.push({ tipo: "sinDano", uid: x, fin: { finTurno: 99 } });
  const ci = poner(e, 0, "mano", "Comer Insectos");
  e = sinRespuesta(aplicar(e, jugar(ci)));
  e = drenar(e);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: x });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.ok(e.jugadores[1].castillo.length < 30);
});

test("Falso Infante: reduce su coste en un Oro por cada carta con Exhumar que controles, mínimo 1", () => {
  const e = mesa();
  const f = poner(e, 0, "mano", "Falso Infante");
  assert.equal(costeDe(e, 0, f).pagar, 3);
  const bl = poner(e, 0, "defensa", "Blajini");
  assert.equal(costeDe(e, 0, f).pagar, 2);
  poner(e, 0, "arma", "Martillo Sacro", { portador: bl });
  assert.equal(costeDe(e, 0, f).pagar, 1);
  poner(e, 0, "defensa", "Blajini");
  assert.equal(costeDe(e, 0, f).pagar, 1);
});

test("Falso Infante: las cartas con Exhumar del oponente no reducen su coste", () => {
  const e = mesa();
  const f = poner(e, 0, "mano", "Falso Infante");
  poner(e, 1, "defensa", "Blajini");
  assert.equal(costeDe(e, 0, f).pagar, 3);
});

test("Falso Infante: en tu Fase Final Destierra una carta del fondo de un Castillo y hasta una carta de un Cementerio", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Falso Infante");
  const v = poner(e, 0, "cementerio", "Valefor");
  const fondo = e.jugadores[1].castillo.at(-1);
  e = hacer(e, { tipo: "terminar" }, "Castillo oponente", v);
  assert.equal(zonaDe(e, fondo), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 29);
  assert.equal(zonaDe(e, v), "destierro");
});

test("Falso Infante: la carta del Cementerio es opcional", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Falso Infante");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, { tipo: "terminar" }, "tu Castillo", esNulo);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[0].destierro.length, 1);
});

test("Ghul Leal: tiene Furia", () => {
  const e = mesa();
  assert.ok(N.tiene(e, poner(e, 0, "defensa", "Ghul Leal"), "Furia"));
});

test("Ghul Leal: cuando un Aliado que controlas sale del juego, tu oponente Bota una carta", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Ghul Leal");
  const a = poner(e, 0, "defensa", "Sir Persival");
  sale(e, a);
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Ghul Leal: hasta tres veces por turno", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Ghul Leal");
  for (let i = 0; i < 4; i++) sale(e, poner(e, 0, "defensa", "Sir Persival"));
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Ghul Leal: no dispara cuando sale un Aliado oponente ni una carta que no es Aliado", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Ghul Leal");
  sale(e, poner(e, 1, "defensa", "Sir Persival"));
  sale(e, poner(e, 0, "apoyo", "Abadía de Carfax"));
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Ghul Leal: tus Aliados con Furia no pueden cambiar de controlador pero los demás sí", () => {
  const e = mesa();
  const ghul = poner(e, 0, "defensa", "Ghul Leal");
  const furia = poner(e, 0, "defensa", "Bandidos Szgany");
  const comun = poner(e, 0, "defensa", "Sir Persival");
  assert.equal(N.puedeTomar(e, ghul, 1), false);
  assert.equal(N.puedeTomar(e, furia, 1), false);
  assert.equal(N.puedeTomar(e, comun, 1), true);
});

test("Grimorio: paga este Oro y baraja una carta de tu mano para buscar en el Castillo oponente una carta del mismo tipo y desterrar todas sus copias", () => {
  let e = mesa();
  const g = poner(e, 0, "reserva", "Grimorio");
  const m = poner(e, 0, "mano", "Sir Galahad");
  const copias = [0, 1, 2].map(() => poner(e, 1, "castillo", "Sir Persival"));
  e = hacer(e, habilidad(g, "Grimorio"), noNulo);
  assert.equal(zonaDe(e, g), "pagado");
  assert.equal(zonaDe(e, m), "castillo");
  for (const c of copias) assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Grimorio: busca una carta del mismo tipo que la barajada", () => {
  let e = mesa();
  const g = poner(e, 0, "reserva", "Grimorio");
  poner(e, 0, "mano", "Llamar a la Manada");
  const aliado = poner(e, 1, "castillo", "Sir Persival");
  const tal = poner(e, 1, "castillo", "Guillatún");
  e = aplicar(e, habilidad(g, "Grimorio"));
  const v = e.pendiente.opciones.map((o) => o.valor);
  assert.ok(v.includes(tal));
  assert.ok(!v.includes(aliado));
  e = elegir(e, tal);
  assert.equal(zonaDe(e, tal), "destierro");
  assert.equal(zonaDe(e, aliado), "castillo");
});

test("Grimorio: la búsqueda es opcional y entonces no destierra nada", () => {
  let e = mesa();
  const g = poner(e, 0, "reserva", "Grimorio");
  poner(e, 0, "mano", "Sir Galahad");
  poner(e, 1, "castillo", "Sir Persival");
  e = hacer(e, habilidad(g, "Grimorio"), esNulo);
  assert.equal(e.jugadores[1].destierro.length, 0);
  assert.equal(zonaDe(e, g), "pagado");
});

test("Grimorio: necesita una carta en la mano y estar en la Reserva", () => {
  const e = mesa();
  const g = poner(e, 0, "reserva", "Grimorio");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === g));
  poner(e, 0, "mano", "Sir Galahad");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === g));
  e.jugadores[0].reserva = [];
  e.jugadores[0].pagado.push(g);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === g));
});

test("Hiemal: no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const h = poner(e, 0, "mano", "Hiemal");
  const mal = poner(e, 1, "mano", "Malocchio");
  e = aplicar(e, jugar(h));
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === mal));
  assert.equal(zonaDe(e, h), "cementerio");
});

test("Hiemal: por cada dado par tu oponente Bota tres cartas", () => {
  const semilla = semillaCon((r) => pares(r) === 2 && !r.includes(1));
  let e = mesa();
  e.azar = semilla;
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Hiemal");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(e.jugadores[0].generados.length, 0);
});

test("Hiemal: sin dados pares no Bota cartas", () => {
  const semilla = semillaCon((r) => pares(r) === 0);
  let e = mesa();
  e.azar = semilla;
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Hiemal");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Hiemal: con tres dados pares Bota nueve cartas", () => {
  const semilla = semillaCon((r) => pares(r) === 3);
  let e = mesa();
  e.azar = semilla;
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Hiemal");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.equal(e.jugadores[1].castillo.length, 21);
});

test("Hiemal: si un dado es 1 genera un Oro para jugar Aliados o Talismanes por el turno", () => {
  const semilla = semillaCon((r) => r.includes(1));
  let e = mesa();
  e.azar = semilla;
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Hiemal");
  const aliado = poner(e, 0, "mano", "Valefor");
  const caro = poner(e, 0, "mano", "Mecha-Daikaiju");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Aliado", "Talismán"] }]);
  assert.ok(legal(e, aliado));
  assert.ok(!legal(e, caro));
  e = sinRespuesta(aplicar(e, jugar(aliado)));
  assert.equal(zonaDe(e, aliado), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Hiemal: sin ningún 1 no genera Oro", () => {
  const semilla = semillaCon((r) => !r.includes(1));
  let e = mesa();
  e.azar = semilla;
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Hiemal");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.equal(e.jugadores[0].generados.length, 0);
});
