import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeUsar = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);
const valores = (e) => (e.pendiente?.opciones ?? []).map((o) => o.valor);

function armado(e, j, nombre = "Valefor") {
  const aliado = poner(e, j, "defensa", nombre);
  const arma = poner(e, j, "arma", "Pedrenyal", { portador: aliado });
  return { aliado, arma };
}

function lucy(e, objetivo) {
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(t)));
  return elegir(e, objetivo);
}

test("Dr. Jack Seward: si controlas Armas, al entrar los Aliados oponentes pierden su habilidad y son destruidos", () => {
  let e = mesa();
  oros(e, 0, 3);
  armado(e, 0);
  const ileana = poner(e, 1, "defensa", "Ileana");
  const valefor = poner(e, 1, "defensa", "Valefor");
  const jack = poner(e, 0, "mano", "Dr. Jack Seward");
  e = sinRespuesta(aplicar(e, jugar(jack)));
  assert.equal(zonaDe(e, ileana), "cementerio");
  assert.equal(zonaDe(e, valefor), "cementerio");
  assert.equal(zonaDe(e, jack), "defensa");
});

test("Dr. Jack Seward: sin Armas ni Armas jugadas en tu turno anterior no destruye", () => {
  let e = mesa();
  oros(e, 0, 3);
  const valefor = poner(e, 1, "defensa", "Valefor");
  const jack = poner(e, 0, "mano", "Dr. Jack Seward");
  e = sinRespuesta(aplicar(e, jugar(jack)));
  assert.equal(zonaDe(e, valefor), "defensa");
});

test("Dr. Jack Seward: también destruye si jugaste Armas en tu turno anterior", () => {
  let e = mesa();
  oros(e, 0, 4);
  const aliado = poner(e, 0, "defensa", "Valefor");
  const ped = poner(e, 0, "mano", "Pedrenyal");
  const jack = poner(e, 0, "mano", "Dr. Jack Seward");
  const valefor = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ped, { portador: aliado })));
  N.mover(e, ped, "cementerio");
  e.turno += 2;
  e = sinRespuesta(aplicar(e, jugar(jack)));
  assert.equal(zonaDe(e, valefor), "cementerio");
});

test("Dr. Jack Seward: una vez por turno genera un Oro para jugar Armas", () => {
  let e = mesa();
  const jack = poner(e, 0, "defensa", "Dr. Jack Seward");
  const ped = poner(e, 0, "mano", "Pedrenyal");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === ped), false);
  e = aplicar(e, habilidad(jack, "Dr. Jack Seward"));
  e = elegir(e, "Generar un Oro para jugar Armas");
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma"] }]);
  e = sinRespuesta(aplicar(e, jugar(ped, { portador: jack })));
  assert.equal(N.portadorDe(e, ped), jack);
  assert.equal(puedeUsar(e, jack), false);
});

test("Dr. Jack Seward: o Baraja y/o Destierra hasta cuatro cartas de los Cementerios y Roba una", () => {
  let e = mesa();
  const jack = poner(e, 0, "defensa", "Dr. Jack Seward");
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, habilidad(jack, "Dr. Jack Seward"));
  e = elegir(e, "Barajar y/o Desterrar hasta cuatro cartas de los Cementerios y Robar una carta");
  e = elegir(e, c[0]);
  e = elegir(e, c[2]);
  e = elegir(e, null);
  e = elegir(e, c[1]);
  e = elegir(e, null);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "destierro", "castillo", "cementerio"]);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Duque Godofredo: tus Aliados de raza Caballero ganan 1 de Fuerza", () => {
  const e = mesa();
  const duque = poner(e, 0, "defensa", "Duque Godofredo");
  const galahad = poner(e, 0, "defensa", "Sir Galahad");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Sir Galahad");
  assert.equal(N.fuerza(e, duque), 3);
  assert.equal(N.fuerza(e, galahad), 3);
  assert.equal(N.fuerza(e, valefor), 3);
  assert.equal(N.fuerza(e, rival), 2);
});

