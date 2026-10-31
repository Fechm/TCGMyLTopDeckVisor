import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);

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

const anularAliado = (e) => {
  (e.jugadores[1].jugadas.anuladas ??= {}).Aliado = 1;
  return e;
};

test("Cadenas de Titán: no puede ser Anulado", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Cadenas de Titán");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
});

test("Cadenas de Titán: el oponente Destierra seis cartas de su Castillo, robas dos y el oponente no recibe daño este turno", () => {
  let e = anularAliado(mesa());
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const c = poner(e, 0, "mano", "Cadenas de Titán");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[1].destierro.length, 6);
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(e.jugadores[0].mano.length, 2);
  e = atacarSolo(e, v);
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Cadenas de Titán: solo se juega si un Aliado fue Anulado este turno", () => {
  const e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Cadenas de Titán");
  assert.equal(puedeJugar(e, c), false);
  anularAliado(e);
  assert.equal(puedeJugar(e, c), true);
});

test("Cadenas de Titán: no se pueden jugar más cartas este turno", () => {
  let e = anularAliado(mesa());
  oros(e, 0, 4);
  const c = poner(e, 0, "mano", "Cadenas de Titán");
  const v = poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Drácula");
  assert.equal(puedeJugar(e, v), true);
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" || a.tipo === "oro"), false);
});

test("Cae la Casa Usher: baraja hasta tres cartas de tu Cementerio y roba dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const u = poner(e, 0, "mano", "Cae la Casa Usher");
  const c = [0, 1, 2, 3].map(() => poner(e, 0, "cementerio", "Valefor"));
  e = hacer(e, jugar(u), "Barajar hasta tres cartas de tu Cementerio y Robar dos cartas", c[0], c[1], c[2]);
  assert.deepEqual(c.map((x) => zonaDe(e, x)).filter((z) => z === "cementerio").length, 1);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("Cae la Casa Usher: hasta tres Aliados no hacen daño este turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const u = poner(e, 0, "mano", "Cae la Casa Usher");
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Sir Galahad");
  e = hacer(e, jugar(u), "Hasta tres Aliados no hacen daño este turno", a, null);
  assert.equal(e.efectos.some((f) => f.tipo === "sinDano" && f.uid === a), true);
  assert.equal(e.efectos.some((f) => f.tipo === "sinDano" && f.uid === b), false);
});

test("Cae la Casa Usher: Exhumar, se juega desde el Cementerio y queda Desterrada", () => {
  let e = mesa();
  oros(e, 0, 1);
  const u = poner(e, 0, "cementerio", "Cae la Casa Usher");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === u && a.desde === "cementerio"), true);
  e = hacer(e, jugar(u, { desde: "cementerio" }), "Barajar hasta tres cartas de tu Cementerio y Robar dos cartas");
  assert.equal(zonaDe(e, u), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Cae la Reina: baraja hasta diez cartas de los Cementerios, roba tres y queda Desterrada", () => {
  let e = mesa();
  oros(e, 0, 2);
  const r = poner(e, 0, "mano", "Cae la Reina");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, jugar(r), a, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(zonaDe(e, r), "destierro");
});

test("Cae la Reina: Exhumar, se juega desde el Cementerio", () => {
  const e = mesa();
  oros(e, 0, 2);
  const r = poner(e, 0, "cementerio", "Cae la Reina");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === r && a.desde === "cementerio"), true);
});

