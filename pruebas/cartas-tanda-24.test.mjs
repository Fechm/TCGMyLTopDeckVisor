import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const primero = (v) => v !== null;

function con(e, nombre, extra) {
  const k = id(nombre);
  e.catalogo = { ...e.catalogo, [k]: { ...e.catalogo[k], ...extra } };
  return e;
}

function armar(e, nombre, portador, j = 0) {
  const a = poner(e, j, "mano", nombre);
  oros(e, j, costeDe(e, j, a).pagar);
  return [sinRespuesta(aplicar(e, jugar(a, { portador }))), a];
}

function declarar(e, uid) {
  e = aplicar(e, { tipo: "batalla" });
  return aplicar(e, { tipo: "atacar", uid });
}

function hastaDano(e) {
  e = aplicar(e, { tipo: "finAtaque" });
  const antes = e.registro.length;
  for (let i = 0; i < 40 && e.registro.length === antes; i++) {
    if (e.pendiente) {
      e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
      continue;
    }
    const l = accionesLegales(e);
    e = aplicar(e, l.find((x) => ["finBloqueo", "pasar", "noResponder"].includes(x.tipo)) ?? l[0]);
  }
  return e;
}

function sacar(e, uid) {
  N.mover(e, uid, "cementerio");
  resolver(e);
  return e;
}

test("Alas de Ángel: el portador gana Imbloqueable y al entrar Robas dos cartas", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Alas de Ángel", g);
  assert.equal(N.tiene(e, g, "Imbloqueable"), true);
  assert.equal(N.tiene(e, g, "Indestructible"), false);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Alas de Ángel: si el portador es un Ángel gana Indestructible e Indesterrable mientras la porte", () => {
  let e = con(mesa(), "Sir Galahad", { razas: ["Ángel"] });
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Alas de Ángel", g);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
  e = sacar(e, a);
  assert.equal(N.tiene(e, g, "Indestructible"), false);
});

test("Alas de Ángel: con Aliados Ángel el oponente solo declara un atacante por turno", () => {
  let e = con(mesa(), "Sir Galahad", { razas: ["Ángel"] });
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Alas de Ángel", g);
  const v1 = poner(e, 1, "defensa", "Valefor");
  const v2 = poner(e, 1, "defensa", "Valefor");
  e.activo = 1;
  e = declarar(e, v1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === v2), false);
});

test("Alas de Ángel: sin Aliados Ángel el oponente ataca con varios", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Alas de Ángel", g);
  const v1 = poner(e, 1, "defensa", "Valefor");
  const v2 = poner(e, 1, "defensa", "Valefor");
  e.activo = 1;
  e = declarar(e, v1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === v2), true);
});

test("Ama-No-Saka-Hoko: el portador gana 1 de Fuerza y es Indesterrable", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Ama-No-Saka-Hoko", g);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
});

test("Ama-No-Saka-Hoko: en la Fase Final, también la oponente, puedes Robar una carta", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Ama-No-Saka-Hoko", g);
  e.activo = 1;
  const mano = e.jugadores[0].mano.length;
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, true);
  assert.equal(e.jugadores[0].mano.length, mano + 1);
});

test("Anticucho: el portador gana 2 de Fuerza y al atacar puedes poner un Oro de tu Cementerio en tu Oro Pagado", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Anticucho", g);
  assert.equal(N.fuerza(e, g), 4);
  const o = poner(e, 0, "cementerio", "Drácula");
  e = declarar(e, g);
  e = elegir(e, true);
  assert.equal(zonaDe(e, o), "pagado");
  assert.equal(N.puedeSalir(e, g), true);
});

test("Anticucho: si jugaste Terremoto o controlas Pebre, el Oro va a Reserva y el portador no puede salir del juego", () => {
  for (const preparar of [(e) => (e.jugadores[0].jugadas.nombres.Terremoto = 1), (e) => poner(e, 0, "reserva", "Pebre")]) {
    let e = mesa();
    const g = poner(e, 0, "defensa", "Sir Galahad");
    [e] = armar(e, "Anticucho", g);
    preparar(e);
    const o = poner(e, 0, "cementerio", "Drácula");
    e = declarar(e, g);
    e = elegir(e, true);
    assert.equal(zonaDe(e, o), "reserva");
    assert.equal(N.puedeSalir(e, g), false);
  }
});

