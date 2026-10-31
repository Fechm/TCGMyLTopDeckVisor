import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver, disponibles, impuestoSinPagar } from "../web/duelo/efectos.js";
import { mov } from "../web/duelo/formato.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const valores = (e) => e.pendiente.opciones.map((o) => o.valor);

function alTope(e, j, uid) {
  const c = e.jugadores[j].castillo;
  c.splice(c.indexOf(uid), 1);
  c.unshift(uid);
}

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

function atacarCon(e, uid) {
  e = aplicar(e, { tipo: "batalla" });
  return aplicar(e, { tipo: "atacar", uid });
}

function hastaDano(e) {
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

test("Tangata Manu: tiene Furia e Indestructible", () => {
  const e = mesa();
  const t = poner(e, 0, "defensa", "Tangata Manu");
  assert.equal(N.tiene(e, t, "Furia"), true);
  assert.equal(N.tiene(e, t, "Indestructible"), true);
});

test("Tangata Manu: al entrar muestra seis cartas del tope y juega una de coste 2 o menos sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const t = poner(e, 0, "mano", "Tangata Manu");
  const v = poner(e, 0, "castillo", "Valefor");
  alTope(e, 0, v);
  e = hacer(e, jugar(t), v);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(zonaDe(e, t), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Tangata Manu: su habilidad solo se usa una vez por turno aunque entren dos copias", () => {
  let e = mesa();
  oros(e, 0, 4);
  const t1 = poner(e, 0, "mano", "Tangata Manu");
  const t2 = poner(e, 0, "mano", "Tangata Manu");
  e = aplicar(e, jugar(t1));
  e = elegir(e, e.pendiente.opciones[0].valor);
  e = aplicar(e, jugar(t2));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, t2), "defensa");
});

test("Tangata Manu: puede jugarse al comienzo del Bloqueo", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});

test("Watson: tiene Imbloqueable", () => {
  const e = mesa();
  const w = poner(e, 0, "defensa", "Watson");
  assert.equal(N.tiene(e, w, "Imbloqueable"), true);
});

test("Watson: reduce su coste en un Oro si controlas Armas", () => {
  const e = mesa();
  const w = poner(e, 0, "mano", "Watson");
  assert.equal(costeDe(e, 0, w).pagar, 2);
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Pedrenyal", { portador: v });
  assert.equal(costeDe(e, 0, w).pagar, 1);
});

test("Watson: reduce su coste si jugaste Armas en tu turno anterior", { todo: "condición: jugaste cartas de cierto tipo en tu turno anterior" }, () => {});

test("Watson: una vez en tu turno Destierra del tope del Castillo oponente tantas cartas como Fuerza tenga un Aliado que porte Arma", () => {
  let e = mesa();
  const w = poner(e, 0, "defensa", "Watson");
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Pedrenyal", { portador: v });
  e = aplicar(e, habilidad(w, "Watson"));
  assert.equal(e.jugadores[1].castillo.length, 25);
  assert.equal(e.jugadores[1].destierro.length, 5);
  assert.equal(puedeUsar(e, w), false);
});

test("Watson: sin Aliados que porten Arma no puede usar su habilidad", () => {
  const e = mesa();
  const w = poner(e, 0, "defensa", "Watson");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(puedeUsar(e, w), false);
});

test("Yaju: reduce su coste si tienes un Arma o Tótem en tu mano o Cementerio", () => {
  const e = mesa();
  const y = poner(e, 0, "mano", "Yaju");
  assert.equal(costeDe(e, 0, y).pagar, 3);
  poner(e, 0, "cementerio", "Isla de Poveglia");
  assert.equal(costeDe(e, 0, y).pagar, 2);
});