test("El Rey y el Verdugo: tiene Imbloqueable y reduce su coste por cada Arma de tu mano, Cementerio o en juego, hasta 0", () => {
  const e = mesa();
  const rey = poner(e, 0, "mano", "El Rey y el Verdugo");
  assert.equal(N.tiene(e, poner(e, 0, "defensa", "El Rey y el Verdugo"), "Imbloqueable"), true);
  assert.equal(costeDe(e, 0, rey).pagar, 2);
  poner(e, 0, "mano", "Pedrenyal");
  assert.equal(costeDe(e, 0, rey).pagar, 1);
  poner(e, 0, "cementerio", "Pedrenyal");
  assert.equal(costeDe(e, 0, rey).pagar, 0);
  armado(e, 0);
  assert.equal(costeDe(e, 0, rey).pagar, 0);
});

test("El Rey y el Verdugo: al entrar Baraja todas las Armas de tu Destierro y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "destierro", "Pedrenyal");
  const b = poner(e, 0, "destierro", "Martillo Sacro");
  const v = poner(e, 0, "destierro", "Valefor");
  const rey = poner(e, 0, "mano", "El Rey y el Verdugo");
  e = sinRespuesta(aplicar(e, jugar(rey)));
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("Felipe Augusto: tiene Furia y al entrar juega sin pagar un Arma de coste 2 o menos de tu Cementerio en un Caballero", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Valefor");
  const ped = poner(e, 0, "cementerio", "Pedrenyal");
  const zwei = poner(e, 0, "cementerio", "Zweihander Brutal");
  const felipe = poner(e, 0, "mano", "Felipe Augusto");
  e = sinRespuesta(aplicar(e, jugar(felipe)));
  assert.equal(N.tiene(e, felipe, "Furia"), true);
  e = elegir(e, true);
  assert.equal(N.portadorDe(e, ped), felipe);
  assert.equal(zonaDe(e, zwei), "cementerio");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Frumos el Paladín: si controlas Armas, Baraja hasta tres cartas de tu mano y Roba esa cantidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  armado(e, 0);
  const h = [1, 2, 3, 4].map(() => poner(e, 0, "mano", "Valefor"));
  const frumos = poner(e, 0, "mano", "Frumos el Paladín");
  e = sinRespuesta(aplicar(e, jugar(frumos)));
  assert.equal(N.tiene(e, frumos, "Furia"), true);
  e = elegir(e, true);
  e = elegir(e, h[0]);
  e = elegir(e, h[1]);
  e = elegir(e, null);
  assert.equal(zonaDe(e, h[0]), "castillo");
  assert.equal(zonaDe(e, h[1]), "castillo");
  assert.equal(e.jugadores[0].mano.length, 4);
});

test("Frumos el Paladín: sin Armas no ofrece Barajar", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "mano", "Valefor");
  const frumos = poner(e, 0, "mano", "Frumos el Paladín");
  e = sinRespuesta(aplicar(e, jugar(frumos)));
  assert.equal(e.pendiente, null);
});

test("Frumos el Paladín: los Aliados que porten Arma ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Frumos el Paladín");
  const { aliado } = armado(e, 0);
  const rival = armado(e, 1).aliado;
  const libre = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, aliado), 6);
  assert.equal(N.fuerza(e, rival), 6);
  assert.equal(N.fuerza(e, libre), 3);
});

test("Frumos el Paladín: los Aliados que porten Arma ganan Imbloqueable", { todo: "continua: ganar una clave solo los Aliados que portan Armas" }, () => {});

test("Gilgamesh el Paladin: tiene Furia e Imbloqueable y tus demás Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Gilgamesh el Paladin");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(N.tiene(e, g, "Imbloqueable"), true);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, r), 3);
});