test("Arco Patagon: Exhumar, el portador gana 1 de Fuerza y Furia", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const v = poner(e, 0, "defensa", "White Worm");
  const otro = poner(e, 0, "cementerio", "Arco Patagon");
  oros(e, 0, 1);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === otro && a.desde === "cementerio"));
  [e] = armar(e, "Arco Patagon", g);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(N.tiene(e, v, "Furia"), true);
});

test("Arco Patagon: cuando sale del juego Robas dos cartas", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Arco Patagon", g);
  const mano = e.jugadores[0].mano.length;
  e = sacar(e, a);
  assert.equal(e.jugadores[0].mano.length, mano + 2);
});

test("Arco Patagon: Destruir un Aliado propio para Barajar una carta de coste 3 o menos; si era el portador, Robas dos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Arco Patagon", g);
  const v = poner(e, 1, "defensa", "Valefor");
  const mano = e.jugadores[0].mano.length;
  e = aplicar(e, habilidad(a, "Arco Patagon"));
  e = elegir(e, v);
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].mano.length, mano + 2);
});

test("Armadura Celestial: el portador gana 1 de Fuerza e Indesterrable", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Armadura Celestial", g);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
});

test("Armadura Celestial: al salir del juego puedes Descartar una carta para ponerla en tu mano", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Armadura Celestial", g);
  const x = poner(e, 0, "mano", "Valefor");
  N.mover(e, g, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(zonaDe(e, a), "mano");
});

test("Armadura Celestial: Destruir el portador para Anular un Talismán de coste 2 o menos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Armadura Celestial", g);
  e.activo = 1;
  oros(e, 1, 3);
  const t = poner(e, 1, "mano", "Llamar a la Manada");
  e = aplicar(e, jugar(t));
  const r = accionesLegales(e).find((x) => x.tipo === "responder" && x.uid === a);
  assert.ok(r);
  e = aplicar(e, r);
  if (e.pendiente) e = elegir(e, false);
  e = sinRespuesta(e);
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(zonaDe(e, t), "cementerio");
  assert.equal(e.jugadores[1].mano.length, 0);
});

test("Armadura Celestial: no Anula Talismanes de coste mayor que 2", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Armadura Celestial", g);
  e.activo = 1;
  oros(e, 1, 5);
  const t = poner(e, 1, "mano", "Danza del Cuchillo");
  e = con(e, "Danza del Cuchillo", { coste: 3 });
  e = aplicar(e, jugar(t));
  assert.equal(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === a), false);
});

test("Armadura Celestial: cancelar la habilidad de una carta que afecte a un Aliado", { todo: "efecto: cancelar una habilidad que afecte a un Aliado" }, () => {});

test("Armadura Dorada: Exhumar, el portador gana 2 de Fuerza e Indestructible y al entrar Robas dos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Armadura Dorada", g);
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Armadura Dorada: Desterrarla o pagar un Oro y Desterrarla de la mano para prevenir que tus Aliados sean afectados o Anulados", { todo: "respuesta: prevenir que tus Aliados sean afectados o Anulados desde una carta en juego o en mano" }, () => {});

test("Armas Campesinas: el portador gana 2 de Fuerza e Indestructible; al entrar un Aliado oponente queda en Fuerza 0, el oponente Bota esa Fuerza y Robas dos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const v = poner(e, 1, "defensa", "Valefor");
  [e] = armar(e, "Armas Campesinas", g);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
  assert.equal(N.fuerza(e, v), 0);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Armas Campesinas: se puede jugar en Guerra de Talismanes", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const a = poner(e, 0, "mano", "Armas Campesinas");
  const otra = poner(e, 0, "mano", "Pedrenyal");
  oros(e, 0, 2);
  e.fase = "talismanes";
  e.prioridad = 0;
  const l = accionesLegales(e);
  assert.ok(l.some((x) => x.tipo === "jugar" && x.uid === a && x.portador === g));
  assert.equal(l.some((x) => x.tipo === "jugar" && x.uid === otra), false);
});