test("Yaju: al entrar Baraja hasta dos cartas cuyos costes sumen 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const y = poner(e, 0, "mano", "Yaju");
  const r1 = poner(e, 1, "defensa", "Valefor");
  const r2 = poner(e, 1, "defensa", "Valefor");
  const r3 = poner(e, 1, "defensa", "Jabberwocky");
  e = aplicar(e, jugar(y));
  e = elegir(e, r1);
  assert.equal(valores(e).includes(r3), false);
  e = elegir(e, r2);
  assert.equal(zonaDe(e, r1), "castillo");
  assert.equal(zonaDe(e, r2), "castillo");
  assert.equal(zonaDe(e, r3), "defensa");
});

test("Yaju: al atacar también Baraja", () => {
  let e = mesa();
  const y = poner(e, 0, "defensa", "Yaju");
  const r1 = poner(e, 1, "defensa", "Valefor");
  e = atacarCon(e, y);
  e = elegir(e, r1);
  assert.equal(zonaDe(e, r1), "castillo");
});

test("Yaju: si porta un Arma gana Furia y su daño va al Destierro", () => {
  const e = mesa();
  const y = poner(e, 0, "defensa", "Yaju");
  assert.equal(N.tiene(e, y, "Furia"), false);
  assert.equal(N.tiene(e, y, "DanoAlDestierro"), false);
  poner(e, 0, "arma", "Pedrenyal", { portador: y });
  assert.equal(N.tiene(e, y, "Furia"), true);
  assert.equal(N.tiene(e, y, "DanoAlDestierro"), true);
});

test("Zadquiel: tiene Furia e Imbloqueable", () => {
  const e = mesa();
  const z = poner(e, 0, "defensa", "Zadquiel");
  assert.equal(N.tiene(e, z, "Furia"), true);
  assert.equal(N.tiene(e, z, "Imbloqueable"), true);
});

test("Zadquiel: al atacar mira la mano oponente y nombra una carta que no puede jugarse hasta tu próximo turno", () => {
  let e = mesa();
  const z = poner(e, 0, "defensa", "Zadquiel");
  poner(e, 1, "mano", "Valefor");
  const m = poner(e, 1, "mano", "Llamar a la Manada");
  e = atacarCon(e, z);
  e = elegir(e, m);
  const f = e.efectos.find((x) => x.tipo === "noJugarNombre");
  assert.equal(f.j, 1);
  assert.equal(f.nombre, "Llamar a la Manada");
  assert.equal(f.fin.inicioDe, 0);
});

test("Zadquiel: una vez por turno juega un Arma sobre un Aliado oponente reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const z = poner(e, 0, "defensa", "Zadquiel");
  const rv = poner(e, 1, "defensa", "Valefor");
  const zw = poner(e, 0, "mano", "Zweihander Brutal");
  e = aplicar(e, habilidad(z, "Zadquiel"));
  e = elegir(e, rv);
  assert.deepEqual(e.armas[rv], [zw]);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(puedeUsar(e, z), false);
});

test("Zadquiel: la reducción no baja el coste del Arma de 1", () => {
  let e = mesa();
  const z = poner(e, 0, "defensa", "Zadquiel");
  poner(e, 0, "mano", "Pedrenyal");
  assert.equal(puedeUsar(e, z), false);
  oros(e, 0, 1);
  assert.equal(puedeUsar(e, z), true);
  e = aplicar(e, habilidad(z, "Zadquiel"));
  assert.equal(e.armas[z].length, 1);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Zhong Kui: tiene Imbloqueable", () => {
  const e = mesa();
  const z = poner(e, 0, "defensa", "Zhong Kui");
  assert.equal(N.tiene(e, z, "Imbloqueable"), true);
});

