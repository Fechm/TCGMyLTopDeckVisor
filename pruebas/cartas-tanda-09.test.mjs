import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const generados = (e, j) => (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

function controlarAjena(e, j, zona, nombre) {
  const u = poner(e, N.rival(j), "mano", nombre);
  N.sacar(e, u);
  e.jugadores[j][zona].push(u);
  return u;
}

test("Contactar Ancestros: el Aliado elegido no puede salir del juego ni cambiar de controlador este turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const c = poner(e, 0, "mano", "Contactar Ancestros");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(N.puedeSalir(e, v), false);
  assert.equal(N.puedeTomar(e, v, 1), false);
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Contactar Ancestros: prevenir que un Aliado sea Anulado", { todo: "efecto: prevenir que un Aliado sea Anulado" }, () => {});

test("Contactar Ancestros: en tu Vigilia sin Oros puestos, se convierte en un Oro sin habilidad en tu Reserva y Robas una", () => {
  let e = mesa();
  const c = poner(e, 0, "mano", "Contactar Ancestros");
  assert.equal(puedeUsar(e, c), true);
  e = aplicar(e, habilidad(c, "Contactar Ancestros"));
  assert.equal(zonaDe(e, c), "reserva");
  assert.equal(N.carta(e, c).tipo, "Oro");
  assert.equal(N.carta(e, c).sinHabilidad, true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Contactar Ancestros: no se convierte si ya pusiste un Oro este turno", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Contactar Ancestros");
  e.jugadores[0].oroJugado = true;
  e.jugadores[0].orosPuestos = 1;
  assert.equal(puedeUsar(e, c), false);
});

test("Contacto con Friendship: ganas el control de un Arma oponente y la porta tu Aliado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Galahad");
  const a = poner(e, 1, "arma", "Martillo Sacro", { portador: r });
  const c = poner(e, 0, "mano", "Contacto con Friendship");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.deepEqual(e.armas[v], [a]);
  assert.equal(N.controlador(e, a), 0);
  assert.equal(generados(e, 0), 0);
});

test("Contacto con Friendship: si eres el dueño del Arma, generas un Oro por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Galahad");
  poner(e, 0, "arma", "Martillo Sacro", { portador: r });
  const c = poner(e, 0, "mano", "Contacto con Friendship");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(generados(e, 0), 1);
});

test("Contacto con Friendship: Desterrarlo para prevenir que el oponente Baraje o Destierre cartas de los Cementerios", { todo: "prevención: Desterrarla de la mano o Cementerio para prevenir que el oponente Baraje o Destierre cartas de los Cementerios" }, () => {});

test("Corromper: no se puede jugar con menos de 3 cartas en mano", () => {
  const e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Corromper");
  poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Valefor");
  assert.equal(puedeJugar(e, c), false);
  poner(e, 0, "mano", "Valefor");
  assert.equal(puedeJugar(e, c), true);
});

test("Corromper: cada jugador elige una carta de la mano oponente y la pone en su mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Corromper");
  const m = [poner(e, 0, "mano", "Valefor"), poner(e, 0, "mano", "El Dracul"), poner(e, 0, "mano", "Sir Galahad")];
  const r1 = poner(e, 1, "mano", "Sir Persival");
  poner(e, 1, "mano", "Jabberwocky");
  e = hacer(e, jugar(c), r1);
  assert.equal(e.pendiente.jugador, 1);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === r1), false);
  e = elegir(e, m[1]);
  assert.equal(e.jugadores[0].mano.includes(r1), true);
  assert.equal(e.jugadores[1].mano.includes(m[1]), true);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[1].mano.length, 2);
});

test("Cortar las Cadenas: no puede ser Anulado y el oponente Bota cinco cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Cortar las Cadenas");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[1].cementerio.length, 5);
  assert.equal(e.jugadores[1].castillo.length, 25);
});

test("Cortar las Cadenas: Exhumar, se juega desde el Cementerio y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "cementerio", "Cortar las Cadenas");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === c && a.desde === "cementerio"), true);
  e = sinRespuesta(aplicar(e, jugar(c, { desde: "cementerio" })));
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 5);
});

