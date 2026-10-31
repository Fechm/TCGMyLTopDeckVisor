import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, elegir, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const oro = (uid, extra = {}) => ({ tipo: "oro", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const primero = (v) => v !== null && v !== false;
const puedeUsar = (e, uid, h) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && (h === undefined || a.h === h));
const generados = (e, j) => (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  N.sacar(e, uid);
  e.jugadores[j].castillo.unshift(uid);
  return uid;
}

function bloqueando(e, uid) {
  e.bloqueos = { [uid]: "atacante" };
  return e;
}

test("Malleus Maleficarum: al entrar nombra una carta y las cartas con ese nombre pierden su habilidad", () => {
  let e = mesa();
  const valefor = poner(e, 1, "defensa", "Valefor");
  const malleus = poner(e, 0, "mano", "Malleus Maleficarum");
  assert.equal(N.activa(e, valefor), true);
  e = aplicar(e, oro(malleus));
  assert.equal(N.activa(e, valefor), false);
  assert.equal(N.tiene(e, valefor, "Furia"), false);
  assert.equal(N.activa(e, malleus), true);
});

test("Malleus Maleficarum: al salir del juego las cartas nombradas recuperan su habilidad", () => {
  let e = mesa();
  const valefor = poner(e, 1, "defensa", "Valefor");
  const malleus = poner(e, 0, "mano", "Malleus Maleficarum");
  e = aplicar(e, oro(malleus));
  N.mover(e, malleus, "cementerio");
  resolver(e);
  assert.equal(N.activa(e, valefor), true);
});

test("Malleus Maleficarum: la pérdida de habilidad aplica solo mientras esté en tu Reserva", { todo: "efecto: las cartas nombradas pierden su habilidad solo mientras la fuente esté en la Reserva (no en el Oro Pagado)" }, () => {});

test("Malleus Maleficarum: al comienzo de tu Fase Final, desde tu Cementerio, Desterrando otra carta sube a tu mano", () => {
  let e = mesa();
  const malleus = poner(e, 0, "cementerio", "Malleus Maleficarum");
  const otra = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  assert.equal(zonaDe(e, otra), "destierro");
  assert.equal(zonaDe(e, malleus), "mano");
});

test("Malleus Maleficarum: sin otra carta en tu Cementerio no se dispara", () => {
  let e = mesa();
  const malleus = poner(e, 0, "cementerio", "Malleus Maleficarum");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, malleus), "cementerio");
});

test("Matriz V: al entrar Roba una carta y hasta dos cartas que controles ganan Indestructible", () => {
  let e = mesa();
  const [d] = oros(e, 0, 1);
  const matriz = poner(e, 0, "mano", "Matriz V");
  e = aplicar(e, oro(matriz));
  e = elegir(e, d);
  e = elegir(e, matriz);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.tiene(e, d, "Indestructible"), true);
  assert.equal(N.tiene(e, matriz, "Indestructible"), true);
});

test("Matriz V: no puede ser convertida", { todo: "efecto: no puede ser convertida" }, () => {});

test("Matriz V: en tu Reserva el oponente no dispara habilidades de cartas de coste 0 o 1 sin Desterrar una carta de su mano", { todo: "continua: el oponente no puede disparar habilidades de cartas de coste N o menos a menos que pague un coste (Desterrar de la mano)" }, () => {});