test("Cae la Reina: solo puede jugarse pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "mano", "Conocimiento Prohibido");
  const reina = poner(e, 0, "castillo", "Cae la Reina");
  const suyo = poner(e, 1, "castillo", "Guillatún");
  e = sinRespuesta(aplicar(e, jugar(c)));
  e = elegir(e, reina);
  e = elegir(e, suyo);
  e = elegir(e, "Jugar el tuyo y Desterrar el del oponente");
  assert.equal(zonaDe(e, reina), "castillo");
  assert.equal(zonaDe(e, suyo), "destierro");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Caida del Alba: si el oponente Destierra una carta de su mano con el nombre nombrado, no buscas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Caida del Alba");
  const v = poner(e, 1, "mano", "Valefor");
  e = hacer(e, jugar(c), v);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[0].mano.length, 0);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Caida del Alba: si el oponente no Destierra, buscas dos cartas en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Caida del Alba");
  const v = poner(e, 1, "mano", "Valefor");
  e = hacer(e, jugar(c), v, null);
  assert.equal(zonaDe(e, v), "mano");
  e = elegir(e, nombreDe(e, "Drácula"));
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Caida del Alba: desde el Cementerio, Desterrarla y pagar un Oro Destierra una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "cementerio", "Caida del Alba");
  const j = poner(e, 1, "defensa", "Jabberwocky");
  e = hacer(e, habilidad(c, "Caida del Alba"), j);
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(zonaDe(e, j), "destierro");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Cambiar de Tamaño: el oponente Destierra tantas cartas como Fuerza de los Aliados que atacaron y barajas Aliados de tu Destierro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Cambiar de Tamaño");
  const v = poner(e, 0, "ataque", "Valefor");
  e.jugadores[0].declarados.push(v);
  const otro = poner(e, 1, "defensa", "Sir Galahad");
  const d = poner(e, 0, "destierro", "Sir Galahad");
  e = hacer(e, jugar(t), v, d);
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(zonaDe(e, d), "castillo");
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano" && f.j === undefined && f.fin.finTurno === e.turno + 1), true);
  assert.equal(zonaDe(e, otro), "defensa");
});

test("Cambiar de Tamaño: los jugadores no reciben daño de combate durante este y el siguiente turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Cambiar de Tamaño");
  e = sinRespuesta(aplicar(e, jugar(t)));
  const mio = poner(e, 0, "defensa", "Sir Persival");
  const suyo = poner(e, 1, "defensa", "Sir Persival");
  e = atacarSolo(e, mio);
  assert.equal(e.jugadores[1].castillo.length, 30);
  assert.equal(e.activo, 1);
  const antes = e.jugadores[0].castillo.length;
  e = atacarSolo(e, suyo);
  assert.equal(e.jugadores[0].castillo.length, antes);
  assert.equal(e.registro.at(-1).dano, 0);
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano"), false);
});

test("Camino del Guerrero: requiere controlar y/o mostrar cuatro Aliados", () => {
  const e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Camino del Guerrero");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "mano", "Valefor");
  assert.equal(puedeJugar(e, c), false);
  poner(e, 0, "mano", "Sir Galahad");
  assert.equal(puedeJugar(e, c), true);
});

test("Camino del Guerrero: tus Aliados ganan 1 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Camino del Guerrero");
  const as = [0, 1, 2, 3].map(() => poner(e, 0, "defensa", "Valefor"));
  const r = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(c)));
  for (const a of as) assert.equal(N.fuerza(e, a), 4);
  assert.equal(N.fuerza(e, r), 3);
  N.expirar(e, "finTurno");
  e.turno += 3;
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, as[0]), 4);
});

test("Camino del Guerrero: previene un efecto", { todo: "efecto: prevenir un efecto" }, () => {});

function cantoListo() {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 2);
  const v = poner(e, 0, "mano", "Valefor");
  const canto = poner(e, 1, "mano", "Canto de los Serafin");
  e = aplicar(e, jugar(v));
  return { e, v, canto };
}

test("Canto de los Serafin: solo se juega en respuesta y Anula una carta oponente", () => {
  let { e, v, canto } = cantoListo();
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === canto), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: canto }));
  e = elegir(e, false);
  e = elegir(e, "Robar dos cartas");
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[1].mano.length, 2);
});

test("Canto de los Serafin: puedes jugar la carta Anulada bajo tu control reduciendo su coste en un Oro", () => {
  let { e, v, canto } = cantoListo();
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: canto }));
  e = elegir(e, true);
  e = elegir(e, "No recibir daño este turno");
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.ubicar(e, v).j, 1);
});

test("Canto de los Serafin: puede Desterrar una carta oponente que no sea Oro", () => {
  let { e, canto } = cantoListo();
  const j = poner(e, 0, "defensa", "Jabberwocky");
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: canto }));
  e = elegir(e, false);
  e = elegir(e, "Desterrar una carta oponente que no sea Oro");
  assert.equal(zonaDe(e, j), "destierro");
});

test("Canto de los Serafin: no recibir daño este turno previene el daño de combate a su Castillo", () => {
  let { e, canto } = cantoListo();
  const j = poner(e, 0, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: canto }));
  e = elegir(e, false);
  e = elegir(e, "No recibir daño este turno");
  e = atacarSolo(e, j);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Capa de Invisibildiad: baraja una carta de coste 2 o menos y queda Desterrada", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Capa de Invisibildiad");
  const j = poner(e, 1, "defensa", "Jabberwocky");
  e = hacer(e, jugar(c), j);
  assert.equal(zonaDe(e, j), "castillo");
  assert.equal(zonaDe(e, c), "destierro");
});