test("Gilgamesh el Paladin: al entrar Destruye un Aliado de Fuerza igual o menor o una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const jaques = poner(e, 1, "defensa", "Jaques de Molay");
  const gusano = poner(e, 1, "defensa", "Gusano Rojo");
  const g = poner(e, 0, "mano", "Gilgamesh el Paladin");
  e = sinRespuesta(aplicar(e, jugar(g)));
  assert.equal(valores(e).includes(gusano), false);
  e = elegir(e, jaques);
  assert.equal(zonaDe(e, jaques), "cementerio");
  assert.equal(zonaDe(e, gusano), "defensa");
});

test("Gilgamesh el Paladin: al salir del juego también Destruye", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gilgamesh el Paladin");
  const v = poner(e, 1, "defensa", "Valefor");
  e = lucy(e, g);
  assert.equal(zonaDe(e, g), "cementerio");
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Gilgamesh el Paladin: al oponente le cuesta un Oro adicional afectar a tus Aliados en la Línea de Ataque", { todo: "efecto: afectar a ciertos Aliados propios cuesta Oros adicionales al oponente" }, () => {});

test("Gilgamesh, Paladín de Uruk: al entrar puede Desterrar un Aliado de Fuerza 4 o menos y buscar un Aliado o Arma", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 1, "defensa", "Valefor");
  const gusano = poner(e, 1, "defensa", "Gusano Rojo");
  const galahad = poner(e, 0, "castillo", "Sir Galahad");
  const g = poner(e, 0, "mano", "Gilgamesh, Paladín de Uruk");
  e = sinRespuesta(aplicar(e, jugar(g)));
  assert.equal(N.tiene(e, g, "Furia"), true);
  e = elegir(e, true);
  assert.equal(valores(e).includes(gusano), false);
  e = elegir(e, v);
  e = elegir(e, galahad);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, galahad), "mano");
});

test("Gilgamesh, Paladín de Uruk: una vez por turno, cuando un Aliado sale del juego, el oponente Bota tres", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Gilgamesh, Paladín de Uruk");
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  e = lucy(e, a);
  assert.equal(e.jugadores[1].castillo.length, 27);
  e = lucy(e, b);
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Guardián del Tiempo: al entrar no recibes daño de combate hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const atacante = poner(e, 1, "defensa", "Lobos de los Cárpatos");
  const guardian = poner(e, 0, "mano", "Guardián del Tiempo");
  e = sinRespuesta(aplicar(e, jugar(guardian)));
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  const antes = e.jugadores[0].castillo.length;
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.activo, 0);
  assert.equal(e.jugadores[0].castillo.length, antes);
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano"), false);
});

test("Guardián del Tiempo: una vez por turno el oponente Descarta una carta, dos si controlas Armas", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Guardián del Tiempo");
  const m = [1, 2, 3, 4].map(() => poner(e, 1, "mano", "Valefor"));
  e = aplicar(e, habilidad(g, "Guardián del Tiempo"));
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, m[0]);
  assert.equal(e.jugadores[1].mano.length, 3);
  assert.equal(puedeUsar(e, g), false);
  let f = mesa();
  const g2 = poner(f, 0, "defensa", "Guardián del Tiempo");
  poner(f, 0, "arma", "Pedrenyal", { portador: g2 });
  [1, 2, 3, 4].forEach(() => poner(f, 1, "mano", "Valefor"));
  f = aplicar(f, habilidad(g2, "Guardián del Tiempo"));
  f = elegir(f, f.jugadores[1].mano[0]);
  f = elegir(f, f.jugadores[1].mano[1]);
  assert.equal(f.jugadores[1].mano.length, 2);
  assert.equal(f.jugadores[1].cementerio.length, 2);
});

test("Hanta Cinco Anillos: reduce su coste en un Oro si muestras un Arma o Tótem de tu mano o Cementerio", () => {
  const e = mesa();
  const h = poner(e, 0, "mano", "Hanta Cinco Anillos");
  assert.equal(costeDe(e, 0, h).pagar, 2);
  const t = poner(e, 0, "cementerio", "Abadía de Carfax");
  assert.equal(costeDe(e, 0, h).pagar, 1);
  N.mover(e, t, "destierro");
  poner(e, 0, "mano", "Pedrenyal");
  assert.equal(costeDe(e, 0, h).pagar, 1);
});