test("Medalla de Papa Legba: al entrar puedes Robar una carta", () => {
  let e = mesa();
  const legba = poner(e, 0, "mano", "Medalla de Papa Legba");
  e = aplicar(e, oro(legba));
  e = elegir(e, true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Medalla de Papa Legba: en tu Vigilia, si el oponente jugó más de dos cartas y controlas Aliados con Furia, pone la primera carta de su Castillo en tu Oro Pagado", () => {
  let e = mesa();
  const legba = poner(e, 0, "reserva", "Medalla de Papa Legba");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(puedeUsar(e, legba), false);
  e.jugadores[1].jugadas = { total: 3, nombres: {}, Aliado: 2, Talismán: 1 };
  const tope = e.jugadores[1].castillo[0];
  e = aplicar(e, habilidad(legba, "Medalla de Papa Legba"));
  assert.equal(zonaDe(e, tope), "pagado");
  assert.ok(e.jugadores[0].pagado.includes(tope));
  assert.equal(N.carta(e, tope).sinHabilidad, true);
  assert.equal(e.jugadores[1].castillo.length, 29);
  assert.equal(puedeUsar(e, legba), false);
});

test("Medalla de Papa Legba: sin Aliados con Furia no se puede usar", () => {
  const e = mesa();
  const legba = poner(e, 0, "reserva", "Medalla de Papa Legba");
  poner(e, 0, "defensa", "Guardia Real");
  e.jugadores[1].jugadas = { total: 3, nombres: {}, Aliado: 3 };
  assert.equal(puedeUsar(e, legba), false);
});

test("Medalla de Papa Legba: cuenta las habilidades que utilizó el oponente", { todo: "contador: habilidades utilizadas por un jugador en el turno" }, () => {});

test("Medalla de Santa Muerte: al comienzo del turno puedes descartar para nombrar una carta que no sea Oro, que pierde su habilidad por el turno", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Medalla de Santa Muerte");
  const x = poner(e, 0, "mano", "Guardia Real");
  const v = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = elegir(e, true);
  e = elegir(e, x);
  assert.equal(zonaDe(e, x), "cementerio");
  e = elegir(e, v);
  assert.equal(N.activa(e, v), false);
  N.expirar(e, "finTurno");
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, v), true);
});

test("Medalla de Santa Muerte: sin cartas en la mano no se dispara", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Medalla de Santa Muerte");
  e.activo = 1;
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 0);
  assert.equal(e.pendiente, null);
});

test("Medalla de Santa Muerte: los jugadores solo usan hasta tres habilidades de Oros, cartas de coste 0 o fuera del juego por turno", { todo: "continua: límite por turno de habilidades de Oros, cartas de coste 0 y cartas fuera del juego" }, () => {});

test("Mente Suprema: es Oro Inicial", () => {
  const e = mesa();
  const mente = poner(e, 0, "reserva", "Mente Suprema");
  assert.equal(N.carta(e, mente).oroInicial, true);
});

test("Mente Suprema: con dos o más Aliados con habilidad, los Talismanes que van al Cementerio son Desterrados", { todo: "reemplazo: los Talismanes que fueran al Cementerio son Desterrados en su lugar" }, () => {});

test("Mente Suprema: cada jugador Roba hasta dos cartas por efectos y juega hasta dos Talismanes por turno", { todo: "continua: máximo de cartas Robadas por efectos y máximo de cartas de un tipo concreto jugadas por turno" }, () => {});

test("Miguel de Cervantes: sin Aliados, una vez por turno pone un Aliado de coste 2 o menos de tu Cementerio como Aliado sin habilidad", () => {
  let e = mesa();
  const cervantes = poner(e, 0, "reserva", "Miguel de Cervantes");
  const guardia = poner(e, 0, "cementerio", "Guardia Real");
  poner(e, 0, "cementerio", "Sir Persival");
  e = aplicar(e, habilidad(cervantes, "Miguel de Cervantes"));
  assert.equal(zonaDe(e, guardia), "defensa");
  assert.equal(N.carta(e, guardia).sinHabilidad, true);
  assert.equal(N.fuerza(e, guardia), 3);
  assert.equal(puedeUsar(e, cervantes), false);
});

test("Miguel de Cervantes: si controlas Aliados no se puede usar", () => {
  const e = mesa();
  const cervantes = poner(e, 0, "reserva", "Miguel de Cervantes");
  poner(e, 0, "cementerio", "Guardia Real");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(puedeUsar(e, cervantes), false);
});