test("Cortar las Cadenas: desde el Destierro, pagar un Oro para Barajarlo y Robar dos o buscar un Tenshi", { todo: "activada desde el Destierro" }, () => {});

test("Corte Letal: Destierra una carta del Cementerio oponente y todas sus copias del Castillo, Cementerio y mano, y Robas dos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "mano", "Corte Letal");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "mano", "Valefor");
  const d = poner(e, 1, "castillo", "Valefor");
  const otra = poner(e, 1, "mano", "El Dracul");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.deepEqual([a, b, d].map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro"]);
  assert.equal(zonaDe(e, otra), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Corte Letal: Descartar dos cartas para reducir su coste en dos y que no pueda ser Anulado", { todo: "coste alternativo: Descartar cartas para reducir el coste y volverse no anulable" }, () => {});

test("Cruzar el Bosque: sube una carta oponente de coste 2 o menos a la mano, Robas dos y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 0, "mano", "Cruzar el Bosque");
  e = hacer(e, jugar(c), "Subir una carta oponente de coste 2 o menos a la mano");
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[1].mano.includes(v), true);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Cruzar el Bosque: Destruye hasta dos cartas de coste 1 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const d = poner(e, 1, "defensa", "El Dracul");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  const c = poner(e, 0, "mano", "Cruzar el Bosque");
  e = hacer(e, jugar(c), "Destruir hasta dos cartas de coste 1 o menos", v, d);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Cruzar el Bosque: jugarla desde tu Destierro y Barajarla en tu Castillo", { todo: "jugar una carta desde el Destierro" }, () => {});

test("Cruzar la Cordillera: Robas una carta y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Cruzar la Cordillera");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Cruzar la Cordillera: jugarlo al comienzo de la Vigilia", { todo: "momento: jugar un Talismán al comienzo de la Vigilia" }, () => {});

test("Cruzar la Cordillera: jugar una carta de un tipo ya jugado en el turno exige Desterrar una carta de la mano", { todo: "efecto: jugar una carta de un tipo ya jugado este turno exige Desterrar una carta de la mano" }, () => {});

test("Cuarto Sello: busca un Sello, Destruye hasta una carta de coste 4 o menos y Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "castillo", "Primer Sello");
  const v = poner(e, 1, "defensa", "Jaques de Molay");
  const c = poner(e, 0, "mano", "Cuarto Sello");
  e = hacer(e, jugar(c), s, v);
  assert.equal(zonaDe(e, s), "mano");
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Cuarto Sello: pagar un Oro y Descartarlo hace que un Aliado pierda su habilidad y 4 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Jaques de Molay");
  const c = poner(e, 0, "mano", "Cuarto Sello");
  e = aplicar(e, habilidad(c, "Cuarto Sello"));
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(N.fuerza(e, v), 0);
  assert.equal(N.activa(e, v), false);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Cuarto Sello: jugarlo al comienzo de cualquier Fase", { todo: "momento: jugar un Talismán al comienzo de cualquier Fase" }, () => {});

test("Culto a la Muerte: cancela la habilidad de una carta y de las de su nombre por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 0, "mano", "Culto a la Muerte");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(N.activa(e, v), false);
  const otra = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.activa(e, otra), false);
});

test("Culto a la Muerte: como respuesta Anula una carta de coste 2 o menos que no sea Aliado y la Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const t = poner(e, 0, "mano", "Llamar a la Manada");
  const c = poner(e, 1, "mano", "Culto a la Muerte");
  e = aplicar(e, jugar(t));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === c), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: c }));
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Culto a la Muerte: el oponente no puede utilizar más habilidades de esas cartas, sin afectar las propias", { todo: "efecto: el oponente no puede utilizar habilidades de cartas con un nombre este turno" }, () => {});

test("Danza Celestial: Baraja hasta cuatro cartas de tu Cementerio, Robas tres y queda Desterrada", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "El Dracul");
  const c = poner(e, 0, "mano", "Danza Celestial");
  e = hacer(e, jugar(c), "Barajar hasta cuatro cartas de tu Cementerio y Robar tres", a, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Danza Celestial: Destierra una carta sin habilidad propia y la juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Drácula");
  const c = poner(e, 0, "mano", "Danza Celestial");
  e = hacer(e, jugar(c), "Desterrar una carta sin habilidad de la que seas dueño y jugarla reduciendo su coste en un Oro", d);
  assert.equal(zonaDe(e, d), "reserva");
  assert.equal(e.jugadores[0].orosPuestos, 1);
});

