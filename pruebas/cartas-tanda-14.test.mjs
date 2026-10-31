import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, opciones, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeJugar = (e, uid, desde) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid && (desde === undefined || a.desde === desde));
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);

function con(e, nombre, extra) {
  const k = id(nombre);
  e.catalogo = { ...e.catalogo, [k]: { ...e.catalogo[k], ...extra } };
  return e;
}

const vainilla = (e, nombre) => con(e, nombre, { claves: [], disparadas: [], continuas: [], activadas: [] });

function fijarCastillo(e, j, nombres) {
  e.jugadores[j].castillo = [];
  const uids = nombres.map((n) => poner(e, j, "castillo", n));
  while (e.jugadores[j].castillo.length < 30) poner(e, j, "castillo", "Drácula");
  return uids;
}

test("Maldición Vudú: solo puede jugarse durante tu turno", () => {
  const e = mesa();
  const mia = poner(e, 0, "mano", "Maldición Vudú");
  const suya = poner(e, 1, "mano", "Maldición Vudú");
  poner(e, 1, "defensa", "Valefor");
  e.fase = "talismanes";
  e.pases = 0;
  e.prioridad = 1;
  assert.equal(puedeJugar(e, suya), false);
  e.prioridad = 0;
  assert.equal(puedeJugar(e, mia), true);
});

test("Maldición Vudú: una carta en juego pierde su habilidad y en tu Fase Final tus Oros pasan al Oro Pagado", () => {
  let e = mesa();
  const [o1, o2] = oros(e, 0, 2);
  const val = poner(e, 1, "defensa", "Valefor");
  const vudu = poner(e, 0, "mano", "Maldición Vudú");
  e = hacer(e, jugar(vudu), val);
  assert.equal(N.activa(e, val), false);
  assert.equal(zonaDe(e, vudu), "cementerio");
  e = aplicar(e, { tipo: "terminar" });
  assert.deepEqual([...e.jugadores[0].pagado].sort(), [o1, o2].sort());
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Maldición Vudú: si no se jugó este turno no mueve tus Oros en la Fase Final", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "cementerio", "Maldición Vudú");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[0].reserva.length, 2);
});

test("Maldición Vudú: Desterrarlo del Cementerio para Barajar o Desterrar una carta de un Cementerio", () => {
  let e = mesa();
  const vudu = poner(e, 0, "cementerio", "Maldición Vudú");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(vudu, "Maldición Vudú"), "Desterrar");
  assert.equal(zonaDe(e, vudu), "destierro");
  assert.equal(zonaDe(e, c), "destierro");
});

test("Maldición Vudú: cancelar una habilidad", { todo: "efecto: cancelar una habilidad (disparada o activada) en resolución" }, () => {});

test("Manipular Destino: su coste baja un Oro por cada carta de coste 2 o más que controles, con mínimo 1", () => {
  const e = mesa();
  const m = poner(e, 0, "mano", "Manipular Destino");
  assert.equal(costeDe(e, 0, m).pagar, 3);
  poner(e, 0, "defensa", "Jabberwocky");
  assert.equal(costeDe(e, 0, m).pagar, 2);
  poner(e, 0, "defensa", "Jabberwocky");
  poner(e, 0, "defensa", "Jabberwocky");
  assert.equal(costeDe(e, 0, m).pagar, 1);
  poner(e, 1, "defensa", "Jabberwocky");
  assert.equal(costeDe(e, 0, m).pagar, 1);
});

test("Manipular Destino: Baraja una carta de coste 2 o menos, Roba dos y solo se juega uno por turno", () => {
  let e = mesa();
  oros(e, 0, 6);
  const val = poner(e, 1, "defensa", "Valefor");
  const [m1, m2] = [poner(e, 0, "mano", "Manipular Destino"), poner(e, 0, "mano", "Manipular Destino")];
  e = hacer(e, jugar(m1), val);
  assert.equal(zonaDe(e, val), "castillo");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(puedeJugar(e, m2), false);
});

test("Manipular Destino: afectar a tus Aliados cuesta un Oro adicional hasta tu próximo turno", { todo: "efecto: afectar a los Aliados de un jugador cuesta Oros adicionales" }, () => {});