test("Hanta Cinco Anillos: al entrar Baraja hasta dos Armas de tu Destierro en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = [1, 2, 3].map(() => poner(e, 0, "destierro", "Pedrenyal"));
  const h = poner(e, 0, "mano", "Hanta Cinco Anillos");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, a[0]);
  e = elegir(e, a[1]);
  assert.deepEqual(a.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro"]);
});

test("Hanta Cinco Anillos: en tu Fase Final, si controlas Armas, Destierra hasta tres cartas de un Cementerio", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Hanta Cinco Anillos");
  poner(e, 0, "arma", "Pedrenyal", { portador: h });
  const c = [1, 2, 3, 4].map(() => poner(e, 1, "cementerio", "Valefor"));
  const propio = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, "Cementerio oponente");
  for (const u of c.slice(0, 3)) e = elegir(e, u);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro", "cementerio"]);
  assert.equal(zonaDe(e, propio), "cementerio");
});

test("Hanta Cinco Anillos: sin Armas no Destierra en la Fase Final", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Hanta Cinco Anillos");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Hanta el Samurái: al entrar puede jugar un Arma de tu mano reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ped = poner(e, 0, "mano", "Pedrenyal");
  const h = poner(e, 0, "mano", "Hanta el Samurái");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, true);
  assert.equal(N.portadorDe(e, ped), h);
  assert.equal(e.jugadores[0].jugadas.Arma, 1);
});

test("Hanta el Samurái: en tu Fase Final Destierra hasta tantas cartas de un Cementerio como Armas controles más uno", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Hanta el Samurái");
  poner(e, 0, "arma", "Pedrenyal", { portador: h });
  const c = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, "Cementerio oponente");
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
});

test("Heracles, Paladín Invencible: tiene Furia y al entrar sube dos cartas que no sean Talismán de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "cementerio", "Valefor");
  const p = poner(e, 0, "cementerio", "Pedrenyal");
  const t = poner(e, 0, "cementerio", "Llamar a la Manada");
  const h = poner(e, 0, "mano", "Heracles, Paladín Invencible");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.equal(N.tiene(e, h, "Furia"), true);
  assert.deepEqual([v, p, t].map((u) => zonaDe(e, u)), ["mano", "mano", "cementerio"]);
});

test("Heracles, Paladín Invencible: una vez por turno un Aliado gana 2 de Fuerza y no puede salir ni cambiar de controlador", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Heracles, Paladín Invencible");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(h, "Heracles, Paladín Invencible"));
  e = elegir(e, v);
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.puedeSalir(e, v), false);
  assert.equal(N.puedeTomar(e, v, 1), false);
  assert.equal(puedeUsar(e, h), false);
  e = lucy(e, v);
  assert.equal(zonaDe(e, v), "defensa");
});

test("Hijos del Fuego Blanco: al entrar puede Descartar una carta para buscar un Arma de coste 1", () => {
  let e = mesa();
  const d = poner(e, 0, "mano", "Valefor");
  const ped = poner(e, 0, "castillo", "Pedrenyal");
  const zwei = poner(e, 0, "cementerio", "Zweihander Brutal");
  const hijos = poner(e, 0, "mano", "Hijos del Fuego Blanco");
  e = sinRespuesta(aplicar(e, jugar(hijos)));
  e = elegir(e, true);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(valores(e).includes(zwei), false);
  e = elegir(e, ped);
  assert.equal(zonaDe(e, ped), "mano");
});

test("Húsar Cazador: al entrar cada jugador Descarta una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const mia = poner(e, 0, "mano", "Valefor");
  const r = [1, 2].map(() => poner(e, 1, "mano", "Valefor"));
  const husar = poner(e, 0, "mano", "Húsar Cazador");
  e = sinRespuesta(aplicar(e, jugar(husar)));
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, r[1]);
  assert.equal(zonaDe(e, mia), "cementerio");
  assert.deepEqual(r.map((u) => zonaDe(e, u)), ["mano", "cementerio"]);
});

