import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver, limiteArmas, cumple } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const ctxDe = (e, uid, j) => ({ ctrl: j, fuente: uid, def: e.instancias[uid], costeFuente: N.carta(e, uid).coste ?? 0, vars: {} });
const opcionesDe = (e) => e.pendiente.opciones.map((o) => o.valor);
const textosDe = (e) => e.pendiente.opciones.map((o) => o.texto);

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  N.sacar(e, uid);
  e.jugadores[j].castillo.unshift(uid);
  return uid;
}

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

function atacarSolo(e, uid) {
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid });
  e = aplicar(e, { tipo: "finAtaque" });
  const antes = e.registro.length;
  for (let i = 0; i < 30 && e.registro.length === antes; i++) {
    const l = accionesLegales(e);
    e = aplicar(e, l.find((x) => ["finBloqueo", "pasar", "noResponder"].includes(x.tipo)) ?? l[0]);
  }
  return e;
}

function comoAliado(nombre, h) {
  test(`${nombre}: Desterrando dos cartas de tu Cementerio entra desde él como un Aliado sin habilidad de Fuerza 2`, () => {
    let e = mesa();
    const oro = poner(e, 0, "cementerio", nombre);
    const a = poner(e, 0, "cementerio", "Valefor");
    const b = poner(e, 0, "cementerio", "Valefor");
    e = aplicar(e, habilidad(oro, nombre, h));
    assert.equal(zonaDe(e, a), "destierro");
    assert.equal(zonaDe(e, b), "destierro");
    assert.equal(zonaDe(e, oro), "defensa");
    assert.equal(N.carta(e, oro).tipo, "Aliado");
    assert.equal(N.carta(e, oro).sinHabilidad, true);
    assert.equal(N.fuerza(e, oro), 2);
  });

  test(`${nombre}: sin dos cartas más en tu Cementerio no puede ponerse como Aliado`, () => {
    const e = mesa();
    const oro = poner(e, 0, "cementerio", nombre);
    poner(e, 0, "cementerio", "Valefor");
    assert.equal(puedeUsar(e, oro), false);
  });
}

test("Belta: al entrar puedes buscar un Tótem en tu Castillo y ponerlo en tu mano", () => {
  let e = mesa();
  const belta = poner(e, 0, "mano", "Belta");
  const abadia = poner(e, 0, "castillo", "Abadía de Carfax");
  e = aplicar(e, { tipo: "oro", uid: belta });
  e = elegir(e, true);
  assert.deepEqual(opcionesDe(e), [abadia, null]);
  e = elegir(e, abadia);
  assert.equal(zonaDe(e, abadia), "mano");
});

test("Belta: una vez por turno Baraja y/o Destierra hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  const belta = poner(e, 0, "reserva", "Belta");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  const c = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(belta, "Belta"));
  e = elegir(e, a);
  e = elegir(e, null);
  e = elegir(e, b);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(puedeUsar(e, belta), false);
});

comoAliado("Belta", 1);

test("Bullnax: al entrar puedes buscar un Oro en tu Castillo y ponerlo en tu mano", () => {
  let e = mesa();
  const bullnax = poner(e, 0, "mano", "Bullnax");
  e = aplicar(e, { tipo: "oro", uid: bullnax });
  e = elegir(e, true);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Bullnax: cuando atacas eliges qué Aliado oponente bloquea y a qué atacante", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Bullnax");
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 1, "defensa", "Valefor");
  const elegido = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: guardia });
  e = elegir(e, elegido);
  e = aplicar(e, { tipo: "finAtaque" });
  assert.deepEqual(accionesLegales(e), [{ tipo: "bloquear", uid: elegido, atacante: guardia }]);
});

comoAliado("Bullnax", 0);

