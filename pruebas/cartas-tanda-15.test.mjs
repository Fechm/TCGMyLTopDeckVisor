import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver, cumple } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

let nFicticia = 0;
function ficticia(e, j, zona, datos = {}) {
  const idf = `ficticia15-${nFicticia++}`;
  e.catalogo = {
    ...e.catalogo,
    [idf]: { id: idf, nombre: idf, tipo: "Aliado", coste: 1, fuerza: 2, razas: [], sinHabilidad: false, oroInicial: false, texto: "", claves: [], continuas: [], disparadas: [], activadas: [], fns: {}, ...datos },
  };
  const uid = `${j}-g${nFicticia}`;
  e.instancias[uid] = idf;
  if (zona === "castillo") e.jugadores[j].castillo.unshift(uid);
  else e.jugadores[j][zona].push(uid);
  return uid;
}

function con(e, nombre, extra) {
  const k = id(nombre);
  e.catalogo = { ...e.catalogo, [k]: { ...e.catalogo[k], ...extra } };
  return e;
}

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  e.jugadores[j].castillo.pop();
  e.jugadores[j].castillo.unshift(uid);
  return uid;
}

test("Paso del Camahueto: tiene Exhumar", () => {
  const e = mesa();
  const p = poner(e, 0, "cementerio", "Paso del Camahueto");
  assert.equal(N.tiene(e, p, "Exhumar"), true);
});

test("Paso del Camahueto: convierte un Aliado de coste 2 o menos en un Aliado sin habilidad bajo tu control", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Paso del Camahueto");
  e = hacer(e, jugar(p), texto("Convertir"));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.ubicar(e, v).j, 0);
  assert.equal(N.carta(e, v).sinHabilidad, true);
  assert.equal(N.carta(e, v).tipo, "Aliado");
});

test("Paso del Camahueto: una carta de coste 2 o menos pierde su habilidad y es Desterrada", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Paso del Camahueto");
  e = hacer(e, jugar(p), texto("Una carta"), v);
  assert.equal(zonaDe(e, v), "destierro");
});

test("Paso del Camahueto: jugado desde el Cementerio con Exhumar queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "cementerio", "Paso del Camahueto");
  e = hacer(e, jugar(p, { desde: "cementerio" }), texto("Una carta"), v);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, p), "destierro");
});

test("Pecado Original: Baraja hasta dos cartas que no sean Oro y busca dos cartas en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Pecado Original");
  e = hacer(e, jugar(p), a, b, nombreDe(e, "Drácula"), nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Pecado Original: en tu Cementerio, cuando un Aliado entra bajo control oponente Destierra una del tope de su Castillo, hasta tres veces por turno", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Pecado Original");
  const aliados = [1, 2, 3, 4].map(() => poner(e, 1, "defensa", "Valefor"));
  for (const uid of aliados) e = disparar(e, "entra", { uid, j: 1 });
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Pecado Original: no se dispara con Aliados propios ni con Oros oponentes", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Pecado Original");
  const mio = poner(e, 0, "defensa", "Valefor");
  const oro = poner(e, 1, "reserva", "Drácula");
  e = disparar(e, "entra", { uid: mio, j: 0 });
  e = disparar(e, "entra", { uid: oro, j: 1 });
  assert.equal(e.jugadores[1].destierro.length, 0);
});

test("Perder la Razon: tiene Exhumar", () => {
  const e = mesa();
  const p = poner(e, 0, "cementerio", "Perder la Razon");
  assert.equal(N.tiene(e, p, "Exhumar"), true);
});

test("Perder la Razon: muestra seis cartas y juega una de coste 3 o menos sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = alTope(e, 0, "Valefor");
  const p = poner(e, 0, "mano", "Perder la Razon");
  e = hacer(e, jugar(p), texto("Jugar"), v);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Perder la Razon: puede poner un Oro de las seis cartas en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const [o] = e.jugadores[0].castillo;
  const p = poner(e, 0, "mano", "Perder la Razon");
  e = hacer(e, jugar(p), texto("Poner"), o);
  assert.equal(zonaDe(e, o), "pagado");
});