test("Mano de Destruccion: convierte un Oro oponente en un Oro sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const onsen = poner(e, 1, "reserva", "Onsen");
  const m = poner(e, 0, "mano", "Mano de Destruccion");
  e = hacer(e, jugar(m), "Convertir un Oro oponente en un Oro sin habilidad");
  assert.equal(N.carta(e, onsen).sinHabilidad, true);
  assert.equal(N.carta(e, onsen).tipo, "Oro");
  assert.equal(N.activa(e, onsen), false);
  assert.equal(N.ubicar(e, onsen).j, 1);
});

test("Mano de Destruccion: una carta de coste 4 o menos pierde su habilidad y es Desterrada", () => {
  let e = mesa();
  oros(e, 0, 1);
  const val = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Mano de Destruccion");
  e = hacer(e, jugar(m), "Una carta de coste 4 o menos pierde su habilidad y es Desterrada", val);
  assert.equal(zonaDe(e, val), "destierro");
});

test("Mano de Destruccion: desde el Cementerio busca un Oro y lo pone en tu Oro Pagado si es tu turno y no pusiste Oros", () => {
  let e = mesa();
  const m = poner(e, 0, "cementerio", "Mano de Destruccion");
  e = hacer(e, habilidad(m, "Mano de Destruccion"), (v) => v !== null);
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Mano de Destruccion: si ya pusiste un Oro este turno, el Oro buscado va a tu mano", () => {
  let e = mesa();
  e.jugadores[0].orosPuestos = 1;
  const m = poner(e, 0, "cementerio", "Mano de Destruccion");
  e = hacer(e, habilidad(m, "Mano de Destruccion"), (v) => v !== null);
  assert.equal(e.jugadores[0].pagado.length, 0);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Manzana Envenenada: Destierra una carta de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const val = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Manzana Envenenada");
  e = hacer(e, jugar(m), val);
  assert.equal(zonaDe(e, val), "destierro");
});

test("Manzana Envenenada: si es Anulada se convierte en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 2);
  poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Manzana Envenenada");
  const malo = poner(e, 1, "mano", "Malocchio");
  e = aplicar(e, jugar(m));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: malo }));
  assert.equal(zonaDe(e, m), "pagado");
  assert.equal(N.ubicar(e, m).j, 0);
  assert.equal(N.carta(e, m).tipo, "Oro");
  assert.equal(N.carta(e, m).sinHabilidad, true);
});

test("Manzana Envenenada: puesta en tu Cementerio en el turno oponente, Desterrarla Destierra dos cartas del tope del Castillo oponente", () => {
  let e = mesa();
  e.activo = 1;
  const m = poner(e, 0, "mano", "Manzana Envenenada");
  N.mover(e, m, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("Manzana Envenenada: también se dispara si es Botada en el turno oponente", () => {
  let e = mesa();
  e.activo = 1;
  const m = poner(e, 0, "castillo", "Manzana Envenenada");
  e.jugadores[0].castillo = [m, ...e.jugadores[0].castillo.filter((u) => u !== m)];
  N.quitarDelCastillo(e, 0, 1, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 2);
});

test("Manzana Envenenada: en tu propio turno no se dispara al llegar al Cementerio", () => {
  const e = mesa();
  const m = poner(e, 0, "mano", "Manzana Envenenada");
  N.mover(e, m, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, m), "cementerio");
});

test("Marca de la Bestia: un Aliado de coste 2 o menos gana Furia e Indestructible, debe atacar y no cambia de controlador", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  const g = poner(e, 0, "defensa", "Ghul Leal");
  const marca = poner(e, 0, "mano", "Marca de la Bestia");
  e = sinRespuesta(aplicar(e, jugar(marca)));
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
  assert.equal(N.puedeTomar(e, g, 1), false);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "terminar"), false);
});

test("Marca de la Bestia: no puede jugarse sin Aliados de coste 2 o menos", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Mecha-Daikaiju");
  const marca = poner(e, 0, "mano", "Marca de la Bestia");
  assert.equal(puedeJugar(e, marca), false);
});

test("Marca de la Bestia: el Aliado no puede ser convertido", { todo: "efecto: no puede ser convertido" }, () => {});

test("Marca de la Bestia: Desterrarlo del Cementerio y pagar un Oro para Anular un Talismán de coste 1", { todo: "respuesta desde el Cementerio: Anular" }, () => {});