test("Báculo de los Eternos: es Oro Inicial; una vez en tu turno Robas una carta y no Robas al finalizar el turno", () => {
  let e = mesa();
  const baculo = poner(e, 0, "reserva", "Báculo de los Eternos");
  assert.equal(N.carta(e, baculo).oroInicial, true);
  e = aplicar(e, habilidad(baculo, "Báculo de los Eternos"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeUsar(e, baculo), false);
  const siguiente = e.jugadores[0].castillo[0];
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo[0], siguiente);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Báculo de los Eternos: si no lo usas Robas normalmente al finalizar tu turno", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Báculo de los Eternos");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Báculo de los Eternos: los jugadores solo atacan con hasta tantos Aliados como Oros controlen", { todo: "restricción: cada jugador ataca con a lo sumo tantos Aliados como Oros controla" }, () => {});

test("Calaveras de Azúcar: al entrar muestra hasta dos Oros de distinto nombre, los pone en tu mano y Baraja el resto", () => {
  let e = mesa({ castillo: 0 });
  poner(e, 1, "castillo", "Drácula");
  const huitzilin = alTope(e, 0, "Huitzilin");
  const repetido = alTope(e, 0, "Drácula");
  const dracula = alTope(e, 0, "Drácula");
  const valefor = alTope(e, 0, "Valefor");
  const calaveras = poner(e, 0, "mano", "Calaveras de Azúcar");
  e = aplicar(e, { tipo: "oro", uid: calaveras });
  assert.deepEqual([...e.jugadores[0].mano].sort(), [dracula, huitzilin].sort());
  assert.equal(zonaDe(e, repetido), "castillo");
  assert.equal(zonaDe(e, valefor), "castillo");
});

test("Calaveras de Azúcar: en el turno oponente puedes subirlo a tu mano para prevenir un efecto que Anule, cancele o prevenga", { todo: "respuesta: prevenir un efecto que Anule, cancele o prevenga" }, () => {});

test("Campana Hundida: al entrar pone la carta del fondo de tu Castillo en tu mano", () => {
  let e = mesa();
  const fondo = poner(e, 0, "castillo", "Valefor");
  const campana = poner(e, 0, "mano", "Campana Hundida");
  e = aplicar(e, { tipo: "oro", uid: campana });
  assert.equal(zonaDe(e, fondo), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Campana Hundida: Desterrándola, un Aliado oponente que no puede ser Anulado no dispara al entrar", () => {
  let e = mesa();
  oros(e, 0, 2);
  const campana = poner(e, 1, "reserva", "Campana Hundida");
  const jab = poner(e, 0, "mano", "Jabberwocky");
  e = aplicar(e, jugar(jab));
  assert.equal(e.pendiente.jugador, 1);
  e = sinRespuesta(elegir(e, true));
  assert.equal(zonaDe(e, campana), "destierro");
  assert.equal(zonaDe(e, jab), "defensa");
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Campana Hundida: si no la usas el Aliado dispara al entrar", () => {
  let e = mesa();
  oros(e, 0, 2);
  const campana = poner(e, 1, "reserva", "Campana Hundida");
  const jab = poner(e, 0, "mano", "Jabberwocky");
  e = aplicar(e, jugar(jab));
  e = sinRespuesta(elegir(e, false));
  assert.equal(zonaDe(e, campana), "reserva");
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Campana Hundida: no se ofrece ante cartas que pueden ser Anuladas", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "reserva", "Campana Hundida");
  const valefor = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(valefor)));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, valefor), "defensa");
});

test("Carro Szgany: es Oro Inicial y en tu Fase Final Destierra hasta dos cartas de un Cementerio", () => {
  let e = mesa();
  const carro = poner(e, 0, "reserva", "Carro Szgany");
  assert.equal(N.carta(e, carro).oroInicial, true);
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const mio = poner(e, 0, "cementerio", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  e = elegir(e, texto("Cementerio oponente"));
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, mio), "cementerio");
});

test("Carro Szgany: si controlas Caballeros, Guerreros o Héroes puedes portar un Arma adicional", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Carro Szgany");
  const valefor = poner(e, 0, "defensa", "Valefor");
  assert.equal(limiteArmas(e, valefor), 1);
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  assert.equal(limiteArmas(e, guardia), 2);
});

test("Carro de Sol: una vez por turno un Aliado de coste 2 o menos gana Furia, Indestructible o Imbloqueable", () => {
  let e = mesa();
  const carro = poner(e, 0, "reserva", "Carro de Sol");
  const valefor = poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Padre Dagón");
  e = aplicar(e, habilidad(carro, "Carro de Sol"));
  assert.deepEqual(textosDe(e), ["Gana Furia", "Gana Indestructible", "Gana Imbloqueable"]);
  e = elegir(e, texto("Gana Imbloqueable"));
  assert.equal(N.tiene(e, valefor, "Imbloqueable"), true);
  N.expirar(e, "finTurno");
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.tiene(e, valefor, "Imbloqueable"), false);
});

