import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { OPS, resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeUsar = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);
const valores = (e) => (e.pendiente?.opciones ?? []).map((o) => o.valor);
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const nombresEn = (e, j, zona) => e.jugadores[j][zona].map((u) => N.carta(e, u).nombre);

function alTope(e, j, nombre, pos = 0) {
  const u = poner(e, j, "castillo", nombre);
  e.jugadores[j].castillo.pop();
  e.jugadores[j].castillo.splice(pos, 0, u);
  return u;
}

function atacar(e, uid) {
  e = aplicar(e, { tipo: "batalla" });
  return aplicar(e, { tipo: "atacar", uid });
}

test("Sandokan: tiene Furia", () => {
  const e = mesa();
  assert.equal(N.tiene(e, poner(e, 0, "defensa", "Sandokan"), "Furia"), true);
});

test("Sandokan: una vez en tu turno muestra un Aliado de tu mano y el oponente Bota cartas igual a su Fuerza", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Sandokan");
  const balaur = poner(e, 0, "mano", "Balaur");
  e = aplicar(e, habilidad(s, "Sandokan"));
  assert.equal(zonaDe(e, balaur), "mano");
  assert.equal(e.jugadores[1].castillo.length, 25);
  assert.equal(e.jugadores[1].cementerio.length, 5);
  assert.equal(puedeUsar(e, s), false);
});

test("Sandokan: sin Aliados en la mano no se puede usar", () => {
  const e = mesa();
  const s = poner(e, 0, "defensa", "Sandokan");
  poner(e, 0, "mano", "Llamar a la Manada");
  assert.equal(puedeUsar(e, s), false);
});

test("Sandokan: cuando atacas, las cartas del Cementerio oponente pierden su habilidad", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Sandokan");
  const v = poner(e, 1, "cementerio", "Vision Heroica");
  assert.equal(N.activa(e, v), true);
  e = atacar(e, s);
  assert.equal(N.activa(e, v), false);
});

test("Sandokan: las cartas de tu propio Cementerio también pierden su habilidad hasta tu próximo turno", { todo: "efecto: las cartas de ambos Cementerios pierden su habilidad por un período, aunque la fuente salga del juego" }, () => {});

test("Santos Pincheira: tiene Furia", () => {
  const e = mesa();
  assert.equal(N.tiene(e, poner(e, 0, "defensa", "Santos Pincheira"), "Furia"), true);
});

test("Santos Pincheira: si es Anulado, tus Aliados ganan 2 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const santos = poner(e, 0, "mano", "Santos Pincheira");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(santos));
  e = aplicar(e, { tipo: "responder", uid: dorado });
  for (let i = 0; i < 10 && (e.pila.length || e.pendiente); i++) {
    e = e.pendiente ? aplicar(e, { tipo: "elegir", i: 0 }) : aplicar(e, accionesLegales(e)[0]);
  }
  assert.equal(zonaDe(e, santos), "cementerio");
  assert.equal(N.fuerza(e, valefor), 5);
  assert.ok(e.efectos.some((f) => f.uid === valefor && f.tipo === "fuerza" && f.n === 2 && f.fin.juego));
});

test("Santos Pincheira: si su habilidad es cancelada, tus Aliados ganan 2 de Fuerza", { todo: "disparo: al ser cancelada su habilidad" }, () => {});

test("Santos Pincheira: una vez por turno destierra una carta del Cementerio oponente y tus Aliados ganan Fuerza igual a su coste", () => {
  let e = mesa();
  const santos = poner(e, 0, "defensa", "Santos Pincheira");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  const balaur = poner(e, 1, "cementerio", "Balaur");
  e = aplicar(e, habilidad(santos, "Santos Pincheira"));
  assert.equal(zonaDe(e, balaur), "destierro");
  assert.equal(N.fuerza(e, santos), 6);
  assert.equal(N.fuerza(e, valefor), 6);
  assert.equal(N.fuerza(e, rival), 3);
  assert.equal(puedeUsar(e, santos), false);
});

test("Shakar Raj: tiene Furia y es Única", () => {
  const e = mesa();
  const s = poner(e, 0, "defensa", "Shakar Raj");
  assert.equal(N.tiene(e, s, "Furia"), true);
  assert.equal(N.tiene(e, s, "UnaCopia"), true);
});