test("Perder la Razon: no ofrece cartas fuera de las seis del tope", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "castillo", "Valefor");
  const p = poner(e, 0, "mano", "Perder la Razon");
  e = aplicar(e, jugar(p));
  assert.equal(e.pendiente.opciones.some((o) => (o.texto ?? "").startsWith("Jugar")), false);
  assert.equal(zonaDe(e, v), "castillo");
});

test("Perder la Razon: si es Anulado genera dos Oros por el turno para jugar Aliados", () => {
  let e = mesa();
  const p = poner(e, 0, "cementerio", "Perder la Razon");
  e = disparar(e, "anulada", { uid: p, j: 0, tipo: "Talismán" });
  assert.deepEqual(e.jugadores[0].generados, [{ n: 2, tipos: ["Aliado"] }]);
});

test("Pereza: se Destierra y por dos turnos no se puede atacar ni puedes jugar más de una carta por turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "defensa", "Valefor");
  const otra = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 0, "mano", "Pereza");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(zonaDe(e, p), "destierro");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
  assert.equal(puedeJugar(e, otra), false);
  N.expirar(e, "finTurno");
  e.turno += 1;
  assert.equal(e.efectos.some((f) => f.tipo === "noAtacar"), true);
  assert.equal(e.efectos.some((f) => f.tipo === "maxNoOro" && f.j === 0), true);
  N.expirar(e, "finTurno");
  assert.equal(e.efectos.some((f) => f.tipo === "noAtacar" || f.tipo === "maxNoOro"), false);
});

test("Pereza: desde tu Cementerio limita a una las cartas puestas en juego desde fuera de la mano", { todo: "continua desde el Cementerio: límite de cartas puestas en juego por turno desde zonas distintas de la mano" }, () => {});

test("Pie de Cueca: el oponente Destierra una al azar de sus ocho del tope y tú pones en tu mano una al azar de tus ocho", () => {
  let e = mesa();
  const ochoRival = e.jugadores[1].castillo.slice(0, 8);
  const ochoMias = e.jugadores[0].castillo.slice(0, 8);
  const p = poner(e, 0, "mano", "Pie de Cueca");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(e.jugadores[1].destierro.length, 1);
  assert.ok(ochoRival.includes(e.jugadores[1].destierro[0]));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.ok(ochoMias.includes(e.jugadores[0].mano[0]));
  assert.equal(e.pendiente, null);
});

test("Pie de Cueca: si controlas una Fonda puedes buscar un Pie de Cueca en tu Castillo", () => {
  let e = mesa({ castillo: 10 });
  ficticia(e, 0, "apoyo", { nombre: "Fonda", tipo: "Tótem", coste: 2 });
  const otro = poner(e, 0, "castillo", "Pie de Cueca");
  e.jugadores[0].castillo = [...e.jugadores[0].castillo.filter((u) => u !== otro), otro];
  const p = poner(e, 0, "mano", "Pie de Cueca");
  e = sinRespuesta(aplicar(e, jugar(p)));
  e = elegir(e, true);
  e = elegir(e, nombreDe(e, "Pie de Cueca"));
  assert.equal(zonaDe(e, otro), "mano");
});

test("Pocion del Mal: se Destierra y Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Sir Persival");
  const p = poner(e, 0, "mano", "Pocion del Mal");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Sir Persival"), false);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, p), "destierro");
});

test("Pocion del Mal: puede jugarse al comienzo de cualquier Fase", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Pocion del Mal");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, p), true);
});