test("Carro de Sol: desde tu Reserva puedes Desterrarlo para Desterrar una carta de coste 2 o menos", () => {
  let e = mesa();
  const carro = poner(e, 0, "reserva", "Carro de Sol");
  const suyo = poner(e, 1, "defensa", "Valefor");
  const caro = poner(e, 1, "defensa", "Padre Dagón");
  e = aplicar(e, habilidad(carro, "Carro de Sol", 1));
  assert.equal(zonaDe(e, carro), "destierro");
  assert.equal(zonaDe(e, suyo), "destierro");
  assert.equal(zonaDe(e, caro), "defensa");
});

test("Cerebelum: al entrar muestra tres cartas, pone todos los Aliados en tu mano y Baraja el resto", () => {
  let e = mesa();
  const guardia = alTope(e, 0, "Guardia Real");
  alTope(e, 0, "Drácula");
  const valefor = alTope(e, 0, "Valefor");
  const cerebelum = poner(e, 0, "mano", "Cerebelum");
  e = aplicar(e, { tipo: "oro", uid: cerebelum });
  e = elegir(e, texto("Todos los Aliados"));
  assert.equal(zonaDe(e, valefor), "mano");
  assert.equal(zonaDe(e, guardia), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("Cerebelum: o pone una carta de las tres en tu mano", () => {
  let e = mesa();
  alTope(e, 0, "Guardia Real");
  const oro = alTope(e, 0, "Huitzilin");
  alTope(e, 0, "Valefor");
  const cerebelum = poner(e, 0, "mano", "Cerebelum");
  e = aplicar(e, { tipo: "oro", uid: cerebelum });
  e = elegir(e, texto("Una carta"));
  e = elegir(e, oro);
  assert.deepEqual(e.jugadores[0].mano, [oro]);
});

test("Cerebelum: al usarlo para pagar un Aliado puedes Barajar hasta tres cartas de los Cementerios", { todo: "disparo: al usar un Oro concreto para pagar el coste de una carta" }, () => {});

test("Chupilca del Diablo: al entrar Robas una carta", () => {
  let e = mesa();
  const chupilca = poner(e, 0, "mano", "Chupilca del Diablo");
  e = aplicar(e, { tipo: "oro", uid: chupilca });
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Chupilca del Diablo: Desterrándolo hasta dos Aliados ganan 2 de Fuerza por el turno", () => {
  let e = mesa();
  const chupilca = poner(e, 0, "reserva", "Chupilca del Diablo");
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Guardia Real");
  e = aplicar(e, habilidad(chupilca, "Chupilca del Diablo"));
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, chupilca), "destierro");
  assert.equal(N.fuerza(e, a), 5);
  assert.equal(N.fuerza(e, b), 5);
});

test("Chupilca del Diablo: una vez por turno un Aliado de coste 2 o menos gana Furia o Indestructible", () => {
  let e = mesa();
  const chupilca = poner(e, 0, "reserva", "Chupilca del Diablo");
  const valefor = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(chupilca, "Chupilca del Diablo", 1));
  assert.deepEqual(textosDe(e), ["Gana Furia", "Gana Indestructible"]);
  e = elegir(e, texto("Gana Indestructible"));
  assert.equal(N.tiene(e, valefor, "Indestructible"), true);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === chupilca && a.h === 1), false);
});

test("Colmillo de Vampiro: al comienzo de la Vigilia Baraja y/o Destierra dos cartas; con Aliados y sin Oros en Reserva, Robas", () => {
  let e = mesa();
  poner(e, 0, "pagado", "Colmillo de Vampiro");
  poner(e, 0, "defensa", "Valefor");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  e = elegir(e, true);
  e = elegir(e, a);
  e = elegir(e, null);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Colmillo de Vampiro: también se dispara en la Vigilia oponente y sin Aliados no Robas", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Colmillo de Vampiro");
  const a = poner(e, 1, "cementerio", "Valefor");
  e = disparar(e, "comienzoVigilia", { j: 1 });
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, true);
  e = elegir(e, a);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Colmillo de Vampiro: afectar tus demás Oros cuesta un Oro adicional al oponente si lo hace con Aliados u Oros", () => {
  const e = mesa();
  const colmillo = poner(e, 0, "reserva", "Colmillo de Vampiro");
  const [oro] = oros(e, 0, 1);
  const balaur = poner(e, 1, "defensa", "Balaur");
  const danza = poner(e, 1, "mano", "Danza del Cuchillo");
  assert.equal(cumple(e, ctxDe(e, balaur, 1), oro, {}, "destruir"), false);
  assert.equal(cumple(e, ctxDe(e, danza, 1), oro, {}, "destruir"), true);
  assert.equal(cumple(e, ctxDe(e, balaur, 1), colmillo, {}, "destruir"), true);
  oros(e, 1, 1);
  assert.equal(cumple(e, ctxDe(e, balaur, 1), oro, {}, "destruir"), true);
});