test("Capa de Invisibildiad: un Aliado tuyo de coste 1 o más gana Indesterrable y al comienzo de tu Vigilia genera un Oro y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Capa de Invisibildiad");
  const j = poner(e, 1, "defensa", "Jabberwocky");
  const m = poner(e, 0, "defensa", "Mecha-Daikaiju");
  e = hacer(e, jugar(c), j, m);
  assert.equal(N.tiene(e, m, "Indesterrable"), true);
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: null }]);
  e = disparar(e, "comienzoVigilia", { j: 1 });
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Capa de Invisibildiad: la habilidad ganada se pierde al salir del juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Capa de Invisibildiad");
  const j = poner(e, 1, "defensa", "Jabberwocky");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  e = hacer(e, jugar(c), j, g);
  N.mover(e, g, "mano");
  assert.equal(e.ganadas[g], undefined);
});

test("Captura Colosal: el Aliado de menor Fuerza no puede atacar ni bloquear y su habilidad pasa a ser la de Captura", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Captura Colosal");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === g), true);
  assert.equal(e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === v), false);
  assert.equal(N.tiene(e, g, "AtacaAlEntrar"), false);
  assert.deepEqual(N.habilidades(e, g).map((d) => d.nombre), ["Captura Colosal"]);
});

test("Captura Colosal: en la Fase Final de su controlador, Destierra las dos primeras cartas de su Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Captura Colosal");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(c)));
  e = disparar(e, "faseFinal", { j: 0 });
  assert.equal(e.jugadores[1].destierro.length, 0);
  e = disparar(e, "faseFinal", { j: 1 });
  assert.equal(e.jugadores[1].destierro.length, 2);
});

test("Captura Colosal: si eliges tu Aliado de menor Fuerza, el afectado es el tuyo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Captura Colosal");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === g), true);
});

test("Capturar Cerbero: robas hasta igualar la mano oponente y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Capturar Cerbero");
  poner(e, 0, "mano", "Valefor");
  for (let i = 0; i < 5; i++) poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[0].mano.length, 5);
  assert.equal(zonaDe(e, c), "destierro");
});

test("Capturar Cerbero: si ya tienes más cartas, no robas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Capturar Cerbero");
  poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Carpa Dragón: reduce su coste en uno por cada Aliado en juego, mínimo 1", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Carpa Dragón");
  assert.equal(costeDe(e, 0, c).pagar, 7);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, c).pagar, 5);
  for (let i = 0; i < 8; i++) poner(e, 1, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, c).pagar, 1);
});

test("Carpa Dragón: Destruye todos los Aliados en juego", () => {
  let e = mesa();
  oros(e, 0, 5);
  const c = poner(e, 0, "mano", "Carpa Dragón");
  const as = [poner(e, 0, "defensa", "Valefor"), poner(e, 1, "defensa", "Valefor")];
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  e = sinRespuesta(aplicar(e, jugar(c)));
  for (const a of as) assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, m), "defensa");
});

test("Catalepsia: no se puede jugar si controlas dos o menos Oros", () => {
  const e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Catalepsia");
  assert.equal(puedeJugar(e, c), false);
  poner(e, 0, "pagado", "Drácula");
  assert.equal(puedeJugar(e, c), true);
});

test("Catalepsia: busca dos Oros sin habilidad, los pone en tu Oro Pagado y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "mano", "Catalepsia");
  const onsen = poner(e, 0, "castillo", "Onsen");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === onsen), false);
  e = elegir(e, nombreDe(e, "Drácula"));
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, onsen) === "castillo" || zonaDe(e, onsen) === "mano", true);
});