test("Marca de los Justos: Desterrarlo del Cementerio para que un Aliado gane 1 de Fuerza por el turno", () => {
  let e = mesa();
  const marca = poner(e, 0, "cementerio", "Marca de los Justos");
  const val = poner(e, 1, "defensa", "Valefor");
  const antes = N.fuerza(e, val);
  e = aplicar(e, habilidad(marca, "Marca de los Justos"));
  assert.equal(N.fuerza(e, val), antes + 1);
  assert.equal(zonaDe(e, marca), "destierro");
});

test("Marca de los Justos: las ganancias de Fuerza de los Aliados se duplican este turno", { todo: "efecto: las ganancias de Fuerza de los Aliados se duplican (máximo 4 por vez) y no se modifica su Fuerza de otra forma este turno" }, () => {});

test("Marcha Sobre Versalles: si el oponente puso más de un Oro este turno, Destierra un Oro oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  e.jugadores[1].orosPuestos = 2;
  const onsen = poner(e, 1, "reserva", "Onsen");
  const m = poner(e, 0, "mano", "Marcha Sobre Versalles");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(zonaDe(e, onsen), "destierro");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Marcha Sobre Versalles: si no, Destierra una carta oponente de coste 2 o menos y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const val = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Marcha Sobre Versalles");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(zonaDe(e, val), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Marcha Sobre Versalles: jugarlo al comienzo de la Fase Final oponente", { todo: "momento: jugar un Talismán al comienzo de la Fase Final oponente" }, () => {});

test("Miedo en Whitby: el oponente Bota tantas como el mayor coste y tú Robas tantas como el menor", () => {
  let e = mesa();
  oros(e, 0, 1);
  fijarCastillo(e, 1, ["Drácula", "Valefor", "Drácula", "Valefor", "Jabberwocky"]);
  const m = poner(e, 0, "mano", "Miedo en Whitby");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 28);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Miedo en Whitby: sin dos Aliados de distinto coste no ocurre nada", () => {
  let e = mesa();
  oros(e, 0, 1);
  fijarCastillo(e, 1, ["Valefor", "Valefor"]);
  const m = poner(e, 0, "mano", "Miedo en Whitby");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(e.jugadores[1].castillo.length, 30);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Misil de Montu: tus Aliados ganan 3 de Fuerza y su daño de combate va al Destierro", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  oros(e, 0, 2);
  const [a, b] = [poner(e, 0, "defensa", "Ghul Leal"), poner(e, 0, "defensa", "Ghul Leal")];
  const r = poner(e, 1, "defensa", "Ghul Leal");
  const m = poner(e, 0, "mano", "Misil de Montu");
  e = sinRespuesta(aplicar(e, jugar(m)));
  for (const u of [a, b]) {
    assert.equal(N.fuerza(e, u), 6);
    assert.equal(N.tiene(e, u, "DanoAlDestierro"), true);
  }
  assert.equal(N.fuerza(e, r), 3);
  assert.equal(N.tiene(e, r, "DanoAlDestierro"), false);
});