test("Colmillo de Vampiro: afectar tus Aliados atacantes cuesta un Oro adicional al oponente", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Colmillo de Vampiro");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.proteccionContra(e, valefor, ctxDe(e, rival, 1)).cuesta, 0);
  e = aplicar(e, { tipo: "batalla" });
  e = sinRespuesta(aplicar(e, { tipo: "atacar", uid: valefor }));
  assert.equal(N.proteccionContra(e, valefor, ctxDe(e, rival, 1)).cuesta, 1);
});

test("Compendium Maleficarum: al entrar nombras una carta que tu oponente no puede jugar en su próximo turno", () => {
  let e = mesa();
  oros(e, 1, 2);
  const valefor = poner(e, 1, "mano", "Valefor");
  const compendium = poner(e, 0, "mano", "Compendium Maleficarum");
  e = aplicar(e, { tipo: "oro", uid: compendium });
  e = elegir(e, valefor);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(puedeJugar(e, valefor), false);
});

test("Compendium Maleficarum: al comienzo de tu Vigilia, desde tu Cementerio, Destierra otra carta para subirlo a tu mano", () => {
  let e = mesa();
  const compendium = poner(e, 0, "cementerio", "Compendium Maleficarum");
  const otra = poner(e, 0, "cementerio", "Valefor");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  e = elegir(e, true);
  assert.equal(zonaDe(e, otra), "destierro");
  assert.equal(zonaDe(e, compendium), "mano");
});

test("Corazon de Muerte: al entrar desde tu mano, afectar una carta elegida cuesta un Oro adicional al oponente hasta tu próximo turno", () => {
  let e = mesa();
  const corazon = poner(e, 0, "mano", "Corazon de Muerte");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const otro = poner(e, 0, "defensa", "Valefor");
  const danza = poner(e, 1, "mano", "Danza del Cuchillo");
  e = aplicar(e, { tipo: "oro", uid: corazon });
  e = elegir(e, valefor);
  assert.equal(N.proteccionContra(e, valefor, ctxDe(e, danza, 1)).cuesta, 1);
  assert.equal(N.proteccionContra(e, otro, ctxDe(e, danza, 1)).cuesta, 0);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(N.proteccionContra(e, valefor, ctxDe(e, danza, 1)).cuesta, 1);
});

test("Corazon de Muerte: si no entra desde tu mano no elige carta", () => {
  let e = mesa();
  const corazon = poner(e, 0, "reserva", "Corazon de Muerte");
  poner(e, 0, "defensa", "Valefor");
  e = disparar(e, "entra", { uid: corazon, j: 0 });
  assert.equal(e.pendiente, null);
});

test("Corazon de Muerte: en tu Vigilia lo pagas para jugar una carta de tu Cementerio que no sea Talismán reduciendo su coste en uno", () => {
  let e = mesa();
  const corazon = poner(e, 0, "reserva", "Corazon de Muerte");
  oros(e, 0, 1);
  const guardia = poner(e, 0, "cementerio", "Guardia Real");
  poner(e, 0, "cementerio", "Regresa Lucy");
  e = aplicar(e, habilidad(corazon, "Corazon de Muerte"));
  assert.equal(zonaDe(e, corazon), "pagado");
  assert.equal(zonaDe(e, guardia), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Corazon de Muerte: sin una carta jugable en tu Cementerio no se puede usar", () => {
  const e = mesa();
  const corazon = poner(e, 0, "reserva", "Corazon de Muerte");
  poner(e, 0, "cementerio", "Regresa Lucy");
  poner(e, 0, "cementerio", "Guardia Real");
  assert.equal(puedeUsar(e, corazon), false);
});

test("Corazón de Dragón: entra en juego como copia de un Oro que controle tu oponente", () => {
  let e = mesa();
  poner(e, 1, "reserva", "Armeria del Guerrero");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const corazon = poner(e, 0, "mano", "Corazón de Dragón");
  assert.equal(N.fuerza(e, valefor), 3);
  e = aplicar(e, { tipo: "oro", uid: corazon });
  assert.equal(zonaDe(e, corazon), "reserva");
  assert.equal(N.fuerza(e, valefor), 4);
});

test("Corazón de Dragón: en tu Vigilia, si no pusiste Oros, lo pones desde tu mano o tu Cementerio en tu Reserva", () => {
  let e = mesa();
  const enMano = poner(e, 0, "mano", "Corazón de Dragón");
  e = aplicar(e, habilidad(enMano, "Corazón de Dragón", 0));
  assert.equal(zonaDe(e, enMano), "reserva");
  let f = mesa();
  const enCementerio = poner(f, 0, "cementerio", "Corazón de Dragón");
  f = aplicar(f, habilidad(enCementerio, "Corazón de Dragón", 1));
  assert.equal(zonaDe(f, enCementerio), "reserva");
});

test("Corazón de Dragón: si ya pusiste un Oro este turno no puedes ponerlo", () => {
  let e = mesa();
  const oro = poner(e, 0, "mano", "Drácula");
  const corazon = poner(e, 0, "cementerio", "Corazón de Dragón");
  e = aplicar(e, { tipo: "oro", uid: oro });
  assert.equal(puedeUsar(e, corazon), false);
});

test("Corona de la Bestia: una vez por turno Robas una carta y Barajas una de tu mano", () => {
  let e = mesa();
  const corona = poner(e, 0, "reserva", "Corona de la Bestia");
  const valefor = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(corona, "Corona de la Bestia"));
  e = elegir(e, valefor);
  assert.equal(zonaDe(e, valefor), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeUsar(e, corona), false);
});