test("Arpon Ballenero: el portador gana 2 de Fuerza e Indestructible y al entrar busca un Aliado y un Arma", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const v = poner(e, 0, "castillo", "Valefor");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  [e] = armar(e, "Arpon Ballenero", g);
  e = elegir(e, v);
  e = elegir(e, p);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, p), "mano");
});

test("Arpon Ballenero: en la Fase Final, si atacaste, Barajas y/o Destierras hasta tantas cartas de los Cementerios como Fuerza del portador", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Arpon Ballenero", g);
  if (e.pendiente) e = elegir(e, null);
  if (e.pendiente) e = elegir(e, null);
  const c = [0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  const f = aplicar(e, { tipo: "terminar" });
  assert.equal(f.pendiente, null);
  e.jugadores[0].atacoEsteTurno = true;
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, c[0]);
  e = elegir(e, null);
  e = elegir(e, c[1]);
  e = elegir(e, null);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "destierro", "cementerio"]);
});

test("Arpon Ballenero: también si bloqueaste este turno", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Arpon Ballenero", g);
  if (e.pendiente) e = elegir(e, null);
  if (e.pendiente) e = elegir(e, null);
  const c = poner(e, 1, "cementerio", "Valefor");
  e.activo = 1;
  e.jugadores[0].atacoEsteTurno = true;
  const f = aplicar(e, { tipo: "terminar" });
  assert.equal(f.pendiente, null);
  e.jugadores[0].bloqueoEsteTurno = true;
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, c);
  assert.equal(zonaDe(e, c), "castillo");
});

test("Atgeir: Exhumar y el portador gana 2 de Fuerza", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Atgeir", g);
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 4);
});

test("Atgeir: en tu Vigilia, una vez por turno, Barajas y/o Destierras cartas de los Cementerios y ya no se repite en la Fase Final", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Atgeir", g);
  const c = [poner(e, 1, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Valefor")];
  e = aplicar(e, habilidad(a, "Atgeir"));
  e = elegir(e, c[0]);
  e = elegir(e, null);
  e = elegir(e, c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "destierro"]);
  assert.equal(puedeUsar(e, a), false);
  poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
});

test("Atgeir: si no la usaste en la Vigilia, puedes usarla en tu Fase Final", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Atgeir", g);
  const c = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  e = elegir(e, null);
  e = elegir(e, c);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Atlatl: el portador gana 2 de Fuerza y si hizo daño de combate puedes buscar un Oro para tu Oro Pagado en la Fase Final", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Atlatl", g);
  assert.equal(N.fuerza(e, g), 4);
  const pagado = e.jugadores[0].pagado.length;
  e = hastaDano(declarar(e, g));
  assert.equal(e.jugadores[1].castillo.length, 26);
  e = elegir(e, true);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].pagado.length, pagado + 1);
});

test("Atlatl: sin daño de combate no hay búsqueda", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Atlatl", g);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
});

test("Ballesta Abismal: Exhumar, +1 de Fuerza; al hacer daño con Aliados de una sola Raza puedes Desterrar una carta de coste 3 o menos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Ballesta Abismal", g);
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 3);
  const v = poner(e, 1, "defensa", "Valefor");
  e = hastaDano(declarar(e, g));
  e = elegir(e, true);
  e = elegir(e, "Desterrar una carta de coste 3 o menos");
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
});

test("Ballesta Abismal: o buscar tres cartas en un Castillo y Desterrarlas", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Ballesta Abismal", g);
  e = hastaDano(declarar(e, g));
  e = elegir(e, true);
  e = elegir(e, "Buscar tres cartas en un Castillo y Desterrarlas");
  e = elegir(e, "Castillo oponente");
  for (let i = 0; i < 3; i++) e = elegir(e, primero);
  assert.equal(e.jugadores[1].destierro.length, 3);
});

test("Ballesta Abismal: si tus Aliados no comparten Raza no se dispara", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  poner(e, 0, "defensa", "White Worm");
  [e] = armar(e, "Ballesta Abismal", g);
  e = hastaDano(declarar(e, g));
  assert.equal(e.pendiente, null);
});

test("Baston de la Noche: Exhumar, +1 de Fuerza; al hacer daño puedes poner en juego un Aliado de coste 2 o menos de tu Cementerio", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Baston de la Noche", g);
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 3);
  const w = poner(e, 0, "cementerio", "White Worm");
  e = hastaDano(declarar(e, g));
  e = elegir(e, true);
  e = elegir(e, "Poner en juego un Aliado de coste 2 o menos de tu Cementerio");
  assert.equal(zonaDe(e, w), "defensa");
});

