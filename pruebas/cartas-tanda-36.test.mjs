import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const usable = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);

function alTope(e, j, nombre, i = 0) {
  const u = poner(e, j, "castillo", nombre);
  const c = e.jugadores[j].castillo;
  c.pop();
  c.splice(i, 0, u);
  return u;
}

function combatir(e, uid) {
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

test("El Bandido Egipcio: tiene Furia y al entrar busca dos Oros en el Castillo oponente y los pone en su Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "El Bandido Egipcio");
  e = sinRespuesta(aplicar(e, jugar(b)));
  e = elegir(e, nombreDe(e, "Drácula"));
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(N.tiene(e, b, "Furia"), true);
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("El Bandido Egipcio: también busca dos Oros oponentes cuando ataca", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "El Bandido Egipcio");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: b }, nombreDe(e, "Drácula"), nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[1].cementerio.length, 2);
});

test("El Bandido Egipcio: los Oros no disparan sus habilidades al entrar en juego", { todo: "continua: los Oros no disparan sus habilidades al entrar en juego" }, () => {});

test("El Cazador: al entrar hasta dos Aliados de coste 2 o menos pierden su habilidad, ganan Indestructible y tienen Fuerza 0", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "El Cazador");
  const guardia = poner(e, 1, "defensa", "Guardia Real");
  const moroi = poner(e, 1, "defensa", "Moroi");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === moroi), false);
  e = elegir(e, guardia);
  e = elegir(e, null);
  assert.equal(N.activa(e, guardia), false);
  assert.equal(N.tiene(e, guardia, "Indestructible"), true);
  assert.equal(N.fuerza(e, guardia), 0);
  assert.equal(N.fuerza(e, c), 3);
});

test("El Cazador: si el oponente atacó con tres o más Aliados este turno no paga su coste", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "El Cazador");
  assert.equal(costeDe(e, 0, c).pagar, 1);
  e.activo = 1;
  e.jugadores[1].declarados = ["a", "b"];
  assert.equal(costeDe(e, 0, c).pagar, 1);
  e.jugadores[1].declarados = ["a", "b", "c"];
  assert.equal(costeDe(e, 0, c).pagar, 0);
});

test("El Cazador: puede jugarse en la Guerra de Talismanes", { todo: "momento: jugar un Aliado en la Guerra de Talismanes" }, () => {});

test("Frederick Ransom: en tu Vigilia pone la primera carta de un Castillo como Aliado de Fuerza 2 sin habilidad que puede atacar", () => {
  let e = mesa();
  const f = poner(e, 0, "defensa", "Frederick Ransom");
  poner(e, 1, "defensa", "Valefor");
  const [t] = e.jugadores[1].castillo;
  e = hacer(e, habilidad(f, "Frederick Ransom"), "Castillo oponente");
  assert.equal(zonaDe(e, t), "defensa");
  assert.equal(N.ubicar(e, t).j, 0);
  assert.equal(N.carta(e, t).sinHabilidad, true);
  assert.equal(N.fuerza(e, t), 2);
  assert.equal(usable(e, f), false);
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === t));
});

test("Frederick Ransom: no se puede usar si controlas más Aliados que tu oponente", () => {
  const e = mesa();
  const f = poner(e, 0, "defensa", "Frederick Ransom");
  assert.equal(usable(e, f), false);
});

test("Frederick Ransom: tiene Exhumar y se juega desde el Cementerio", () => {
  const e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "cementerio", "Frederick Ransom");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === f && a.desde === "cementerio"));
});

test("Gog: al entrar hasta dos Aliados ganan 2 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "mano", "Gog");
  const v = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(g)));
  e = elegir(e, g);
  e = elegir(e, v);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(N.fuerza(e, g), 6);
  assert.equal(N.fuerza(e, v), 5);
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, v), 5);
});