test("Miguel de Cervantes: si uno de tus Aliados de coste 2 o más es Anulado, genera un Oro para jugar Aliados", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Miguel de Cervantes");
  oros(e, 0, 2);
  const guardia = poner(e, 0, "mano", "Guardia Real");
  oros(e, 1, 1);
  const ciempies = poner(e, 1, "mano", "Ciempiés-SP");
  e = aplicar(e, jugar(guardia));
  e = aplicar(e, { tipo: "responder", uid: ciempies });
  while (!e.pendiente && e.pila.length && !e.pila.at(-1).cerrada) e = aplicar(e, { tipo: "noResponder" });
  assert.equal(zonaDe(e, guardia), "cementerio");
  assert.equal(generados(e, 0), 1);
  assert.deepEqual(e.jugadores[0].generados[0].tipos, ["Aliado"]);
});

test("Miguel de Cervantes: el Oro generado solo sirve para Aliados de coste 2 o más", { todo: "generar: Oro restringido a un tipo con coste mínimo" }, () => {});

test("Monitor Araucano: mostrando un Arma de tu mano pone la primera carta de tu Castillo como Aliado sin habilidad de Fuerza 0", () => {
  let e = mesa();
  const monitor = poner(e, 0, "reserva", "Monitor Araucano");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  const tope = alTope(e, 0, "Valefor");
  e = aplicar(e, habilidad(monitor, "Monitor Araucano"));
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.carta(e, tope).tipo, "Aliado");
  assert.equal(N.carta(e, tope).sinHabilidad, true);
  assert.equal(N.fuerza(e, tope), 0);
  assert.equal(puedeUsar(e, monitor), false);
});

test("Monitor Araucano: sin Armas en tu mano no se puede usar", () => {
  const e = mesa();
  const monitor = poner(e, 0, "reserva", "Monitor Araucano");
  poner(e, 0, "mano", "Valefor");
  assert.equal(puedeUsar(e, monitor), false);
});

test("Monitor Araucano: genera un Oro adicional al pagar Armas de coste 2 o más", { todo: "evento: al usar un Oro para pagar cartas de un tipo y coste mínimo, genera Oro adicional" }, () => {});

test("Muro de los Caidos: al entrar puede buscar un Aliado o Tótem de coste 2 o más y ponerlo en tu mano", () => {
  let e = mesa();
  const guardia = poner(e, 0, "castillo", "Guardia Real");
  poner(e, 0, "castillo", "Valefor");
  const muro = poner(e, 0, "mano", "Muro de los Caidos");
  e = aplicar(e, oro(muro));
  e = elegir(e, true);
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Valefor"), false);
  e = elegir(e, guardia);
  assert.equal(zonaDe(e, guardia), "mano");
});

test("Muro de los Caidos: cada jugador juega hasta tres cartas de coste 1 o menos y/o sin pagar su coste por turno", { todo: "continua: máximo por turno de cartas de coste N o menos y/o jugadas sin pagar su coste" }, () => {});

test("Necronomicon: una vez por turno pone hasta dos cartas de tu mano en el fondo de tu Castillo y Roba esa cantidad", () => {
  let e = mesa();
  const necro = poner(e, 0, "reserva", "Necronomicon");
  const a = poner(e, 0, "mano", "Valefor");
  const b = poner(e, 0, "mano", "Guardia Real");
  const c = poner(e, 0, "mano", "Sir Persival");
  e = aplicar(e, habilidad(necro, "Necronomicon"));
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.deepEqual(e.jugadores[0].castillo.slice(-2), [a, b]);
  assert.equal(zonaDe(e, c), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(puedeUsar(e, necro), false);
});

test("Necronomicon: los Oros en juego ganan Indestructible", { todo: "continua: los Oros en juego ganan una clave (Indestructible / Indesterrable)" }, () => {});

test("Necronomicon: no se puede jugar más de una carta sin pagar su coste por turno", { todo: "continua: máximo de cartas jugadas sin pagar su coste por turno" }, () => {});

test("Nombre de Horus: mirando el Castillo oponente pone tres cartas de ahí en su Destierro", () => {
  let e = mesa();
  const horus = poner(e, 0, "mano", "Nombre de Horus");
  e = aplicar(e, oro(horus));
  e = elegir(e, true);
  e = elegir(e, "Castillo oponente");
  for (let i = 0; i < 3; i++) e = elegir(e, primero);
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Nombre de Horus: mirando tu Castillo pone una carta en tu mano y dos en tu Cementerio", () => {
  let e = mesa();
  const horus = poner(e, 0, "mano", "Nombre de Horus");
  e = aplicar(e, oro(horus));
  e = elegir(e, true);
  e = elegir(e, "tu Castillo");
  for (let i = 0; i < 3; i++) e = elegir(e, primero);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 27);
});