test("Baston de la Noche: o Robar dos cartas", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Baston de la Noche", g);
  e = hastaDano(declarar(e, g));
  const mano = e.jugadores[0].mano.length;
  e = elegir(e, true);
  e = elegir(e, "Robar dos cartas");
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[0].mano.length, mano + 2 + 1);
});

test("Brown Bess: el portador gana 2 de Fuerza y al jugar un Arma un Aliado propio gana 1 de Fuerza permanentemente", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const w = poner(e, 0, "defensa", "White Worm");
  [e] = armar(e, "Brown Bess", g);
  assert.equal(N.fuerza(e, g), 4);
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Pedrenyal");
  e = aplicar(e, jugar(p, { portador: w }));
  e = elegir(e, true);
  e = elegir(e, g);
  e = sinRespuesta(e);
  assert.equal(N.fuerza(e, g), 5);
  assert.ok(e.efectos.some((f) => f.tipo === "fuerza" && f.uid === g && f.fin.juego));
});

test("Brown Bess: no se dispara al jugar un Aliado", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Brown Bess", g);
  oros(e, 0, 2);
  const w = poner(e, 0, "mano", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(w)));
  assert.equal(e.pendiente, null);
});

test("Brown Bess: también cuando un Arma cambia de portador", { todo: "evento: un Arma cambia de portador" }, () => {});

test("Cadenas del Abismo: +1 de Fuerza y en tu Vigilia, una vez por turno, buscas un Arma en tu Castillo", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cadenas del Abismo", g);
  assert.equal(N.fuerza(e, g), 3);
  const p = poner(e, 0, "castillo", "Pedrenyal");
  e = aplicar(e, habilidad(a, "Cadenas del Abismo"));
  e = elegir(e, p);
  assert.equal(zonaDe(e, p), "mano");
  assert.equal(puedeUsar(e, a), false);
});

test("Cadenas del Abismo: en tu Fase Final Barajas y/o Destierras hasta tantas cartas de los Cementerios como Fuerza del portador", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Cadenas del Abismo", g);
  const c = [1, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  e = elegir(e, null);
  e = elegir(e, c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro", "cementerio"]);
});

test("Carro Egipcio: el portador gana 1 de Fuerza, Furia, Imbloqueable y daño al Destierro; al entrar busca una carta que no sea Talismán", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const t = poner(e, 0, "castillo", "Llamar a la Manada");
  const v = poner(e, 0, "castillo", "Valefor");
  [e] = armar(e, "Carro Egipcio", g);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === t), false);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(N.fuerza(e, g), 3);
  for (const k of ["Furia", "Imbloqueable", "DanoAlDestierro"]) assert.equal(N.tiene(e, g, k), true);
});

test("Carruaje Infernal: no puedes controlar otra copia y el oponente no puede ganar el control del portador", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const w = poner(e, 0, "defensa", "White Worm");
  [e] = armar(e, "Carruaje Infernal", g);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.puedeTomar(e, g, 1), false);
  const otra = poner(e, 0, "mano", "Carruaje Infernal");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === otra), false);
  assert.ok(w);
});

test("Carruaje Infernal: en tu Vigilia y en tu Fase Final puedes Desterrar una carta de un Cementerio", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Carruaje Infernal", g);
  const c = [poner(e, 1, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Valefor")];
  e = aplicar(e, habilidad(a, "Carruaje Infernal"));
  e = elegir(e, c[0]);
  assert.equal(zonaDe(e, c[0]), "destierro");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  assert.equal(zonaDe(e, c[1]), "destierro");
});

test("Carruaje Infernal: en la Fase Final oponente, él Bota dos cartas o tú Barajas hasta dos de tu Cementerio", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Carruaje Infernal", g);
  e.activo = 1;
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, "Tu oponente Bota dos cartas");
  assert.equal(e.jugadores[1].cementerio.length, 2);
});