test("Gog: al hacer daño puedes Barajarlo para agrupar un Oro y buscar un Aliado y un Arma", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gog");
  const pagado = poner(e, 0, "pagado", "Drácula");
  const v = poner(e, 0, "castillo", "Valefor");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  e = combatir(e, g);
  e = elegir(e, true);
  e = elegir(e, nombreDe(e, "Valefor"));
  e = elegir(e, nombreDe(e, "Pedrenyal"));
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, pagado), "reserva");
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, arma), "mano");
});

test("Gurzil: si atacaste en tu turno anterior se juega pagando dos Oros", () => {
  const e = mesa();
  const g = poner(e, 0, "mano", "Gurzil");
  assert.equal(costeDe(e, 0, g).pagar, 3);
  e.jugadores[0].atacoTurnoAnterior = true;
  assert.equal(costeDe(e, 0, g).pagar, 2);
});

test("Gurzil: cuando atacas el oponente Destierra del tope tanta Fuerza como dos de sus Aliados y Robas una carta", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gurzil");
  const v = poner(e, 1, "defensa", "Valefor");
  const i = poner(e, 1, "defensa", "Ileana");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: g }, v, i);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(e.jugadores[1].destierro.length, 6);
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Hattori Hanzo: tiene Furia e Imbloqueable; una vez por turno un Aliado gana 2 de Fuerza y hace daño al Destierro", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Hattori Hanzo");
  assert.equal(N.tiene(e, h, "Furia"), true);
  assert.equal(N.tiene(e, h, "Imbloqueable"), true);
  e = aplicar(e, habilidad(h, "Hattori Hanzo"));
  assert.equal(N.fuerza(e, h), 6);
  assert.equal(N.tiene(e, h, "DanoAlDestierro"), true);
  assert.equal(usable(e, h), false);
});

test("Hattori Hanzo: cuando fuera a ser afectado puede subir a la mano y mostrar hasta un Aliado de coste 2 para ponerlo en juego", { todo: "respuesta: al ir a ser afectada, subir esta carta a la mano con un efecto de reemplazo" }, () => {});

test("Hijo de la Bestia: tiene Furia", () => {
  const e = mesa();
  const h = poner(e, 0, "defensa", "Hijo de la Bestia");
  assert.equal(N.tiene(e, h, "Furia"), true);
});

test("Hijo de la Bestia: Desterrarlo en juego o de la mano pagando un Oro previene que un Aliado sea afectado", { todo: "respuesta: Desterrar esta carta (en juego o desde la mano pagando) para prevenir que un Aliado sea afectado por un efecto oponente" }, () => {});

test("Ilunga Mbili: es Indestructible y al entrar juega gratis el primer Aliado Guerrero de coste 2 o menos del Castillo; el oponente Bota dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const il = poner(e, 0, "mano", "Ilunga Mbili");
  const ism = alTope(e, 0, "Ismael");
  const val = alTope(e, 0, "Valefor");
  e = sinRespuesta(aplicar(e, jugar(il)));
  assert.equal(N.tiene(e, il, "Indestructible"), true);
  assert.equal(zonaDe(e, ism), "defensa");
  assert.equal(zonaDe(e, val), "castillo");
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ismael: al atacar elige un Aliado oponente que debe bloquearlo y pierde 1 de Fuerza y su habilidad", () => {
  let e = mesa();
  const ism = poner(e, 0, "defensa", "Ismael");
  poner(e, 1, "defensa", "Valefor");
  const il = poner(e, 1, "defensa", "Ileana");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: ism }, true, il);
  assert.equal(N.fuerza(e, il), 2);
  assert.equal(N.activa(e, il), false);
  e = aplicar(e, { tipo: "finAtaque" });
  assert.deepEqual(accionesLegales(e), [{ tipo: "bloquear", uid: il, atacante: ism }]);
});

test("Ismael: puedes no elegir un bloqueador", () => {
  let e = mesa();
  const ism = poner(e, 0, "defensa", "Ismael");
  const v = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: ism }, false);
  e = aplicar(e, { tipo: "finAtaque" });
  assert.equal(N.fuerza(e, v), 3);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "finBloqueo"));
});