test("Danza de Dragones: solo se juega si controlas y/o muestras al menos cinco Oros", () => {
  const e = mesa();
  oros(e, 0, 4);
  const c = poner(e, 0, "mano", "Danza de Dragones");
  assert.equal(puedeJugar(e, c), false);
  poner(e, 0, "mano", "Drácula");
  assert.equal(puedeJugar(e, c), true);
});

test("Danza de Dragones: sube hasta un Aliado u Oro de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 5);
  const v = poner(e, 0, "cementerio", "Valefor");
  const c = poner(e, 0, "mano", "Danza de Dragones");
  e = hacer(e, jugar(c), v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Danza de Dragones: prevén un efecto", { todo: "efecto: prevenir un efecto" }, () => {});

test("Danza del Cuchillo: Destruye un Aliado oponente de coste 3 o menos y busca un Oro en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const p = poner(e, 1, "defensa", "Sir Persival");
  const m = poner(e, 1, "defensa", "Jaques de Molay");
  const c = poner(e, 0, "mano", "Danza del Cuchillo");
  e = hacer(e, jugar(c), nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, p), "cementerio");
  assert.equal(zonaDe(e, m), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].mano[0]).tipo, "Oro");
});

test("Danza del Cuchillo: Desterrarlo del Cementerio y pagar un Oro para Robar dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "cementerio", "Danza del Cuchillo");
  e = aplicar(e, habilidad(c, "Danza del Cuchillo"));
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("De Rodillas: no puede ser Anulado y hasta dos Aliados oponentes pierden su habilidad y tienen Fuerza 0", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Jaques de Molay");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  const c = poner(e, 0, "mano", "De Rodillas");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
  e = hacer(e, jugar(c), a, b);
  assert.equal(N.fuerza(e, a), 0);
  assert.equal(N.fuerza(e, b), 0);
  assert.equal(N.activa(e, a), false);
  assert.equal(N.fuerza(e, g), 2);
});

test("Depredar: reduce su coste en un Oro por cada Aliado en juego, hasta 0", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Depredar");
  assert.equal(costeDe(e, 0, c).pagar, 3);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, c).pagar, 1);
  poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, c).pagar, 0);
});

test("Depredar: hasta tres Aliados de costes que sumen 3 o menos pierden su habilidad, Fuerza 0 y no pueden ser Destruidos", () => {
  let e = mesa();
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "El Dracul");
  const p = poner(e, 1, "defensa", "Sir Persival");
  const c = poner(e, 0, "mano", "Depredar");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
  e = hacer(e, jugar(c), a, b);
  assert.equal(e.pendiente, null);
  for (const u of [a, b]) {
    assert.equal(N.fuerza(e, u), 0);
    assert.equal(N.activa(e, u), false);
    assert.equal(N.tiene(e, u, "Indestructible"), true);
  }
  assert.equal(N.tiene(e, p, "Indestructible"), false);
});

test("Desafiar la Autoridad: Robas dos, Barajas tu Aliado y juegas gratis uno oponente del mismo coste y distinto nombre", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const d = poner(e, 1, "castillo", "El Dracul");
  const c = poner(e, 0, "mano", "Desafiar la Autoridad");
  e = hacer(e, jugar(c), d, false);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].defensa.includes(d), true);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Desafio de Humpty Dumpty: convierte la primera carta de tu Castillo en una copia del Aliado elegido de la mano oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 1, "mano", "Valefor");
  const c = poner(e, 0, "mano", "Desafio de Humpty Dumpty");
  const t = e.jugadores[0].castillo[0];
  e = hacer(e, jugar(c), "Convertir la primera carta de tu Castillo en una copia y ponerla en juego");
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, t), "defensa");
  assert.equal(N.carta(e, t).tipo, "Aliado");
  assert.equal(N.fuerza(e, t), 3);
  assert.equal(N.habilidades(e, t).some((d) => d.nombre === "Valefor"), true);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Desafio de Humpty Dumpty: o genera un Oro por el turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 1, "mano", "Valefor");
  const c = poner(e, 0, "mano", "Desafio de Humpty Dumpty");
  e = hacer(e, jugar(c), "Generar un Oro por el turno");
  assert.equal(generados(e, 0), 1);
});