test("Zhong Kui: al entrar busca un Arma en tu Castillo y la juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 4);
  const z = poner(e, 0, "mano", "Zhong Kui");
  const zw = poner(e, 0, "castillo", "Zweihander Brutal");
  e = aplicar(e, jugar(z));
  e = elegir(e, zw);
  assert.deepEqual(e.armas[z], [zw]);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Zhong Kui: puede jugar un Tótem de coste 1 sin pagar Oros", () => {
  let e = mesa();
  oros(e, 0, 2);
  const z = poner(e, 0, "mano", "Zhong Kui");
  const isla = poner(e, 0, "castillo", "Isla de Poveglia");
  e = aplicar(e, jugar(z));
  e = elegir(e, isla);
  e = elegir(e, false);
  assert.equal(zonaDe(e, isla), "apoyo");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Zhong Kui: hasta tu próximo turno cuesta un Oro más jugar sin pagar y los Talismanes", () => {
  let e = mesa();
  oros(e, 0, 2);
  const z = poner(e, 0, "mano", "Zhong Kui");
  const m = poner(e, 1, "mano", "Llamar a la Manada");
  e = aplicar(e, jugar(z));
  assert.equal(impuestoSinPagar(e, 1), 1);
  assert.equal(costeDe(e, 1, m).pagar, 2);
  assert.ok(e.efectos.filter((f) => ["impuestoSinPagar", "impuestoTalisman"].includes(f.tipo)).every((f) => f.fin.inicioDe === 0));
});

test("Zhong Kui: hasta tu próximo turno cuesta un Oro más jugar cartas de coste 0", { todo: "efecto: jugar cartas de coste 0 cuesta un Oro adicional durante un período" }, () => {});

test("Ahab: tiene Furia y al entrar busca un Aliado que no sea Ahab", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Ahab");
  const otro = poner(e, 0, "castillo", "Ahab");
  const v = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, jugar(a));
  assert.equal(N.tiene(e, a, "Furia"), true);
  assert.equal(valores(e).includes(otro), false);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Ahab: una vez en tu turno agrupa un Oro si tu oponente jugó más de una carta este turno", () => {
  let e = mesa();
  const a = poner(e, 0, "defensa", "Ahab");
  const o = poner(e, 0, "pagado", "Drácula");
  assert.equal(puedeUsar(e, a), false);
  e.jugadores[1].jugadas.Talismán = 2;
  e = aplicar(e, habilidad(a, "Ahab"));
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(puedeUsar(e, a), false);
});

test("Ahab: también cuenta las habilidades utilizadas por el oponente", { todo: "condición: cantidad de habilidades utilizadas por un jugador este turno" }, () => {});

test("Antonio Pincheira: al entrar el oponente Bota seis y pones hasta un Oro de su Cementerio en tu Reserva", () => {
  let e = mesa();
  oros(e, 0, 3);
  const a = poner(e, 0, "mano", "Antonio Pincheira");
  e = aplicar(e, jugar(a));
  assert.equal(e.jugadores[1].castillo.length, 24);
  const o = e.pendiente.opciones[0].valor;
  e = elegir(e, o);
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(N.controlador(e, o), 0);
  assert.equal(e.jugadores[1].cementerio.length, 5);
  assert.equal(N.tiene(e, a, "Furia"), true);
});

test("Antonio Pincheira: al atacar también hace Botar seis", () => {
  let e = mesa();
  const a = poner(e, 0, "defensa", "Antonio Pincheira");
  e = atacarCon(e, a);
  e = elegir(e, null);
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Antonio Pincheira: una vez por turno Roba dos cartas", () => {
  let e = mesa();
  const a = poner(e, 0, "defensa", "Antonio Pincheira");
  e = aplicar(e, habilidad(a, "Antonio Pincheira"));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, a), false);
});

test("Antonio Pincheira: en tu Fase Final agrupa hasta dos Aliados", () => {
  let e = mesa();
  const a = poner(e, 0, "ataque", "Antonio Pincheira");
  const v = poner(e, 0, "ataque", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, a);
  e = elegir(e, v);
  assert.equal(zonaDe(e, a), "defensa");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Antonio Pincheira: los Talismanes cuestan un Oro adicional", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Antonio Pincheira");
  const m0 = poner(e, 0, "mano", "Llamar a la Manada");
  const m1 = poner(e, 1, "mano", "Llamar a la Manada");
  assert.equal(costeDe(e, 0, m0).pagar, 2);
  assert.equal(costeDe(e, 1, m1).pagar, 2);
});

