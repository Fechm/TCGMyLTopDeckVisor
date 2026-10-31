import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeResponder = (e, uid) => accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === uid);

function alTope(e, j, uid) {
  const c = e.jugadores[j].castillo;
  c.splice(c.indexOf(uid), 1);
  c.unshift(uid);
}

function cambiarControl(e, uid, j, zona) {
  N.sacar(e, uid);
  e.jugadores[j][zona].push(uid);
}

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

test("Duelo Magico: el jugador con la mano más cara queda limitado por el resto del juego y el Talismán se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo Magico");
  poner(e, 0, "mano", "Sir Galahad");
  poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(d)));
  const f = e.efectos.find((x) => x.tipo === "limiteBotarDescartar");
  assert.equal(f.j, 0);
  assert.equal(f.fin.juego, true);
  assert.equal(zonaDe(e, d), "destierro");
});

test("Duelo Magico: con manos de igual coste nadie queda limitado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo Magico");
  poner(e, 0, "mano", "Valefor");
  poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(d)));
  assert.equal(e.efectos.some((x) => x.tipo === "limiteBotarDescartar"), false);
});

test("Duelo Magico: no Botar más de diez cartas ni Descartar o Desterrar más de una de la mano por turno", { todo: "efecto: límite por turno de cartas Botadas y de cartas Descartadas o Desterradas de la mano" }, () => {});

test("Duelo Personal: cada jugador busca un Aliado en el Castillo oponente y lo pone en juego sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo Personal");
  const g = poner(e, 1, "castillo", "Sir Galahad");
  const v = poner(e, 0, "castillo", "Valefor");
  e = hacer(e, jugar(d), "Cada jugador busca un Aliado en el Castillo oponente y lo pone en juego sin habilidad", g);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, v);
  assert.equal(N.ubicar(e, g).j, 0);
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(N.ubicar(e, v).j, 1);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.activa(e, g), false);
  assert.equal(N.tiene(e, v, "Furia"), false);
});

test("Duelo Personal: el controlador del Aliado con más Fuerza Roba tres cartas y su oponente Descarta una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo Personal");
  poner(e, 0, "defensa", "Padre Dagón");
  poner(e, 1, "defensa", "Valefor");
  const a = poner(e, 1, "mano", "Valefor");
  const b = poner(e, 1, "mano", "Sir Galahad");
  e = hacer(e, jugar(d), "El controlador del Aliado con más Fuerza Roba tres cartas y su oponente Descarta una");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, a);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, b), "mano");
});

test("Duelo Personal: con Golpe de Agua en tu Cementerio se resuelven ambos efectos", () => {
  let e = mesa();
  e.catalogo = { ...e.catalogo, golpe: { id: "golpe", nombre: "Golpe de Agua", tipo: "Talismán", coste: 1, fuerza: 0, razas: [], sinHabilidad: false, texto: "" } };
  e.instancias["0-golpe"] = "golpe";
  e.jugadores[0].cementerio.push("0-golpe");
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo Personal");
  const g = poner(e, 1, "castillo", "Padre Dagón");
  const v = poner(e, 0, "castillo", "Valefor");
  poner(e, 1, "mano", "Valefor");
  e = hacer(e, jugar(d), g, v);
  assert.equal(N.ubicar(e, g).j, 0);
  assert.equal(N.ubicar(e, v).j, 1);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[1].mano.length, 0);
});

test("Duelo Personal: con Golpe de Agua en tu Cementerio o Destierro no puede ser Anulado", { todo: "protección condicional: no puede ser Anulado mientras se cumpla una condición" }, () => {});

test("Duelo a Siete Pasos: Destruye una carta tuya y una carta oponente de igual o menor coste pierde su habilidad y es Destruida", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo a Siete Pasos");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  const p = poner(e, 1, "defensa", "Padre Dagón");
  e = hacer(e, jugar(d), g);
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(zonaDe(e, m), "cementerio");
  assert.equal(zonaDe(e, p), "defensa");
});