test("Pocion del Mal: hasta el final del turno, cada vez que el oponente juega una carta Barajas o Destierras una de un Cementerio y Robas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  const x = poner(e, 1, "mano", "Valefor");
  const p = poner(e, 0, "mano", "Pocion del Mal");
  e = sinRespuesta(aplicar(e, jugar(p)));
  e = elegir(e, v);
  assert.equal(zonaDe(e, p), "destierro");
  assert.equal(e.jugadores[0].mano.length, 0);
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Aliado" });
  e = elegir(e, "Cementerio oponente");
  e = elegir(e, c);
  e = elegir(e, "Desterrar");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
  e = disparar(e, "juega", { uid: x, j: 0, tipo: "Aliado" });
  assert.equal(e.jugadores[0].mano.length, 1);
  N.expirar(e, "finTurno");
  e.turno += 1;
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Aliado" });
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Pozo Impuro: tiene Exhumar y solo se juega una vez por turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  const a = poner(e, 0, "mano", "Pozo Impuro");
  const b = poner(e, 0, "mano", "Pozo Impuro");
  assert.equal(N.tiene(e, a, "Exhumar"), true);
  e = hacer(e, jugar(a), texto("Barajar"), nombreDe(e, "Valefor"));
  assert.equal(e.pendiente, null);
  e = sinRespuesta(e);
  assert.equal(puedeJugar(e, b), false);
});

test("Pozo Impuro: Baraja una carta de coste 1 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Pozo Impuro");
  e = hacer(e, jugar(p), texto("Barajar"), v);
  assert.equal(zonaDe(e, v), "castillo");
});

test("Pozo Impuro: Destierra una carta de tu mano para Barajar una carta de coste 2", () => {
  let e = mesa();
  oros(e, 0, 1);
  const j = poner(e, 1, "defensa", "Jabberwocky");
  const x = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 0, "mano", "Pozo Impuro");
  e = hacer(e, jugar(p), texto("Desterrar"));
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(zonaDe(e, j), "castillo");
});

test("Pozo Impuro: los Aliados pierden Furia e Imbloqueable", { todo: "efecto: los Aliados pierden palabras clave (Furia, Imbloqueable)" }, () => {});

test("Primer Sello: busca un Sello y el oponente Bota una más una por cada Sello en tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = ficticia(e, 0, "castillo", { nombre: "Sello de Prueba", tipo: "Talismán" });
  ficticia(e, 0, "cementerio", { nombre: "Otro Sello", tipo: "Talismán" });
  ficticia(e, 0, "cementerio", { nombre: "Tercer Sello", tipo: "Talismán" });
  const p = poner(e, 0, "mano", "Primer Sello");
  e = hacer(e, jugar(p), nombreDe(e, "Sello de Prueba"));
  assert.equal(zonaDe(e, s), "mano");
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Primer Sello: en tu Cementerio, una vez por turno, cuando juegas un Sello tu oponente Bota una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "cementerio", "Primer Sello");
  const s1 = ficticia(e, 0, "mano", { nombre: "Sello A", tipo: "Talismán", coste: 1 });
  const s2 = ficticia(e, 0, "mano", { nombre: "Sello B", tipo: "Talismán", coste: 1 });
  e = sinRespuesta(aplicar(e, jugar(s1)));
  assert.equal(e.jugadores[1].cementerio.length, 1);
  e = sinRespuesta(aplicar(e, jugar(s2)));
  assert.equal(e.jugadores[1].cementerio.length, 1);
});

test("Primer Sello: no se dispara al jugar cartas que no son Sello", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "cementerio", "Primer Sello");
  const m = poner(e, 0, "mano", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Prisionero de Drácula: convierte un Aliado de coste 3 o menos en un Tótem sin habilidad bajo tu control y Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 1, "defensa", "Sir Persival");
  const p = poner(e, 0, "mano", "Prisionero de Drácula");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(zonaDe(e, s), "apoyo");
  assert.equal(N.ubicar(e, s).j, 0);
  assert.equal(N.carta(e, s).tipo, "Tótem");
  assert.equal(N.carta(e, s).sinHabilidad, true);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Prisionero de Drácula: en tu Cementerio tus cartas sin habilidad no pueden ser Barajadas ni cambiar de controlador", { todo: "continua desde el Cementerio: tus cartas sin habilidad no pueden ser Barajadas ni cambiar de controlador" }, () => {});