test("Celebrar la Muerte: Destierra una carta de coste 3 o menos y se baraja en tu Castillo al resolverse", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Celebrar la Muerte");
  const j = poner(e, 1, "defensa", "Jabberwocky");
  const m = poner(e, 1, "defensa", "Gusano Rojo");
  e = hacer(e, jugar(c), j);
  assert.equal(zonaDe(e, j), "destierro");
  assert.equal(zonaDe(e, m), "defensa");
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("Celebrar la Muerte: no se pueden jugar cartas con el mismo nombre hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Celebrar la Muerte");
  const v = poner(e, 1, "defensa", "Valefor");
  const mia = poner(e, 0, "mano", "Valefor");
  e = hacer(e, jugar(c), v);
  assert.equal(puedeJugar(e, mia), false);
  assert.equal(e.efectos.filter((f) => f.tipo === "noJugarNombre" && f.nombre === "Valefor").map((f) => f.j).sort().join(","), "0,1");
});

test("Celebrar la Muerte: si llega al Cementerio por otra vía no se baraja", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Celebrar la Muerte");
  N.mover(e, c, "cementerio");
  resolver(e);
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Celebrar la Muerte: al Botarla por daño oponente puedes Desterrarla para barajar hasta cinco cartas de los Cementerios", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Sir Persival");
  const c = poner(e, 1, "castillo", "Celebrar la Muerte");
  e.jugadores[1].castillo = [c, ...e.jugadores[1].castillo.filter((u) => u !== c)];
  const m = poner(e, 0, "cementerio", "Sir Galahad");
  e = atacarSolo(e, v);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, true);
  e = elegir(e, m);
  e = elegir(e, null);
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(zonaDe(e, m), "castillo");
});

test("Celebrar la Muerte: si se Bota por otra vía no se ofrece Desterrarla", () => {
  const e = mesa();
  const c = poner(e, 1, "castillo", "Celebrar la Muerte");
  e.jugadores[1].castillo = [c, ...e.jugadores[1].castillo.filter((u) => u !== c)];
  N.quitarDelCastillo(e, 1, 1, "cementerio");
  resolver(e);
  assert.equal(e.pendiente ?? null, null);
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Chivateo del Mandinga: Destruye los Aliados de Fuerza 3 o más y su controlador Roba una por cada uno", () => {
  let e = mesa();
  oros(e, 0, 4);
  const c = poner(e, 0, "mano", "Chivateo del Mandinga");
  const mio = poner(e, 0, "defensa", "Valefor");
  const r1 = poner(e, 1, "defensa", "Valefor");
  const r2 = poner(e, 1, "defensa", "Jabberwocky");
  const debil = poner(e, 1, "defensa", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(c)));
  for (const u of [mio, r1, r2]) assert.equal(zonaDe(e, u), "cementerio");
  assert.equal(zonaDe(e, debil), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[1].mano.length, 2);
});

test("Chivateo del Mandinga: un Aliado Indestructible no se Destruye ni hace robar", () => {
  let e = mesa();
  oros(e, 0, 4);
  const c = poner(e, 0, "mano", "Chivateo del Mandinga");
  const g = poner(e, 1, "defensa", "Gusano Rojo");
  N.agregarEfecto(e, { tipo: "gana", clave: "Indestructible", uid: g, fin: "mientras" }, 1);
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[1].mano.length, 0);
});

test("Choque de Colosos: robas tantas cartas como coste del Aliado elegido y Destruyes cartas oponentes cuyos costes sumen eso o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Choque de Colosos");
  const s = poner(e, 0, "defensa", "Sir Persival");
  const j = poner(e, 1, "defensa", "Jabberwocky");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  e = hacer(e, jugar(c), s);
  assert.equal(e.jugadores[0].mano.length, 3);
  e = elegir(e, j);
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [v, null]);
  e = elegir(e, v);
  assert.equal(zonaDe(e, j), "cementerio");
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, g), "defensa");
});

test("Cienpies-SP: solo se juega en respuesta y Anula una carta de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 4);
  oros(e, 1, 1);
  const cp = poner(e, 1, "mano", "Cienpies-SP");
  const v = poner(e, 0, "mano", "Valefor");
  const g = poner(e, 0, "mano", "Gusano Rojo");
  assert.equal(N.carta(e, cp).soloRespuesta, true);
  e = aplicar(e, jugar(v));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === cp), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: cp }));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, g), "mano");
});

test("Clamor de los Justos: Caballero genera un Oro para Armas y Aliados", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Clamor de los Justos");
  poner(e, 0, "defensa", "Sir Galahad");
  e = hacer(e, jugar(c), (v, o) => o.texto.startsWith("Caballero"));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma", "Aliado"], costeMin: 2 }]);
});