test("Duelo a Siete Pasos: si Destruyes un Oro de coste 0 no alcanza a cartas oponentes de mayor coste", () => {
  let e = mesa();
  const [o] = oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo a Siete Pasos");
  poner(e, 0, "defensa", "Mecha-Daikaiju");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(d));
  assert.equal(zonaDe(e, o), "cementerio");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Duelo a Siete Pasos: Exhumar, se juega desde el Cementerio y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "cementerio", "Duelo a Siete Pasos");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === d && a.desde === "cementerio"), true);
  e = hacer(e, jugar(d, { desde: "cementerio" }), g);
  assert.equal(zonaDe(e, d), "destierro");
});

function siteListo(nombre) {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const t = poner(e, 0, "mano", nombre);
  const sp = poner(e, 1, "mano", "Duelo a Siete Pasos - Sp");
  e = aplicar(e, jugar(t));
  return { e, t, sp };
}

test("Duelo a Siete Pasos - Sp: Anula un Talismán de coste 2 o menos, lo Destierra y Roba una carta", () => {
  let { e, t, sp } = siteListo("Llamar a la Manada");
  assert.equal(puedeResponder(e, sp), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: sp }));
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(zonaDe(e, sp), "destierro");
  assert.equal(e.jugadores[1].mano.length, 1);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Duelo a Siete Pasos - Sp: no puede Anular un Talismán de coste 3", () => {
  const { e, sp } = siteListo("Murciélagos del Caos");
  assert.equal(puedeResponder(e, sp), false);
});

test("Duelo a Siete Pasos - Sp: solo se juega en respuesta", () => {
  const e = mesa();
  oros(e, 0, 1);
  const sp = poner(e, 0, "mano", "Duelo a Siete Pasos - Sp");
  assert.equal(puedeJugar(e, sp), false);
});

test("Duelo de Dragones: Destierra de la mano, del Castillo y del Cementerio y Roba dos si Desterró dos o más", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo de Dragones");
  const v = poner(e, 1, "mano", "Valefor");
  const g = poner(e, 1, "mano", "Sir Galahad");
  const c1 = poner(e, 1, "cementerio", "Valefor");
  const c2 = poner(e, 1, "cementerio", "Sir Galahad");
  e = hacer(e, jugar(d), "Castillo oponente", nombreDe(e, "Drácula"), "Cementerio oponente", c1, c2);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, g), "mano");
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 29);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(zonaDe(e, d), "destierro");
});

test("Duelo de Dragones: si Destierra menos de dos cartas no Roba", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo de Dragones");
  e = hacer(e, jugar(d), "tu Castillo", nombreDe(e, "Drácula"), "Tu Cementerio");
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Duelo de Dragones: puede jugarse al comienzo de cualquier Fase", { todo: "momento: jugar un Talismán al comienzo de cualquier Fase" }, () => {});

test("Duelo en Marte: busca tres Armas y/o Tótem en tu Castillo y los pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo en Marte");
  const a = poner(e, 0, "castillo", "Pedrenyal");
  const b = poner(e, 0, "castillo", "Hacha Danesa");
  const c = poner(e, 0, "castillo", "Templo Gótico");
  e = hacer(e, jugar(d), a, b, c, "Ponerlos en tu mano");
  for (const x of [a, b, c]) assert.equal(zonaDe(e, x), "mano");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Duelo en Marte: puede ponerlos en tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Duelo en Marte");
  const a = poner(e, 0, "castillo", "Pedrenyal");
  e = hacer(e, jugar(d), a, "Ponerlos en tu Cementerio");
  assert.equal(zonaDe(e, a), "cementerio");
});

test("Duelo en Marte: puede jugarse al comienzo de cualquier Fase", { todo: "momento: jugar un Talismán al comienzo de cualquier Fase" }, () => {});

test("Duelo en Marte: desde tu Cementerio, tus Armas y Tótem en el Cementerio no pueden ser Barajados ni Desterrados por efectos", { todo: "continua desde el Cementerio: cartas de ciertos tipos en tu Cementerio no pueden ser Barajadas ni Desterradas por efectos" }, () => {});

