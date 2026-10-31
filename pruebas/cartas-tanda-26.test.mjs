import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { entrarEnJuego, resolver, disponibles } from "../web/duelo/efectos.js";

const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const cualquiera = (v) => v !== null;

function aliado(e, j, { fuerza = 3, coste = 1, zona = "defensa" } = {}) {
  const u = poner(e, j, zona, "Drácula");
  e.conv[u] = { tipo: "Aliado", fuerza, coste, sinHabilidad: true };
  return u;
}

function armar(e, j, nombre, portador) {
  return poner(e, j, "arma", nombre, { portador });
}

function jugarArma(e, nombre, portador) {
  const u = poner(e, 0, "mano", nombre);
  oros(e, 0, N.carta(e, u).coste);
  e = aplicar(e, { tipo: "jugar", uid: u, portador });
  return [sinRespuesta(e), u];
}

function combate(e, atacante) {
  for (const a of [{ tipo: "batalla" }, { tipo: "atacar", uid: atacante }, { tipo: "finAtaque" }, { tipo: "finBloqueo" }, { tipo: "pasar" }, { tipo: "pasar" }]) e = aplicar(e, a);
  return e;
}

function jugableDesdeCementerio(e, uid) {
  return accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid && a.desde === "cementerio");
}

function botarConCartaEn(e, nombre, pos) {
  const u = poner(e, 0, "castillo", nombre);
  const c = e.jugadores[0].castillo;
  c.pop();
  c.splice(pos, 0, u);
  return u;
}

const opcionesDe = (e) => e.pendiente.opciones.map((o) => o.valor);

test("Guia del Guardián: el portador gana 2 de Fuerza; al entrar Roba, sube un Aliado de tu Cementerio y Destierra una carta de un Cementerio", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const sir = poner(e, 0, "cementerio", "Sir Peter Hawkins");
  const v = poner(e, 1, "cementerio", "Valefor");
  let g;
  [e, g] = jugarArma(e, "Guia del Guardián", p);
  e = elegir(e, sir);
  e = elegir(e, v);
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(zonaDe(e, sir), "mano");
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.deepEqual(e.armas[p], [g]);
});

test("Gungnir: al entrar puedes buscar un Oro en tu Castillo para tu Oro Pagado", () => {
  let e = mesa();
  const p = aliado(e, 0);
  [e] = jugarArma(e, "Gungnir", p);
  e = elegir(e, true);
  e = elegir(e, cualquiera);
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Gungnir: en tu Vigilia Baraja hasta una carta oponente que no sea Oro y hasta cuatro cartas de los Cementerios", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const g = armar(e, 0, "Gungnir", p);
  const r = aliado(e, 1);
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, habilidad(g, "Gungnir"));
  e = elegir(e, r);
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(accionesLegales(e).some((x) => x.tipo === "habilidad" && x.uid === g), false);
});

test("Hacha Solar: el portador gana 3 de Fuerza e Indestructible y en tu Vigilia busca un Oro para tu Oro Pagado", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const h = armar(e, 0, "Hacha Solar", p);
  assert.equal(N.fuerza(e, p), 6);
  assert.equal(N.tiene(e, p, "Indestructible"), true);
  e = aplicar(e, habilidad(h, "Hacha Solar"));
  e = elegir(e, cualquiera);
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Hacha de Seth: en tu Vigilia Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const h = armar(e, 0, "Hacha de Seth", p);
  const r = aliado(e, 1, { coste: 2 });
  const caro = aliado(e, 1, { coste: 3 });
  assert.equal(N.fuerza(e, p), 5);
  e = aplicar(e, habilidad(h, "Hacha de Seth"));
  assert.equal(opcionesDe(e).includes(caro), false);
  e = elegir(e, r);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Hacha de Seth: busca dos cartas en cada Castillo, una al Cementerio y otra a la mano o al Destierro", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const h = armar(e, 0, "Hacha de Seth", p);
  const v0 = poner(e, 0, "castillo", "Valefor");
  const p0 = poner(e, 0, "castillo", "Pedrenyal");
  const v1 = poner(e, 1, "castillo", "Valefor");
  const p1 = poner(e, 1, "castillo", "Pedrenyal");
  e = aplicar(e, habilidad(h, "Hacha de Seth", 1));
  e = elegir(e, v0);
  e = elegir(e, p0);
  e = elegir(e, "A la mano");
  e = elegir(e, v1);
  e = elegir(e, p1);
  e = elegir(e, "Al Destierro");
  assert.equal(zonaDe(e, v0), "cementerio");
  assert.equal(zonaDe(e, p0), "mano");
  assert.equal(zonaDe(e, v1), "cementerio");
  assert.equal(zonaDe(e, p1), "destierro");
});