test("Húsar Cazador: una vez por turno juega un Arma de tu Cementerio pagando su coste y puede portar un Arma adicional", () => {
  let e = mesa();
  oros(e, 0, 1);
  const husar = poner(e, 0, "defensa", "Húsar Cazador");
  const primera = poner(e, 0, "arma", "Martillo Sacro", { portador: husar });
  const ped = poner(e, 0, "cementerio", "Pedrenyal");
  e = aplicar(e, habilidad(husar, "Húsar Cazador"));
  assert.deepEqual(e.armas[husar], [primera, ped]);
  assert.equal(e.jugadores[0].reserva.length, 0);
  poner(e, 0, "cementerio", "Pedrenyal");
  oros(e, 0, 1);
  assert.equal(puedeUsar(e, husar), false);
});

test("Ignacio Carrera Pinto: tiene Imbloqueable y al entrar busca un Arma o Aliado de coste 1 o menos y lo juega gratis", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "castillo", "Valefor");
  const ig = poner(e, 0, "mano", "Ignacio Carrera Pinto");
  e = sinRespuesta(aplicar(e, jugar(ig)));
  assert.equal(N.tiene(e, ig, "Imbloqueable"), true);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "defensa");
});

test("Ignacio Carrera Pinto: al salir del juego también busca y juega gratis", () => {
  let e = mesa();
  const ig = poner(e, 0, "defensa", "Ignacio Carrera Pinto");
  const v = poner(e, 0, "castillo", "Valefor");
  e = lucy(e, ig);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "defensa");
});

test("Ignacio Carrera Pinto: una vez por turno, al jugar un Arma puede Barajar una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ig = poner(e, 0, "defensa", "Ignacio Carrera Pinto");
  const [p1, p2] = [1, 2].map(() => poner(e, 0, "mano", "Pedrenyal"));
  const otro = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, jugar(p1, { portador: ig }));
  e = elegir(e, true);
  e = elegir(e, r);
  e = sinRespuesta(e);
  assert.equal(zonaDe(e, r), "castillo");
  e = sinRespuesta(aplicar(e, jugar(p2, { portador: otro })));
  assert.equal(e.pendiente, null);
});

test("John Trelawney: reduce su coste en dos si muestras un Arma de tu mano o en juego", () => {
  const e = mesa();
  const john = poner(e, 0, "mano", "John Trelawney");
  assert.equal(costeDe(e, 0, john).pagar, 3);
  const ped = poner(e, 0, "mano", "Pedrenyal");
  assert.equal(costeDe(e, 0, john).pagar, 1);
  N.mover(e, ped, "cementerio");
  assert.equal(costeDe(e, 0, john).pagar, 3);
  armado(e, 0);
  assert.equal(costeDe(e, 0, john).pagar, 1);
});

test("John Trelawney: reduce su coste en dos si jugaste Armas en tu turno anterior", () => {
  let e = mesa();
  oros(e, 0, 1);
  const aliado = poner(e, 0, "defensa", "Valefor");
  const ped = poner(e, 0, "mano", "Pedrenyal");
  const john = poner(e, 0, "mano", "John Trelawney");
  e = sinRespuesta(aplicar(e, jugar(ped, { portador: aliado })));
  N.mover(e, ped, "cementerio");
  assert.equal(costeDe(e, 0, john).pagar, 3);
  e.turno += 2;
  assert.equal(costeDe(e, 0, john).pagar, 1);
  e.turno += 2;
  assert.equal(costeDe(e, 0, john).pagar, 3);
});

test("John Trelawney: con Armas, el primer Aliado que juegues cada turno no puede ser Anulado", { todo: "protección: el primer Aliado que juegues cada turno no puede ser Anulado ni cancelada su habilidad" }, () => {});

test("Juan Mackenna: reduce su coste en un Oro si controlas Armas", () => {
  const e = mesa();
  const juan = poner(e, 0, "mano", "Juan Mackenna");
  assert.equal(costeDe(e, 0, juan).pagar, 2);
  armado(e, 0);
  assert.equal(costeDe(e, 0, juan).pagar, 1);
});