test("Auguste Dupin: al entrar Descarta los Talismanes y Tótem de la mano oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const d = poner(e, 0, "mano", "Auguste Dupin");
  const m = poner(e, 1, "mano", "Llamar a la Manada");
  const t = poner(e, 1, "mano", "Isla de Poveglia");
  const v = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, jugar(d));
  assert.equal(zonaDe(e, m), "cementerio");
  assert.equal(zonaDe(e, t), "cementerio");
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(N.tiene(e, d, "Furia"), true);
});

test("Auguste Dupin: en juego no se pueden Barajar cartas del Cementerio oponente", () => {
  const e = mesa();
  const d = poner(e, 0, "defensa", "Auguste Dupin");
  const c = poner(e, 1, "cementerio", "Valefor");
  e.cola.unshift(N.nuevoFrame([mov("barajar", "x")], { ctrl: 0, fuente: d, def: id("Auguste Dupin"), vars: { x: [c] } }));
  resolver(e);
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Auguste Dupin: en juego o en tu Cementerio nadie puede Barajar cartas de ningún Cementerio", { todo: "continua: prohibir Barajar cartas de todos los Cementerios, también activa desde el Cementerio" }, () => {});

test("Bandido Esqueleto: al entrar Roba y juega un Bandido pagando su coste, generando un Oro para Aliados o Armas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bandido Esqueleto");
  const n = poner(e, 0, "mano", "Bandido Neira");
  e = aplicar(e, jugar(b));
  e = elegir(e, true);
  assert.equal(zonaDe(e, n), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(disponibles(e, 0, "Aliado"), 1);
  assert.equal(disponibles(e, 0, "Talismán"), 0);
  assert.equal(N.tiene(e, b, "Furia"), true);
});

test("Bandido Esqueleto: puede jugar un Aliado de su Cementerio pagando su coste, sin generar Oro si no es Bandido", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bandido Esqueleto");
  const f = poner(e, 0, "cementerio", "Capitan Flint");
  e = aplicar(e, jugar(b));
  e = elegir(e, true);
  assert.equal(zonaDe(e, f), "defensa");
  assert.equal(disponibles(e, 0, "Aliado"), 0);
});

test("Bandido Liberona: al entrar muestra cuatro cartas del tope y pone una en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Bandido Liberona");
  const v = poner(e, 0, "castillo", "Valefor");
  alTope(e, 0, v);
  e = aplicar(e, jugar(b));
  e = elegir(e, v);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Bandido Liberona: con dos o más Bandido pone una carta adicional en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Bandido Neira");
  const b = poner(e, 0, "mano", "Bandido Liberona");
  e = aplicar(e, jugar(b));
  e = elegir(e, e.pendiente.opciones[0].valor);
  e = elegir(e, e.pendiente.opciones[0].valor);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Bandido Medieval: al entrar busca una carta Bandido o un Aliado de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Bandido Medieval");
  const ataque = poner(e, 0, "castillo", "Ataque Bandido");
  const v = poner(e, 0, "castillo", "Valefor");
  const g = poner(e, 0, "castillo", "Sir Galahad");
  e = aplicar(e, jugar(b));
  e = elegir(e, "Buscar una carta Bandido o un Aliado de coste 2 o menos");
  assert.equal(valores(e).includes(v), true);
  assert.equal(valores(e).includes(g), false);
  e = elegir(e, ataque);
  assert.equal(zonaDe(e, ataque), "mano");
});

test("Bandido Medieval: al entrar puede convertir un Oro oponente en un Oro sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Bandido Medieval");
  const o = poner(e, 1, "reserva", "Onsen");
  e = aplicar(e, jugar(b));
  e = elegir(e, "Convertir un Oro oponente en un Oro sin habilidad");
  assert.equal(N.activa(e, o), false);
});