test("Corona de la Bestia: lo pagado con este Oro no puede ser Anulado y los Aliados ganan Furia si atacaste en tu turno anterior", { todo: "disparo: al usar un Oro concreto para pagar el coste de una carta" }, () => {});

test("Cristo de Mayo: no puede perder su habilidad y Descartando un Oro o Talismán busca un Aliado o Tótem de coste 2", () => {
  let e = mesa();
  const cristo = poner(e, 0, "reserva", "Cristo de Mayo");
  assert.ok(N.carta(e, cristo).claves.includes("NoPierdeHabilidad"));
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  const guardia = poner(e, 0, "castillo", "Guardia Real");
  const valefor = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, habilidad(cristo, "Cristo de Mayo"));
  assert.equal(zonaDe(e, lucy), "cementerio");
  assert.equal(opcionesDe(e).includes(valefor), false);
  e = elegir(e, guardia);
  assert.equal(zonaDe(e, guardia), "mano");
});

test("Cristo de Mayo: pagándolo y convirtiéndolo en Oro sin habilidad Baraja una carta; si costaba 4 o más Descartas una", () => {
  let e = mesa();
  const cristo = poner(e, 0, "reserva", "Cristo de Mayo");
  const dagon = poner(e, 1, "defensa", "Padre Dagón");
  const mia = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(cristo, "Cristo de Mayo", 1));
  assert.equal(zonaDe(e, cristo), "pagado");
  assert.equal(N.carta(e, cristo).sinHabilidad, true);
  assert.equal(zonaDe(e, dagon), "castillo");
  assert.equal(zonaDe(e, mia), "cementerio");
});

test("Cristo de Mayo: si la carta Barajada cuesta menos de 4 no Descartas", () => {
  let e = mesa();
  const cristo = poner(e, 0, "reserva", "Cristo de Mayo");
  const suyo = poner(e, 1, "defensa", "Valefor");
  const mia = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(cristo, "Cristo de Mayo", 1));
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.equal(zonaDe(e, mia), "mano");
});

test("Crono Diamante: tras jugar un Aliado de coste 2 o más, Descartas una carta para jugar un Aliado reduciendo su coste en uno", () => {
  let e = mesa();
  const crono = poner(e, 0, "reserva", "Crono Diamante");
  oros(e, 0, 3);
  const guardia = poner(e, 0, "mano", "Guardia Real");
  const ileana = poner(e, 0, "mano", "Ileana");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  assert.equal(puedeUsar(e, crono), false);
  e = sinRespuesta(aplicar(e, jugar(guardia)));
  assert.equal(e.jugadores[0].reserva.length, 2);
  assert.equal(puedeUsar(e, crono), true);
  e = aplicar(e, habilidad(crono, "Crono Diamante"));
  e = elegir(e, lucy);
  assert.equal(zonaDe(e, lucy), "cementerio");
  assert.equal(zonaDe(e, ileana), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("Crono Diamante: el Aliado jugado cuesta como mínimo un Oro", () => {
  let e = mesa();
  const crono = poner(e, 0, "reserva", "Crono Diamante");
  oros(e, 0, 1);
  const guardia = poner(e, 0, "mano", "Guardia Real");
  const valefor = poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(guardia)));
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(puedeUsar(e, crono), false);
  assert.equal(zonaDe(e, valefor), "mano");
});

test("Crono Diamante: tu primer Aliado de coste 2 o más del turno no puede ser Anulado", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Crono Diamante");
  oros(e, 0, 4);
  oros(e, 1, 5);
  poner(e, 1, "mano", "Dragón Dorado");
  const guardia = poner(e, 0, "mano", "Guardia Real");
  const ileana = poner(e, 0, "mano", "Ileana");
  e = aplicar(e, jugar(guardia));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
  e = sinRespuesta(e);
  assert.equal(zonaDe(e, guardia), "defensa");
  e = aplicar(e, jugar(ileana));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), true);
});