test("Juan Mackenna: nombra una carta y Baraja una carta con ese nombre de la mano oponente", () => {
  let e = mesa();
  const juan = poner(e, 0, "defensa", "Juan Mackenna");
  const [a, b] = [1, 2].map(() => poner(e, 1, "mano", "Valefor"));
  const g = poner(e, 1, "mano", "Sir Galahad");
  e = aplicar(e, habilidad(juan, "Juan Mackenna"));
  e = elegir(e, a);
  e = elegir(e, "Barajar una carta con ese nombre de la mano oponente");
  assert.equal(valores(e).includes(g), false);
  e = elegir(e, b);
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(puedeUsar(e, juan), false);
});

test("Juan Mackenna: o las cartas con ese nombre no pueden ser jugadas hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const juan = poner(e, 0, "defensa", "Juan Mackenna");
  const r = poner(e, 1, "mano", "Valefor");
  const mia = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(juan, "Juan Mackenna"));
  e = elegir(e, r);
  e = elegir(e, "Las cartas con ese nombre no pueden ser jugadas hasta tu próximo turno");
  assert.equal(accionesLegales(e).some((x) => x.tipo === "jugar" && x.uid === mia), false);
  assert.deepEqual(e.efectos.filter((f) => f.tipo === "noJugarNombre" && f.nombre === "Valefor").map((f) => f.j), [0, 1]);
});

test("Kwanyip: no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 4);
  const k = poner(e, 0, "mano", "Kwanyip");
  poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(k));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
});

test("Kwanyip: una vez en tu Vigilia convierte hasta un Aliado y un Tótem de coste 3 o menos en Armas sin habilidad y las porta", () => {
  let e = mesa();
  const k = poner(e, 0, "defensa", "Kwanyip");
  const v = poner(e, 1, "defensa", "Valefor");
  const t = poner(e, 1, "apoyo", "Abadía de Carfax");
  const jaques = poner(e, 1, "defensa", "Jaques de Molay");
  e = aplicar(e, habilidad(k, "Kwanyip"));
  assert.equal(valores(e).includes(jaques), false);
  e = elegir(e, v);
  e = elegir(e, t);
  assert.deepEqual(e.armas[k], [v, t]);
  assert.equal(N.carta(e, v).tipo, "Arma");
  assert.equal(N.activa(e, t), false);
  assert.equal(N.fuerza(e, k), 4);
  assert.equal(N.controlador(e, v), 0);
  assert.equal(puedeUsar(e, k), false);
  e = lucy(e, k);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[1].cementerio.includes(t), true);
  assert.equal(e.conv[v], undefined);
});

test("Kwanyip: puede Botar dos cartas para prevenir que una carta salga del juego", { todo: "reemplazo: pagar un coste (Botar o Desterrarse) para prevenir que cartas salgan del juego" }, () => {});

test("Legion Paladin: al entrar puede subir un Aliado o Arma de tu Cementerio a tu mano y Robar una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ped = poner(e, 0, "cementerio", "Pedrenyal");
  const t = poner(e, 0, "cementerio", "Llamar a la Manada");
  const l = poner(e, 0, "mano", "Legion Paladin");
  e = sinRespuesta(aplicar(e, jugar(l)));
  e = elegir(e, true);
  assert.equal(valores(e).includes(t), false);
  e = elegir(e, ped);
  assert.equal(zonaDe(e, ped), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Legion Paladin: el primer Arma que juegues cada turno cuesta un Oro menos, con mínimo 1", () => {
  let e = mesa();
  oros(e, 0, 3);
  const l = poner(e, 0, "defensa", "Legion Paladin");
  const zwei = poner(e, 0, "mano", "Zweihander Brutal");
  const ped = poner(e, 0, "mano", "Pedrenyal");
  assert.equal(costeDe(e, 0, zwei).pagar, 2);
  e = sinRespuesta(aplicar(e, jugar(zwei, { portador: l })));
  assert.equal(e.jugadores[0].reserva.length, 2);
  assert.equal(e.jugadores[0].pagado.length, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ped, { portador: v })));
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("Legion Paladin: puede Desterrarse para prevenir que hasta dos Aliados salgan del juego", { todo: "reemplazo: pagar un coste (Botar o Desterrarse) para prevenir que cartas salgan del juego" }, () => {});