test("Shakar Raj: Única impide controlar dos copias", { todo: "restricción: Única para cartas que no son Oro" }, () => {});

test("Shakar Raj: al entrar un Aliado gana 1 de Fuerza permanentemente", () => {
  let e = mesa();
  const s = poner(e, 0, "mano", "Shakar Raj");
  const valefor = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(s)));
  e = elegir(e, valefor);
  assert.equal(N.fuerza(e, valefor), 4);
  assert.ok(e.efectos.some((f) => f.uid === valefor && f.fin.juego));
});

test("Shakar Raj: en tu Fase Final destierra hasta tantas cartas de un Cementerio como Aliados con Fuerza modificada más uno", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Shakar Raj");
  const valefor = poner(e, 0, "defensa", "Valefor");
  N.agregarEfecto(e, { tipo: "fuerza", uid: valefor, n: 1, fin: "turno" }, 0);
  const c = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, "Cementerio oponente");
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
});

test("Shiji: tiene Furia y reduce su coste en un Oro si tienes un Arma o Tótem en tu mano o Cementerio", () => {
  const e = mesa();
  const s = poner(e, 0, "mano", "Shiji");
  assert.equal(N.tiene(e, s, "Furia"), true);
  assert.equal(costeDe(e, 0, s).pagar, 2);
  poner(e, 0, "cementerio", "Pedrenyal");
  assert.equal(costeDe(e, 0, s).pagar, 1);
});

test("Shiji: al entrar juega un Arma de coste 1 de tu Cementerio sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Shiji");
  const p = poner(e, 0, "cementerio", "Pedrenyal");
  e = sinRespuesta(aplicar(e, jugar(s)));
  assert.deepEqual(e.armas[s], [p]);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Shiji: al entrar juega un Tótem de coste 1 de tu mano sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Shiji");
  const isla = poner(e, 0, "mano", "Isla de Poveglia");
  e = sinRespuesta(aplicar(e, jugar(s)));
  if (e.pendiente) e = elegir(e, false);
  assert.equal(zonaDe(e, isla), "apoyo");
});

test("Vaku Custodio: tiene Furia y tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const vaku = poner(e, 0, "defensa", "Vaku Custodio");
  const mio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, vaku, "Furia"), true);
  assert.equal(N.fuerza(e, vaku), 4);
  assert.equal(N.fuerza(e, mio), 4);
  assert.equal(N.fuerza(e, rival), 3);
});

test("Vaku Custodio: al entrar puede Desterrar hasta dos Tótem o Armas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const vaku = poner(e, 0, "mano", "Vaku Custodio");
  const portador = poner(e, 1, "defensa", "Valefor");
  const arma = poner(e, 1, "arma", "Pedrenyal", { portador });
  const templo = poner(e, 1, "apoyo", "Templo Gótico");
  e = sinRespuesta(aplicar(e, jugar(vaku)));
  assert.equal(valores(e).includes(portador), false);
  e = elegir(e, arma);
  e = elegir(e, templo);
  assert.equal(zonaDe(e, arma), "destierro");
  assert.equal(zonaDe(e, templo), "destierro");
  assert.equal(zonaDe(e, portador), "defensa");
});

test("Vaku Custodio: su habilidad de entrada no puede ser cancelada", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});

test("Vathek: al entrar puede mostrar un Aliado de tu mano para Barajar hasta dos Aliados oponentes", () => {
  let e = mesa();
  oros(e, 0, 4);
  const vathek = poner(e, 0, "mano", "Vathek");
  const mostrado = poner(e, 0, "mano", "Valefor");
  const r = [1, 2, 3].map(() => poner(e, 1, "defensa", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(vathek)));
  e = elegir(e, true);
  e = elegir(e, r[0]);
  e = elegir(e, r[1]);
  assert.deepEqual(r.map((u) => zonaDe(e, u)), ["castillo", "castillo", "defensa"]);
  assert.equal(zonaDe(e, mostrado), "mano");
});

test("Vathek: sin Aliados en la mano no ofrece Barajar", () => {
  let e = mesa();
  oros(e, 0, 4);
  const vathek = poner(e, 0, "mano", "Vathek");
  poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(vathek)));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, vathek), "defensa");
});