test("Bandido Medieval: una vez por turno un Aliado gana 1 de Fuerza permanentemente", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "Bandido Medieval");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(b, "Bandido Medieval"));
  e = elegir(e, "Un Aliado gana 1 de Fuerza");
  e = elegir(e, v);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(e.efectos.find((f) => f.uid === v).fin.mientras, true);
  assert.equal(puedeUsar(e, b), false);
});

test("Bandido Medieval: o tus Aliados Bandido ganan 1 de Fuerza permanentemente", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "Bandido Medieval");
  const n = poner(e, 0, "defensa", "Bandido Neira");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(b, "Bandido Medieval"));
  e = elegir(e, "Tus Aliados Bandido ganan 1 de Fuerza");
  assert.equal(N.fuerza(e, b), 3);
  assert.equal(N.fuerza(e, n), 4);
  assert.equal(N.fuerza(e, v), 3);
});

test("Bandido Neira: al hacer daño puede Desterrar hasta dos cartas de un Cementerio", () => {
  let e = mesa();
  const n = poner(e, 0, "defensa", "Bandido Neira");
  e = hastaDano(atacarCon(e, n));
  e = elegir(e, true);
  e = elegir(e, "Desterrar hasta dos cartas de un Cementerio");
  const [c1, c2] = e.jugadores[1].cementerio;
  e = elegir(e, c1);
  e = elegir(e, c2);
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[1].cementerio.length, 1);
});

test("Bandido Neira: con dos o más Bandido puede poner un Oro de un Cementerio como Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  const n = poner(e, 0, "defensa", "Bandido Neira");
  poner(e, 0, "defensa", "Bandido Salas");
  const o = poner(e, 1, "cementerio", "Onsen");
  e = hastaDano(atacarCon(e, n));
  e = elegir(e, true);
  e = elegir(e, "Poner un Oro de un Cementerio como Oro sin habilidad en tu Oro Pagado");
  e = elegir(e, o);
  assert.equal(N.ubicar(e, o).j, 0);
  assert.equal(N.carta(e, o).sinHabilidad, true);
  assert.equal(zonaDe(e, o), "pagado");
});

test("Bandido Salas: al entrar busca un Aliado en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Bandido Salas");
  const v = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, jugar(s));
  e = elegir(e, "Buscar un Aliado en tu Castillo");
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Bandido Salas: o intercambia el control de un Oro tuyo por un Oro oponente y los mueve al Oro Pagado", () => {
  let e = mesa();
  const [d] = oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Bandido Salas");
  const o = poner(e, 1, "reserva", "Onsen");
  e = aplicar(e, jugar(s));
  e = elegir(e, "Intercambiar el control de un Oro tuyo por un Oro oponente y moverlos al Oro Pagado");
  assert.equal(N.ubicar(e, d).j, 1);
  assert.equal(zonaDe(e, d), "pagado");
  assert.equal(N.ubicar(e, o).j, 0);
  assert.equal(zonaDe(e, o), "pagado");
});

test("Bandido Salas: si controlas dos o más Bandido, tus Bandido ganan 1 de Fuerza", () => {
  const e = mesa();
  const s = poner(e, 0, "defensa", "Bandido Salas");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, s), 3);
  const n = poner(e, 0, "defensa", "Bandido Neira");
  assert.equal(N.fuerza(e, s), 4);
  assert.equal(N.fuerza(e, n), 4);
  assert.equal(N.fuerza(e, v), 3);
});

test("Beleth: tiene Furia e Imbloqueable y tus demás Guerreros ganan 1 de Fuerza", () => {
  const e = mesa();
  const b = poner(e, 0, "defensa", "Beleth");
  const z = poner(e, 0, "defensa", "Berserker Z");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Berserker Z");
  assert.equal(N.tiene(e, b, "Furia"), true);
  assert.equal(N.tiene(e, b, "Imbloqueable"), true);
  assert.equal(N.fuerza(e, b), 3);
  assert.equal(N.fuerza(e, z), 4);
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.fuerza(e, r), 3);
});