test("Protocolo Totemico: Destruye una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Protocolo Totemico");
  e = hacer(e, jugar(p), texto("Destruir"), v);
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Protocolo Totemico: Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Protocolo Totemico");
  e = hacer(e, jugar(p), texto("Barajar"), v);
  assert.equal(zonaDe(e, v), "castillo");
});

test("Protocolo Totemico: Anula un Tótem de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const t = ficticia(e, 0, "mano", { tipo: "Tótem", coste: 2 });
  const p = poner(e, 1, "mano", "Protocolo Totemico");
  e = aplicar(e, jugar(t));
  e = aplicar(e, { tipo: "responder", uid: p });
  assert.equal(zonaDe(e, t), "cementerio");
});

test("Protocolo Totemico: también Anula un Arma de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const a = ficticia(e, 0, "mano", { tipo: "Arma", coste: 2, fuerza: 1 });
  const p = poner(e, 1, "mano", "Protocolo Totemico");
  e = aplicar(e, jugar(a, { portador: v }));
  e = aplicar(e, { tipo: "responder", uid: p });
  assert.equal(zonaDe(e, a), "cementerio");
});

test("Protocolo Totemico: mostrando cuatro cartas de un mismo tipo de tu mano sube del Cementerio a tu mano", () => {
  let e = mesa();
  const p = poner(e, 0, "cementerio", "Protocolo Totemico");
  for (let i = 0; i < 3; i++) poner(e, 0, "mano", "Valefor");
  assert.equal(puedeUsar(e, p), false);
  poner(e, 0, "mano", "Valefor");
  assert.equal(puedeUsar(e, p), true);
  e = aplicar(e, habilidad(p, "Protocolo Totemico"));
  assert.equal(zonaDe(e, p), "mano");
});

test("Protocolo Totemico: también sirven cuatro cartas del mismo coste", () => {
  const e = mesa();
  const p = poner(e, 0, "cementerio", "Protocolo Totemico");
  poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "El Dracul");
  poner(e, 0, "mano", "Llamar a la Manada");
  poner(e, 0, "mano", "Pedrenyal");
  assert.equal(puedeUsar(e, p), true);
});

test("Psicofonía: una carta de coste 2 o menos pierde su habilidad, es Desterrada y Robas una", () => {
  let e = mesa();
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Psicofonía");
  e = hacer(e, jugar(p), texto("Una carta"));
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Psicofonía: pagando un Oro un Aliado pierde su habilidad, es Desterrado y Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 1, "defensa", "Sir Persival");
  const p = poner(e, 0, "mano", "Psicofonía");
  e = hacer(e, jugar(p), texto("Pagar"));
  assert.equal(zonaDe(e, s), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Psicofonía: sin Oros no se ofrece el efecto que paga un Oro", () => {
  let e = mesa();
  poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Psicofonía");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(e.pendiente.opciones.some((o) => (o.texto ?? "").startsWith("Pagar")), false);
  e = elegir(e, texto("Una carta"));
  assert.equal(zonaDe(e, p), "cementerio");
  assert.equal(e.jugadores[1].destierro.length, 1);
});

test("Psicofonía: si pagaste dos Oros no se puede responder a ella", { todo: "coste opcional: pagar Oros adicionales para que no se pueda responder a la carta" }, () => {});

test("Puertas Grandes y Pequeas: previene el próximo daño este turno y el oponente Bota dos por cada Aliado en su Línea de Ataque", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "ataque", "Valefor");
  poner(e, 1, "ataque", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Puertas Grandes y Pequeas");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(zonaDe(e, p), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 4);
  const f = e.efectos.find((x) => x.tipo === "prevenirDano");
  assert.equal(f.j, 0);
  assert.equal(f.unaVez, true);
  assert.equal(f.n, undefined);
});

test("Puertas Grandes y Pequeas: se juega sin pagar su coste en respuesta a recibir daño", { todo: "respuesta: jugar sin pagar su coste cuando fueras a recibir daño" }, () => {});