test("Hatchet: Exhumar; el portador gana 2 de Fuerza y no puede ser Barajado ni cambiar de controlador", () => {
  const e = mesa();
  oros(e, 0, 2);
  const p = aliado(e, 0);
  const x = poner(e, 0, "cementerio", "Hatchet");
  assert.equal(jugableDesdeCementerio(e, x), true);
  const q = aliado(e, 0);
  armar(e, 0, "Hatchet", q);
  assert.equal(N.fuerza(e, q), 5);
  assert.equal(N.tiene(e, q, "NoBarajable"), true);
  assert.equal(N.puedeTomar(e, q, 1), false);
  assert.equal(N.puedeTomar(e, p, 1), true);
});

test("Hatchet: una vez en tu turno, un Oro y hasta una carta oponente pierden su habilidad hasta tu próximo turno y Robas dos", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const h = armar(e, 0, "Hatchet", p);
  const o = poner(e, 1, "reserva", "Drácula");
  const per = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(h, "Hatchet"));
  e = elegir(e, per);
  assert.equal(N.activa(e, per), false);
  assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === o && f.fin.inicioDe === 0), true);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Haz Atomico: el portador gana Fuerza igual a su coste y Baraja una carta de coste igual o menor", () => {
  let e = mesa();
  const p = aliado(e, 0, { fuerza: 2, coste: 3 });
  const h = armar(e, 0, "Haz Atomico", p);
  const r = aliado(e, 1, { coste: 3 });
  const caro = aliado(e, 1, { coste: 4 });
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.fuerza(e, r), 3);
  e = aplicar(e, habilidad(h, "Haz Atomico"));
  assert.equal(opcionesDe(e).includes(caro), false);
  e = elegir(e, r);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Haz Atomico: en tu Cementerio, el primer Aliado de coste 2 o más que juegues cada turno no puede ser Anulado", () => {
  let e = mesa();
  poner(e, 1, "mano", "Ciempiés-SP");
  oros(e, 1, 1);
  oros(e, 0, 4);
  const g1 = poner(e, 0, "mano", "Guardia Real");
  const g2 = poner(e, 0, "mano", "Guardia Real");
  let sin = structuredClone({ ...e, catalogo: null });
  sin = { ...sin, catalogo: e.catalogo };
  sin = aplicar(sin, { tipo: "jugar", uid: g1 });
  assert.equal(sin.pila.at(-1).cerrada, false);
  poner(e, 0, "cementerio", "Haz Atomico");
  e = aplicar(e, { tipo: "jugar", uid: g1 });
  assert.equal(e.pila.length, 0);
  assert.equal(zonaDe(e, g1), "defensa");
  e = aplicar(e, { tipo: "jugar", uid: g2 });
  assert.equal(e.pila.at(-1).cerrada, false);
});

test("Jarngreipr: Exhumar; el portador gana 3 de Fuerza e Imbloqueable", () => {
  const e = mesa();
  oros(e, 0, 1);
  aliado(e, 0);
  const x = poner(e, 0, "cementerio", "Jarngreipr");
  assert.equal(jugableDesdeCementerio(e, x), true);
  const p = aliado(e, 0);
  armar(e, 0, "Jarngreipr", p);
  assert.equal(N.fuerza(e, p), 6);
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
});

test("Jarngreipr: en tu Vigilia Baraja una carta que no sea Oro y no se pueden jugar cartas con su nombre hasta tu próximo turno", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const j = armar(e, 0, "Jarngreipr", p);
  const per = poner(e, 1, "defensa", "Sir Persival");
  const mia = poner(e, 0, "mano", "Sir Persival");
  oros(e, 0, 3);
  e = aplicar(e, habilidad(j, "Jarngreipr"));
  e = elegir(e, per);
  assert.equal(zonaDe(e, per), "castillo");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === mia), false);
  assert.equal(e.efectos.filter((f) => f.tipo === "noJugarNombre" && f.nombre === "Sir Persival").length, 2);
});