test("Orden del Dragón: una carta de coste 2 o menos pierde su habilidad por el turno y busca mostrando el tipo nombrado", () => {
  let e = mesa();
  const v = poner(e, 1, "defensa", "Valefor");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  const orden = poner(e, 0, "mano", "Orden del Dragón");
  e = aplicar(e, oro(orden));
  e = elegir(e, v);
  e = elegir(e, "Nombrar Arma");
  assert.equal(N.activa(e, v), false);
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Orden del Dragón: nombrando Tótem pone el primer Tótem mostrado en tu mano", () => {
  let e = mesa();
  const totem = poner(e, 0, "castillo", "Fortaleza Hoshi");
  const orden = poner(e, 0, "mano", "Orden del Dragón");
  e = aplicar(e, oro(orden));
  e = elegir(e, "Nombrar Tótem");
  assert.equal(zonaDe(e, totem), "mano");
});

test("Pallax: al entrar pone la primera y la última carta de tu Castillo en tu mano", () => {
  let e = mesa();
  const tope = alTope(e, 0, "Valefor");
  const fondo = poner(e, 0, "castillo", "Guardia Real");
  const pallax = poner(e, 0, "mano", "Pallax");
  e = aplicar(e, oro(pallax));
  assert.equal(zonaDe(e, tope), "mano");
  assert.equal(zonaDe(e, fondo), "mano");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Pallax: Desterrando dos cartas de tu Cementerio entra desde él como un Aliado sin habilidad de Fuerza 2", () => {
  let e = mesa();
  const pallax = poner(e, 0, "cementerio", "Pallax");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(pallax, "Pallax"));
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, pallax), "defensa");
  assert.equal(N.carta(e, pallax).tipo, "Aliado");
  assert.equal(N.carta(e, pallax).sinHabilidad, true);
  assert.equal(N.fuerza(e, pallax), 2);
});

test("Pallax: sin dos cartas más en tu Cementerio no se puede usar", () => {
  const e = mesa();
  const pallax = poner(e, 0, "cementerio", "Pallax");
  poner(e, 0, "cementerio", "Valefor");
  assert.equal(puedeUsar(e, pallax), false);
});

test("Pallax: los efectos de Oros oponentes que afecten a tus Aliados con Arma cuestan un Oro adicional", { todo: "efecto: las habilidades de Oros oponentes que afecten a ciertos Aliados cuestan Oros adicionales" }, () => {});

test("Pan de Muerto: en tu Vigilia, pagándolo busca un Tótem de coste 2 o más y lo juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  const pan = poner(e, 0, "reserva", "Pan de Muerto");
  oros(e, 0, 2);
  const hoshi = poner(e, 0, "castillo", "Fortaleza Hoshi");
  e = aplicar(e, habilidad(pan, "Pan de Muerto"));
  e = elegir(e, hoshi);
  assert.equal(zonaDe(e, hoshi), "apoyo");
  assert.equal(zonaDe(e, pan), "pagado");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(puedeUsar(e, pan), false);
});