test("Jane Eyre: cuando el oponente juega un Talismán gana 2 de Fuerza permanentemente, hasta tres veces por turno", () => {
  let e = mesa();
  const jane = poner(e, 0, "defensa", "Jane Eyre");
  oros(e, 1, 4);
  const ts = [1, 2, 3, 4].map(() => poner(e, 1, "mano", "Llamar a la Manada"));
  e.fase = "talismanes";
  e.pases = 0;
  for (const t of ts) {
    e.prioridad = 1;
    e = sinRespuesta(aplicar(e, jugar(t)));
  }
  assert.equal(N.tiene(e, jane, "Furia"), true);
  assert.equal(N.fuerza(e, jane), 7);
});

test("Jane Eyre: Destruir otro Aliado propio previene que salga del juego", { todo: "reemplazo: pagar un coste (Destruir otro Aliado propio) para prevenir que esta carta salga del juego" }, () => {});

test("Karl Red: mostrando un Aliado el oponente Bota tres y, si Botó un Oro, pones un Oro de un Cementerio en tu Oro Pagado", () => {
  let e = mesa();
  const k = poner(e, 0, "defensa", "Karl Red");
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(k, "Karl Red"));
  assert.equal(e.jugadores[1].cementerio.length, 3);
  e = elegir(e, true);
  const oro = e.jugadores[1].cementerio[0];
  e = elegir(e, oro);
  assert.equal(zonaDe(e, oro), "pagado");
  assert.equal(N.ubicar(e, oro).j, 0);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(usable(e, k), false);
});

test("Karl Red: si no Botó Oros ni Aliados no ofrece el Oro", () => {
  let e = mesa();
  const k = poner(e, 0, "defensa", "Karl Red");
  poner(e, 0, "mano", "Valefor");
  for (let i = 0; i < 3; i++) alTope(e, 1, "Llamar a la Manada");
  e = aplicar(e, habilidad(k, "Karl Red"));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Karl Red: sin Aliados en la mano no se puede usar", () => {
  const e = mesa();
  const k = poner(e, 0, "defensa", "Karl Red");
  assert.equal(usable(e, k), false);
});

test("Kuchiku Kan: al entrar busca un Aliado y tus Aliados ganan 1 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const k = poner(e, 0, "mano", "Kuchiku Kan");
  const otro = poner(e, 0, "defensa", "Guardia Real");
  const v = poner(e, 0, "castillo", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(k)));
  e = elegir(e, nombreDe(e, "Valefor"));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(N.fuerza(e, k), 4);
  assert.equal(N.fuerza(e, otro), 4);
});

test("Kuchiku Kan: Descartando una carta, una carta pierde su habilidad y no ataca ni bloquea mientras siga en juego", () => {
  let e = mesa();
  const k = poner(e, 0, "defensa", "Kuchiku Kan");
  const d = poner(e, 0, "mano", "Drácula");
  const il = poner(e, 1, "defensa", "Ileana");
  e = hacer(e, habilidad(k, "Kuchiku Kan"), il);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(N.activa(e, il), false);
  assert.ok(e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === il));
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), k);
  assert.equal(zonaDe(e, k), "cementerio");
  assert.equal(N.activa(e, il), true);
  assert.equal(e.efectos.some((f) => f.uid === il), false);
});

test("Kuchiku el Cazador: una vez en tu turno busca un Aliado y lo juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const k = poner(e, 0, "defensa", "Kuchiku el Cazador");
  const ism = poner(e, 0, "castillo", "Ismael");
  e = hacer(e, habilidad(k, "Kuchiku el Cazador", 0), nombreDe(e, "Ismael"));
  assert.equal(zonaDe(e, ism), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(usable(e, k, 0), false);
});

test("Kuchiku el Cazador: Destruye hasta una carta de coste 3 o menos y el oponente Bota tantas cartas como su Fuerza", () => {
  let e = mesa();
  const k = poner(e, 0, "defensa", "Kuchiku el Cazador");
  const g = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, habilidad(k, "Kuchiku el Cazador", 1), g);
  assert.equal(N.tiene(e, k, "Furia"), true);
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 26);
  assert.equal(e.jugadores[1].cementerio.length, 5);
});