test("Clamor de los Justos: Guerrero da 2 de Fuerza a tus Aliados y Héroe encarece los Talismanes", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Clamor de los Justos");
  const gu = poner(e, 0, "defensa", "Ghul Leal");
  poner(e, 0, "defensa", "Ileana");
  const otro = poner(e, 0, "mano", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.pendiente.opciones.some((o) => o.texto?.startsWith("Caballero")), false);
  e = elegir(e, (v, o) => o.texto.startsWith("Guerrero"));
  e = elegir(e, (v, o) => o.texto.startsWith("Héroe"));
  assert.equal(N.fuerza(e, gu), 5);
  assert.equal(costeDe(e, 0, otro).pagar, 2);
});

test("Clamor de los Justos: el Oro generado solo sirve para Caballeros de coste 2 o más", { todo: "generar: Oro restringido a un tipo de carta o a una Raza (Armas y/o Caballeros)" }, () => {});

test("Colaborador Titán: Destierra del Castillo oponente tantas cartas como coste de tus Aliados Titán o Ignis y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "mano", "Colaborador Titán");
  const t = poner(e, 0, "defensa", "Titán Abismal");
  poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[1].destierro.length, N.carta(e, t).coste);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Colaborador Titán: Destruir o Descartar un Aliado Titán o Ignis reduce su coste", { todo: "coste alternativo: Destruir o Descartar una carta para reducir el coste" }, () => {});

test("Colapso Global: Robas una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Colapso Global");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Colapso Global: en respuesta a que el oponente mire tu mano o busque, se juega gratis Desterrando una carta y lo previene", { todo: "respuesta: a que el oponente mire tu mano o busque en un Castillo, con prevención de ese efecto" }, () => {});

test("Combate Naval de Iquique: no puede ser Anulado", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Combate Naval de Iquique");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
});

test("Combate Naval de Iquique: Destierra hasta dos Arma y/o Tótem cuyos costes sumen hasta 4", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Combate Naval de Iquique");
  const h = poner(e, 1, "apoyo", "Fortaleza Hoshi");
  const t = poner(e, 1, "apoyo", "Templo Gótico");
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "arma", "Pedrenyal", { portador: v });
  e = hacer(e, jugar(c), h);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === t), false);
  e = elegir(e, p);
  assert.equal(zonaDe(e, h), "destierro");
  assert.equal(zonaDe(e, p), "destierro");
  assert.equal(zonaDe(e, t), "apoyo");
});

test("Combate Naval de Iquique: desde el Cementerio, Desterrarlo hace que un Arma o Tótem pierda su habilidad", () => {
  let e = mesa();
  const c = poner(e, 0, "cementerio", "Combate Naval de Iquique");
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "arma", "Pedrenyal", { portador: v });
  e = hacer(e, habilidad(c, "Combate Naval de Iquique"), "Durante el próximo turno");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(N.activa(e, p), false);
  assert.equal(N.fuerza(e, v), 3);
});

test("Combate de Punta Gruesa: Descarta una carta que no sea Oro de la mano oponente y si es de coste 2 o menos Robas una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Combate de Punta Gruesa");
  const v = poner(e, 1, "mano", "Valefor");
  const o = poner(e, 1, "mano", "Drácula");
  poner(e, 0, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "batalla" });
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, o), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Combate de Punta Gruesa: si la carta Descartada es de coste 3 o más no Robas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Combate de Punta Gruesa");
  const m = poner(e, 1, "mano", "Mecha-Daikaiju");
  poner(e, 0, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "batalla" });
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(zonaDe(e, m), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Combate de Punta Gruesa: se puede jugar al comienzo de cualquier Fase, también en el turno oponente", () => {
  let e = mesa();
  oros(e, 1, 1);
  const c = poner(e, 1, "mano", "Combate de Punta Gruesa");
  poner(e, 0, "mano", "Valefor");
  poner(e, 0, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "batalla" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, c), false);
  e = aplicar(e, { tipo: "pasarMomento" });
  assert.equal(puedeJugar(e, c), true);
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Comite de Animales: por cada Aliado de coste 1 o más en juego convierte la primera carta de tu Castillo en un Aliado de Fuerza 2 con Furia", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Comite de Animales");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Jabberwocky");
  const [t1, t2, t3] = e.jugadores[0].castillo;
  e = sinRespuesta(aplicar(e, jugar(c)));
  for (const u of [t1, t2]) {
    assert.equal(zonaDe(e, u), "defensa");
    assert.equal(N.ubicar(e, u).j, 0);
    assert.equal(N.carta(e, u).tipo, "Aliado");
    assert.equal(N.fuerza(e, u), 2);
    assert.equal(N.tiene(e, u, "Furia"), true);
  }
  assert.equal(zonaDe(e, t3), "castillo");
});