test("Desafio del Ingenio: Baraja hasta tres cartas de los Cementerios, busca un Aliado y Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const d = poner(e, 0, "castillo", "El Dracul");
  const c = poner(e, 0, "mano", "Desafio del Ingenio");
  e = hacer(e, jugar(c), a, b, d);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, d), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Desafio del Ingenio: pagar un Oro y Desterrarlo del Cementerio Destierra las tres primeras del Castillo oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "cementerio", "Desafio del Ingenio");
  e = aplicar(e, habilidad(c, "Desafio del Ingenio"));
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 3);
});

test("Descubrir Disfraz: busca una copia del Aliado elegido y la juegas reduciendo su coste en dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 1, "defensa", "Valefor");
  const copia = poner(e, 0, "castillo", "Valefor");
  const c = poner(e, 0, "mano", "Descubrir Disfraz");
  e = hacer(e, jugar(c), "tu Castillo", copia);
  assert.equal(e.jugadores[0].defensa.includes(copia), true);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Descubrir Disfraz: Descartarlo para Robar una carta", () => {
  let e = mesa();
  const c = poner(e, 0, "mano", "Descubrir Disfraz");
  e = aplicar(e, habilidad(c, "Descubrir Disfraz"));
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Desembarco Orco: no puede ser Anulado y las cartas que no son Oro controladas por quien no es su dueño suben a la mano del dueño", () => {
  let e = mesa();
  const ajena = controlarAjena(e, 0, "defensa", "Valefor");
  const oroAjeno = controlarAjena(e, 1, "reserva", "Drácula");
  const propia = poner(e, 0, "defensa", "El Dracul");
  const c = poner(e, 0, "mano", "Desembarco Orco");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[1].mano.includes(ajena), true);
  assert.equal(zonaDe(e, oroAjeno), "reserva");
  assert.equal(zonaDe(e, propia), "defensa");
});

test("Despertar de Behemot: Baraja una carta oponente de coste 3 o más", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 1, "defensa", "Sir Persival");
  const c = poner(e, 0, "mano", "Despertar de Behemot");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
  e = hacer(e, jugar(c), "Barajar una carta oponente de coste 3 o más");
  assert.equal(zonaDe(e, p), "castillo");
});

test("Despertar de Behemot: busca en tu Castillo una carta de coste 3 o más, con Exhumar desde el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "castillo", "Sir Galahad");
  const c = poner(e, 0, "cementerio", "Despertar de Behemot");
  e = hacer(e, jugar(c, { desde: "cementerio" }), "Buscar en tu Castillo una carta de coste 3 o más", g);
  assert.equal(zonaDe(e, g), "mano");
  assert.equal(zonaDe(e, c), "destierro");
});

test("Despertar de Behemot: no puedes jugar cartas ni utilizar habilidades por el resto del turno", { todo: "efecto: no puedes jugar cartas ni utilizar habilidades por el resto del turno" }, () => {});

test("Destruccion Urbana: convierte hasta dos cartas de un Cementerio en Tótems en tu Línea de Apoyo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "El Dracul");
  const c = poner(e, 0, "mano", "Destruccion Urbana");
  e = hacer(e, jugar(c), "Cementerio oponente", a, b);
  for (const u of [a, b]) {
    assert.equal(e.jugadores[0].apoyo.includes(u), true);
    assert.equal(N.carta(e, u).tipo, "Tótem");
  }
});

test("Destruccion Urbana: el Tótem puede Destruirse para Robar dos cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "cementerio", "Valefor");
  const c = poner(e, 0, "mano", "Destruccion Urbana");
  e = hacer(e, jugar(c), "Tu Cementerio", a);
  e = hacer(e, habilidad(a, "Destruccion Urbana"), "Robar dos cartas");
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Destruccion Urbana: el Tótem puede Destruirse para no recibir daño este turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "cementerio", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Galahad");
  const c = poner(e, 0, "mano", "Destruccion Urbana");
  e = hacer(e, jugar(c), "Tu Cementerio", a);
  e = hacer(e, habilidad(a, "Destruccion Urbana"), "No recibir daño este turno");
  assert.equal(e.efectos.some((f) => f.tipo === "sinDano" && f.uid === r), true);
});