test("Crono Diamante: la primera habilidad de Oro que utilizas cada turno no puede ser cancelada", { todo: "protección: la primera habilidad de cierto tipo de carta que usas cada turno no puede ser cancelada" }, () => {});

test("Cruz de Borgoa: al entrar busca en tu Castillo un Aliado de Fuerza 2 o menos", () => {
  let e = mesa();
  const cruz = poner(e, 0, "mano", "Cruz de Borgoa");
  const mordred = poner(e, 0, "castillo", "Mordred, el Traidor Tenebris");
  const valefor = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, { tipo: "oro", uid: cruz });
  assert.equal(opcionesDe(e).includes(valefor), false);
  e = elegir(e, mordred);
  assert.equal(zonaDe(e, mordred), "mano");
});

test("Cruz de Borgoa: para Barajar cartas que controles tu oponente debe Barajar una carta de su mano", { todo: "efecto: para Barajar cartas que controles el oponente debe Barajar una carta de su mano" }, () => {});

test("Cráneo de Duvel: una vez por turno pones una carta de tu mano en el tope y la del fondo de tu Castillo en tu mano", () => {
  let e = mesa();
  const craneo = poner(e, 0, "reserva", "Cráneo de Duvel");
  const valefor = poner(e, 0, "mano", "Valefor");
  const fondo = poner(e, 0, "castillo", "Guardia Real");
  e = aplicar(e, habilidad(craneo, "Cráneo de Duvel"));
  assert.equal(e.jugadores[0].castillo[0], valefor);
  assert.equal(zonaDe(e, fondo), "mano");
  assert.equal(puedeUsar(e, craneo), false);
});

test("Cráneo de Duvel: en tu Reserva tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const craneo = poner(e, 0, "reserva", "Cráneo de Duvel");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, mio), 4);
  assert.equal(N.fuerza(e, suyo), 3);
  N.mover(e, craneo, "pagado");
  assert.equal(N.fuerza(e, mio), 3);
});

test("Cráneo de Duvel: en tu Reserva, en la Fase Final tus Aliados que atacaron son agrupados", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Cráneo de Duvel");
  const atacante = poner(e, 0, "ataque", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  assert.equal(zonaDe(e, atacante), "defensa");
});

test("Cráneos Vivos: al entrar un jugador muestra hasta dos cartas de distinto tipo y las Destierra", () => {
  let e = mesa();
  const segunda = alTope(e, 1, "Valefor");
  const primera = alTope(e, 1, "Drácula");
  const craneos = poner(e, 0, "mano", "Cráneos Vivos");
  e = aplicar(e, { tipo: "oro", uid: craneos });
  e = elegir(e, texto("Castillo oponente"));
  assert.equal(zonaDe(e, primera), "destierro");
  assert.equal(zonaDe(e, segunda), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Cráneos Vivos: pagándolo y convirtiéndolo en Oro sin habilidad, el oponente Bota tantas cartas como tipos haya en los Destierros", () => {
  let e = mesa();
  const craneos = poner(e, 0, "reserva", "Cráneos Vivos");
  poner(e, 0, "destierro", "Valefor");
  poner(e, 1, "destierro", "Drácula");
  poner(e, 1, "destierro", "Regresa Lucy");
  poner(e, 1, "destierro", "Valefor");
  e = aplicar(e, habilidad(craneos, "Cráneos Vivos"));
  assert.equal(zonaDe(e, craneos), "pagado");
  assert.equal(N.carta(e, craneos).sinHabilidad, true);
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Cuerno de Titán: una vez por turno Descartas una carta para buscar una carta Titán en tu Castillo", () => {
  let e = mesa();
  const cuerno = poner(e, 0, "reserva", "Cuerno de Titán");
  const valefor = poner(e, 0, "mano", "Valefor");
  const titan = poner(e, 0, "castillo", "Titán Abismal");
  e = aplicar(e, habilidad(cuerno, "Cuerno de Titán"));
  e = elegir(e, texto("Descartar"));
  assert.equal(zonaDe(e, valefor), "cementerio");
  assert.deepEqual(opcionesDe(e), [titan, null]);
  e = elegir(e, titan);
  assert.equal(zonaDe(e, titan), "mano");
  assert.equal(puedeUsar(e, cuerno), false);
});

test("Cuerno de Titán: o Destruyes una carta que controles", () => {
  let e = mesa();
  const cuerno = poner(e, 0, "reserva", "Cuerno de Titán");
  const valefor = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(cuerno, "Cuerno de Titán"));
  e = elegir(e, texto("Destruir"));
  e = elegir(e, valefor);
  assert.equal(zonaDe(e, valefor), "cementerio");
});