test("La Torre: al entrar juega gratis un Aliado de coste 2 o menos y gana 1 de Fuerza por cada otro Aliado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const t = poner(e, 0, "mano", "La Torre");
  const ism = poner(e, 0, "castillo", "Ismael");
  e = sinRespuesta(aplicar(e, jugar(t)));
  e = elegir(e, nombreDe(e, "Ismael"));
  assert.equal(zonaDe(e, ism), "defensa");
  assert.equal(N.tiene(e, t, "Furia"), true);
  assert.equal(N.fuerza(e, t), 4);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, t), 5);
});

test("La Torre: solo una La Torre por turno", () => {
  let e = mesa();
  oros(e, 0, 5);
  const t1 = poner(e, 0, "mano", "La Torre");
  const t2 = poner(e, 0, "mano", "La Torre");
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(t1)));
  if (e.pendiente) e = elegir(e, null);
  const legales = accionesLegales(e);
  assert.equal(legales.some((a) => a.tipo === "jugar" && a.uid === t2), false);
  assert.ok(legales.some((a) => a.tipo === "jugar" && a.uid === v));
});

test("Long John Silver: mostrando un Aliado, el oponente pone en su Cementerio cartas del tope hasta mostrar dos Aliados", () => {
  let e = mesa();
  const l = poner(e, 0, "defensa", "Long John Silver");
  poner(e, 0, "mano", "Valefor");
  const a1 = alTope(e, 1, "Valefor", 1);
  const a2 = alTope(e, 1, "Valefor", 3);
  e = aplicar(e, habilidad(l, "Long John Silver"));
  assert.equal(zonaDe(e, a1), "cementerio");
  assert.equal(zonaDe(e, a2), "cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 28);
  assert.equal(usable(e, l), false);
});

test("Long John Silver: cuando es mostrado por la habilidad de un Aliado Guerrero el oponente Bota dos", { todo: "disparo: al ser mostrada por la habilidad de un Aliado de cierta Raza" }, () => {});

test("Los Marcados: al entrar puede subir un Aliado y un Arma de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Los Marcados");
  const v = poner(e, 0, "cementerio", "Valefor");
  const a = poner(e, 0, "cementerio", "Pedrenyal");
  const o = poner(e, 0, "cementerio", "Drácula");
  e = sinRespuesta(aplicar(e, jugar(m)));
  e = hacer(e, { tipo: "elegir", i: 0 }, v, a);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, o), "cementerio");
});

test("Los Marcados: se puede Desterrar en juego o desde el Cementerio", () => {
  let e = mesa();
  const m1 = poner(e, 0, "defensa", "Los Marcados");
  const m2 = poner(e, 0, "cementerio", "Los Marcados");
  e = aplicar(e, habilidad(m1, "Los Marcados", 0));
  e = aplicar(e, habilidad(m2, "Los Marcados", 1));
  assert.equal(zonaDe(e, m1), "destierro");
  assert.equal(zonaDe(e, m2), "destierro");
});

test("Los Marcados: el oponente no puede declarar más de dos Aliados bloqueadores este turno", { todo: "efecto: el oponente no puede declarar más de N Aliados bloqueadores este turno" }, () => {});

test("Mariano Osorio: al entrar pone dos cartas del tope en tu mano y, si mostró un Aliado, un Oro queda sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Mariano Osorio");
  const onsen = poner(e, 1, "reserva", "Onsen");
  const v = alTope(e, 0, "Valefor");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(N.tiene(e, m, "Furia"), true);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.activa(e, onsen), false);
});

test("Mariano Osorio: si no mostró Aliados ni Armas los Oros conservan su habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Mariano Osorio");
  const onsen = poner(e, 1, "reserva", "Onsen");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.activa(e, onsen), true);
});

test("Mariano Osorio: en tu Fase Final Destierra hasta tres cartas del Cementerio oponente", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Mariano Osorio");
  const c = [1, 2, 3, 4].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = hacer(e, { tipo: "elegir", i: 0 }, c[1], c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro", "cementerio"]);
});