test("Pulso Kaiju: busca tres Aliados de distinto nombre, uno a la mano, dos al Cementerio y Robas una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "castillo", "Valefor");
  const v2 = poner(e, 0, "castillo", "Valefor");
  const d = poner(e, 0, "castillo", "El Dracul");
  const s = poner(e, 0, "castillo", "Sir Persival");
  const p = poner(e, 0, "mano", "Pulso Kaiju");
  e = aplicar(e, jugar(p));
  e = elegir(e, nombreDe(e, "Valefor"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Valefor"), false);
  e = elegir(e, nombreDe(e, "El Dracul"));
  e = elegir(e, nombreDe(e, "Sir Persival"));
  assert.equal([v, v2].filter((u) => zonaDe(e, u) === "mano").length, 1);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, s), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Pulso Kaiju: puede jugarse al comienzo de cualquier Fase", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Pulso Kaiju");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, p), true);
});

test("Pulso Kaiju: en tu Cementerio el oponente no puede Desterrar Aliados de tu Cementerio", { todo: "continua desde el Cementerio: el oponente no puede Desterrar Aliados de tu Cementerio" }, () => {});

test("Purificar Alma: Baraja todas las cartas del tipo elegido de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const t = poner(e, 1, "cementerio", "Llamar a la Manada");
  const p = poner(e, 0, "mano", "Purificar Alma");
  e = hacer(e, jugar(p), "Aliado", "Barajar");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, t), "cementerio");
});

test("Purificar Alma: puede Desterrar todas las cartas del tipo elegido", () => {
  let e = mesa();
  oros(e, 0, 2);
  const t = poner(e, 1, "cementerio", "Llamar a la Manada");
  const a = poner(e, 1, "cementerio", "Valefor");
  const p = poner(e, 0, "mano", "Purificar Alma");
  e = hacer(e, jugar(p), "Talismán", "Desterrar");
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, p), "cementerio");
});

test("Pánico Vampiro: si la primera carta es un Aliado la pones en tu mano", () => {
  let e = mesa({ castillo: 0 });
  for (let i = 0; i < 5; i++) poner(e, 0, "castillo", "Valefor");
  for (let i = 0; i < 5; i++) poner(e, 1, "castillo", "Drácula");
  const p = poner(e, 0, "mano", "Pánico Vampiro");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].mano[0]).nombre, "Valefor");
  assert.equal(zonaDe(e, p), "cementerio");
});

test("Pánico Vampiro: si es Oro o Talismán Barajas hasta dos cartas de los Cementerios y se Destierra", () => {
  let e = mesa();
  const c = [poner(e, 1, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Valefor")];
  const p = poner(e, 0, "mano", "Pánico Vampiro");
  e = hacer(e, jugar(p), c[0], c[1]);
  assert.equal(c.filter((u) => zonaDe(e, u) === "castillo").length, 2);
  assert.equal(zonaDe(e, p), "destierro");
});

test("Pánico Vampiro: si es Arma o Tótem Destruye una carta de coste 1", () => {
  let e = mesa({ castillo: 0 });
  for (let i = 0; i < 5; i++) poner(e, 0, "castillo", "Pedrenyal");
  for (let i = 0; i < 5; i++) poner(e, 1, "castillo", "Drácula");
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "mano", "Pánico Vampiro");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, p), "cementerio");
});

test("Quemar el Corazón: elige hasta dos efectos, Desterrar un Aliado sin habilidad y que el oponente Destierre dos de su mano, y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 2);
  const s = poner(e, 1, "defensa", "Sir Persival");
  const m = [poner(e, 1, "mano", "Valefor"), poner(e, 1, "mano", "Valefor")];
  const q = poner(e, 0, "mano", "Quemar el Corazón");
  e = hacer(e, jugar(q), texto("Un Aliado"), texto("Tu oponente"));
  assert.equal(zonaDe(e, s), "destierro");
  assert.deepEqual(m.map((u) => zonaDe(e, u)), ["destierro", "destierro"]);
  assert.equal(zonaDe(e, q), "destierro");
});