test("Misil de Montu: Barajarlo desde tu mano para Robar una carta", () => {
  let e = mesa();
  const m = poner(e, 0, "mano", "Misil de Montu");
  e = aplicar(e, habilidad(m, "Misil de Montu"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Misiles de Rastreo: busca una copia de un Oro en juego para tu Reserva y Destierra una carta oponente de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 1, "reserva", "Huitzilin");
  const mia = poner(e, 0, "castillo", "Huitzilin");
  const onsen = poner(e, 0, "castillo", "Onsen");
  const val = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Misiles de Rastreo");
  e = aplicar(e, jugar(m));
  assert.equal(opciones(e).some((o) => o.valor === onsen), false);
  e = elegir(e, nombreDe(e, "Huitzilin"));
  e = elegir(e, val);
  assert.equal(zonaDe(e, mia), "reserva");
  assert.equal(N.ubicar(e, mia).j, 0);
  assert.equal(zonaDe(e, val), "destierro");
});

test("Misiles de Rastreo: pagar un Oro y Desterrarlo del Cementerio para Barajar hasta cuatro cartas de los Cementerios y Robar dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "cementerio", "Misiles de Rastreo");
  const cs = [poner(e, 0, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Valefor")];
  e = hacer(e, habilidad(m, "Misiles de Rastreo"), ...cs);
  for (const u of cs) assert.equal(zonaDe(e, u), "castillo");
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Momificar: cada jugador pone en juego un Aliado de su Cementerio bajo su control", () => {
  let e = mesa();
  oros(e, 0, 2);
  const mio = poner(e, 0, "cementerio", "Valefor");
  const suyo = poner(e, 1, "cementerio", "Valefor");
  const m = poner(e, 0, "mano", "Momificar");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(zonaDe(e, mio), "defensa");
  assert.equal(N.ubicar(e, mio).j, 0);
  assert.equal(zonaDe(e, suyo), "defensa");
  assert.equal(N.ubicar(e, suyo).j, 1);
});

test("Monstruo de la Laguna: Roba una carta y busca un Aliado para tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const val = poner(e, 0, "castillo", "Valefor");
  const m = poner(e, 0, "mano", "Monstruo de la Laguna");
  e = hacer(e, jugar(m), val, "A tu mano");
  assert.equal(zonaDe(e, val), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Monstruo de la Laguna: el Aliado buscado puede ir a tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const val = poner(e, 0, "castillo", "Valefor");
  const m = poner(e, 0, "mano", "Monstruo de la Laguna");
  e = hacer(e, jugar(m), val, "A tu Cementerio");
  assert.equal(zonaDe(e, val), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Monstruo de la Laguna: si buscaste un Dinosaurio busca además un Aliado para tu Cementerio", () => {
  let e = con(mesa(), "Valefor", { razas: ["Dinosaurio"] });
  oros(e, 0, 1);
  const val = poner(e, 0, "castillo", "Valefor");
  const ghul = poner(e, 0, "castillo", "Ghul Leal");
  const m = poner(e, 0, "mano", "Monstruo de la Laguna");
  e = hacer(e, jugar(m), val, "A tu mano", ghul);
  assert.equal(zonaDe(e, val), "mano");
  assert.equal(zonaDe(e, ghul), "cementerio");
});

test("Mordida de Vampiro: Destierra una carta de coste 2 o menos, una copia de un Castillo y una carta del fondo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const val = poner(e, 1, "defensa", "Valefor");
  const copia = poner(e, 1, "castillo", "Valefor");
  const m = poner(e, 0, "mano", "Mordida de Vampiro");
  e = hacer(e, jugar(m), val, "Desterrar", copia, "Castillo oponente");
  assert.equal(zonaDe(e, val), "destierro");
  assert.equal(zonaDe(e, copia), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 29);
  assert.equal(zonaDe(e, m), "destierro");
});

test("Mordida de Vampiro: Destierra una carta adicional del fondo por cada otra Mordida de Vampiro en tu Destierro", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "destierro", "Mordida de Vampiro");
  const val = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Mordida de Vampiro");
  e = hacer(e, jugar(m), val, "Barajar", "Castillo oponente");
  assert.equal(zonaDe(e, val), "castillo");
  assert.equal(e.jugadores[1].destierro.length, 2);
});

test("Motin a Bordo: Robar una carta y se Destierra al jugarlo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Motin a Bordo");
  e = hacer(e, jugar(m), "No eres afectado por habilidades y efectos oponentes este turno y Robas una carta");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, m), "destierro");
});

test("Motin a Bordo: Subir hasta un Aliado de coste 2 o menos a la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const val = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Motin a Bordo");
  e = hacer(e, jugar(m), "No pagas costes adicionales este turno y Subes hasta un Aliado de coste 2 o menos a la mano", val);
  assert.equal(zonaDe(e, val), "mano");
  assert.equal(N.ubicar(e, val).j, 1);
});

test("Motin a Bordo: jugarlo al comienzo de la Vigilia", { todo: "momento: jugar un Talismán al comienzo de la Vigilia" }, () => {});

test("Motin a Bordo: no ser afectado por habilidades y efectos oponentes este turno", { todo: "efecto: un jugador no es afectado por habilidades ni efectos oponentes este turno" }, () => {});

test("Motin a Bordo: no pagar costes adicionales este turno", { todo: "efecto: un jugador no paga costes adicionales este turno" }, () => {});