test("Pan de Muerto: también juega un Talismán de coste 2 o más y lo resuelve", () => {
  let e = mesa();
  const pan = poner(e, 0, "reserva", "Pan de Muerto");
  oros(e, 0, 1);
  const cuervo = poner(e, 0, "castillo", "Cuervo Nocturno");
  e = aplicar(e, habilidad(pan, "Pan de Muerto"));
  e = elegir(e, cuervo);
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(zonaDe(e, cuervo), "cementerio");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Pan de Muerto: si no alcanzan los Oros la carta buscada queda en el Castillo", () => {
  let e = mesa();
  const pan = poner(e, 0, "reserva", "Pan de Muerto");
  const hoshi = poner(e, 0, "castillo", "Fortaleza Hoshi");
  e = aplicar(e, habilidad(pan, "Pan de Muerto"));
  e = elegir(e, hoshi);
  assert.equal(zonaDe(e, hoshi), "castillo");
});

test("Pan de Muerto: tus Aliados son Indestructibles mientras bloquean", () => {
  const e = mesa();
  poner(e, 1, "reserva", "Pan de Muerto");
  const b = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, b, "Indestructible"), false);
  bloqueando(e, b);
  assert.equal(N.tiene(e, b, "Indestructible"), true);
});

test("Pan de Muerto: la carta jugada puede ser Anulada", { todo: "jugar desde un efecto: abrir la ventana de Anular para la carta jugada" }, () => {});

test("Pan de Muerto: solo se Botan y/o Destierran hasta quince cartas de cada Castillo por turno", { todo: "continua: máximo de cartas que salen de cada Castillo por Botar o Desterrar por turno" }, () => {});

test("Patria Vieja: es Oro Inicial y tus Aliados de coste 1 o más ganan 1 de Fuerza", () => {
  const e = mesa();
  const patria = poner(e, 0, "reserva", "Patria Vieja");
  assert.equal(N.carta(e, patria).oroInicial, true);
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, mio), 4);
  assert.equal(N.fuerza(e, suyo), 3);
});

test("Patria Vieja: en tu Vigilia, sin haber puesto Oros, mira seis cartas y pone un Oro de ahí en tu Reserva", () => {
  let e = mesa();
  const patria = poner(e, 0, "reserva", "Patria Vieja");
  e = aplicar(e, habilidad(patria, "Patria Vieja"));
  e = elegir(e, primero);
  assert.equal(e.jugadores[0].reserva.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 29);
  assert.equal(puedeUsar(e, patria), false);
});

test("Patria Vieja: si ya pusiste un Oro este turno no se puede usar", () => {
  let e = mesa();
  const patria = poner(e, 0, "reserva", "Patria Vieja");
  const d = poner(e, 0, "mano", "Drácula");
  e = aplicar(e, oro(d));
  assert.equal(puedeUsar(e, patria), false);
});

test("Patria Vieja: tus Aliados de coste 1 o más no son Destruidos cuando bloquean", () => {
  const e = mesa();
  poner(e, 1, "reserva", "Patria Vieja");
  const b = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, b, "Indestructible"), false);
  bloqueando(e, b);
  assert.equal(N.tiene(e, b, "Indestructible"), true);
});

test("Pebre: al entrar busca una Empanada y un Anticucho y los pone en tu mano", () => {
  let e = mesa();
  const empanada = poner(e, 0, "castillo", "Empanada");
  const anticucho = poner(e, 0, "castillo", "Anticucho");
  const pebre = poner(e, 0, "mano", "Pebre");
  e = aplicar(e, oro(pebre));
  e = elegir(e, empanada);
  e = elegir(e, anticucho);
  assert.equal(zonaDe(e, empanada), "mano");
  assert.equal(zonaDe(e, anticucho), "mano");
});

test("Pebre: Destruyendo un Oro que controles juega un Anticucho de tu mano reduciendo su coste en un Oro", () => {
  let e = mesa();
  const pebre = poner(e, 0, "reserva", "Pebre");
  const [d] = oros(e, 0, 1);
  const portador = poner(e, 0, "defensa", "Valefor");
  const anticucho = poner(e, 0, "mano", "Anticucho");
  e = aplicar(e, habilidad(pebre, "Pebre"));
  e = elegir(e, d);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.deepEqual(e.armas[portador], [anticucho]);
  assert.equal(zonaDe(e, pebre), "pagado");
  assert.equal(puedeUsar(e, pebre), false);
});