test("Vathek: desde tu Cementerio, Desterrarlo y pagar un Oro Baraja dos cartas de un Cementerio y roba dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const vathek = poner(e, 0, "cementerio", "Vathek");
  const c = [1, 2].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, habilidad(vathek, "Vathek"));
  e = elegir(e, "Cementerio oponente");
  assert.equal(zonaDe(e, vathek), "destierro");
  for (const u of c) assert.equal(zonaDe(e, u), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Vicente Benavides: al entrar sube un Arma y un Aliado de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "mano", "Vicente Benavides");
  const arma = poner(e, 0, "cementerio", "Pedrenyal");
  const aliado = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(zonaDe(e, aliado), "mano");
});

test("Vicente Benavides: Desterrarlo y mostrar un Aliado de tu mano hace que el oponente Bote cartas igual a su Fuerza", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Vicente Benavides");
  poner(e, 0, "mano", "Balaur");
  e = aplicar(e, habilidad(v, "Vicente Benavides"));
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 5);
});

test("Vlad Tepes: tiene Indestructible", () => {
  const e = mesa();
  assert.equal(N.tiene(e, poner(e, 0, "defensa", "Vlad Tepes"), "Indestructible"), true);
});

test("Vlad Tepes: al entrar mira seis cartas y juega gratis un Aliado Guerrero de coste 1 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const tepes = poner(e, 0, "mano", "Vlad Tepes");
  const abel = alTope(e, 0, "Abel");
  const shakar = alTope(e, 0, "Shakar Raj", 3);
  e = sinRespuesta(aplicar(e, jugar(tepes)));
  assert.equal(valores(e).includes(shakar), true);
  assert.equal(valores(e).includes(abel), false);
  e = elegir(e, shakar);
  e = elegir(e, tepes);
  assert.equal(zonaDe(e, shakar), "defensa");
  assert.equal(zonaDe(e, abel), "castillo");
  assert.equal(N.fuerza(e, tepes), 2);
});

test("Vlad Tepes: puede no elegir ninguno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const tepes = poner(e, 0, "mano", "Vlad Tepes");
  const shakar = alTope(e, 0, "Shakar Raj");
  e = sinRespuesta(aplicar(e, jugar(tepes)));
  e = elegir(e, null);
  assert.equal(zonaDe(e, shakar), "castillo");
});

test("Vlad el Empalador: tiene Furia y al entrar muestra hasta un Aliado de coste 1 y lo juega gratis", () => {
  let e = mesa();
  oros(e, 0, 2);
  const vlad = poner(e, 0, "mano", "Vlad el Empalador");
  const abel = alTope(e, 0, "Abel", 2);
  e = sinRespuesta(aplicar(e, jugar(vlad)));
  assert.equal(N.tiene(e, vlad, "Furia"), true);
  assert.equal(zonaDe(e, abel), "defensa");
});

test("Vlad el Empalador: también al atacar juega un Aliado de coste 1 del tope", () => {
  let e = mesa();
  const vlad = poner(e, 0, "defensa", "Vlad el Empalador");
  const abel = alTope(e, 0, "Abel", 1);
  e = atacar(e, vlad);
  assert.equal(zonaDe(e, abel), "defensa");
});

test("Vlad el Empalador: en tu turno, cuando otro de tus Aliados sale del juego Baraja hasta una carta de coste 3 o menos y el oponente Bota tres", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Vlad el Empalador");
  const cam = poner(e, 0, "defensa", "Cam");
  const rival = poner(e, 1, "defensa", "Valefor");
  N.mover(e, cam, "cementerio");
  resolver(e);
  e = elegir(e, rival);
  assert.equal(zonaDe(e, rival), "castillo");
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Vlad el Empalador: en el turno oponente no se dispara", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Vlad el Empalador");
  const cam = poner(e, 0, "defensa", "Cam");
  e.activo = 1;
  N.mover(e, cam, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Abd-El-Kerim: tiene Furia y el oponente debe declarar ataque si puede", () => {
  const e = mesa();
  const abd = poner(e, 0, "defensa", "Abd-El-Kerim");
  poner(e, 1, "defensa", "Valefor");
  e.activo = 1;
  assert.equal(N.tiene(e, abd, "Furia"), true);
  const l = accionesLegales(e);
  assert.equal(l.some((a) => a.tipo === "terminar"), false);
  assert.equal(l.some((a) => a.tipo === "batalla"), true);
});