test("Día de los Muertos: reduce su coste en uno por cada carta que no sea Oro en juego, hasta un mínimo de 1", () => {
  const e = mesa();
  const d = poner(e, 0, "mano", "Día de los Muertos");
  assert.equal(costeDe(e, 0, d).pagar, 7);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Sir Galahad");
  poner(e, 1, "apoyo", "Templo Gótico");
  oros(e, 1, 2);
  assert.equal(costeDe(e, 0, d).pagar, 4);
  for (let i = 0; i < 6; i++) poner(e, 1, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, d).pagar, 1);
});

test("Día de los Muertos: convierte los Aliados en Aliados de Fuerza 1 que no pueden portar Armas", () => {
  let e = mesa();
  oros(e, 0, 3);
  const d = poner(e, 0, "mano", "Día de los Muertos");
  const v = poner(e, 0, "defensa", "Valefor");
  const p = poner(e, 0, "arma", "Pedrenyal", { portador: v });
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  poner(e, 1, "apoyo", "Templo Gótico");
  e = sinRespuesta(aplicar(e, jugar(d)));
  for (const a of [v, m, g]) {
    assert.equal(N.fuerza(e, a), 1);
    assert.equal(N.tiene(e, a, "NoPortaArmas"), true);
  }
  assert.equal(N.tiene(e, v, "Furia"), false);
  assert.equal(N.tiene(e, m, "Indestructible"), false);
  assert.equal(zonaDe(e, p), "cementerio");
});

test("Día de los Muertos: desde tu Cementerio, el daño que recibe tu Castillo se reduce en dos", { todo: "efecto: reducir el daño recibido por tu Castillo" }, () => {});

test("Ea Poe: paga Oros y Destierra del Castillo oponente esa cantidad más dos, Robando por cada Talismán o Tótem", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ea = poner(e, 0, "mano", "Ea Poe");
  const t = poner(e, 1, "castillo", "Regresa Lucy");
  const h = poner(e, 1, "castillo", "Templo Gótico");
  alTope(e, 1, t);
  alTope(e, 1, h);
  e = hacer(e, jugar(ea), "Pagar 1 Oros");
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(zonaDe(e, h), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ea Poe: sin pagar Oros Destierra dos cartas", () => {
  let e = mesa();
  const ea = poner(e, 0, "mano", "Ea Poe");
  e = hacer(e, jugar(ea), "Pagar 0 Oros");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("El Caleuche: no puede ser Anulado", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "El Caleuche");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
});

test("El Caleuche: Baraja una carta de coste 2 o menos y Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "El Caleuche");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(c), v);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("El Caleuche: en respuesta a una carta jugada sin pagar su coste o que no puede ser Anulada, entra sin habilidad", { todo: "respuesta: a una carta jugada sin pagar su coste o que no puede ser Anulada; entra sin habilidad por el turno o el Talismán se resuelve sin efecto" }, () => {});

test("El Dragón Emerge: busca un Aliado de coste 3 o más y lo juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const d = poner(e, 0, "mano", "El Dragón Emerge");
  const g = poner(e, 0, "castillo", "Sir Galahad");
  poner(e, 0, "castillo", "Valefor");
  e = hacer(e, jugar(d));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Valefor"), false);
  e = elegir(e, g);
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("El Dragón Emerge: el Aliado jugado no puede ser Anulado ni cancelarse sus habilidades este turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 3);
  poner(e, 1, "mano", "Ciempiés-SP");
  const d = poner(e, 0, "mano", "El Dragón Emerge");
  const g = poner(e, 0, "castillo", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(d)));
  e = elegir(e, g);
  assert.equal(e.pila.length, 0);
  assert.equal(zonaDe(e, g), "defensa");
});

test("El Dragón Emerge: desde tu Cementerio, tus Aliados de coste 3 o más ganan 1 de Fuerza", { todo: "continua desde el Cementerio: tus Aliados de coste N o más ganan Fuerza" }, () => {});