test("Quemar el Corazón: busca una carta en un Castillo y la Destierra, y no recibes daño hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const q = poner(e, 0, "mano", "Quemar el Corazón");
  e = hacer(e, jugar(q), texto("Buscar"), texto("No recibes"), "Castillo oponente", nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[1].destierro.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 29);
  const f = e.efectos.find((x) => x.tipo === "prevenirDano");
  assert.equal(f.j, 0);
  assert.deepEqual(f.fin, { inicioDe: 0, desde: e.turno });
});

test("Quemar el Corazón: si es Anulado va al Cementerio y agrupa un Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 4);
  const q = poner(e, 0, "mano", "Quemar el Corazón");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(q));
  assert.equal(e.jugadores[0].pagado.length, 2);
  e = aplicar(e, { tipo: "responder", uid: dorado });
  for (let i = 0; i < 10 && (e.pila.length || e.pendiente); i++) e = e.pendiente ? aplicar(e, { tipo: "elegir", i: 0 }) : aplicar(e, accionesLegales(e)[0]);
  assert.equal(zonaDe(e, q), "cementerio");
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("Quinto Sello: busca un Sello, Baraja hasta cinco de los Cementerios y juega un Aliado de tu Cementerio reduciendo su coste en uno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = ficticia(e, 0, "castillo", { nombre: "Sello de Prueba", tipo: "Talismán" });
  const c = poner(e, 1, "cementerio", "Valefor");
  const a = poner(e, 0, "cementerio", "Valefor");
  const q = poner(e, 0, "mano", "Quinto Sello");
  e = hacer(e, jugar(q), nombreDe(e, "Sello de Prueba"), c, null, texto("Jugar un Aliado"));
  assert.equal(zonaDe(e, s), "mano");
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(zonaDe(e, a), "defensa");
});

test("Quinto Sello: puede jugar un Sello de tu Cementerio pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const s = ficticia(e, 0, "cementerio", { nombre: "Sello Robador", tipo: "Talismán", coste: 1, talisman: [{ op: "robar", n: 2, quien: "yo" }] });
  const q = poner(e, 0, "mano", "Quinto Sello");
  e = hacer(e, jugar(q), null, texto("Jugar un Sello"));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, s), "cementerio");
});

test("Quinto Sello: en tu Cementerio no se pueden jugar más de cinco cartas por turno", { todo: "continua desde el Cementerio: no se pueden jugar más de N cartas por turno" }, () => {});

test("R L Stevenson: se Destierra, convierte una carta de coste 2 o menos en un Tótem sin habilidad bajo tu control y pone en tu mano el primer Aliado del Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const x = poner(e, 0, "castillo", "Valefor");
  const r = poner(e, 0, "mano", "R L Stevenson");
  e = hacer(e, jugar(r), v);
  assert.equal(zonaDe(e, v), "apoyo");
  assert.equal(N.ubicar(e, v).j, 0);
  assert.equal(N.carta(e, v).tipo, "Tótem");
  assert.equal(N.carta(e, v).sinHabilidad, true);
  assert.equal(zonaDe(e, x), "mano");
  assert.equal(zonaDe(e, r), "destierro");
});

test("R L Stevenson: puede jugarse al comienzo de cualquier Fase", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "R L Stevenson");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, r), true);
});

test("Rafaga de Energia: con un Caballero Barajas un Aliado en juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "defensa", { razas: ["Caballero"] });
  const v = poner(e, 1, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Rafaga de Energia");
  e = hacer(e, jugar(r), texto("Caballero"), v);
  assert.equal(zonaDe(e, v), "castillo");
});

test("Rafaga de Energia: con un Guerrero el oponente Bota cartas igual a la Fuerza de un Aliado", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "defensa", { razas: ["Guerrero"], fuerza: 2 });
  const v = poner(e, 1, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Rafaga de Energia");
  e = hacer(e, jugar(r), texto("Guerrero"), v);
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Rafaga de Energia: sin las Razas no se ofrecen los efectos", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Rafaga de Energia");
  e = sinRespuesta(aplicar(e, jugar(r)));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, r), "cementerio");
});