test("Comite de Animales: no puede ser Anulado por cartas de coste 1 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 2);
  const c = poner(e, 0, "mano", "Comite de Animales");
  const cp = poner(e, 1, "mano", "Cienpies-SP");
  const canto = poner(e, 1, "mano", "Canto de los Serafin");
  e = aplicar(e, jugar(c));
  const respuestas = accionesLegales(e).filter((a) => a.tipo === "responder").map((a) => a.uid);
  assert.equal(respuestas.includes(cp), false);
  assert.equal(respuestas.includes(canto), true);
});

test("Comite de Animales: la Raza del Aliado convertido es a tu elección", { todo: "convertir: elegir la Raza de la carta convertida" }, () => {});

test("Conan Doyle: no puede ser Anulado", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Conan Doyle");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
});

test("Conan Doyle: juega un Aliado de coste 2 o menos desde tu mano o Cementerio sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Conan Doyle");
  const j = poner(e, 0, "cementerio", "Jabberwocky");
  const m = poner(e, 0, "mano", "Mecha-Daikaiju");
  e = aplicar(e, { tipo: "terminar" });
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === m), false);
  e = elegir(e, j);
  e = sinRespuesta(e);
  assert.equal(zonaDe(e, j), "defensa");
});

test("Conan Doyle: se puede jugar en la Fase Final", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Conan Doyle");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, c), true);
});

test("Conan Doyle: reduce su coste si un Aliado salió del juego por un efecto oponente este turno", { todo: "condición: un Aliado salió del juego por un efecto oponente este turno" }, () => {});

test("Concilio de los Eternos: requiere controlar y/o mostrar cuatro tipos de carta distintos", () => {
  const e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Concilio de los Eternos");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "mano", "Llamar a la Manada");
  assert.equal(puedeJugar(e, c), false);
  poner(e, 0, "mano", "Fortaleza Hoshi");
  assert.equal(puedeJugar(e, c), true);
});

test("Concilio de los Eternos: el oponente solo puede atacar con hasta dos Aliados este turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Concilio de los Eternos");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "mano", "Llamar a la Manada");
  poner(e, 0, "mano", "Fortaleza Hoshi");
  const as = [0, 1, 2].map(() => poner(e, 1, "defensa", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(c)));
  e.activo = 1;
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: as[0] });
  e = aplicar(e, { tipo: "atacar", uid: as[1] });
  assert.equal(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === as[2]), false);
});

test("Concilio de los Eternos: previene un efecto", { todo: "efecto: prevenir un efecto" }, () => {});

test("Conocimiento Prohibido: juegas tu Talismán buscado sin pagar y Destierras el del oponente", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "mano", "Conocimiento Prohibido");
  const mio = poner(e, 0, "castillo", "Llamar a la Manada");
  const suyo = poner(e, 1, "castillo", "Guillatún");
  e = sinRespuesta(aplicar(e, jugar(c)));
  e = elegir(e, mio);
  e = elegir(e, suyo);
  e = elegir(e, "Jugar el tuyo y Desterrar el del oponente");
  assert.equal(zonaDe(e, mio), "cementerio");
  assert.equal(zonaDe(e, suyo), "destierro");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Conocimiento Prohibido: puedes jugar el Talismán oponente bajo tu control y Desterrar el tuyo", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "mano", "Conocimiento Prohibido");
  const mio = poner(e, 0, "castillo", "Guillatún");
  const suyo = poner(e, 1, "castillo", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(c)));
  e = elegir(e, mio);
  e = elegir(e, suyo);
  e = elegir(e, "Jugar el del oponente y Desterrar el tuyo");
  assert.equal(zonaDe(e, mio), "destierro");
  assert.equal(zonaDe(e, suyo), "cementerio");
  assert.equal(N.ubicar(e, suyo).j, 1);
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Conocimiento Prohibido: Exhumar, se juega desde el Cementerio", () => {
  const e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "cementerio", "Conocimiento Prohibido");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === c && a.desde === "cementerio"), true);
});