test("El Gran Descenso: el oponente Descarta tres al azar y puede recuperarlas Desterrando cuatro cartas por cada una mientras tú Robas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const d = poner(e, 0, "mano", "El Gran Descenso");
  const mano = [0, 1, 2, 3].map(() => poner(e, 1, "mano", "Valefor"));
  e = aplicar(e, jugar(d));
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.pendiente.jugador, 1);
  const r = e.pendiente.opciones.find((o) => o.valor !== null).valor;
  e = elegir(e, r);
  e = elegir(e, null);
  assert.equal(zonaDe(e, r), "mano");
  assert.equal(e.jugadores[1].mano.length, 2);
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 26);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(mano.filter((u) => zonaDe(e, u) === "cementerio").length, 2);
});

test("El Gran Descenso: solo puede jugarse pagando su coste impreso", { todo: "restricción: la carta solo puede jugarse pagando su coste" }, () => {});

test("El Ángel y Su Juicio: busca un Aliado y lo juega reduciendo su coste en dos Oros", () => {
  let e = mesa();
  oros(e, 0, 3);
  const a = poner(e, 0, "mano", "El Ángel y Su Juicio");
  const g = poner(e, 0, "castillo", "Sir Galahad");
  e = hacer(e, jugar(a), g);
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("El Ángel y Su Juicio: si controlas un Aliado Ángel reduce en tres Oros y Robas una carta", () => {
  let e = mesa();
  const vid = id("Valefor");
  e.catalogo = { ...e.catalogo, [vid]: { ...e.catalogo[vid], razas: ["Ángel"] } };
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Valefor");
  const a = poner(e, 0, "mano", "El Ángel y Su Juicio");
  const g = poner(e, 0, "castillo", "Sir Galahad");
  e = hacer(e, jugar(a), g);
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("El Ángel y Su Juicio: Exhumar, se juega desde el Cementerio y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "cementerio", "El Ángel y Su Juicio");
  const v = poner(e, 0, "castillo", "Valefor");
  assert.equal(accionesLegales(e).some((x) => x.tipo === "jugar" && x.uid === a && x.desde === "cementerio"), true);
  e = hacer(e, jugar(a, { desde: "cementerio" }), v);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(zonaDe(e, a), "destierro");
});

test("El Ángel y Su Juicio: cuenta también un Aliado Ángel jugado desde tu turno anterior", { todo: "condición: jugaste un Aliado de cierta raza desde tu turno anterior" }, () => {});

test("Elemental: el oponente Descarta tres cartas y buscas un Sherlock Holmes", () => {
  let e = mesa();
  oros(e, 0, 3);
  const el = poner(e, 0, "mano", "Elemental");
  const mano = [0, 1, 2, 3].map(() => poner(e, 1, "mano", "Valefor"));
  const s = poner(e, 0, "castillo", "Sherlock Holmes");
  e = aplicar(e, jugar(el));
  assert.equal(e.pendiente.jugador, 1);
  e = hacer(e, { tipo: "elegir", i: 0 }, mano[1], mano[2]);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[1].mano.length, 1);
  e = elegir(e, s);
  assert.equal(zonaDe(e, s), "mano");
  assert.equal(zonaDe(e, el), "destierro");
});

test("Elemental: solo puede jugarse desde la mano pagando su coste", { todo: "restricción: la carta solo puede jugarse pagando su coste" }, () => {});

test("Energía Suprema: requiere mostrar un Arma o Tótem de tu mano o Cementerio", () => {
  const e = mesa();
  oros(e, 0, 1);
  const en = poner(e, 0, "mano", "Energía Suprema");
  assert.equal(puedeJugar(e, en), false);
  poner(e, 0, "cementerio", "Pedrenyal");
  assert.equal(puedeJugar(e, en), true);
});

test("Energía Suprema: genera dos Oros para jugar un Aliado y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 2);
  const en = poner(e, 0, "mano", "Energía Suprema");
  poner(e, 0, "mano", "Templo Gótico");
  const g = poner(e, 0, "mano", "Sir Galahad");
  assert.equal(puedeJugar(e, g), false);
  e = sinRespuesta(aplicar(e, jugar(en)));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 2, tipos: ["Aliado"] }]);
  assert.equal(zonaDe(e, en), "destierro");
  assert.equal(puedeJugar(e, g), true);
});