test("Pebre: sin Anticucho ni Terremoto en tu mano no se puede usar", () => {
  const e = mesa();
  const pebre = poner(e, 0, "reserva", "Pebre");
  oros(e, 0, 1);
  poner(e, 0, "mano", "Pedrenyal");
  assert.equal(puedeUsar(e, pebre), false);
});

test("Peral Encantado: se juega desde tu Cementerio y al entrar pone en tu mano un Oro con habilidad y uno sin habilidad", () => {
  let e = mesa();
  const peral = poner(e, 0, "cementerio", "Peral Encantado");
  const onsen = poner(e, 0, "castillo", "Onsen");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === peral && a.desde === "cementerio"));
  e = aplicar(e, oro(peral, { desde: "cementerio" }));
  assert.equal(zonaDe(e, peral), "reserva");
  assert.equal(zonaDe(e, onsen), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.ok(e.jugadores[0].mano.some((u) => N.carta(e, u).nombre === "Drácula"));
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Perla de Sangre: pagándola busca un Aliado y lo juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  const perla = poner(e, 0, "reserva", "Perla de Sangre");
  oros(e, 0, 1);
  const guardia = poner(e, 0, "castillo", "Guardia Real");
  e = aplicar(e, habilidad(perla, "Perla de Sangre"));
  e = elegir(e, guardia);
  e = elegir(e, "Jugarlo reduciendo su coste en un Oro");
  assert.equal(zonaDe(e, guardia), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, perla), "pagado");
});

test("Perla de Sangre: el coste reducido tiene un mínimo de 1", () => {
  let e = mesa();
  const perla = poner(e, 0, "reserva", "Perla de Sangre");
  const valefor = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, habilidad(perla, "Perla de Sangre"));
  e = elegir(e, valefor);
  e = elegir(e, "Jugarlo reduciendo su coste en un Oro");
  assert.equal(zonaDe(e, valefor), "castillo");
});

test("Perla de Sangre: puede poner el Aliado buscado en tu mano", () => {
  let e = mesa();
  const perla = poner(e, 0, "reserva", "Perla de Sangre");
  const guardia = poner(e, 0, "castillo", "Guardia Real");
  e = aplicar(e, habilidad(perla, "Perla de Sangre"));
  e = elegir(e, guardia);
  e = elegir(e, "Ponerlo en tu mano");
  assert.equal(zonaDe(e, guardia), "mano");
});

test("Perla de Sangre: convirtiéndose en Oro sin habilidad Baraja hasta cuatro cartas de los Cementerios y Roba hasta dos", () => {
  let e = mesa();
  const perla = poner(e, 0, "reserva", "Perla de Sangre");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, habilidad(perla, "Perla de Sangre", 1));
  e = elegir(e, a);
  e = elegir(e, b);
  e = elegir(e, "Barajar");
  e = elegir(e, 2);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.carta(e, perla).sinHabilidad, true);
  assert.equal(zonaDe(e, perla), "reserva");
  assert.equal(puedeUsar(e, perla), false);
});

test("Piedra del Chaman: al entrar Roba una carta", () => {
  let e = mesa();
  const piedra = poner(e, 0, "mano", "Piedra del Chaman");
  e = aplicar(e, oro(piedra));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Piedra del Chaman: cuando un efecto oponente la pone en tu Cementerio vuelve a tu Oro Pagado", () => {
  let e = mesa();
  const piedra = poner(e, 0, "reserva", "Piedra del Chaman");
  e.activo = 1;
  oros(e, 1, 1);
  const lucy = poner(e, 1, "mano", "Regresa Lucy");
  e = aplicar(e, jugar(lucy));
  e = elegir(e, piedra);
  assert.equal(zonaDe(e, piedra), "pagado");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Piedra del Chaman: si no es por un efecto oponente se queda en el Cementerio", () => {
  const e = mesa();
  const piedra = poner(e, 0, "reserva", "Piedra del Chaman");
  N.mover(e, piedra, "cementerio");
  resolver(e);
  assert.equal(zonaDe(e, piedra), "cementerio");
});