test("Muñeco Vudú: en tu Vigilia, con Aliados con Furia, Baraja un Talismán o Tótem de la mano oponente", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Valefor");
  const manada = poner(e, 1, "mano", "Llamar a la Manada");
  const val = poner(e, 1, "mano", "Valefor");
  const m = poner(e, 0, "mano", "Muñeco Vudú");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(zonaDe(e, manada), "castillo");
  assert.equal(zonaDe(e, val), "mano");
});

test("Muñeco Vudú: no se juega sin Aliados con Furia ni fuera de tu Vigilia", () => {
  const e = vainilla(mesa(), "Ghul Leal");
  const g = poner(e, 0, "defensa", "Ghul Leal");
  const m = poner(e, 0, "mano", "Muñeco Vudú");
  assert.equal(puedeJugar(e, m), false);
  N.agregarEfecto(e, { tipo: "gana", clave: "Furia", uid: g }, 0);
  assert.equal(puedeJugar(e, m), true);
  e.fase = "talismanes";
  e.prioridad = 0;
  e.pases = 0;
  assert.equal(puedeJugar(e, m), false);
});

test("Muñeco Vudú: en tu Vigilia, una vez por turno, un Aliado gana 2 de Fuerza permanentemente", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  const g = poner(e, 0, "defensa", "Ghul Leal");
  const m = poner(e, 0, "cementerio", "Muñeco Vudú");
  e = aplicar(e, habilidad(m, "Muñeco Vudú"));
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(puedeUsar(e, m), false);
  assert.equal(e.efectos.find((f) => f.uid === g && f.tipo === "fuerza").fin.mientras, true);
});

test("Muñeco Vudú: su habilidad no puede ser cancelada ni prevenida", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});

test("Nautilus: Baraja hasta dos cartas que controles y el oponente Baraja esa cantidad de sus Aliados, que pierden su habilidad", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  oros(e, 0, 1);
  const a = poner(e, 0, "defensa", "Ghul Leal");
  const r1 = poner(e, 1, "defensa", "Valefor");
  const r2 = poner(e, 1, "defensa", "Valefor");
  const n = poner(e, 0, "mano", "Nautilus");
  e = hacer(e, jugar(n), a, null);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, r1);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, r1), "castillo");
  assert.equal(zonaDe(e, r2), "defensa");
});

test("Nautilus: tiene Exhumar", () => {
  const e = mesa();
  oros(e, 0, 1);
  const n = poner(e, 0, "cementerio", "Nautilus");
  assert.equal(puedeJugar(e, n, "cementerio"), true);
});

test("Niebla Cuantica: por cada Aliado que mostraste Destierras una carta mostrada por el oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  fijarCastillo(e, 0, ["Valefor", "Drácula", "Ghul Leal"]);
  const n = poner(e, 0, "mano", "Niebla Cuantica");
  e = aplicar(e, jugar(n));
  e = elegir(e, (v) => v !== null);
  e = elegir(e, (v) => v !== null);
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 28);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Niebla Cuantica: desde el Cementerio gana Exhumar si muestras tres cartas de un mismo tipo o coste", () => {
  const e = mesa();
  oros(e, 0, 1);
  const n = poner(e, 0, "cementerio", "Niebla Cuantica");
  poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Ghul Leal");
  assert.equal(puedeJugar(e, n, "cementerio"), false);
  poner(e, 0, "mano", "Pedrenyal");
  assert.equal(puedeJugar(e, n, "cementerio"), true);
});

test("Niebla de Muerte: Destruye hasta una carta de coste 3 o menos y el oponente Bota siete", () => {
  let e = mesa();
  oros(e, 0, 3);
  const val = poner(e, 1, "defensa", "Valefor");
  const n = poner(e, 0, "mano", "Niebla de Muerte");
  e = hacer(e, jugar(n), val);
  assert.equal(zonaDe(e, val), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 23);
  assert.equal(e.jugadores[1].cementerio.length, 8);
});

test("Niebla de Muerte: las cartas puestas en el Cementerio este turno pierden su habilidad", { todo: "efecto: las cartas puestas en los Cementerios este turno pierden su habilidad por el turno" }, () => {});

test("Niebla de Muerte: si es Descartada por un efecto oponente puede jugarse pagando un Oro", { todo: "disparo: al ser Descartada por un efecto oponente" }, () => {});