test("Abd-El-Kerim: su controlador también debe declarar ataque si puede", { todo: "restricción: todos los jugadores, incluido el controlador, deben declarar ataque si pueden" }, () => {});

test("Abd-El-Kerim: al entrar, este y otro Aliado que controles no pueden salir del juego hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const abd = poner(e, 0, "mano", "Abd-El-Kerim");
  const valefor = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(abd)));
  assert.equal(N.puedeSalir(e, abd), false);
  assert.equal(N.puedeSalir(e, valefor), false);
});

test("Abel: tiene Indestructible", () => {
  const e = mesa();
  assert.equal(N.tiene(e, poner(e, 0, "defensa", "Abel"), "Indestructible"), true);
});

test("Abel: en tu Vigilia un Aliado gana Fuerza igual a los Aliados que controla tu oponente", () => {
  let e = mesa();
  const abel = poner(e, 0, "defensa", "Abel");
  const valefor = poner(e, 0, "defensa", "Valefor");
  [1, 2, 3].forEach(() => poner(e, 1, "defensa", "Valefor"));
  e = aplicar(e, habilidad(abel, "Abel"));
  e = elegir(e, "Contar los Aliados oponentes");
  e = elegir(e, valefor);
  assert.equal(N.fuerza(e, valefor), 6);
  assert.equal(puedeUsar(e, abel), false);
});

test("Abel: o igual a los Aliados que controlas", () => {
  let e = mesa();
  const abel = poner(e, 0, "defensa", "Abel");
  poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(abel, "Abel"));
  e = elegir(e, "Contar tus Aliados");
  e = elegir(e, abel);
  assert.equal(N.fuerza(e, abel), 3);
});

test("Abel: Convertir cartas y Barajar tus Aliados Héroe cuesta un Oro adicional", { todo: "efecto: Convertir cartas y Barajar Aliados propios de cierta raza cuesta un Oro adicional" }, () => {});

test("Abraham Van Helsing: al entrar busca un Aliado y un Arma en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const abraham = poner(e, 0, "mano", "Abraham Van Helsing");
  poner(e, 0, "castillo", "Valefor");
  poner(e, 0, "castillo", "Pedrenyal");
  e = sinRespuesta(aplicar(e, jugar(abraham)));
  e = elegir(e, nombreDe(e, "Valefor"));
  e = elegir(e, nombreDe(e, "Pedrenyal"));
  assert.deepEqual(nombresEn(e, 0, "mano").sort(), ["Pedrenyal", "Valefor"]);
});

test("Abraham Van Helsing: una vez por turno un Aliado gana 1 de Fuerza e Indestructible", () => {
  let e = mesa();
  const abraham = poner(e, 0, "defensa", "Abraham Van Helsing");
  const valefor = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(abraham, "Abraham Van Helsing"));
  e = elegir(e, valefor);
  assert.equal(N.fuerza(e, valefor), 4);
  assert.equal(N.tiene(e, valefor, "Indestructible"), true);
  assert.equal(puedeUsar(e, abraham), false);
});

test("Abraham Van Helsing: puede Barajarse para prevenir que otro Aliado salga del juego", { todo: "reemplazo: pagar un coste para prevenir que cartas salgan del juego" }, () => {});

test("Akari: al entrar muestra un Oro, un Arma y un Tótem; uno a la mano y dos al Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const akari = poner(e, 0, "mano", "Akari");
  const arma = alTope(e, 0, "Pedrenyal", 0);
  const totem = alTope(e, 0, "Isla de Poveglia", 1);
  const oro = e.jugadores[0].castillo[2];
  e = sinRespuesta(aplicar(e, jugar(akari)));
  assert.deepEqual(valores(e).sort(), [arma, totem, oro].sort());
  e = elegir(e, arma);
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(zonaDe(e, totem), "cementerio");
  assert.equal(zonaDe(e, oro), "cementerio");
});

test("Akari: puede Desterrarse para Anular una carta de coste 1 o menos que no sea Aliado", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Akari Musashi: al entrar destierra una carta oponente que no sea Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const akari = poner(e, 0, "mano", "Akari Musashi");
  const rival = poner(e, 1, "defensa", "Valefor");
  const oro = poner(e, 1, "reserva", "Onsen");
  e = sinRespuesta(aplicar(e, jugar(akari)));
  assert.equal(zonaDe(e, rival), "destierro");
  assert.equal(zonaDe(e, oro), "reserva");
});