test("Casco de Esparta: Exhumar, el portador gana 2 de Fuerza y Furia y al entrar Robas dos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const otro = poner(e, 0, "cementerio", "Casco de Esparta");
  oros(e, 0, 1);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === otro && a.desde === "cementerio"));
  [e] = armar(e, "Casco de Esparta", g);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Cañon Naval: el portador gana 2 de Fuerza e Imbloqueable; una vez por turno el oponente Bota cinco y Destierra hasta tres de un Cementerio", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cañon Naval", g);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Imbloqueable"), true);
  e = aplicar(e, habilidad(a, "Cañon Naval"));
  assert.equal(e.pendiente.jugador, 1);
  for (let i = 0; i < 3; i++) e = elegir(e, primero);
  assert.equal(e.jugadores[1].castillo.length, 25);
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(puedeUsar(e, a), false);
});

test("Cañon Naval: cuando sale del juego el oponente Bota cinco", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cañon Naval", g);
  e = sacar(e, a);
  e = elegir(e, null);
  assert.equal(e.jugadores[1].castillo.length, 25);
});

test("Cañon Naval: en tu Fase Final puedes Botar dos cartas de tu Castillo para agrupar un Oro", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Cañon Naval", g);
  const reserva = e.jugadores[0].reserva.length;
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  e = elegir(e, primero);
  assert.equal(e.jugadores[0].cementerio.length, 2);
  assert.equal(e.jugadores[0].reserva.length, reserva + 1);
});

test("Cañon Silverado: Exhumar, +3 de Fuerza e Indesterrable; al entrar Destierra una carta oponente que no sea Oro y él Destierra una de su mano", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const v = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 1, "mano", "Balaur");
  let a;
  [e, a] = armar(e, "Cañon Silverado", g);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
});

test("Cañon Silverado: también cuando el portador ataca", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Cañon Silverado", g);
  const v = poner(e, 1, "defensa", "Valefor");
  e = declarar(e, g);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
});

test("Cañon Silverado: los Talismanes cuestan un Oro adicional", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Cañon Silverado", g);
  const t0 = poner(e, 0, "mano", "Llamar a la Manada");
  const t1 = poner(e, 1, "mano", "Llamar a la Manada");
  assert.equal(costeDe(e, 0, t0).pagar, 2);
  assert.equal(costeDe(e, 1, t1).pagar, 2);
});

test("Cañon de Fusion: Exhumar, +2 de Fuerza e Indesterrable; al entrar puedes Barajar una carta oponente que no sea Oro", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const v = poner(e, 1, "defensa", "Valefor");
  let a;
  [e, a] = armar(e, "Cañon de Fusion", g);
  e = elegir(e, true);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
});

test("Cañon de Fusion: una vez por turno Barajas una carta de tu mano para Robar dos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cañon de Fusion", g);
  e = elegir(e, false);
  const x = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(a, "Cañon de Fusion"));
  assert.equal(zonaDe(e, x), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, a), false);
});

test("Cañon de Fusion: tus demás cartas no pueden perder su habilidad", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cañon de Fusion", g);
  if (e.pendiente) e = elegir(e, false);
  const oro = poner(e, 0, "reserva", "Pebre");
  const rival = poner(e, 1, "defensa", "Balaur");
  for (const u of [g, oro, rival]) N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: u, fin: "turno" }, 1);
  assert.equal(N.activa(e, g), true);
  assert.equal(N.activa(e, oro), true);
  assert.equal(N.activa(e, rival), false);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: a, fin: "turno" }, 1);
  assert.equal(N.activa(e, a), false);
  assert.equal(N.activa(e, g), false);
});

test("Cañon de Plasma: Exhumar, +2 de Fuerza e Indesterrable; busca un Arma y Destierra del Castillo oponente una carta de coste igual o menor", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cañon de Plasma", g);
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
  const p = poner(e, 0, "castillo", "Pedrenyal");
  const b = poner(e, 1, "castillo", "Balaur");
  e = aplicar(e, habilidad(a, "Cañon de Plasma"));
  e = elegir(e, p);
  assert.equal(zonaDe(e, p), "mano");
  assert.equal(e.pendiente.opciones.some((o) => o.valor === b), false);
  e = elegir(e, primero);
  assert.equal(e.jugadores[1].destierro.length, 1);
});