test("Rafaga de Energia: con un Héroe afectar a tus Aliados cuesta un Oro adicional hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = ficticia(e, 0, "defensa", { razas: ["Héroe"] });
  const r = poner(e, 0, "mano", "Rafaga de Energia");
  const d = poner(e, 1, "mano", "Pocion del Mal");
  const ctx = { ctrl: 1, fuente: d, def: e.instancias[d], costeFuente: 1, vars: {} };
  assert.equal(cumple(e, ctx, h, {}, "barajar"), true);
  e = hacer(e, jugar(r), texto("Héroe"));
  assert.equal(cumple(e, ctx, h, {}, "barajar"), false);
  oros(e, 1, 1);
  assert.equal(cumple(e, ctx, h, {}, "barajar"), true);
  assert.equal(cumple(e, { ...ctx, ctrl: 0 }, h, {}, "barajar"), true);
  assert.deepEqual(e.efectos.find((f) => f.tipo === "proteccion").fin, { inicioDe: 0, desde: e.turno });
});

test("Ragnarok: si tus Aliados son de la misma Raza Baraja todos los Aliados, y cada jugador revela dos Aliados de coste 2 o menos, uno a la mano y otro en juego", () => {
  let e = mesa();
  oros(e, 0, 2);
  const mios = [ficticia(e, 0, "defensa", { coste: 3, razas: ["Dragón"] }), ficticia(e, 0, "defensa", { coste: 3, razas: ["Dragón", "Bestia"] })];
  const rival = poner(e, 1, "defensa", "Sir Persival");
  const t0 = [alTope(e, 0, "Jabberwocky"), alTope(e, 0, "Jabberwocky")];
  const t1 = [alTope(e, 1, "Jabberwocky"), alTope(e, 1, "Jabberwocky")];
  const g = poner(e, 0, "mano", "Ragnarok");
  e = sinRespuesta(aplicar(e, jugar(g)));
  for (const u of [...mios, rival]) assert.equal(zonaDe(e, u), "castillo");
  for (const [j, par] of [[0, t0], [1, t1]]) {
    assert.deepEqual(par.map((u) => zonaDe(e, u)).sort(), ["defensa", "mano"]);
    assert.equal(N.ubicar(e, par.find((u) => zonaDe(e, u) === "defensa")).j, j);
  }
});

test("Ragnarok: si tus Aliados no comparten Raza no se Barajan", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "defensa", "Valefor");
  const s = poner(e, 0, "defensa", "Sir Persival");
  const g = poner(e, 0, "mano", "Ragnarok");
  e = sinRespuesta(aplicar(e, jugar(g)));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(zonaDe(e, s), "defensa");
});

test("Rayo Gaia: solo puede jugarse en respuesta", () => {
  const e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Rayo Gaia");
  assert.equal(puedeJugar(e, r), false);
});

test("Rayo Gaia: Destierra un Aliado de coste 2 o menos que controles", () => {
  let e = con(mesa(), "Rayo Gaia", { soloRespuesta: false });
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Rayo Gaia");
  e = sinRespuesta(aplicar(e, jugar(r)));
  assert.equal(zonaDe(e, v), "destierro");
});

test("Rayo Gaia: en respuesta a que un Aliado fuera a salir del juego por efecto oponente", { todo: "respuesta: a que un Aliado propio fuera a salir del juego por un efecto oponente" }, () => {});

test("Rayo Gaia: durante tres turnos usas la habilidad del Aliado Desterrado como si estuviera en juego", { todo: "mecánica: utilizar la habilidad de una carta desde el Destierro como si estuviera en juego" }, () => {});

test("Rayo Penetrante: Destierra una carta de coste 2 o menos y Baraja o Destierra hasta tres cartas de un Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const c = [poner(e, 1, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Valefor")];
  const r = poner(e, 0, "mano", "Rayo Penetrante");
  e = hacer(e, jugar(r), texto("Desterrar una carta de coste 2"), v, "Cementerio oponente", c[0], c[1], "Desterrar");
  assert.equal(zonaDe(e, v), "destierro");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro"]);
});