test("Katana Colosal: el portador gana 2 de Fuerza y Furia; al entrar Roba una carta", () => {
  let e = mesa();
  const p = aliado(e, 0);
  [e] = jugarArma(e, "Katana Colosal", p);
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Katana Colosal: cuando el portador hace daño, Destierra una carta de un Cementerio y todas sus copias del Castillo y Cementerio de su dueño", () => {
  let e = mesa();
  const p = aliado(e, 0);
  armar(e, 0, "Katana Colosal", p);
  const v1 = poner(e, 1, "cementerio", "Valefor");
  const v2 = poner(e, 1, "cementerio", "Valefor");
  const v3 = poner(e, 1, "castillo", "Valefor");
  e = combate(e, p);
  e = elegir(e, true);
  e = elegir(e, v1);
  assert.equal(zonaDe(e, v1), "destierro");
  assert.equal(zonaDe(e, v2), "destierro");
  assert.equal(zonaDe(e, v3), "destierro");
});

test("Kukri: el portador gana 2 de Fuerza e Indestructible; al entrar el oponente Baraja una carta de su mano", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const a = poner(e, 1, "mano", "Valefor");
  const b = poner(e, 1, "mano", "Valefor");
  [e] = jugarArma(e, "Kukri", p);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, a);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.tiene(e, p, "Indestructible"), true);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Kukri: si entra en el turno oponente, además Robas dos cartas", () => {
  const e = mesa();
  const p = aliado(e, 0);
  const k = poner(e, 0, "mano", "Kukri");
  const a = poner(e, 1, "mano", "Valefor");
  e.activo = 1;
  entrarEnJuego(e, k, 0, p);
  resolver(e);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Kukri: se puede jugar en la Guerra de Talismanes o en la Fase Final oponente", { todo: "carta: Arma jugable en la Guerra de Talismanes y en la Fase Final oponente" }, () => {
  assert.fail();
});

test("La Esmeralda: Exhumar; el portador gana 3 de Fuerza y Furia; al entrar genera un Oro por el turno", () => {
  let e = mesa();
  const x = poner(e, 0, "cementerio", "La Esmeralda");
  const p = aliado(e, 0);
  oros(e, 0, 2);
  assert.equal(jugableDesdeCementerio(e, x), true);
  e = aplicar(e, { tipo: "jugar", uid: x, portador: p, desde: "cementerio" });
  e = sinRespuesta(e);
  assert.equal(N.fuerza(e, p), 6);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(disponibles(e, 0), 1);
});

test("La Esmeralda: al comienzo de cada turno el oponente Baraja una carta de su mano y, si controlas otra Arma, Robas dos", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const q = aliado(e, 0);
  armar(e, 0, "La Esmeralda", p);
  armar(e, 0, "Pedrenyal", q);
  const v = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Lanza Argenta: el portador gana 2 de Fuerza e Indesterrable; Destruirla Roba tres y al llegar al Cementerio se Baraja con hasta dos cartas de un Cementerio", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const l = armar(e, 0, "Lanza Argenta", p);
  const v = poner(e, 1, "cementerio", "Valefor");
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.tiene(e, p, "Indesterrable"), true);
  e = aplicar(e, habilidad(l, "Lanza Argenta"));
  e = elegir(e, v);
  assert.equal(zonaDe(e, l), "castillo");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Lanza Argenta: puede Destruirse para cancelar una habilidad", { todo: "efecto: cancelar una habilidad" }, () => {
  assert.fail();
});

test("Lanza Argenta: también se Baraja si llega al Cementerio porque su portador sale del juego", { todo: "evento: alCementerio para Armas que caen junto a su portador" }, () => {
  assert.fail();
});

test("Lanza Sacra: el portador gana 1 de Fuerza y Furia; al entrar juega un Arma de tu Destierro reduciendo su coste en un Oro", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const q = aliado(e, 0);
  const z = poner(e, 0, "destierro", "Zweihander Brutal");
  oros(e, 0, 2);
  [e] = jugarArma(e, "Lanza Sacra", p);
  e = elegir(e, "Jugar un Arma de tu Destierro reduciendo su coste en un Oro (mínimo 1)");
  assert.deepEqual(e.armas[q], [z]);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
});

test("Lanza Sacra: al entrar puedes subir un Arma de tu Destierro a tu mano", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const z = poner(e, 0, "destierro", "Pedrenyal");
  [e] = jugarArma(e, "Lanza Sacra", p);
  e = elegir(e, "Subir un Arma de tu Destierro a tu mano");
  assert.equal(zonaDe(e, z), "mano");
});