test("Energía Suprema: los Oros generados solo sirven para Aliados de coste 3 o más", { todo: "generar: Oro restringido por raza y coste mínimo" }, () => {});

test("Energía Suprema: al usar los Oros, Baraja cartas de los Cementerios y Roba según el coste del Aliado", { todo: "disparo: al usar un Oro generado, efecto según el coste de la carta pagada" }, () => {});

test("Ensamble: cada jugador Descarta las cartas de coste 1 o menos de su mano; Robas por cada una tuya y si Robas menos de tres el oponente Bota seis", () => {
  let e = mesa();
  oros(e, 0, 2);
  const en = poner(e, 0, "mano", "Ensamble");
  const v = poner(e, 0, "mano", "Valefor");
  const o = poner(e, 0, "mano", "Drácula");
  const g = poner(e, 0, "mano", "Sir Galahad");
  const rv = poner(e, 1, "mano", "Valefor");
  const rg = poner(e, 1, "mano", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(en)));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, o), "cementerio");
  assert.equal(zonaDe(e, g), "mano");
  assert.equal(zonaDe(e, rv), "cementerio");
  assert.equal(zonaDe(e, rg), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Ensamble: si Robas tres o más cartas el oponente no Bota", () => {
  let e = mesa();
  oros(e, 0, 2);
  const en = poner(e, 0, "mano", "Ensamble");
  for (let i = 0; i < 3; i++) poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(en)));
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Ensamble: si es Anulado, agrupa un Oro y Roba una carta", { todo: "disparo: al ser Anulado" }, () => {});

function envidiaLista(nombre, orosRival = 2) {
  let e = mesa();
  oros(e, 0, 5);
  oros(e, 1, orosRival);
  const c = poner(e, 0, "mano", nombre);
  const env = poner(e, 1, "mano", "Envidia");
  e = aplicar(e, jugar(c));
  return { e, c, env };
}

test("Envidia: Anula una carta de coste 3 o menos y la juega bajo tu control sin pagar su coste", () => {
  let { e, c, env } = envidiaLista("Sir Galahad");
  assert.equal(puedeResponder(e, env), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: env }));
  assert.equal(zonaDe(e, c), "defensa");
  assert.equal(N.ubicar(e, c).j, 1);
  assert.equal(e.jugadores[1].reserva.length, 0);
});

test("Envidia: no puede Anular una carta de coste 4", () => {
  const { e, env } = envidiaLista("Padre Dagón");
  assert.equal(puedeResponder(e, env), false);
});

test("Envidia: desde tu Cementerio, si tienes menos cartas que tu oponente, puedes Desterrarla para Robar una carta", () => {
  let e = mesa();
  const env = poner(e, 0, "cementerio", "Envidia");
  poner(e, 1, "mano", "Valefor");
  e = aplicar(e, habilidad(env, "Envidia"));
  assert.equal(zonaDe(e, env), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Envidia: con igual cantidad de cartas no puede Desterrarse para Robar", () => {
  const e = mesa();
  const env = poner(e, 0, "cementerio", "Envidia");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === env), false);
});

test("Envidia Mortal: si el oponente tiene más cartas del tipo, buscas una carta y él Destierra una de ese tipo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const em = poner(e, 0, "mano", "Envidia Mortal");
  const a = poner(e, 1, "mano", "Valefor");
  const b = poner(e, 1, "mano", "Sir Galahad");
  const r = poner(e, 1, "mano", "Regresa Lucy");
  const s = poner(e, 0, "castillo", "Sherlock Holmes");
  e = hacer(e, jugar(em), "Aliado", s);
  assert.equal(zonaDe(e, s), "mano");
  assert.equal(e.pendiente.jugador, 1);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === r), false);
  e = elegir(e, b);
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, a), "mano");
});