test("Beleth: al hacer daño se Baraja para buscar dos Aliados de coste 1 que no sean Beleth, jugar uno gratis y poner el otro en tu mano", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "Beleth");
  const otro = poner(e, 0, "castillo", "Beleth");
  const f = poner(e, 0, "castillo", "Capitan Flint");
  const z = poner(e, 0, "castillo", "Berserker Z");
  e = hastaDano(atacarCon(e, b));
  e = elegir(e, true);
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(valores(e).includes(otro), false);
  assert.equal(valores(e).includes(b), false);
  e = elegir(e, f);
  e = elegir(e, z);
  assert.equal(zonaDe(e, f), "defensa");
  assert.equal(zonaDe(e, z), "mano");
});

test("Berserker Z: al entrar pone la última carta de tu Castillo en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Berserker Z");
  const v = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, jugar(b));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(N.tiene(e, b, "Furia"), true);
});

test("Berserker Z: cuando tu oponente pone cartas en su mano por efectos, Bota esa cantidad", { todo: "evento: un jugador pone cartas en su mano por efectos" }, () => {});

test("Breaker: al entrar muestra dos Aliados o Armas de coste 2 o menos, juega uno sin pagar y Baraja el otro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const b = poner(e, 0, "mano", "Breaker");
  const v = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 0, "cementerio", "Pedrenyal");
  e = aplicar(e, jugar(b));
  e = elegir(e, true);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(zonaDe(e, p), "castillo");
  assert.equal(N.tiene(e, b, "Furia"), true);
});

test("Breaker: sin dos cartas que mostrar no ofrece la habilidad", () => {
  let e = mesa();
  oros(e, 0, 3);
  const b = poner(e, 0, "mano", "Breaker");
  poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(b));
  assert.equal(e.pendiente, null);
});

test("Cain: tiene Furia e Imbloqueable y al entrar puede Robar dos cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Cain");
  e = aplicar(e, jugar(c));
  e = elegir(e, "Robar dos cartas");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.tiene(e, c, "Furia"), true);
  assert.equal(N.tiene(e, c, "Imbloqueable"), true);
});

test("Cain: al entrar puede Barajar hasta una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Cain");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, jugar(c));
  e = elegir(e, "Barajar hasta una carta de coste 2 o menos");
  e = elegir(e, rv);
  assert.equal(zonaDe(e, rv), "castillo");
});

test("Cain: al hacer daño de combate se Baraja para buscar dos Aliados de coste 2 o menos, jugar uno gratis y poner el otro en tu mano", () => {
  let e = mesa();
  const c = poner(e, 0, "defensa", "Cain");
  const w = poner(e, 0, "castillo", "Watson");
  const f = poner(e, 0, "castillo", "Capitan Flint");
  e = hastaDano(atacarCon(e, c));
  e = elegir(e, true);
  assert.equal(zonaDe(e, c), "castillo");
  e = elegir(e, w);
  e = elegir(e, f);
  assert.equal(zonaDe(e, w), "defensa");
  assert.equal(zonaDe(e, f), "mano");
});

test("Calfucura: al entrar busca dos Aliados de distinto coste en tu Castillo y/o Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Calfucura");
  const v = poner(e, 0, "castillo", "Valefor");
  const w = poner(e, 0, "castillo", "Watson");
  const f = poner(e, 0, "cementerio", "Capitan Flint");
  e = aplicar(e, jugar(c));
  e = elegir(e, true);
  e = elegir(e, v);
  assert.equal(valores(e).includes(f), false);
  e = elegir(e, w);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, w), "mano");
  assert.equal(N.tiene(e, c, "Furia"), true);
});

test("Calfucura: una vez por turno genera un Oro para jugar Aliados o Armas", () => {
  let e = mesa();
  const c = poner(e, 0, "defensa", "Calfucura");
  e = aplicar(e, habilidad(c, "Calfucura"));
  assert.equal(disponibles(e, 0, "Aliado"), 1);
  assert.equal(disponibles(e, 0, "Arma"), 1);
  assert.equal(disponibles(e, 0, "Talismán"), 0);
  assert.equal(puedeUsar(e, c), false);
});