test("Mariano Osorio: si lo usaste en tu Vigilia no se repite en la Fase Final", () => {
  let e = mesa();
  e.activo = 1;
  poner(e, 0, "defensa", "Mariano Osorio");
  const c = [1, 2, 3, 4, 5].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 0);
  e = hacer(e, { tipo: "elegir", i: 0 }, c[0], c[1], c[2]);
  assert.equal(e.jugadores[1].destierro.length, 3);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[1].destierro.length, 3);
});

test("Mr Smee: al entrar el oponente Bota tantas cartas como Aliados controles y Destierras dos de su Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Mr Smee");
  poner(e, 0, "defensa", "Valefor");
  const previa = poner(e, 1, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(s)));
  assert.equal(e.jugadores[1].castillo.length, 28);
  e = elegir(e, previa);
  e = elegir(e, (v) => v !== null && v !== previa);
  assert.equal(zonaDe(e, previa), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[1].cementerio.length, 1);
});

test("Mr Smee: cuando ataca una carta de coste 2 o menos pierde su habilidad por el turno", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Mr Smee");
  const il = poner(e, 1, "defensa", "Ileana");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: s }, il);
  assert.equal(N.tiene(e, s, "Furia"), true);
  assert.equal(N.activa(e, il), false);
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, il), true);
});

test("Nimrod: al hacer daño puede Barajarse para poner una carta de un Cementerio como Aliado de Fuerza 3 que encarece los Talismanes", () => {
  let e = mesa();
  const n = poner(e, 0, "defensa", "Nimrod");
  const x = poner(e, 1, "cementerio", "Valefor");
  const manada = poner(e, 1, "mano", "Llamar a la Manada");
  assert.equal(N.tiene(e, n, "Furia"), true);
  assert.equal(N.tiene(e, n, "Imbloqueable"), true);
  e = combatir(e, n);
  e = elegir(e, true);
  e = elegir(e, x);
  assert.equal(zonaDe(e, n), "castillo");
  assert.equal(zonaDe(e, x), "defensa");
  assert.equal(N.ubicar(e, x).j, 0);
  assert.equal(N.fuerza(e, x), 3);
  assert.equal(costeDe(e, 1, manada).pagar, 2);
});

test("Orikalon: al entrar puede subir un Aliado y un Oro de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const o = poner(e, 0, "mano", "Orikalon");
  const v = poner(e, 0, "cementerio", "Valefor");
  const d = poner(e, 0, "cementerio", "Drácula");
  e = sinRespuesta(aplicar(e, jugar(o)));
  e = hacer(e, { tipo: "elegir", i: 0 }, v, d);
  assert.equal(N.tiene(e, o, "Furia"), true);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, d), "mano");
});

test("Orikalon: cuando sale del juego se convierte en un Arma que da 2 de Fuerza e Imbloqueable a su portador", () => {
  let e = mesa();
  oros(e, 0, 1);
  const o = poner(e, 0, "defensa", "Orikalon");
  const v = poner(e, 0, "defensa", "Valefor");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), o);
  assert.deepEqual(e.armas[v], [o]);
  assert.equal(N.carta(e, o).tipo, "Arma");
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
});

test("Pablo Pincheira: tiene Furia y al entrar Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Pablo Pincheira");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Pablo Pincheira: Desterrándolo de la mano juegas un Aliado pagando su coste; un Pincheira no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Pablo Pincheira");
  const r = poner(e, 0, "mano", "Rosa Pincheira");
  e = aplicar(e, habilidad(p, "Pablo Pincheira"));
  assert.equal(zonaDe(e, p), "destierro");
  assert.equal(zonaDe(e, r), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Pablo Pincheira: el Aliado que no es Pincheira abre la ventana de respuesta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Pablo Pincheira");
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(p, "Pablo Pincheira"));
  assert.equal(e.pila.length, 1);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "noResponder"));
  e = sinRespuesta(e);
  assert.equal(zonaDe(e, v), "defensa");
});