test("Rayo Penetrante: Destierra una carta oponente de coste 3 o más y el oponente Roba una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 1, "defensa", "Sir Persival");
  const r = poner(e, 0, "mano", "Rayo Penetrante");
  e = hacer(e, jugar(r), texto("Desterrar una carta oponente"));
  assert.equal(zonaDe(e, s), "destierro");
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Rayo Penetrante: puede jugarse en la Fase Final", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Rayo Penetrante");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, r), true);
});

test("Red de Plata: Anula un Aliado y si tenía coste 2 o menos lo Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const r = poner(e, 1, "mano", "Red de Plata");
  e = aplicar(e, jugar(v));
  e = aplicar(e, { tipo: "responder", uid: r });
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, r), "destierro");
});

test("Red de Plata: un Aliado Anulado de coste 3 o más va al Cementerio", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const s = poner(e, 0, "mano", "Sir Persival");
  const r = poner(e, 1, "mano", "Red de Plata");
  e = aplicar(e, jugar(s));
  e = aplicar(e, { tipo: "responder", uid: r });
  assert.equal(zonaDe(e, s), "cementerio");
});

test("Red de Plata: cancela la habilidad de un Aliado en juego y si tiene coste 2 o menos lo Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 1, "defensa", "Sir Persival");
  const r = poner(e, 0, "mano", "Red de Plata");
  e = sinRespuesta(aplicar(e, jugar(r)));
  assert.equal(zonaDe(e, s), "defensa");
  assert.equal(N.activa(e, s), false);
  e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const r2 = poner(e, 0, "mano", "Red de Plata");
  e = sinRespuesta(aplicar(e, jugar(r2)));
  if (e.pendiente) e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
});

test("Red de Plata: Desterrándola de tu Cementerio un Aliado pierde su habilidad por el turno", () => {
  let e = mesa();
  const r = poner(e, 0, "cementerio", "Red de Plata");
  const s = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(r, "Red de Plata"));
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(N.activa(e, s), false);
  N.expirar(e, "finTurno");
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, s), true);
});

test("Reflejo Maldito: no puede ser Anulado, se Destierra, Baraja cartas cuyos costes sumen 4 o menos y Robas una", () => {
  let e = mesa();
  oros(e, 0, 2);
  const j1 = poner(e, 1, "defensa", "Jabberwocky");
  const j2 = poner(e, 1, "defensa", "Jabberwocky");
  const v = poner(e, 1, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Reflejo Maldito");
  assert.equal(N.carta(e, r).claves.includes("NoAnulable"), true);
  e = hacer(e, jugar(r), j1, j2);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === v), false);
  e = elegir(e, null);
  assert.equal(zonaDe(e, j1), "castillo");
  assert.equal(zonaDe(e, j2), "castillo");
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, r), "destierro");
});

test("Reflejo Maldito: hasta tu próximo turno no se pueden Botar ni Desterrar cartas de los Castillos por efectos", { todo: "efecto: no se pueden Botar ni Desterrar cartas de los Castillos por efectos durante un período" }, () => {});

test("Regresa la Razon: mira tantas cartas como Fuerza impresa del Aliado elegido y pone las tuyas en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  N.agregarEfecto(e, { tipo: "fuerza", uid: v, n: 5 }, 0);
  const r = poner(e, 0, "mano", "Regresa la Razon");
  e = hacer(e, jugar(r), "Poner tus cartas en tu mano");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Regresa la Razon: o pone las cartas oponentes en su Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "defensa", "Sir Persival");
  const r = poner(e, 0, "mano", "Regresa la Razon");
  e = hacer(e, jugar(r), "Poner las cartas oponentes en su Cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("Regresa la Razon: si es Anulado genera un Oro para jugar un Arma", () => {
  let e = mesa();
  const r = poner(e, 0, "cementerio", "Regresa la Razon");
  e = disparar(e, "anulada", { uid: r, j: 0, tipo: "Talismán" });
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma"] }]);
});