test("Lanza Sacra: puedes Barajarla de tu mano para Robar una carta", () => {
  let e = mesa();
  const l = poner(e, 0, "mano", "Lanza Sacra");
  e = aplicar(e, habilidad(l, "Lanza Sacra"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Lanza de Exorcista: Exhumar; el portador gana 3 de Fuerza, Furia e Imbloqueable", () => {
  const e = mesa();
  oros(e, 0, 2);
  aliado(e, 0);
  const x = poner(e, 0, "cementerio", "Lanza de Exorcista");
  assert.equal(jugableDesdeCementerio(e, x), true);
  const p = aliado(e, 0);
  armar(e, 0, "Lanza de Exorcista", p);
  assert.equal(N.fuerza(e, p), 6);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
});

test("Lanza de Exorcista: una vez por turno Destierra cartas oponentes cuyos costes sumen hasta 3", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const l = armar(e, 0, "Lanza de Exorcista", p);
  const a = aliado(e, 1, { coste: 2 });
  const b = aliado(e, 1, { coste: 1 });
  const c = aliado(e, 1, { coste: 2 });
  e = aplicar(e, habilidad(l, "Lanza de Exorcista"));
  e = elegir(e, a);
  assert.deepEqual(opcionesDe(e), [b, null]);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "defensa");
});

test("Lanza de Exorcista: en la Fase Final Baraja y/o Destierra hasta tres cartas de los Cementerios y Roba una", () => {
  let e = mesa();
  const p = aliado(e, 0);
  armar(e, 0, "Lanza de Exorcista", p);
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  const d = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, a);
  e = elegir(e, b);
  e = elegir(e, null);
  e = elegir(e, c);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Lanza de Madera: Exhumar; el portador gana 1 de Fuerza, Imbloqueable y hace daño al Destierro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = aliado(e, 0);
  const x = poner(e, 0, "cementerio", "Lanza de Madera");
  assert.equal(jugableDesdeCementerio(e, x), true);
  const q = aliado(e, 0);
  armar(e, 0, "Lanza de Madera", q);
  assert.equal(N.tiene(e, q, "Imbloqueable"), true);
  e = combate(e, q);
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(zonaDe(e, p), "defensa");
});

test("Lanza de Sombras: Exhumar; una vez en tu turno Destruye un Aliado propio para Barajar una carta oponente de coste 2 o menos, Desterrar el tope de un Castillo y Robar", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const s = aliado(e, 0);
  const l = armar(e, 0, "Lanza de Sombras", p);
  const r = aliado(e, 1, { coste: 2 });
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(N.tiene(e, l, "Exhumar"), true);
  e = aplicar(e, habilidad(l, "Lanza de Sombras"));
  e = elegir(e, s);
  e = elegir(e, "Tope del Castillo oponente");
  assert.equal(zonaDe(e, s), "cementerio");
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(e.jugadores[1].destierro.length, 1);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Lanza del Juramento: al entrar un Oro oponente no se agrupa y una carta no puede usar sus habilidades el próximo turno", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const o = poner(e, 1, "pagado", "Drácula");
  const per = poner(e, 1, "defensa", "Sir Persival");
  [e] = jugarArma(e, "Lanza del Juramento", p);
  e = elegir(e, per);
  assert.equal(N.fuerza(e, p), 7);
  assert.equal(N.tiene(e, p, "Furia"), true);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(zonaDe(e, o), "pagado");
  assert.equal(N.activa(e, per), false);
});

test("Lanza del Juramento: cuando el portador hace daño de combate, juega sin pagar una carta de coste 2 o menos de tu mano o Cementerio", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const q = aliado(e, 0);
  armar(e, 0, "Lanza del Juramento", p);
  const ped = poner(e, 0, "cementerio", "Pedrenyal");
  e = combate(e, p);
  assert.deepEqual(e.armas[q], [ped]);
  assert.equal(e.jugadores[1].cementerio.length, 7);
});

test("Luthairon: Exhumar; el portador gana 1 de Fuerza e Indestructible y al entrar Robas hasta tantas cartas como su coste", () => {
  let e = mesa();
  const p = aliado(e, 0, { coste: 3 });
  const x = poner(e, 0, "cementerio", "Luthairon");
  oros(e, 0, 2);
  assert.equal(jugableDesdeCementerio(e, x), true);
  e = aplicar(e, { tipo: "jugar", uid: x, portador: p, desde: "cementerio" });
  e = sinRespuesta(e);
  assert.deepEqual(opcionesDe(e), [0, 1, 2, 3]);
  e = elegir(e, 3);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Indestructible"), true);
});