test("Cañón Helios: +2 de Fuerza y Furia, al entrar Robas dos y al atacar eliges qué Aliado oponente lo bloquea", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Cañón Helios", g);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(e.jugadores[0].mano.length, 2);
  const v = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "White Worm");
  e = declarar(e, g);
  e = elegir(e, true);
  e = elegir(e, v);
  e = aplicar(e, { tipo: "finAtaque" });
  assert.deepEqual(accionesLegales(e), [{ tipo: "bloquear", uid: v, atacante: g }]);
});

test("Cañón Helios: Desterrarlo para Anular un Talismán", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cañón Helios", g);
  e.activo = 1;
  oros(e, 1, 3);
  const t = poner(e, 1, "mano", "Llamar a la Manada");
  e = aplicar(e, jugar(t));
  const r = accionesLegales(e).find((x) => x.tipo === "responder" && x.uid === a);
  assert.ok(r);
  e = sinRespuesta(aplicar(e, r));
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, t), "cementerio");
  assert.equal(zonaDe(e, g), "defensa");
});

test("Cañón Helios: prevenir que un Aliado sea afectado por un efecto oponente", { todo: "respuesta: prevenir que un Aliado sea afectado por un efecto oponente desde una carta en juego" }, () => {});

test("Cetro Demoniaco: su coste baja en uno si controlas o jugaste Armas o a Lucifer", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Cetro Demoniaco");
  assert.equal(costeDe(e, 0, c).pagar, 3);
  e.jugadores[0].jugadas.Arma = 1;
  assert.equal(costeDe(e, 0, c).pagar, 2);
  e.jugadores[0].jugadas.Arma = 0;
  poner(e, 0, "defensa", "Lucifer");
  assert.equal(costeDe(e, 0, c).pagar, 2);
});

test("Cetro Demoniaco: +3 de Fuerza e Indesterrable; una vez por turno genera un Oro y Destierra cuatro del tope de un Castillo", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Cetro Demoniaco", g);
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
  e = aplicar(e, habilidad(a, "Cetro Demoniaco"));
  e = elegir(e, "Castillo oponente");
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[0].generados.reduce((s, x) => s + x.n, 0), 1);
  assert.equal(puedeUsar(e, a), false);
});

test("Cetro Demoniaco: no recibes daño de combate", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  [e] = armar(e, "Cetro Demoniaco", g);
  const b = poner(e, 1, "defensa", "Valefor");
  e.activo = 1;
  e = hastaDano(declarar(e, b));
  assert.equal(zonaDe(e, b), "ataque");
  assert.equal(e.registro.at(-1).dano, 0);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Cetro Demoniaco: tu oponente no puede Desterrar cartas de tu Castillo", { todo: "continua: el oponente no puede Desterrar cartas de tu Castillo" }, () => {});

test("Chakram: Exhumar, +2 de Fuerza e Indesterrable; una carta de la mano oponente no puede jugarse hasta tu próximo turno y Robas una", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Chakram", g);
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
  const v = poner(e, 1, "mano", "Valefor");
  poner(e, 1, "mano", "Drácula");
  const mano = e.jugadores[0].mano.length;
  e = aplicar(e, habilidad(a, "Chakram"));
  assert.equal(e.jugadores[0].mano.length, mano + 1);
  e.activo = 1;
  oros(e, 1, 3);
  assert.equal(accionesLegales(e).some((x) => x.tipo === "jugar" && x.uid === v), false);
});

test("Corvo Campesino: Exhumar, +3 de Fuerza y Furia; juega gratis un Aliado de coste 2 o menos del Castillo, sin habilidad y pudiendo atacar", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  let a;
  [e, a] = armar(e, "Corvo Campesino", g);
  assert.equal(N.carta(e, a).claves.includes("Exhumar"), true);
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(N.tiene(e, g, "Furia"), true);
  const j = poner(e, 0, "castillo", "Jabberwocky");
  e = aplicar(e, habilidad(a, "Corvo Campesino"));
  e = elegir(e, j);
  assert.equal(zonaDe(e, j), "defensa");
  assert.equal(e.jugadores[1].castillo.length, 30);
  assert.equal(N.activa(e, j), false);
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((x) => x.tipo === "atacar" && x.uid === j));
  assert.equal(puedeUsar(e, a), false);
});