test("Akari Musashi: al atacar también destierra una carta oponente", () => {
  let e = mesa();
  const akari = poner(e, 0, "defensa", "Akari Musashi");
  const rival = poner(e, 1, "defensa", "Valefor");
  e = atacar(e, akari);
  assert.equal(zonaDe(e, rival), "destierro");
});

test("Akari Musashi: una vez por turno busca un Aliado Héroe en tu Castillo", () => {
  let e = mesa();
  const akari = poner(e, 0, "defensa", "Akari Musashi");
  const abel = poner(e, 0, "castillo", "Abel");
  const tepes = poner(e, 0, "castillo", "Vlad Tepes");
  e = aplicar(e, habilidad(akari, "Akari Musashi"));
  assert.equal(valores(e).includes(abel), true);
  assert.equal(valores(e).includes(tepes), false);
  e = elegir(e, abel);
  assert.equal(zonaDe(e, abel), "mano");
  assert.equal(puedeUsar(e, akari), false);
});

test("Akari Musashi: al oponente le cuesta un Oro adicional jugar Talismanes", { todo: "impuesto: el oponente paga un Oro adicional por jugar Talismanes" }, () => {});

test("Akari la Piloto Fenix: al entrar puede Desterrar un Aliado de coste 2 o menos de tu Cementerio y ganar sus habilidades", () => {
  let e = mesa();
  oros(e, 0, 3);
  const akari = poner(e, 0, "mano", "Akari la Piloto Fenix");
  const valefor = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(akari)));
  e = elegir(e, true);
  assert.equal(zonaDe(e, valefor), "destierro");
  assert.deepEqual(e.ganadas[akari], [id("Valefor")]);
  assert.ok(N.habilidades(e, akari).some((d) => d.nombre === "Valefor"));
  assert.equal(N.tiene(e, akari, "Furia"), true);
  assert.equal(N.tiene(e, akari, "Indestructible"), true);
});

test("Akari la Piloto Fenix: se dispara al atacar sola pero no si ataca acompañada", () => {
  let e = mesa();
  const akari = poner(e, 0, "defensa", "Akari la Piloto Fenix");
  poner(e, 0, "cementerio", "Valefor");
  const sola = atacar(e, akari);
  assert.notEqual(sola.pendiente, null);
  const otro = poner(e, 0, "defensa", "Valefor");
  e = atacar(e, otro);
  e = aplicar(e, { tipo: "atacar", uid: akari });
  assert.equal(e.pendiente, null);
});

test("Akari la Piloto Fenix: al salir Baraja dos Aliados de tu Destierro y Destruye hasta un Aliado o Tótem", () => {
  let e = mesa();
  const akari = poner(e, 0, "defensa", "Akari la Piloto Fenix");
  const d = [1, 2].map(() => poner(e, 0, "destierro", "Valefor"));
  const rival = poner(e, 1, "defensa", "Valefor");
  N.mover(e, akari, "cementerio");
  resolver(e);
  for (const u of d) assert.equal(zonaDe(e, u), "castillo");
  e = elegir(e, rival);
  assert.equal(zonaDe(e, rival), "cementerio");
});

test("Akari la Piloto Fenix: su habilidad no puede ser cancelada", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});

test("Alicia: una vez por turno un Aliado gana 3 de Fuerza y robas dos cartas", () => {
  let e = mesa();
  const alicia = poner(e, 0, "defensa", "Alicia");
  e = aplicar(e, habilidad(alicia, "Alicia"));
  assert.equal(N.fuerza(e, alicia), 5);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, alicia), false);
});

test("Alicia: no puede ser afectada por Talismanes", { todo: "protección: no puede ser afectado por Talismanes" }, () => {});

test("Alicia: al oponente le cuesta un Oro adicional usar habilidades o poner Oros tras repetirlos en el turno", { todo: "impuesto: el oponente paga un Oro adicional por usar habilidades o poner Oros tras superar un umbral en el turno" }, () => {});