test("Luthairon: los Aliados en Línea de Defensa con menos Fuerza que el portador pierden su habilidad", { todo: "continua: Aliados en Línea de Defensa con menos Fuerza que el portador pierden su habilidad" }, () => {
  assert.fail();
});

test("Machete del Abuelo: un Aliado gana Furia y 2 de Fuerza permanentemente y Robas hasta su coste más una", () => {
  let e = mesa();
  const a = aliado(e, 0, { coste: 2 });
  const m = armar(e, 0, "Machete del Abuelo", a);
  assert.equal(N.fuerza(e, a), 3);
  e = aplicar(e, habilidad(m, "Machete del Abuelo"));
  assert.deepEqual(opcionesDe(e), [0, 1, 2, 3]);
  e = elegir(e, 3);
  assert.equal(N.fuerza(e, a), 5);
  assert.equal(N.tiene(e, a, "Furia"), true);
  assert.equal(e.jugadores[0].mano.length, 3);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(N.fuerza(e, a), 5);
});

test("Machete del Abuelo: una vez por turno una carta que no sea Oro pierde su habilidad y es Desterrada", () => {
  let e = mesa();
  const a = aliado(e, 0);
  const m = armar(e, 0, "Machete del Abuelo", a);
  const per = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(m, "Machete del Abuelo", 1));
  e = elegir(e, per);
  assert.equal(zonaDe(e, per), "destierro");
  assert.equal(accionesLegales(e).some((x) => x.tipo === "habilidad" && x.uid === m && x.h === 1), false);
});

test("Macuñ: gana Exhumar si controlas Aliados Caballero, Guerrero o Héroe", () => {
  const e = mesa();
  aliado(e, 0);
  const x = poner(e, 0, "cementerio", "Macuñ");
  assert.equal(jugableDesdeCementerio(e, x), false);
  poner(e, 0, "defensa", "Sir Peter Hawkins");
  assert.equal(jugableDesdeCementerio(e, x), true);
});

test("Macuñ: el portador gana 2 de Fuerza; una vez en tu turno Baraja o Destierra una carta de un Cementerio", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const m = armar(e, 0, "Macuñ", p);
  const v = poner(e, 1, "cementerio", "Valefor");
  assert.equal(N.fuerza(e, p), 5);
  e = aplicar(e, habilidad(m, "Macuñ"));
  e = elegir(e, "Desterrar");
  assert.equal(zonaDe(e, v), "destierro");
});

test("Macuñ: no se puede convertir en cartas del mismo u otro tipo", { todo: "efecto: no puede ser convertida en otra carta" }, () => {
  assert.fail();
});

test("Martillo Mjlnir: el portador gana 3 de Fuerza; en tu Vigilia sube un Aliado de tu Cementerio a tu mano", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const m = armar(e, 0, "Martillo Mjlnir", p);
  const s = poner(e, 0, "cementerio", "Sir Peter Hawkins");
  assert.equal(N.fuerza(e, p), 6);
  e = aplicar(e, habilidad(m, "Martillo Mjlnir"));
  assert.equal(zonaDe(e, s), "mano");
});

test("Martillo Mjlnir: en tu Fase Final, si el portador hizo daño de combate, Destierra hasta cinco cartas de un Cementerio", () => {
  let e = mesa();
  const p = aliado(e, 0);
  armar(e, 0, "Martillo Mjlnir", p);
  e = combate(e, p);
  e = elegir(e, true);
  e = elegir(e, "Cementerio oponente");
  for (let i = 0; i < 5; i++) e = elegir(e, cualquiera);
  assert.equal(e.jugadores[1].destierro.length, 5);
  assert.equal(e.jugadores[1].cementerio.length, 1);
});

test("Martillo Mjlnir: sin daño de combate no Destierra en la Fase Final", () => {
  let e = mesa();
  const p = aliado(e, 0);
  armar(e, 0, "Martillo Mjlnir", p);
  poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(e.activo, 1);
});

test("Mosquete Charleville: al entrar Baraja cartas de tu mano y Roba la misma cantidad más una", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const a = poner(e, 0, "mano", "Valefor");
  const b = poner(e, 0, "mano", "Valefor");
  [e] = jugarArma(e, "Mosquete Charleville", p);
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 29);
  assert.equal(N.fuerza(e, p), 5);
});