test("Envidia Mortal: de lo contrario Robas dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const em = poner(e, 0, "mano", "Envidia Mortal");
  poner(e, 1, "mano", "Valefor");
  e = hacer(e, jugar(em), "Talismán");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Escorpion de Seth: no puede ser Anulado, Baraja todas las cartas oponentes que no sean Oros y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 3);
  const es = poner(e, 0, "mano", "Escorpion de Seth");
  assert.equal(N.carta(e, es).claves.includes("NoAnulable"), true);
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "arma", "Pedrenyal", { portador: v });
  const t = poner(e, 1, "apoyo", "Templo Gótico");
  const [o] = oros(e, 1, 1);
  const mio = poner(e, 0, "defensa", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(es)));
  for (const x of [v, p, t]) assert.equal(zonaDe(e, x), "castillo");
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(zonaDe(e, mio), "defensa");
  assert.equal(zonaDe(e, es), "destierro");
});

test("Escudo Estelar: no se juega fuera de respuesta", () => {
  const e = mesa();
  oros(e, 0, 1);
  const es = poner(e, 0, "mano", "Escudo Estelar");
  assert.equal(puedeJugar(e, es), false);
});

test("Escudo Estelar: en respuesta a que se juegue o use la habilidad de una carta de coste 1 o menos", { todo: "respuesta: a que se juegue o se use la habilidad de una carta de cierto coste, sin Anularla" }, () => {});

test("Escudo Estelar: nadie puede buscar, mirar ni mostrar cartas de la mano ni los Castillos hasta tu próxima Fase Final", { todo: "efecto: prohibir buscar, mirar y mostrar cartas de la mano y los Castillos durante un período" }, () => {});

test("Escudo Prisma Zeta: hasta dos cartas en juego pierden su habilidad el turno siguiente y Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const es = poner(e, 0, "mano", "Escudo Prisma Zeta");
  const v = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  e = hacer(e, jugar(es), v, m, "El turno siguiente");
  for (const x of [v, m]) assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === x && f.fin.finTurno === e.turno + 1), true);
  assert.equal(N.activa(e, v), false);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Escudo Prisma Zeta: puede elegir que pierdan su habilidad este turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const es = poner(e, 0, "mano", "Escudo Prisma Zeta");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(es), v, null, "Este turno");
  assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === v && f.fin.finTurno === e.turno), true);
});

test("Escudo Prisma Zeta: al comienzo de tu Vigilia, desde el Cementerio, Destierra otra carta de tu Cementerio para subirlo a tu mano", () => {
  let e = mesa();
  const es = poner(e, 0, "cementerio", "Escudo Prisma Zeta");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  e = elegir(e, true);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, es), "mano");
});

test("Escudo Prisma Zeta: sin otra carta en tu Cementerio no se dispara", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Escudo Prisma Zeta");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.pendiente, null);
});

test("Espectro del Padre: Destruye un Aliado oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const es = poner(e, 0, "mano", "Espectro del Padre");
  const v = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(es)));
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Espectro del Padre: requiere un Aliado oponente que pueda ser Destruido", () => {
  const e = mesa();
  oros(e, 0, 2);
  const es = poner(e, 0, "mano", "Espectro del Padre");
  poner(e, 1, "defensa", "Mecha-Daikaiju");
  assert.equal(puedeJugar(e, es), false);
});

test("Espectro del Padre: en respuesta a que un Aliado tuyo sea Destruido, se juega sin pagar su coste", { todo: "respuesta: jugar sin pagar su coste cuando un Aliado propio es Destruido" }, () => {});

test("Espectros Vindicantes: no puede ser Anulado, Destierra dos cartas de distinto nombre de un Castillo y el oponente Descarta una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ev = poner(e, 0, "mano", "Espectros Vindicantes");
  assert.equal(N.carta(e, ev).claves.includes("NoAnulable"), true);
  const v1 = poner(e, 1, "castillo", "Valefor");
  poner(e, 1, "castillo", "Valefor");
  const a = poner(e, 1, "mano", "Sir Galahad");
  poner(e, 1, "mano", "Sir Galahad");
  e = hacer(e, jugar(ev), "Castillo oponente", v1);
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Valefor"), false);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, v1), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, a);
  assert.equal(zonaDe(e, a), "cementerio");
});