test("Piedra del Chaman: una vez por turno, cuando una carta va a un Cementerio puedes Desterrarla", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Piedra del Chaman");
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  N.mover(e, a, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, a), "destierro");
  N.mover(e, b, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, b), "cementerio");
});

test("Piedra del Chaman: el daño directo disminuye en dos", { todo: "continua: reducir el daño directo (no de combate)" }, () => {});

test("Pintura Sagrada: sin haber puesto Oros, en tu Vigilia la pones desde tu mano en tu Reserva y al entrar busca una carta para tu Cementerio", () => {
  let e = mesa();
  const pintura = poner(e, 0, "mano", "Pintura Sagrada");
  const d = poner(e, 0, "mano", "Drácula");
  assert.equal(puedeUsar(e, pintura), true);
  e = aplicar(e, habilidad(pintura, "Pintura Sagrada"));
  e = elegir(e, primero);
  assert.equal(zonaDe(e, pintura), "reserva");
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === d), false);
});

test("Pintura Sagrada: si ya pusiste un Oro este turno no puede ponerse en tu Reserva", () => {
  let e = mesa();
  const pintura = poner(e, 0, "mano", "Pintura Sagrada");
  const d = poner(e, 0, "mano", "Drácula");
  e = aplicar(e, oro(d));
  assert.equal(puedeUsar(e, pintura), false);
});

test("Pintura Sagrada: en cada Fase Final puedes Barajar o Desterrar una carta de un Cementerio", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Pintura Sagrada");
  const x = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  e = elegir(e, "Desterrar");
  assert.equal(zonaDe(e, x), "destierro");
});

test("Polvo de Hadas: al entrar mira tres cartas y pone una en tu mano, otra en tu Cementerio y otra en tu Destierro o fondo del Castillo", () => {
  let e = mesa();
  const polvo = poner(e, 0, "mano", "Polvo de Hadas");
  e = aplicar(e, oro(polvo));
  e = elegir(e, true);
  e = elegir(e, primero);
  e = elegir(e, primero);
  e = elegir(e, "Destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(e.jugadores[0].destierro.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 27);
});

test("Polvo de Hadas: la tercera carta puede ir al fondo de tu Castillo", () => {
  let e = mesa();
  const tercera = e.jugadores[0].castillo[2];
  const polvo = poner(e, 0, "mano", "Polvo de Hadas");
  e = aplicar(e, oro(polvo));
  e = elegir(e, true);
  e = elegir(e, e.jugadores[0].castillo[0]);
  e = elegir(e, e.jugadores[0].castillo[0]);
  e = elegir(e, "Fondo de tu Castillo");
  assert.equal(e.jugadores[0].castillo.at(-1), tercera);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Polvo de Hadas: convirtiéndose en Oro sin habilidad previene que un efecto oponente Bote o Destierre del tope de tu Castillo", { todo: "prevención: convertir esta carta para prevenir que un efecto oponente Bote o Destierre cartas de tu Castillo" }, () => {});

test("Primer Escudo: en tu Vigilia, sin haber puesto Oros, se pone desde tu Cementerio en tu Reserva", () => {
  let e = mesa();
  const escudo = poner(e, 0, "cementerio", "Primer Escudo");
  e = aplicar(e, habilidad(escudo, "Primer Escudo", 1));
  assert.equal(zonaDe(e, escudo), "reserva");
  assert.equal(e.jugadores[0].oroJugado, true);
});

test("Primer Escudo: también desde tu mano, y no si ya pusiste un Oro", () => {
  let e = mesa();
  const escudo = poner(e, 0, "mano", "Primer Escudo");
  const otro = poner(e, 0, "cementerio", "Primer Escudo");
  e = aplicar(e, habilidad(escudo, "Primer Escudo", 0));
  assert.equal(zonaDe(e, escudo), "reserva");
  assert.equal(puedeUsar(e, otro), false);
});

test("Primer Escudo: convirtiéndolo, pagando un Oro y mostrando dos Aliados Anula un Talismán", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Quantum Megumi: una vez por turno Baraja una carta de tu mano para Barajar hasta tres de tu Cementerio y Robar una", () => {
  let e = mesa();
  const quantum = poner(e, 0, "reserva", "Quantum Megumi");
  const m = poner(e, 0, "mano", "Valefor");
  const a = poner(e, 0, "cementerio", "Guardia Real");
  const b = poner(e, 0, "cementerio", "Sir Persival");
  e = aplicar(e, habilidad(quantum, "Quantum Megumi"));
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 32);
  assert.ok(zonaDe(e, m) === "castillo" || zonaDe(e, m) === "mano");
  assert.equal(puedeUsar(e, quantum), false);
});

test("Quantum Megumi: en tu Fase Final puedes Desterrar hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Quantum Megumi");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  e = elegir(e, a);
  e = elegir(e, b);
  assert.deepEqual([a, b, c].map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
});