test("Pablo Pincheira: sin Oros para pagar el Aliado no se puede usar", () => {
  const e = mesa();
  const p = poner(e, 0, "mano", "Pablo Pincheira");
  poner(e, 0, "mano", "Valefor");
  assert.equal(usable(e, p), false);
});

test("Pablo Pincheira: las habilidades del Pincheira no pueden ser canceladas este turno", { todo: "efecto: las habilidades de una carta no pueden ser canceladas durante un período" }, () => {});

test("Príncipe Orion: al entrar Roba una carta o sube un Aliado de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const o = poner(e, 0, "mano", "Príncipe Orion");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(o)));
  e = elegir(e, "Subir un Aliado de tu Cementerio a tu mano");
  assert.equal(N.tiene(e, o, "Furia"), true);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Príncipe Orion: también puede Robar una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const o = poner(e, 0, "mano", "Príncipe Orion");
  e = sinRespuesta(aplicar(e, jugar(o)));
  e = elegir(e, "Robar una carta");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Príncipe Orion: Desterrándolo Anula un Talismán si controlas Aliados atacantes o con Armas", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Príncipe Ur Nammu: en tu Vigilia muestra cinco cartas y juega un Aliado de ahí reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const u = poner(e, 0, "defensa", "Príncipe Ur Nammu");
  const ism = alTope(e, 0, "Ismael", 3);
  e = hacer(e, habilidad(u, "Príncipe Ur Nammu", 0), ism);
  assert.equal(zonaDe(e, ism), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].castillo.length, 30);
  assert.equal(usable(e, u, 0), false);
});

test("Príncipe Ur Nammu: no puede jugar Aliados más allá de las cinco primeras cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const u = poner(e, 0, "defensa", "Príncipe Ur Nammu");
  alTope(e, 0, "Ismael", 5);
  e = aplicar(e, habilidad(u, "Príncipe Ur Nammu", 0));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("Príncipe Ur Nammu: en tu Vigilia el oponente Bota tantas cartas como Aliados controles", () => {
  let e = mesa();
  const u = poner(e, 0, "defensa", "Príncipe Ur Nammu");
  poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(u, "Príncipe Ur Nammu", 1));
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(usable(e, u, 1), false);
});

test("Rosa Pincheira: al entrar busca un Pincheira en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const r = poner(e, 0, "mano", "Rosa Pincheira");
  const p = poner(e, 0, "castillo", "Pablo Pincheira");
  e = sinRespuesta(aplicar(e, jugar(r)));
  assert.ok(e.pendiente.opciones.every((o) => o.valor === null || N.carta(e, o.valor).nombre.includes("Pincheira")));
  e = elegir(e, p);
  assert.equal(zonaDe(e, p), "mano");
});

test("Rosa Pincheira: Desterrando una carta de tu Cementerio el oponente Bota cuatro cartas", () => {
  let e = mesa();
  const r = poner(e, 0, "defensa", "Rosa Pincheira");
  const c = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(r, "Rosa Pincheira"));
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 4);
  assert.equal(usable(e, r), false);
});

test("Rysei: una vez por turno muestra cartas hasta un Aliado de Fuerza 4 o más y lo pone en tu mano", () => {
  let e = mesa();
  const r = poner(e, 0, "defensa", "Rysei");
  const ism = alTope(e, 0, "Ismael");
  const v = alTope(e, 0, "Valefor");
  e = aplicar(e, habilidad(r, "Rysei"));
  assert.equal(zonaDe(e, ism), "mano");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(usable(e, r), false);
});

test("Rysei: tus demás Aliados con Furia ganan 1 de Fuerza", () => {
  const e = mesa();
  const r = poner(e, 0, "defensa", "Rysei");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Guardia Real");
  const ajeno = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, r), 4);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.fuerza(e, ajeno), 3);
});

test("Rysei: tus demás Aliados con Furia no son afectados por Talismanes ni Tótems", { todo: "protección: no puede ser afectado por Talismanes ni Tótems" }, () => {});