test("Lord John Roxton: una vez por turno cambia de portador un Arma que controles", () => {
  let e = mesa();
  const rox = poner(e, 0, "defensa", "Lord John Roxton");
  const { arma } = armado(e, 0);
  e = aplicar(e, habilidad(rox, "Lord John Roxton"));
  e = elegir(e, "Cambiar de portador un Arma que controles");
  assert.equal(N.portadorDe(e, arma), rox);
  assert.equal(puedeUsar(e, rox), false);
});

test("Lord John Roxton: o sube un Arma de tu Cementerio a tu mano", () => {
  let e = mesa();
  const rox = poner(e, 0, "defensa", "Lord John Roxton");
  const ped = poner(e, 0, "cementerio", "Pedrenyal");
  e = aplicar(e, habilidad(rox, "Lord John Roxton"));
  e = elegir(e, "Subir un Arma de tu Cementerio a tu mano");
  assert.equal(zonaDe(e, ped), "mano");
});

test("Lord John Roxton: si controlas Armas, Destruye un Aliado Bestia o una carta de coste 1 o menos, o Roba dos", () => {
  let e = mesa();
  const rox = poner(e, 0, "defensa", "Lord John Roxton");
  assert.equal(puedeUsar(e, rox, 1), false);
  poner(e, 0, "arma", "Pedrenyal", { portador: rox });
  const lobos = poner(e, 1, "defensa", "Lobos de los Cárpatos");
  const jaques = poner(e, 1, "defensa", "Jaques de Molay");
  e = aplicar(e, habilidad(rox, "Lord John Roxton", 1));
  e = elegir(e, "Destruir un Aliado Bestia o una carta de coste 1 o menos");
  assert.equal(valores(e).includes(jaques), false);
  e = elegir(e, lobos);
  assert.equal(zonaDe(e, lobos), "cementerio");
  let f = mesa();
  const rox2 = poner(f, 0, "defensa", "Lord John Roxton");
  poner(f, 0, "arma", "Pedrenyal", { portador: rox2 });
  f = aplicar(f, habilidad(rox2, "Lord John Roxton", 1));
  f = elegir(f, "Robar dos cartas");
  assert.equal(f.jugadores[0].mano.length, 2);
});

test("Lupin: al entrar convierte hasta dos cartas cuyos costes sumen 3 o menos en Armas sin habilidad y las porta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 1, "defensa", "Valefor");
  const d = poner(e, 1, "defensa", "Lobos de los Cárpatos");
  const jaques = poner(e, 1, "defensa", "Jaques de Molay");
  const lupin = poner(e, 0, "mano", "Lupin");
  e = sinRespuesta(aplicar(e, jugar(lupin)));
  e = elegir(e, true);
  assert.equal(valores(e).includes(jaques), false);
  e = elegir(e, v);
  e = elegir(e, d);
  assert.deepEqual(e.armas[lupin], [v, d]);
  assert.equal(N.carta(e, d).tipo, "Arma");
  assert.equal(N.activa(e, d), false);
});

test("Lupin: con Armas, durante tu Vigilia el oponente no puede jugar Talismanes y solo puede usar una habilidad", { todo: "restricción: durante tu Vigilia el oponente no puede jugar Talismanes y solo puede usar una habilidad" }, () => {});

test("Manuel Bulnes: tiene Imbloqueable y al entrar Roba una carta y Baraja una de tu mano", () => {
  let e = mesa();
  const b = poner(e, 0, "mano", "Manuel Bulnes");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(N.tiene(e, b, "Imbloqueable"), true);
  assert.equal(e.jugadores[0].mano.length, 0);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Manuel Bulnes: gana 1 de Fuerza por cada Arma que controles", () => {
  const e = mesa();
  const b = poner(e, 0, "defensa", "Manuel Bulnes");
  assert.equal(N.fuerza(e, b), 1);
  armado(e, 0);
  armado(e, 0);
  armado(e, 1);
  assert.equal(N.fuerza(e, b), 3);
});