test("Cuerno de Titán: aumenta o disminuye en uno el coste de hasta una carta en juego", { todo: "efecto: aumentar o disminuir el coste de una carta en juego" }, () => {});

test("Cuerno de Titán: tus Aliados Titán ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Cuerno de Titán");
  const titan = poner(e, 0, "defensa", "Titán Abismal");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const ajeno = poner(e, 1, "defensa", "Titán Abismal");
  assert.equal(N.fuerza(e, titan), 3);
  assert.equal(N.fuerza(e, valefor), 3);
  assert.equal(N.fuerza(e, ajeno), 2);
});

test("Cáliz de Sangre: en tu Vigilia Barajas un Oro de tu Reserva y pones un Oro de tu mano en tu Reserva", () => {
  let e = mesa();
  const caliz = poner(e, 0, "reserva", "Cáliz de Sangre");
  const dracula = poner(e, 0, "reserva", "Drácula");
  const huitzilin = poner(e, 0, "mano", "Huitzilin");
  e = aplicar(e, habilidad(caliz, "Cáliz de Sangre"));
  e = elegir(e, dracula);
  assert.equal(zonaDe(e, dracula), "castillo");
  assert.equal(zonaDe(e, huitzilin), "reserva");
  assert.equal(puedeUsar(e, caliz), false);
});

test("Cáliz de Sangre: en tu Fase Final puedes Barajar hasta dos cartas de tu Cementerio o Desterrar una de un Cementerio", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Cáliz de Sangre");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  const suya = poner(e, 1, "cementerio", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  e = elegir(e, texto("Barajar"));
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, suya), "cementerio");
  let f = mesa();
  poner(f, 0, "reserva", "Cáliz de Sangre");
  const otra = poner(f, 1, "cementerio", "Valefor");
  f = disparar(f, "faseFinal", { j: 0 });
  f = elegir(f, texto("Desterrar"));
  assert.equal(zonaDe(f, otra), "destierro");
});

test("Diadema Angelical: al entrar Robas una carta", () => {
  let e = mesa();
  const diadema = poner(e, 0, "mano", "Diadema Angelical");
  e = aplicar(e, { tipo: "oro", uid: diadema });
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Diadema Angelical: Barajándola desde tu mano y pagando un Oro juegas una carta reduciendo su coste en uno, sin poder ser Anulada", () => {
  let e = mesa();
  oros(e, 0, 2);
  const diadema = poner(e, 0, "mano", "Diadema Angelical");
  const guardia = poner(e, 0, "mano", "Guardia Real");
  poner(e, 1, "mano", "Ciempiés-SP");
  oros(e, 1, 2);
  e = aplicar(e, habilidad(diadema, "Diadema Angelical", 0));
  assert.equal(zonaDe(e, diadema), "castillo");
  assert.equal(zonaDe(e, guardia), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.pila.length, 0);
});

test("Diadema Angelical: también se usa Barajándola desde el juego", () => {
  let e = mesa();
  const diadema = poner(e, 0, "reserva", "Diadema Angelical");
  oros(e, 0, 1);
  const valefor = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(diadema, "Diadema Angelical", 1));
  assert.equal(zonaDe(e, diadema), "castillo");
  assert.equal(zonaDe(e, valefor), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Diadema Angelical: si la Botas por daño dejas de Botar cartas y la Destierras", () => {
  let e = mesa();
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  const despues = alTope(e, 1, "Valefor");
  const diadema = alTope(e, 1, "Diadema Angelical");
  const antes = alTope(e, 1, "Valefor");
  e = atacarSolo(e, guardia);
  assert.equal(zonaDe(e, antes), "cementerio");
  assert.equal(zonaDe(e, diadema), "destierro");
  assert.equal(e.jugadores[1].castillo[0], despues);
  assert.equal(e.jugadores[1].castillo.length, 31);
  assert.equal(e.jugadores[1].cementerio.length, 1);
});