test("Estaca en el Corazón: los jugadores ganan el control de las cartas que no sean Oro de las que son dueños", () => {
  let e = mesa();
  oros(e, 0, 1);
  const es = poner(e, 0, "mano", "Estaca en el Corazón");
  assert.equal(N.carta(e, es).claves.includes("NoAnulable"), true);
  const v = poner(e, 1, "defensa", "Valefor");
  cambiarControl(e, v, 0, "ataque");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  cambiarControl(e, g, 1, "defensa");
  const o = poner(e, 1, "reserva", "Drácula");
  cambiarControl(e, o, 0, "reserva");
  e = sinRespuesta(aplicar(e, jugar(es)));
  assert.equal(N.ubicar(e, v).j, 1);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.ubicar(e, g).j, 0);
  assert.equal(N.ubicar(e, o).j, 0);
});

test("Estaca en el Corazón: no puedes jugar más Estaca en el Corazón este turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "mano", "Estaca en el Corazón");
  const b = poner(e, 0, "mano", "Estaca en el Corazón");
  e = sinRespuesta(aplicar(e, jugar(a)));
  assert.equal(puedeJugar(e, b), false);
});

test("Estaca en el Corazón: utiliza una habilidad activada de una carta de coste 2 o menos en un Cementerio o Destierro", { todo: "mecánica: utilizar una habilidad activada de una carta fuera del juego como si la controlaras" }, () => {});

test("Estirpe Maldita: pone del tope de un Castillo un Aliado de Fuerza 2 por cada Aliado tuyo, Robas dos y tus Aliados ganan 2 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const es = poner(e, 0, "mano", "Estirpe Maldita");
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Sir Galahad");
  e = hacer(e, jugar(es), "tu Castillo");
  const aliados = N.aliadosDe(e, 0);
  assert.equal(aliados.length, 4);
  assert.equal(N.fuerza(e, v), 5);
  for (const a of aliados.filter((u) => N.carta(e, u).nombre === "Drácula")) {
    assert.equal(N.fuerza(e, a), 4);
    assert.equal(N.activa(e, a), false);
  }
  assert.equal(e.jugadores[0].mano.length, 2);
  N.expirar(e, "finTurno");
  e.turno += 3;
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, v), 5);
});

test("Estirpe Maldita: desde tu Cementerio, puedes Desterrarla para que un Aliado de coste 2 o menos gane Furia", () => {
  let e = mesa();
  const es = poner(e, 0, "cementerio", "Estirpe Maldita");
  poner(e, 0, "defensa", "Valefor");
  const j = poner(e, 0, "defensa", "Jabberwocky");
  assert.equal(N.tiene(e, j, "Furia"), false);
  e = hacer(e, habilidad(es, "Estirpe Maldita"), j);
  assert.equal(zonaDe(e, es), "destierro");
  assert.equal(N.tiene(e, j, "Furia"), true);
});

test("Exhumar: juega un Aliado de Fuerza 4 o más de tu Cementerio pagando su coste; gana Furia y Destierra un Talismán de la mano oponente", () => {
  let e = mesa();
  oros(e, 0, 5);
  const ex = poner(e, 0, "mano", "Exhumar");
  const p = poner(e, 0, "cementerio", "Padre Dagón");
  const r = poner(e, 1, "mano", "Regresa Lucy");
  const v = poner(e, 1, "mano", "Valefor");
  e = hacer(e, jugar(ex), r);
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(zonaDe(e, v), "mano");
});

test("Exhumar: un Aliado de Fuerza 3 o menos gana Indesterrable y puedes Desterrar un Aliado de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ex = poner(e, 0, "mano", "Exhumar");
  const v = poner(e, 0, "cementerio", "Valefor");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  e = hacer(e, jugar(ex), g);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
  assert.equal(zonaDe(e, g), "destierro");
});

test("Exhumar: requiere un Aliado en tu Cementerio", () => {
  const e = mesa();
  oros(e, 0, 1);
  const ex = poner(e, 0, "mano", "Exhumar");
  assert.equal(puedeJugar(e, ex), false);
});