test("Nimas de Cucao: las cartas del tipo nombrado pierden su habilidad hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const carcosa = poner(e, 1, "apoyo", "Carcosa");
  const val = poner(e, 1, "defensa", "Valefor");
  const n = poner(e, 0, "mano", "Nimas de Cucao");
  e = hacer(e, jugar(n), "Tótem");
  assert.equal(N.activa(e, carcosa), false);
  assert.equal(N.activa(e, val), true);
  assert.equal(e.efectos.find((f) => f.uid === carcosa).fin.inicioDe, 0);
});

test("Nimas de Cucao: no puedes Botar cartas hasta tu próximo turno", { todo: "efecto: un jugador no puede Botar cartas" }, () => {});

test("Nimas de Cucao: si es Barajado de tu mano por una carta que controlas, puede jugarse con coste reducido", { todo: "disparo: al ser Barajada desde la mano por una habilidad propia, jugarla con coste reducido" }, () => {});

test("No Mas Bichos: Baraja todas las cartas de coste 1 o menos y Roba cinco menos una por cada carta Barajada", () => {
  let e = mesa();
  oros(e, 0, 2);
  const val = poner(e, 1, "defensa", "Valefor");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  const b = poner(e, 0, "mano", "No Mas Bichos");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(zonaDe(e, val), "castillo");
  assert.equal(zonaDe(e, jab), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 0);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("No Mas Bichos: no puede ser Anulado", () => {
  const e = mesa();
  const b = poner(e, 0, "mano", "No Mas Bichos");
  assert.ok(N.carta(e, b).claves.includes("NoAnulable"));
});

test("No Mas Bichos: Descartar una carta para Barajarlo desde tu Cementerio en tu Castillo", () => {
  let e = mesa();
  const b = poner(e, 0, "cementerio", "No Mas Bichos");
  const d = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(b, "No Mas Bichos"));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, b), "castillo");
});

test("Ofrenda a los Abuelos: busca hasta dos cartas con distinto nombre en un Castillo y las Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const [v1, ghul] = fijarCastillo(e, 1, ["Valefor", "Ghul Leal", "Valefor"]);
  const o = poner(e, 0, "mano", "Ofrenda a los Abuelos");
  e = hacer(e, jugar(o), "Castillo oponente", v1);
  assert.equal(opciones(e).some((x) => x.valor !== null && N.carta(e, x.valor).nombre === "Valefor"), false);
  e = elegir(e, ghul);
  assert.equal(zonaDe(e, v1), "destierro");
  assert.equal(zonaDe(e, ghul), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("Ofrenda a los Abuelos: jugarlo sin pagar en respuesta a que el oponente busque", { todo: "respuesta: a que el oponente busque en tu Castillo (o por segunda vez en el suyo), jugarla sin pagar su coste" }, () => {});

test("Ofrenda a los Abuelos: prevenir que el oponente busque cartas en tu Castillo", { todo: "efecto: prevenir que el oponente busque cartas en tu Castillo" }, () => {});

test("Ofrendas al Dragón: Baraja y Destierra cuatro cartas de distinto tipo de los Cementerios y genera un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const cs = [poner(e, 0, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Drácula"), poner(e, 0, "cementerio", "Pedrenyal"), poner(e, 1, "cementerio", "Carcosa")];
  const o = poner(e, 0, "mano", "Ofrendas al Dragón");
  e = hacer(e, jugar(o), cs[0], cs[1], null, cs[2], cs[3]);
  assert.deepEqual(cs.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro", "destierro"]);
  assert.equal(e.jugadores[0].generados.reduce((s, g) => s + g.n, 0), 1);
});

test("Ofrendas al Dragón: sin cuatro tipos distintos no genera Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const cs = [0, 1, 0, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  const o = poner(e, 0, "mano", "Ofrendas al Dragón");
  e = hacer(e, jugar(o), ...cs);
  assert.equal(cs.every((u) => zonaDe(e, u) === "castillo"), true);
  assert.equal((e.jugadores[0].generados ?? []).length, 0);
});