test("Canaan: se considera Bandido", () => {
  const e = mesa();
  const c = poner(e, 0, "defensa", "Canaan");
  poner(e, 0, "defensa", "Bandido Salas");
  assert.equal(N.fuerza(e, c), 4);
  assert.equal(N.tiene(e, c, "Furia"), true);
});

test("Canaan: al entrar un Oro que controles gana las habilidades de un Oro oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "reserva", "Agua Sagrada");
  const c = poner(e, 0, "mano", "Canaan");
  poner(e, 1, "reserva", "Onsen");
  e = aplicar(e, jugar(c));
  e = elegir(e, true);
  e = elegir(e, "Un Oro que controles gana las habilidades de un Oro oponente");
  e = elegir(e, a);
  assert.equal(N.habilidades(e, a).some((d) => d.nombre === "Onsen"), true);
});

test("Canaan: al entrar puede buscar un Arma en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Canaan");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  e = aplicar(e, jugar(c));
  e = elegir(e, true);
  e = elegir(e, "Buscar un Arma en tu Castillo");
  e = elegir(e, p);
  assert.equal(zonaDe(e, p), "mano");
});

test("Canaan: tus Bandido no pueden ser cancelados", { todo: "protección: las habilidades de tus Aliados de cierta clase no pueden ser canceladas" }, () => {});

test("Capitan Flint: tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const f = poner(e, 0, "defensa", "Capitan Flint");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, f), 3);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, r), 3);
});

test("Capitan Flint: al ser mostrado por la habilidad de un Aliado Guerrero puede Desterrar dos cartas de un Cementerio", { todo: "evento: una carta es mostrada por la habilidad de otra carta" }, () => {});

test("Cochero de Sombras: al atacar elige un Aliado oponente que debe bloquearlo", () => {
  let e = mesa();
  const c = poner(e, 0, "defensa", "Cochero de Sombras");
  const rv = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  e = atacarCon(e, c);
  e = elegir(e, rv);
  e = aplicar(e, { tipo: "finAtaque" });
  assert.deepEqual(accionesLegales(e), [{ tipo: "bloquear", uid: rv, atacante: c }]);
  assert.equal(N.tiene(e, c, "Furia"), true);
});

test("Cochero de Sombras: al hacer daño se Baraja para Destruir una carta de coste 2 o menos", () => {
  let e = mesa();
  const c = poner(e, 0, "defensa", "Cochero de Sombras");
  const rj = poner(e, 1, "apoyo", "Isla de Poveglia");
  e = hastaDano(atacarCon(e, c));
  e = elegir(e, true);
  assert.equal(zonaDe(e, c), "castillo");
  e = elegir(e, "Destruir una carta de coste 2 o menos");
  assert.equal(zonaDe(e, rj), "cementerio");
  e = elegir(e, false);
});

test("Cochero de Sombras: o juega un Aliado o Arma de coste 1 de tu mano o Cementerio sin pagar su coste", () => {
  let e = mesa();
  const c = poner(e, 0, "defensa", "Cochero de Sombras");
  const f = poner(e, 0, "cementerio", "Capitan Flint");
  e = hastaDano(atacarCon(e, c));
  e = elegir(e, true);
  e = elegir(e, "Jugar un Aliado o Arma de coste 1 de tu mano o Cementerio sin pagar su coste");
  assert.equal(zonaDe(e, f), "defensa");
});

test("Corsario Negro: al entrar muestra cartas del Castillo hasta dos Aliados Guerrero y los pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Corsario Negro");
  const v = poner(e, 0, "castillo", "Valefor");
  const z = poner(e, 0, "castillo", "Berserker Z");
  const f = poner(e, 0, "castillo", "Capitan Flint");
  alTope(e, 0, f);
  alTope(e, 0, e.jugadores[0].castillo[5]);
  alTope(e, 0, z);
  alTope(e, 0, v);
  e = aplicar(e, jugar(c));
  e = elegir(e, true);
  assert.equal(zonaDe(e, z), "mano");
  assert.equal(zonaDe(e, f), "mano");
  assert.equal(zonaDe(e, v), "castillo");
});