test("Retrato de la Condesa: al entrar busca un Oro en tu Castillo y lo pone en tu mano", () => {
  let e = mesa();
  const retrato = poner(e, 0, "mano", "Retrato de la Condesa");
  e = aplicar(e, oro(retrato));
  e = elegir(e, primero);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].mano[0]).tipo, "Oro");
});

test("Retrato de la Condesa: los jugadores no pueden ganar el control de cartas de las que no sean dueños", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Retrato de la Condesa");
  const suyo = poner(e, 1, "defensa", "Valefor");
  const mio = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.puedeTomar(e, suyo, 0), false);
  assert.equal(N.puedeTomar(e, mio, 1), false);
});

test("Retrato de la Condesa: para afectarte tu oponente debe Desterrar una carta del tope de su Castillo", { todo: "protección: el oponente paga un coste (Desterrar del tope de su Castillo) para afectarte con efectos" }, () => {});

test("Romualdito: al comienzo de la Vigilia, sin Oros en tu Reserva, Destierra dos cartas del tope de tu Castillo y hasta una de un Cementerio", () => {
  let e = mesa();
  poner(e, 0, "pagado", "Romualdito");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = elegir(e, c);
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Romualdito: con Oros en tu Reserva no se dispara", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Romualdito");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[0].destierro.length, 0);
});

test("Romualdito: convirtiéndolo previene que un Aliado sea Destruido, cambie de controlador o sea convertido por un efecto oponente", { todo: "prevención: convertir esta carta para prevenir que un efecto oponente Destruya, tome el control o convierta un Aliado" }, () => {});

test("Salitre: al entrar Roba dos cartas y Baraja una carta de tu mano", () => {
  let e = mesa();
  const salitre = poner(e, 0, "mano", "Salitre");
  e = aplicar(e, oro(salitre));
  e = elegir(e, primero);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Salitre: puedes poner Oros en juego desde tu Cementerio como si estuvieran en tu mano", () => {
  let e = mesa();
  const salitre = poner(e, 0, "reserva", "Salitre");
  const onsen = poner(e, 0, "cementerio", "Onsen");
  const d = poner(e, 0, "mano", "Drácula");
  e = aplicar(e, habilidad(salitre, "Salitre"));
  e = elegir(e, primero);
  assert.equal(zonaDe(e, onsen), "reserva");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === d), false);
  assert.equal(puedeUsar(e, salitre), false);
});

test("Salitre: cuando un Oro es Destruido se Baraja en el Castillo de su dueño", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Salitre");
  const suyo = poner(e, 1, "reserva", "Drácula");
  N.mover(e, suyo, "cementerio");
  resolver(e);
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.ok(e.jugadores[1].castillo.includes(suyo));
});

test("Salitre: los Oros en juego son Indesterrables", { todo: "continua: los Oros en juego ganan una clave (Indestructible / Indesterrable)" }, () => {});