test("Ofrendas al Dragón: Descartarlo para que un Arma o Tótem pierda su habilidad por el turno", () => {
  let e = mesa();
  const carcosa = poner(e, 1, "apoyo", "Carcosa");
  const o = poner(e, 0, "mano", "Ofrendas al Dragón");
  e = aplicar(e, habilidad(o, "Ofrendas al Dragón"));
  assert.equal(zonaDe(e, o), "cementerio");
  assert.equal(N.activa(e, carcosa), false);
});

test("Ofrendas al Dragón: tiene Exhumar", () => {
  const e = mesa();
  oros(e, 0, 1);
  const o = poner(e, 0, "cementerio", "Ofrendas al Dragón");
  assert.equal(puedeJugar(e, o, "cementerio"), true);
});

test("Orden Restaurado: busca un Aliado de coste 1 y lo juega sin pagar su coste con Furia", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  oros(e, 0, 1);
  const g = poner(e, 0, "castillo", "Ghul Leal");
  const jab = poner(e, 0, "castillo", "Jabberwocky");
  const o = poner(e, 0, "mano", "Orden Restaurado");
  e = aplicar(e, jugar(o));
  assert.equal(opciones(e).some((x) => x.valor === jab), false);
  e = elegir(e, g);
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
});

test("Orden Restaurado: Desterrarla del Cementerio para que una carta gane Indestructible este turno", () => {
  let e = mesa();
  const o = poner(e, 0, "cementerio", "Orden Restaurado");
  const val = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(o, "Orden Restaurado"));
  assert.equal(N.tiene(e, val, "Indestructible"), true);
  assert.equal(zonaDe(e, o), "destierro");
});

test("Orden Restaurado: la carta no puede ser afectada por efectos oponentes este turno", { todo: "efecto: una carta no puede ser afectada por efectos oponentes" }, () => {});

test("Oriflama: hasta dos Aliados que porten Armas ganan Furia, 1 de Fuerza por cada Arma que controles y no pueden salir del juego", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  oros(e, 0, 1);
  const g = poner(e, 0, "defensa", "Ghul Leal");
  poner(e, 0, "arma", "Pedrenyal", { portador: g });
  const otro = poner(e, 0, "defensa", "Ghul Leal");
  const o = poner(e, 0, "mano", "Oriflama");
  e = hacer(e, jugar(o), g);
  assert.equal(N.fuerza(e, g), 6);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(N.puedeSalir(e, g), false);
  assert.equal(N.tiene(e, otro, "Furia"), false);
});

test("Oriflama: tiene Exhumar", () => {
  const e = mesa();
  oros(e, 0, 1);
  const o = poner(e, 0, "cementerio", "Oriflama");
  assert.equal(puedeJugar(e, o, "cementerio"), true);
});

test("Pacto Sangriento: el oponente convierte los Aliados y Oros sobrantes en Tótem sin habilidad y, si son 3 o menos, ganas su control", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Ghul Leal");
  const ra = [1, 2, 3].map(() => poner(e, 1, "defensa", "Ghul Leal"));
  const ro = oros(e, 1, 3);
  const p = poner(e, 0, "mano", "Pacto Sangriento");
  e = aplicar(e, jugar(p));
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, ra[0]);
  e = elegir(e, ra[1]);
  e = elegir(e, ro[0]);
  for (const u of [ra[0], ra[1], ro[0]]) {
    assert.equal(zonaDe(e, u), "apoyo");
    assert.equal(N.ubicar(e, u).j, 0);
    assert.equal(N.carta(e, u).tipo, "Tótem");
    assert.equal(N.carta(e, u).sinHabilidad, true);
  }
  assert.equal(zonaDe(e, ra[2]), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Pacto Sangriento: si se convierten más de 3 cartas quedan bajo control del oponente", () => {
  let e = vainilla(mesa(), "Ghul Leal");
  oros(e, 0, 2);
  const ra = [1, 2, 3, 4].map(() => poner(e, 1, "defensa", "Ghul Leal"));
  oros(e, 1, 2);
  const p = poner(e, 0, "mano", "Pacto Sangriento");
  e = sinRespuesta(aplicar(e, jugar(p)));
  for (const u of ra) {
    assert.equal(zonaDe(e, u), "apoyo");
    assert.equal(N.ubicar(e, u).j, 1);
    assert.equal(N.carta(e, u).tipo, "Tótem");
  }
  assert.equal(e.jugadores[1].reserva.length, 2);
});