test("Manuel Bulnes: tus Aliados que porten Arma no pueden perder su habilidad", { todo: "continua: tus Aliados que portan Armas no pueden perder su habilidad (filtro por portar Armas)" }, () => {});

test("Manuel de Salas: tus Aliados ganan Imbloqueable y los que portan Armas ganan 1 de Fuerza", () => {
  const e = mesa();
  const s = poner(e, 0, "defensa", "Manuel de Salas");
  const { aliado } = armado(e, 0);
  const r = armado(e, 1).aliado;
  assert.equal(N.tiene(e, s, "Imbloqueable"), true);
  assert.equal(N.tiene(e, aliado, "Imbloqueable"), true);
  assert.equal(N.tiene(e, r, "Imbloqueable"), false);
  assert.equal(N.fuerza(e, s), 3);
  assert.equal(N.fuerza(e, aliado), 6);
  assert.equal(N.fuerza(e, r), 5);
});

test("Manuel de Salas: tus Aliados que portan Armas ganan Furia", { todo: "continua: ganar una clave solo los Aliados que portan Armas" }, () => {});

test("Mateo de Toro y Zambrano: al entrar Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Mateo de Toro y Zambrano");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Mateo de Toro y Zambrano: en tu Vigilia, una vez por turno, juega un Arma de tu Cementerio o Destierro pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "defensa", "Mateo de Toro y Zambrano");
  const ped = poner(e, 0, "destierro", "Pedrenyal");
  e = aplicar(e, habilidad(m, "Mateo de Toro y Zambrano"));
  assert.equal(N.portadorDe(e, ped), m);
  assert.equal(e.jugadores[0].reserva.length, 0);
  poner(e, 0, "cementerio", "Martillo Sacro");
  oros(e, 0, 1);
  assert.equal(puedeUsar(e, m), false);
});

test("Miguel: tiene Furia e Imbloqueable; al entrar el oponente Descarta dos y tú Robas hasta dos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const r = [1, 2, 3].map(() => poner(e, 1, "mano", "Valefor"));
  const mg = poner(e, 0, "mano", "Miguel");
  e = sinRespuesta(aplicar(e, jugar(mg)));
  assert.equal(N.tiene(e, mg, "Furia"), true);
  assert.equal(N.tiene(e, mg, "Imbloqueable"), true);
  e = elegir(e, r[0]);
  e = elegir(e, r[2]);
  assert.deepEqual(r.map((u) => zonaDe(e, u)), ["cementerio", "mano", "cementerio"]);
  e = elegir(e, 2);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Miguel: una vez en tu turno juega una carta de tu mano o de un Cementerio reduciendo su coste en un Oro", () => {
  let e = mesa();
  const mg = poner(e, 0, "defensa", "Miguel");
  const v = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, habilidad(mg, "Miguel"));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.controlador(e, v), 0);
  assert.equal(puedeUsar(e, mg), false);
});

test("Miguel: su habilidad al entrar no puede ser cancelada", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});

test("Milena: tiene Indestructible y una vez por turno juega un Arma de tu mano o Cementerio con un Oro menos", () => {
  let e = mesa();
  const mil = poner(e, 0, "defensa", "Milena");
  const ped = poner(e, 0, "cementerio", "Pedrenyal");
  assert.equal(N.tiene(e, mil, "Indestructible"), true);
  e = aplicar(e, habilidad(mil, "Milena"));
  assert.equal(N.portadorDe(e, ped), mil);
  assert.equal(puedeUsar(e, mil), false);
});

test("Milena: tus Aliados que porten Armas ganan Furia, o Imbloqueable si ya la tenían", { todo: "continua: ganar una clave solo los Aliados que portan Armas" }, () => {});