test("Corsario Negro: en tu Vigilia puede Destruirse para que tu oponente Bote tantas cartas como Oros controle", () => {
  let e = mesa();
  const c = poner(e, 0, "defensa", "Corsario Negro");
  oros(e, 1, 3);
  e = aplicar(e, habilidad(c, "Corsario Negro"));
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Cush: se considera Bandido", () => {
  const e = mesa();
  const c = poner(e, 0, "defensa", "Cush");
  poner(e, 0, "defensa", "Bandido Salas");
  assert.equal(N.fuerza(e, c), 4);
});

test("Cush: cuando un Aliado entra en juego puede subir de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "cementerio", "Cush");
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  e = elegir(e, true);
  assert.equal(zonaDe(e, c), "mano");
});

test("Cush: una vez en tu turno un Aliado Bandido gana Imbloqueable y hace daño al Destierro", () => {
  let e = mesa();
  const c = poner(e, 0, "defensa", "Cush");
  const n = poner(e, 0, "defensa", "Bandido Neira");
  poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(c, "Cush"));
  assert.equal(valores(e).length, 2);
  e = elegir(e, n);
  assert.equal(N.tiene(e, n, "Imbloqueable"), true);
  assert.equal(N.tiene(e, n, "DanoAlDestierro"), true);
  assert.equal(puedeUsar(e, c), false);
});

test("Dhampir: al entrar, mostrando un Aliado de tu mano, Destierra hasta una carta de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const d = poner(e, 0, "mano", "Dhampir");
  poner(e, 0, "mano", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, jugar(d));
  e = elegir(e, "Desterrar hasta una carta de coste 3 o menos");
  e = elegir(e, rv);
  assert.equal(zonaDe(e, rv), "destierro");
  assert.equal(N.tiene(e, d, "Furia"), true);
});

test("Dhampir: sin Aliados en tu mano su habilidad no hace nada", () => {
  let e = mesa();
  oros(e, 0, 2);
  const d = poner(e, 0, "mano", "Dhampir");
  e = aplicar(e, jugar(d));
  assert.equal(e.pendiente, null);
});

test("Dhampir: al salir del juego puede Robar dos cartas", () => {
  let e = mesa();
  const d = poner(e, 0, "defensa", "Dhampir");
  poner(e, 0, "mano", "Valefor");
  N.mover(e, d, "cementerio");
  resolver(e);
  e = elegir(e, "Robar dos cartas");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Dhampir: cuando tu oponente juega una carta Bota dos, o las Destierra si es tu turno, hasta tres veces por turno", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Dhampir");
  const x = poner(e, 1, "mano", "Llamar a la Manada");
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Talismán" });
  assert.equal(e.jugadores[1].destierro.length, 2);
  e.activo = 1;
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Talismán" });
  assert.equal(e.jugadores[1].cementerio.length, 2);
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Talismán" });
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Talismán" });
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Dhampir Feroce: al entrar Roba dos cartas y tu oponente Bota tres", () => {
  let e = mesa();
  oros(e, 0, 2);
  const d = poner(e, 0, "mano", "Dhampir Feroce");
  e = aplicar(e, jugar(d));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(N.tiene(e, d, "Furia"), true);
});

test("Dhampir Feroce: al salir del juego también Roba dos y el oponente Bota tres", () => {
  const e = mesa();
  const d = poner(e, 0, "defensa", "Dhampir Feroce");
  N.mover(e, d, "cementerio");
  resolver(e);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Dhampir Feroce: al atacar hasta dos Aliados no pueden ser afectados por efectos oponentes durante la Batalla", { todo: "efecto: Aliados protegidos de efectos oponentes durante la Batalla" }, () => {});