test("Allan Quatermain: tiene Indestructible y una vez por turno una carta que no sea Oro pierde su habilidad y es Destruida", () => {
  let e = mesa();
  const allan = poner(e, 0, "defensa", "Allan Quatermain");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, allan, "Indestructible"), true);
  e = aplicar(e, habilidad(allan, "Allan Quatermain"));
  e = elegir(e, rival);
  assert.equal(zonaDe(e, rival), "cementerio");
  assert.equal(puedeUsar(e, allan), false);
});

test("Allan Quatermain: al oponente le cuesta un Oro adicional afectarlo", { todo: "efecto: afectar a ciertas cartas cuesta un Oro adicional al oponente" }, () => {});

test("Allan Quatermain: al oponente le cuesta un Oro adicional jugar cartas sin pagar su coste", { todo: "impuesto: el oponente paga un Oro adicional por jugar cartas sin pagar su coste" }, () => {});

test("Almirante Akari: tiene Indestructible y al comienzo del Ataque genera un Oro para Aliados o Armas", () => {
  let e = mesa();
  const akari = poner(e, 0, "defensa", "Almirante Akari");
  assert.equal(N.tiene(e, akari, "Indestructible"), true);
  e = atacar(e, akari);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Aliado", "Arma"] }]);
});

test("Almirante Akari: puede Barajar una carta para Anular una carta de coste 2 o menos", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Almirante Akari: puede Barajar una carta para prevenir que un Aliado sea afectado por un efecto oponente", { todo: "respuesta: prevenir que una carta propia sea afectada por un efecto oponente" }, () => {});

test("Almirante Gorm: al entrar una carta de coste 2 o menos pierde su habilidad por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const gorm = poner(e, 0, "mano", "Almirante Gorm");
  const rival = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(gorm)));
  e = elegir(e, rival);
  assert.equal(N.activa(e, rival), false);
  assert.ok(e.efectos.some((f) => f.uid === rival && f.fin.finTurno === e.turno));
});

test("Almirante Gorm: desde la mano paga un Oro para prevenir un efecto oponente y entra sin pagar su coste", { todo: "respuesta: desde la mano, prevenir que un Aliado sea afectado por un efecto oponente y jugarla sin pagar su coste" }, () => {});

test("Arthur Gordon Pym: puede jugarse al comienzo del Bloqueo", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});

test("Arthur Gordon Pym: cuando bloquea, los Aliados bloqueados no hacen daño de combate", { todo: "disparo: al bloquear" }, () => {});

test("Arthur Gordon Pym: solo se pueden agrupar hasta cinco cartas por turno", { todo: "restricción: máximo de cartas que se agrupan por turno" }, () => {});

test("Axel: tiene Indestructible y solo entra pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 4);
  const axel = poner(e, 0, "mano", "Axel");
  const otro = poner(e, 0, "castillo", "Axel");
  assert.equal(N.tiene(e, axel, "Indestructible"), true);
  OPS.entrar(e, { uid: otro, datos: { pagado: false } }, { ctx: { ctrl: 0, vars: {} } });
  assert.equal(zonaDe(e, otro), "castillo");
  e = sinRespuesta(aplicar(e, jugar(axel)));
  assert.equal(zonaDe(e, axel), "defensa");
});

test("Axel: al oponente le cuesta un Oro adicional jugar cartas", { todo: "impuesto: el oponente paga un Oro adicional por jugar cartas" }, () => {});

test("Blanca Nieves: tiene Indestructible y al entrar Baraja hasta un Aliado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const blanca = poner(e, 0, "mano", "Blanca Nieves");
  const rival = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(blanca)));
  e = elegir(e, rival);
  assert.equal(N.tiene(e, blanca, "Indestructible"), true);
  assert.equal(zonaDe(e, rival), "castillo");
});