test("Diadema Celestial: al entrar muestra hasta un Aliado y un Talismán y los pone en tu mano", () => {
  let e = mesa();
  const lucy = alTope(e, 0, "Regresa Lucy");
  alTope(e, 0, "Drácula");
  const valefor = alTope(e, 0, "Valefor");
  const diadema = poner(e, 0, "mano", "Diadema Celestial");
  e = aplicar(e, { tipo: "oro", uid: diadema });
  assert.equal(zonaDe(e, valefor), "mano");
  assert.equal(zonaDe(e, lucy), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Diadema Celestial: tus Aliados bloqueadores ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Diadema Celestial");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "ataque", "Valefor");
  assert.equal(N.fuerza(e, mio), 3);
  e.bloqueos[mio] = suyo;
  assert.equal(N.fuerza(e, mio), 4);
  assert.equal(N.fuerza(e, suyo), 3);
});

test("Diadema Celestial: los Aliados oponentes pierden Imbloqueable", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Diadema Celestial");
  const mio = poner(e, 0, "defensa", "Gusano Rojo");
  const suyo = poner(e, 1, "defensa", "Gusano Rojo");
  assert.equal(N.tiene(e, mio, "Imbloqueable"), true);
  assert.equal(N.tiene(e, suyo, "Imbloqueable"), false);
});

test("Diadema Celestial: si la Botas por daño dejas de Botar cartas y la Destierras", () => {
  let e = mesa();
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  const despues = alTope(e, 1, "Valefor");
  const diadema = alTope(e, 1, "Diadema Celestial");
  e = atacarSolo(e, guardia);
  assert.equal(zonaDe(e, diadema), "destierro");
  assert.equal(e.jugadores[1].castillo[0], despues);
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Diente de Dragón: es Oro Inicial; en tu Fase Final Barajas una carta de tu mano para mostrar una de coste 3 o más y ponerla en tu mano", () => {
  let e = mesa();
  const diente = poner(e, 0, "reserva", "Diente de Dragón");
  assert.equal(N.carta(e, diente).oroInicial, true);
  const valefor = poner(e, 0, "mano", "Valefor");
  const balaur = poner(e, 0, "castillo", "Balaur");
  e = disparar(e, "faseFinal", { j: 0 });
  e = elegir(e, true);
  assert.equal(zonaDe(e, valefor), "castillo");
  assert.deepEqual(e.jugadores[0].mano, [balaur]);
});

test("Diente de Dragón: sin cartas en la mano no se ofrece", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Diente de Dragón");
  e = disparar(e, "faseFinal", { j: 0 });
  assert.equal(e.pendiente, null);
});

test("Diente de Dragón: cada jugador solo puede generar Oros y jugar cartas sin pagar su coste una vez por turno", { todo: "restricción: cada jugador genera Oros y juega cartas sin pagar su coste solo una vez por turno" }, () => {});

test("Directorium Inquisitorum: al entrar desde tu mano puedes buscar un Oro en tu Castillo", () => {
  let e = mesa();
  const dir = poner(e, 0, "mano", "Directorium Inquisitorum");
  e = aplicar(e, { tipo: "oro", uid: dir });
  assert.deepEqual(textosDe(e), ["Buscar un Oro en tu Castillo", "listo"]);
  e = elegir(e, texto("Buscar"));
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Directorium Inquisitorum: se pone en juego desde tu Cementerio como si estuviera en tu mano y en vez de buscar puedes Robar dos", () => {
  let e = mesa();
  const dir = poner(e, 0, "cementerio", "Directorium Inquisitorum");
  e = aplicar(e, habilidad(dir, "Directorium Inquisitorum"));
  assert.equal(zonaDe(e, dir), "reserva");
  e = elegir(e, texto("Robar dos"));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "oro"), false);
});

test("Directorium Inquisitorum: si ya jugaste un Oro este turno no se pone desde tu Cementerio", () => {
  let e = mesa();
  const oro = poner(e, 0, "mano", "Drácula");
  const dir = poner(e, 0, "cementerio", "Directorium Inquisitorum");
  e = aplicar(e, { tipo: "oro", uid: oro });
  assert.equal(puedeUsar(e, dir), false);
});