test("Peacemaker: el portador gana 1 de Fuerza por cada carta en tu mano y Furia", () => {
  const e = mesa();
  const p = aliado(e, 0);
  armar(e, 0, "Peacemaker", p);
  poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Valefor");
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.tiene(e, p, "Furia"), true);
});

test("Peacemaker: al entrar busca tres Armas de distinto nombre en tu Castillo o Cementerio", () => {
  let e = mesa();
  const p = aliado(e, 0);
  const a = poner(e, 0, "castillo", "Pedrenyal");
  poner(e, 0, "castillo", "Pedrenyal");
  const b = poner(e, 0, "castillo", "Vieja Snaphance");
  const c = poner(e, 0, "cementerio", "Zweihander Brutal");
  [e] = jugarArma(e, "Peacemaker", p);
  e = elegir(e, true);
  e = elegir(e, a);
  assert.equal(opcionesDe(e).some((v) => v !== null && N.carta(e, v).nombre === "Pedrenyal"), false);
  e = elegir(e, b);
  e = elegir(e, c);
  assert.deepEqual([a, b, c].map((u) => zonaDe(e, u)), ["mano", "mano", "mano"]);
});

test("Pistola de Dos Cañones: el portador gana 2 de Fuerza; cuando hace daño de combate, Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  const p = aliado(e, 0);
  armar(e, 0, "Pistola de Dos Cañones", p);
  const r = aliado(e, 1, { coste: 2 });
  e = combate(e, p);
  assert.equal(e.jugadores[1].cementerio.length, 5);
  e = elegir(e, true);
  e = elegir(e, r);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Pistola de Dos Cañones: cuando la Botas por daño dejas de Botar y se Destierra", () => {
  const e = mesa();
  const x = botarConCartaEn(e, "Pistola de Dos Cañones", 2);
  N.quitarDelCastillo(e, 0, 5, "cementerio", false, true);
  resolver(e);
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(e.jugadores[0].cementerio.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Pistola de Dos Cañones: puedes Barajarla de tu mano para Robar una carta", () => {
  let e = mesa();
  const x = poner(e, 0, "mano", "Pistola de Dos Cañones");
  e = aplicar(e, habilidad(x, "Pistola de Dos Cañones"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Pistolas de Duelo: Exhumar; el portador gana 2 de Fuerza e Imbloqueable", () => {
  const e = mesa();
  oros(e, 0, 1);
  aliado(e, 0);
  const x = poner(e, 0, "cementerio", "Pistolas de Duelo");
  assert.equal(jugableDesdeCementerio(e, x), true);
  const p = aliado(e, 0);
  armar(e, 0, "Pistolas de Duelo", p);
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
});

test("Pistolas de Duelo: si el portador cuesta 2 o menos, Descartas una carta para que dispare su habilidad de entrar en juego", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  e.conv[p] = { tipo: "Aliado", coste: 2, como: id("Sir Persival") };
  const x = armar(e, 0, "Pistolas de Duelo", p);
  const r = aliado(e, 1);
  const d = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(x, "Pistolas de Duelo"));
  e = elegir(e, true);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, r), "castillo");
});

test("Pistolas de Duelo: si el portador cuesta más de 2, Robas dos cartas", () => {
  let e = mesa();
  const p = aliado(e, 0, { coste: 3 });
  const x = armar(e, 0, "Pistolas de Duelo", p);
  e = aplicar(e, habilidad(x, "Pistolas de Duelo"));
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Puo Estelar: Exhumar; el portador gana 3 de Fuerza y Furia", () => {
  const e = mesa();
  oros(e, 0, 1);
  aliado(e, 0);
  const x = poner(e, 0, "cementerio", "Puo Estelar");
  assert.equal(jugableDesdeCementerio(e, x), true);
  const p = aliado(e, 0);
  armar(e, 0, "Puo Estelar", p);
  assert.equal(N.fuerza(e, p), 6);
  assert.equal(N.tiene(e, p, "Furia"), true);
});

test("Puo Estelar: si la Botas por daño dejas de Botar y se Destierra", () => {
  const e = mesa();
  const x = botarConCartaEn(e, "Puo Estelar", 0);
  N.quitarDelCastillo(e, 0, 4, "cementerio", false, true);
  resolver(e);
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(e.jugadores[0].cementerio.length, 0);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Puo Estelar: Barajarla de tu mano previene que una carta tuya sea afectada por un Oro o carta de coste 0", { todo: "efecto: proteger una carta de Oros y cartas de coste 0" }, () => {
  assert.fail();
});