test("Blanca Nieves: cuando otro de tus Aliados sale del juego puedes jugar un Aliado de tu mano reduciendo su coste en uno", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Blanca Nieves");
  const cam = poner(e, 0, "defensa", "Cam");
  const valefor = poner(e, 0, "mano", "Valefor");
  N.mover(e, cam, "cementerio");
  resolver(e);
  e = elegir(e, true);
  e = elegir(e, valefor);
  assert.equal(zonaDe(e, valefor), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("Blanca Nieves: también puede jugarlo desde tu Cementerio pagando un Oro menos, una vez por turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Blanca Nieves");
  const cams = [1, 2].map(() => poner(e, 0, "defensa", "Cam"));
  const balaur = poner(e, 0, "cementerio", "Balaur");
  N.mover(e, cams[0], "cementerio");
  resolver(e);
  e = elegir(e, true);
  e = elegir(e, balaur);
  assert.equal(zonaDe(e, balaur), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  N.mover(e, cams[1], "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
});

test("Cam: al entrar un Aliado no puede salir del juego hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const cam = poner(e, 0, "mano", "Cam");
  const valefor = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(cam)));
  e = elegir(e, "Un Aliado no puede salir del juego hasta tu próximo turno");
  e = elegir(e, valefor);
  assert.equal(N.puedeSalir(e, valefor), false);
});

test("Cam: o hasta dos Aliados cambian su habilidad por Indestructible y tienen Fuerza 0 por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const cam = poner(e, 0, "mano", "Cam");
  const rival = poner(e, 1, "defensa", "Keshalyi");
  const otro = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(cam)));
  e = elegir(e, "Hasta dos Aliados cambian su habilidad por Indestructible y tienen Fuerza 0 por el turno");
  e = elegir(e, rival);
  e = elegir(e, otro);
  for (const u of [rival, otro]) {
    assert.equal(N.fuerza(e, u), 0);
    assert.equal(N.tiene(e, u, "Indestructible"), true);
  }
  assert.equal(N.activa(e, rival), false);
  assert.equal(N.fuerza(e, cam), 2);
});

test("Cam: puede jugarse al comienzo del Bloqueo", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});

test("Capitan Daisuke: en tu Vigilia un Aliado gana Furia, Indestructible y 1 de Fuerza", () => {
  let e = mesa();
  const daisuke = poner(e, 0, "defensa", "Capitan Daisuke");
  e = aplicar(e, habilidad(daisuke, "Capitan Daisuke"));
  assert.equal(N.fuerza(e, daisuke), 5);
  assert.equal(N.tiene(e, daisuke, "Furia"), true);
  assert.equal(N.tiene(e, daisuke, "Indestructible"), true);
  assert.equal(puedeUsar(e, daisuke), false);
});

test("Capitan Daisuke: en tu Fase Final Baraja y/o Destierra hasta cuatro cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Capitan Daisuke");
  const m = poner(e, 0, "cementerio", "Valefor");
  const r = poner(e, 1, "cementerio", "Valefor");
  const queda = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, m);
  e = elegir(e, null);
  e = elegir(e, r);
  e = elegir(e, null);
  assert.equal(zonaDe(e, m), "castillo");
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(zonaDe(e, queda), "cementerio");
});

test("Capitan Daisuke: al atacar con un solo Aliado, al oponente le cuesta un Oro adicional usar habilidades de Oro", { todo: "impuesto: el oponente paga un Oro adicional por usar habilidades de Oros durante un período" }, () => {});

test("Cazador Zíngaro: tiene Indestructible y al entrar Destruye una carta oponente que no sea Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const cazador = poner(e, 0, "mano", "Cazador Zíngaro");
  const rival = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(cazador)));
  assert.equal(N.tiene(e, cazador, "Indestructible"), true);
  assert.equal(zonaDe(e, rival), "cementerio");
});

test("Cazador Zíngaro: al atacar también Destruye una carta oponente", () => {
  let e = mesa();
  const cazador = poner(e, 0, "defensa", "Cazador Zíngaro");
  const rival = poner(e, 1, "defensa", "Valefor");
  e = atacar(e, cazador);
  assert.equal(zonaDe(e, rival), "cementerio");
});

test("Cazador Zíngaro: en tu Fase Final Baraja hasta dos de tu Cementerio, Destierra hasta dos del oponente y roba una", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Cazador Zíngaro");
  const m = [1, 2, 3].map(() => poner(e, 0, "cementerio", "Valefor"));
  const r = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, m[0]);
  e = elegir(e, m[1]);
  e = elegir(e, r[0]);
  e = elegir(e, r[1]);
  assert.deepEqual(m.map((u) => zonaDe(e, u)), ["castillo", "castillo", "cementerio"]);
  assert.deepEqual(r.map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
  assert.equal(e.jugadores[0].mano.length, 2);
});