test("Destruccion Urbana: Exhumar", () => {
  const e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "cementerio", "Destruccion Urbana");
  poner(e, 1, "cementerio", "Valefor");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === c && a.desde === "cementerio"), true);
});

test("Destruir Refugio: los Tótems de coste 2 o menos pierden su habilidad y son Destruidos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const carcosa = poner(e, 1, "apoyo", "Carcosa");
  const abadia = poner(e, 1, "apoyo", "Abadía de Carfax");
  const hoshi = poner(e, 1, "apoyo", "Fortaleza Hoshi");
  const c = poner(e, 0, "mano", "Destruir Refugio");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(zonaDe(e, carcosa), "cementerio");
  assert.equal(zonaDe(e, abadia), "cementerio");
  assert.equal(zonaDe(e, hoshi), "apoyo");
  assert.equal(e.jugadores[0].castillo.length, 30);
  assert.equal(e.jugadores[1].mano.length, 0);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Destruir Refugio: Exhumar", () => {
  const e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "cementerio", "Destruir Refugio");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === c && a.desde === "cementerio"), true);
});

test("Dolor de Rocinante: convierte una carta de coste 2 o menos en un Tótem sin habilidad y Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 0, "mano", "Dolor de Rocinante");
  e = hacer(e, jugar(c), v);
  assert.equal(e.jugadores[1].apoyo.includes(v), true);
  assert.equal(N.carta(e, v).tipo, "Tótem");
  assert.equal(N.carta(e, v).sinHabilidad, true);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Dolor de Rocinante: en tu Cementerio, al comienzo de la Fase Final oponente, Destierra una por cada carta sin habilidad que controle", () => {
  const e = mesa();
  poner(e, 0, "cementerio", "Dolor de Rocinante");
  oros(e, 1, 2);
  poner(e, 1, "defensa", "Valefor");
  disparar(e, "faseFinal", { j: 0 });
  assert.equal(e.jugadores[1].destierro.length, 0);
  disparar(e, "faseFinal", { j: 1 });
  assert.equal(e.jugadores[1].destierro.length, 2);
});

test("Dos de Cada Uno: busca dos cartas del mismo nombre que no sean Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "castillo", "Valefor");
  const b = poner(e, 0, "castillo", "Valefor");
  poner(e, 0, "castillo", "El Dracul");
  const c = poner(e, 0, "mano", "Dos de Cada Uno");
  e = hacer(e, jugar(c), nombreDe(e, "Valefor"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre !== "Valefor"), false);
  e = elegir(e, nombreDe(e, "Valefor"));
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, b), "mano");
});

test("Dos de Cada Uno: pagar un Oro y Desterrarlo de la mano para prevenir que cartas de coste 1 o menos sean afectadas", { todo: "prevención: cartas de coste N o menos de un mismo tipo no son afectadas por un efecto oponente" }, () => {});

test("Duelo Espacial: busca una carta en un Castillo o Cementerio y la pone en tu Oro Pagado como Oro sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 0, "mano", "Duelo Espacial");
  e = hacer(e, jugar(c), v);
  assert.equal(e.jugadores[0].pagado.includes(v), true);
  assert.equal(N.carta(e, v).tipo, "Oro");
  assert.equal(N.carta(e, v).sinHabilidad, true);
});

test("Duelo Espacial: en tu Cementerio, en tu Vigilia Robas una carta una vez por turno", () => {
  let e = mesa();
  const c = poner(e, 0, "cementerio", "Duelo Espacial");
  e = aplicar(e, habilidad(c, "Duelo Espacial"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(puedeUsar(e, c), false);
});

test("Duelo Espacial: en tu Cementerio no puede ser Desterrado", { todo: "continua desde el Cementerio: la carta no puede ser Desterrada" }, () => {});
