import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeUsar = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);

function alTope(e, j, ...uids) {
  const c = e.jugadores[j].castillo;
  for (const u of uids) c.splice(c.indexOf(u), 1);
  c.unshift(...uids);
}

test("Xanadú: si controlas dos o más Tótem puedes Robar una carta, una vez por turno", () => {
  let e = mesa();
  const x = poner(e, 0, "apoyo", "Xanadú");
  assert.equal(puedeUsar(e, x), false);
  poner(e, 0, "apoyo", "Templo Gótico");
  e = aplicar(e, habilidad(x, "Xanadú"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeUsar(e, x), false);
});

test("Xanadú: los Aliados de Fuerza 0 pierden su habilidad", { todo: "continua: los Aliados de cierta Fuerza pierden su habilidad" }, () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Xanadú");
  const m = poner(e, 1, "defensa", "Metalmorfo");
  assert.equal(N.activa(e, m), false);
});

test("Yggdrasil: al entrar Baraja todos los Aliados", () => {
  let e = mesa();
  oros(e, 0, 5);
  const y = poner(e, 0, "mano", "Yggdrasil");
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(y)));
  assert.equal(zonaDe(e, y), "apoyo");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
});

test("Yggdrasil: es Única y no se juega otra copia si ya controlas una", () => {
  const e = mesa();
  oros(e, 0, 5);
  poner(e, 0, "apoyo", "Yggdrasil");
  const otra = poner(e, 0, "mano", "Yggdrasil");
  assert.equal(puedeJugar(e, otra), false);
});

test("Yggdrasil: en tu Vigilia convierte un Tótem en un Aliado con Fuerza igual a su coste hasta la Fase Final", () => {
  let e = mesa();
  const y = poner(e, 0, "apoyo", "Yggdrasil");
  const t = poner(e, 0, "apoyo", "Templo Gótico");
  e = hacer(e, habilidad(y, "Yggdrasil"), t);
  assert.equal(zonaDe(e, t), "defensa");
  assert.equal(N.carta(e, t).tipo, "Aliado");
  assert.equal(N.fuerza(e, t), 2);
  assert.equal(puedeUsar(e, y), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, t), "apoyo");
  assert.equal(N.carta(e, t).tipo, "Tótem");
});

test("Yggdrasil: mientras esté en juego jugar Aliados cuesta un Oro adicional", { todo: "continua: jugar cartas de un tipo cuesta un Oro adicional a ambos jugadores" }, () => {
  const e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "apoyo", "Yggdrasil");
  const v = poner(e, 0, "mano", "Valefor");
  assert.equal(puedeJugar(e, v), false);
});

test("Adan: al entrar busca a Eva y, si no controlas más Aliados, la juega sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const adan = poner(e, 0, "mano", "Adan");
  const eva = poner(e, 0, "castillo", "Eva");
  e = sinRespuesta(aplicar(e, jugar(adan)));
  e = elegir(e, eva);
  assert.equal(zonaDe(e, eva), "defensa");
  assert.equal(N.fuerza(e, adan), 3);
});

test("Adan: si controlas otro Aliado, Eva queda en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const adan = poner(e, 0, "mano", "Adan");
  const eva = poner(e, 0, "castillo", "Eva");
  e = sinRespuesta(aplicar(e, jugar(adan)));
  e = elegir(e, eva);
  assert.equal(zonaDe(e, eva), "mano");
});

test("Adan: una vez por turno pone hasta dos cartas de tu mano al fondo del Castillo y Roba esa misma cantidad", () => {
  let e = mesa();
  const adan = poner(e, 0, "defensa", "Adan");
  const a = poner(e, 0, "mano", "Valefor");
  const b = poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Valefor");
  e = hacer(e, habilidad(adan, "Adan"), a, b);
  assert.deepEqual(e.jugadores[0].castillo.slice(-2), [a, b]);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(puedeUsar(e, adan), false);
});

test("Alicia en Wonderland: al entrar muestra hasta dos Aliados de distinto coste y los pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const alicia = poner(e, 0, "mano", "Alicia en Wonderland");
  const a = poner(e, 0, "castillo", "Valefor");
  const b = poner(e, 0, "castillo", "El Dracul");
  const c = poner(e, 0, "castillo", "Guardia Real");
  alTope(e, 0, a, b, c);
  e = sinRespuesta(aplicar(e, jugar(alicia)));
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, c), "mano");
});

test("Alicia en Wonderland: la carta nombrada pierde su habilidad mientras Alicia esté en juego", () => {
  let e = mesa();
  oros(e, 0, 2);
  const alicia = poner(e, 0, "mano", "Alicia en Wonderland");
  const r = poner(e, 1, "defensa", "Valefor");
  const propia = poner(e, 0, "defensa", "Valefor");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(alicia)));
  e = elegir(e, r);
  assert.equal(N.activa(e, r), false);
  assert.equal(N.activa(e, propia), false);
  assert.equal(N.activa(e, alicia), true);
  e = sinRespuesta(aplicar(e, jugar(lucy)));
  e = elegir(e, alicia);
  assert.equal(zonaDe(e, alicia), "cementerio");
  assert.equal(N.activa(e, r), true);
});

test("Alicia en Wonderland: la carta nombrada pierde su habilidad también fuera del juego", { todo: "efecto: pérdida de habilidad por nombre en zonas fuera del juego" }, () => {
  let e = mesa();
  oros(e, 0, 1);
  const alicia = poner(e, 0, "mano", "Alicia en Wonderland");
  const r = poner(e, 1, "cementerio", "Belial");
  e = sinRespuesta(aplicar(e, jugar(alicia)));
  e = elegir(e, r);
  assert.equal(N.activa(e, r), false);
});

test("Arturo Prat - Sp: intercambia el control de una carta tuya por una oponente que cueste hasta un Oro más", () => {
  let e = mesa();
  const arturo = poner(e, 0, "defensa", "Arturo Prat - Sp");
  const mia = poner(e, 0, "defensa", "Valefor");
  const suya = poner(e, 1, "defensa", "Guardia Real");
  const cara = poner(e, 1, "defensa", "Gusano Rojo");
  e = hacer(e, habilidad(arturo, "Arturo Prat - Sp"), mia);
  assert.equal(N.controlador(e, mia), 1);
  assert.equal(N.controlador(e, suya), 0);
  assert.equal(N.controlador(e, cara), 1);
  assert.equal(puedeUsar(e, arturo), false);
});

test("Arturo Prat - Sp: cuando un Aliado entra bajo tu control Baraja hasta una carta de un Cementerio y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Arturo Prat - Sp");
  const c = poner(e, 1, "cementerio", "Valefor");
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(v)));
  e = elegir(e, c);
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Arturo Prat - Sp: su habilidad disparada solo se usa tres veces por turno", () => {
  let e = mesa();
  oros(e, 0, 4);
  poner(e, 0, "defensa", "Arturo Prat - Sp");
  const vs = [1, 2, 3, 4].map(() => poner(e, 0, "mano", "Valefor"));
  for (const v of vs) e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Ava Rei Pua: no puede ser Barajado", () => {
  let e = mesa();
  const k = poner(e, 0, "defensa", "Espiritu Kotaix");
  const ava = poner(e, 1, "defensa", "Ava Rei Pua");
  e = aplicar(e, habilidad(k, "Espiritu Kotaix"));
  assert.equal(zonaDe(e, ava), "defensa");
});

test("Ava Rei Pua: cuando tu oponente Roba cartas por efectos puedes Robar esa misma cantidad", { todo: "evento: cuando el oponente Roba cartas por efectos" }, () => {
  let e = mesa();
  poner(e, 0, "defensa", "Ava Rei Pua");
  const k = poner(e, 1, "defensa", "Espiritu Kotaix");
  e.activo = 1;
  e = aplicar(e, habilidad(k, "Espiritu Kotaix"));
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Belial: al entrar Destierra hasta una carta de coste 2 o menos y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Belial");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const caro = poner(e, 1, "defensa", "Gusano Rojo");
  e = sinRespuesta(aplicar(e, jugar(b)));
  e = elegir(e, g);
  assert.equal(zonaDe(e, g), "destierro");
  assert.equal(zonaDe(e, caro), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Belial: Botando dos cartas sube de tu Cementerio a tu mano, una vez por turno", () => {
  let e = mesa();
  const b = poner(e, 0, "cementerio", "Belial");
  const otro = poner(e, 0, "cementerio", "Belial");
  e = aplicar(e, habilidad(b, "Belial"));
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.equal(puedeUsar(e, otro), false);
});

test("Cleopatra VII: es Indestructible", () => {
  const e = mesa();
  const c = poner(e, 0, "defensa", "Cleopatra VII");
  assert.equal(N.tiene(e, c, "Indestructible"), true);
});

test("Cleopatra VII: tus demás Aliados no son afectados por habilidades de Aliados oponentes", { todo: "protección: tus Aliados no son afectados por habilidades de Aliados oponentes" }, () => {
  let e = mesa();
  poner(e, 1, "defensa", "Cleopatra VII");
  const v = poner(e, 1, "defensa", "Valefor");
  const k = poner(e, 0, "defensa", "Espiritu Kotaix");
  e = aplicar(e, habilidad(k, "Espiritu Kotaix"));
  if (e.pendiente) e = elegir(e, v);
  assert.equal(zonaDe(e, v), "defensa");
});

test("Cleopatra VII: tus demás Aliados no pueden ser bloqueados por Aliados de mayor Fuerza", { todo: "restricción de bloqueo: no puede ser bloqueado por Aliados de mayor Fuerza" }, () => {
  let e = mesa();
  poner(e, 0, "defensa", "Cleopatra VII");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Gusano Rojo");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: v });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.equal(accionesLegales(e).some((a) => a.tipo === "bloquear" && a.uid === g), false);
});

test("Cleopatra VII: entra en juego con una Raza a tu elección", { todo: "efecto: elegir la Raza de una carta al entrar en juego" }, () => {
  assert.fail("sin modelar");
});

test("Don Quijote: tiene Exhumar e Indesterrable", () => {
  const e = mesa();
  const d = poner(e, 0, "defensa", "Don Quijote");
  assert.equal(N.tiene(e, d, "Exhumar"), true);
  assert.equal(N.tiene(e, d, "Indesterrable"), true);
});

test("Don Quijote: al entrar puede buscar dos cartas que no sean Talismán", () => {
  let e = mesa();
  oros(e, 0, 2);
  const d = poner(e, 0, "mano", "Don Quijote");
  const v = poner(e, 0, "castillo", "Valefor");
  const t = poner(e, 0, "castillo", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(d)));
  e = elegir(e, true);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === t), false);
  e = elegir(e, v);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, t), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Don Quijote: una vez por turno Roba dos cartas", () => {
  let e = mesa();
  const d = poner(e, 0, "defensa", "Don Quijote");
  e = aplicar(e, habilidad(d, "Don Quijote"));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, d), false);
});

test("Don Quijote: genera un Oro para jugar cartas de coste 3 o más", { todo: "generar: Oro generado restringido a cartas de coste mínimo" }, () => {
  let e = mesa();
  const d = poner(e, 0, "defensa", "Don Quijote");
  e = aplicar(e, habilidad(d, "Don Quijote"));
  assert.equal(e.jugadores[0].generados.length, 1);
});

test("Espiritu Kotaix: es Indesterrable y una vez por turno Roba dos cartas y Baraja una carta oponente que no sea Oro", () => {
  let e = mesa();
  const k = poner(e, 0, "defensa", "Espiritu Kotaix");
  const v = poner(e, 1, "defensa", "Valefor");
  const o = poner(e, 1, "reserva", "Drácula");
  assert.equal(N.tiene(e, k, "Indesterrable"), true);
  e = aplicar(e, habilidad(k, "Espiritu Kotaix"));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(puedeUsar(e, k), false);
});

test("Espiritu Kotaix: tus Aliados ganan 2 de Fuerza y Furia", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Espiritu Kotaix");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.tiene(e, v, "Furia"), true);
  assert.equal(N.fuerza(e, r), 3);
});

test("Espiritu Kotaix: tus Aliados no pueden ser afectados por Talismanes", { todo: "protección: tus Aliados no pueden ser afectados por Talismanes" }, () => {
  let e = mesa();
  poner(e, 1, "defensa", "Espiritu Kotaix");
  const v = poner(e, 1, "defensa", "Valefor");
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(lucy)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === v), false);
});

test("Eva: al entrar busca a Adan y, si no controlas más Aliados, lo juega sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const eva = poner(e, 0, "mano", "Eva");
  const adan = poner(e, 0, "castillo", "Adan");
  e = sinRespuesta(aplicar(e, jugar(eva)));
  e = elegir(e, adan);
  assert.equal(zonaDe(e, adan), "defensa");
});

test("Eva: en tu Vigilia, pagando un Oro, busca un Aliado y un Talismán en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const eva = poner(e, 0, "defensa", "Eva");
  const v = poner(e, 0, "castillo", "Valefor");
  const t = poner(e, 0, "castillo", "Llamar a la Manada");
  e = hacer(e, habilidad(eva, "Eva"), v, t);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, t), "mano");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(puedeUsar(e, eva), false);
});

test("Eva: tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Eva");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, r), 3);
});

test("Guerrillero Rodriguez: es Indestructible y al entrar Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Guerrillero Rodriguez");
  e = sinRespuesta(aplicar(e, jugar(g)));
  assert.equal(N.tiene(e, g, "Indestructible"), true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Guerrillero Rodriguez: puede jugarse al comienzo de la Vigilia", { todo: "momento: jugar un Aliado al comienzo de la Vigilia" }, () => {
  assert.fail("sin modelar");
});

test("Guerrillero Rodriguez: las cartas solo pueden ser puestas en juego desde la mano de su dueño", { todo: "restricción: los jugadores solo pueden poner cartas en juego desde su mano" }, () => {
  const e = mesa();
  oros(e, 0, 2);
  poner(e, 1, "defensa", "Guerrillero Rodriguez");
  const d = poner(e, 0, "cementerio", "Don Quijote");
  assert.equal(puedeJugar(e, d), false);
});

test("Guerrillero Rodriguez: no puede ser afectado por Oros oponentes", { todo: "protección: no puede ser afectado por Oros oponentes" }, () => {
  assert.fail("sin modelar");
});

test("Hijo de la Rebeldia: tiene Furia e Imbloqueable", () => {
  const e = mesa();
  const h = poner(e, 0, "defensa", "Hijo de la Rebeldia");
  assert.equal(N.tiene(e, h, "Furia"), true);
  assert.equal(N.tiene(e, h, "Imbloqueable"), true);
});

test("Hijo de la Rebeldia: si es Desterrado busca una carta en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "defensa", "Hijo de la Rebeldia");
  const v = poner(e, 0, "castillo", "Valefor");
  const b = poner(e, 0, "mano", "Belial");
  e = sinRespuesta(aplicar(e, jugar(b)));
  e = elegir(e, h);
  e = elegir(e, v);
  assert.equal(zonaDe(e, h), "destierro");
  assert.equal(zonaDe(e, v), "mano");
});

test("Hijo de la Rebeldia: si es Anulado busca una carta en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const h = poner(e, 0, "mano", "Hijo de la Rebeldia");
  const v = poner(e, 0, "castillo", "Valefor");
  const c = poner(e, 1, "mano", "Ciempiés-SP");
  e = aplicar(e, jugar(h));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: c }));
  e = elegir(e, v);
  assert.equal(zonaDe(e, h), "cementerio");
  assert.equal(zonaDe(e, v), "mano");
});

test("Hijo de la Rebeldia: los Aliados deben atacar todos los turnos si pueden", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Hijo de la Rebeldia");
  const r = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.fase, "vigilia");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "terminar"), false);
  e = aplicar(e, { tipo: "batalla" });
  assert.equal(accionesLegales(e).some((a) => a.tipo === "finAtaque"), false);
  e = aplicar(e, { tipo: "atacar", uid: r });
  assert.equal(accionesLegales(e).some((a) => a.tipo === "finAtaque"), true);
});

test("Ivi Atua: no puede ser Barajado", () => {
  const e = mesa();
  const i = poner(e, 0, "defensa", "Ivi Atua");
  assert.equal(N.tiene(e, i, "NoBarajable"), true);
});

test("Ivi Atua: una vez en tu turno Destierra hasta dos cartas cuyos costes sumen hasta 2 y Roba dos cartas", () => {
  let e = mesa();
  const i = poner(e, 0, "defensa", "Ivi Atua");
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "El Dracul");
  const g = poner(e, 1, "defensa", "Guardia Real");
  e = aplicar(e, habilidad(i, "Ivi Atua"));
  e = elegir(e, a);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === g), false);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Ivi Atua: Barajando una carta de tu mano no recibes daño de combate hasta tu próximo turno", () => {
  let e = mesa();
  const i = poner(e, 0, "defensa", "Ivi Atua");
  const m = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(i, "Ivi Atua", 1));
  assert.equal(zonaDe(e, m), "castillo");
  assert.ok(e.efectos.some((f) => f.tipo === "prevenirDano" && f.j === 0));
  assert.equal(puedeUsar(e, i, 1), false);
});

test("Jinete de la Guerra: tiene Exhumar y Furia y una vez en tu turno Destruye hasta una carta de coste 1 o menos", () => {
  let e = mesa();
  const j = poner(e, 0, "defensa", "Jinete de la Guerra");
  const v = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, j, "Exhumar"), true);
  assert.equal(N.tiene(e, j, "Furia"), true);
  e = hacer(e, habilidad(j, "Jinete de la Guerra"), v);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.pendiente, null);
  assert.equal(puedeUsar(e, j), false);
});

test("Jinete de la Guerra: si controlas otro Jinete, además busca un Jinete en tu Castillo o Cementerio", () => {
  let e = mesa();
  const j = poner(e, 0, "defensa", "Jinete de la Guerra");
  poner(e, 0, "defensa", "Jinete de la Peste");
  const h = poner(e, 0, "cementerio", "Jinete del Hambre");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(j, "Jinete de la Guerra"), v, h);
  assert.equal(zonaDe(e, h), "mano");
});

test("Jinete de la Guerra: con cuatro Aliados Jinete ganan Furia y su daño va al Destierro", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Jinete de la Guerra");
  const p = poner(e, 0, "defensa", "Jinete de la Peste");
  poner(e, 0, "defensa", "Jinete del Hambre");
  assert.equal(N.tiene(e, p, "DanoAlDestierro"), false);
  poner(e, 0, "defensa", "Jinete de la Muerte");
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(N.tiene(e, p, "DanoAlDestierro"), true);
});

test("Jinete de la Muerte: tiene Exhumar e Indesterrable y una vez por turno Destierra una carta que no sea Oro", () => {
  let e = mesa();
  const m = poner(e, 0, "defensa", "Jinete de la Muerte");
  const v = poner(e, 1, "defensa", "Valefor");
  const o = poner(e, 1, "reserva", "Drácula");
  assert.equal(N.tiene(e, m, "Exhumar"), true);
  assert.equal(N.tiene(e, m, "Indesterrable"), true);
  e = aplicar(e, habilidad(m, "Jinete de la Muerte"));
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(puedeUsar(e, m), false);
});

test("Jinete de la Muerte: con cuatro Aliados Jinete, las cartas que no sean Jinete ni Oro pierden su habilidad y son Destruidas", () => {
  let e = mesa();
  const m = poner(e, 0, "defensa", "Jinete de la Muerte");
  const js = ["Jinete de la Guerra", "Jinete de la Peste", "Jinete del Hambre"].map((n) => poner(e, 0, "defensa", n));
  const c = poner(e, 1, "defensa", "Cleopatra VII");
  const t = poner(e, 1, "apoyo", "Templo Gótico");
  const propio = poner(e, 0, "defensa", "Valefor");
  const o = poner(e, 1, "reserva", "Drácula");
  e = aplicar(e, habilidad(m, "Jinete de la Muerte"));
  for (const u of [c, t, propio]) assert.equal(zonaDe(e, u), "cementerio");
  for (const u of [m, ...js]) assert.equal(zonaDe(e, u), "defensa");
  assert.equal(zonaDe(e, o), "reserva");
});

test("Jinete de la Muerte: desde tu Destierro se Baraja con hasta otro Jinete", { todo: "zona: habilidad activada desde el Destierro" }, () => {
  const e = mesa();
  const m = poner(e, 0, "destierro", "Jinete de la Muerte");
  assert.equal(puedeUsar(e, m), true);
});

test("Jinete de la Peste: tiene Exhumar e Imbloqueable y una vez por turno busca en un Castillo dos cartas de distinto nombre y las Destierra", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Jinete de la Peste");
  const v = poner(e, 1, "castillo", "Valefor");
  assert.equal(N.tiene(e, p, "Exhumar"), true);
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
  e = hacer(e, habilidad(p, "Jinete de la Peste"), "Castillo oponente", nombreDe(e, "Drácula"));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [v, null]);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Jinete de la Peste: si controlas otro Jinete, además Roba una carta", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Jinete de la Peste");
  poner(e, 0, "defensa", "Jinete de la Guerra");
  const v = poner(e, 0, "castillo", "Valefor");
  e = hacer(e, habilidad(p, "Jinete de la Peste"), "tu Castillo", nombreDe(e, "Drácula"), v);
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Jinete de la Peste: con cuatro Aliados Jinete tu oponente no puede poner cartas en su mano por efectos", { todo: "restricción: el oponente no puede poner cartas en su mano por efectos" }, () => {
  let e = mesa();
  for (const n of ["Jinete de la Peste", "Jinete de la Guerra", "Jinete del Hambre", "Jinete de la Muerte"]) poner(e, 0, "defensa", n);
  const k = poner(e, 1, "defensa", "Espiritu Kotaix");
  e.activo = 1;
  e = aplicar(e, habilidad(k, "Espiritu Kotaix"));
  assert.equal(e.jugadores[1].mano.length, 0);
});

test("Jinete del Hambre: tiene Exhumar e Indestructible y Desterrando una carta de tu mano Roba una carta", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Jinete del Hambre");
  const m = poner(e, 0, "mano", "Valefor");
  assert.equal(N.tiene(e, h, "Exhumar"), true);
  assert.equal(N.tiene(e, h, "Indestructible"), true);
  e = hacer(e, habilidad(h, "Jinete del Hambre"), "Robar una carta");
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeUsar(e, h), false);
});

test("Jinete del Hambre: puede impedir que un Jinete salga del juego", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Jinete del Hambre");
  poner(e, 0, "mano", "Valefor");
  e = hacer(e, habilidad(h, "Jinete del Hambre"), "Un Jinete no puede salir del juego este turno");
  assert.equal(N.puedeSalir(e, h), false);
});

test("Jinete del Hambre: si controlas otro Jinete, además tu oponente Descarta una carta", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Jinete del Hambre");
  poner(e, 0, "defensa", "Jinete de la Guerra");
  poner(e, 0, "mano", "Valefor");
  const r1 = poner(e, 1, "mano", "Valefor");
  poner(e, 1, "mano", "Belial");
  e = hacer(e, habilidad(h, "Jinete del Hambre"), "Robar una carta");
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, r1);
  assert.equal(zonaDe(e, r1), "cementerio");
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Jinete del Hambre: con cuatro Aliados Jinete tu oponente solo puede utilizar hasta tres habilidades por turno", { todo: "restricción: el oponente usa como máximo tres habilidades por turno" }, () => {
  assert.fail("sin modelar");
});

test("Jonathan Harker: en tu Vigilia Baraja un Arma que controles para jugar otra de tu mano o Cementerio pagando un Oro menos", () => {
  let e = mesa();
  const harker = poner(e, 0, "defensa", "Jonathan Harker");
  const v = poner(e, 0, "defensa", "Valefor");
  const vieja = poner(e, 0, "arma", "Pedrenyal", { portador: v });
  const nueva = poner(e, 0, "cementerio", "Pedrenyal");
  e = hacer(e, habilidad(harker, "Jonathan Harker"), v);
  assert.equal(zonaDe(e, vieja), "castillo");
  assert.deepEqual(e.armas[v], [nueva]);
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(puedeUsar(e, harker), false);
});

test("Jonathan Harker: sin Arma en juego de coste 1 o más no puede usar su habilidad", () => {
  const e = mesa();
  const harker = poner(e, 0, "defensa", "Jonathan Harker");
  poner(e, 0, "mano", "Pedrenyal");
  assert.equal(puedeUsar(e, harker), false);
});

test("Jonathan Harker: Destruyendo un Aliado que controles Anula un Arma o Tótem", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {
  assert.fail("sin modelar");
});

test("Jupitris: tiene Furia, Imbloqueable e Indestructible; al entrar no recibes daño hasta tu próximo turno y puedes Robar tres", () => {
  let e = mesa();
  oros(e, 0, 3);
  const j = poner(e, 0, "mano", "Jupitris");
  e = sinRespuesta(aplicar(e, jugar(j)));
  e = elegir(e, true);
  for (const k of ["Furia", "Imbloqueable", "Indestructible"]) assert.equal(N.tiene(e, j, k), true);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.ok(e.efectos.some((f) => f.tipo === "prevenirDano" && f.j === 0));
});

test("Jupitris: una vez por turno Baraja un Aliado oponente y tres cartas de un Cementerio", () => {
  let e = mesa();
  const j = poner(e, 0, "defensa", "Jupitris");
  const v = poner(e, 1, "defensa", "Valefor");
  const c = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Belial"));
  const mio = poner(e, 0, "cementerio", "Belial");
  e = hacer(e, habilidad(j, "Jupitris"), "Cementerio oponente");
  assert.equal(zonaDe(e, v), "castillo");
  for (const u of c) assert.equal(zonaDe(e, u), "castillo");
  assert.equal(zonaDe(e, mio), "cementerio");
  assert.equal(e.jugadores[1].destierro.length, 0);
  assert.equal(puedeUsar(e, j), false);
});

test("La Catrina: al entrar Baraja las cartas oponentes que no sean Oro y el oponente Destierra una carta del tope por cada Oro que controle", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = poner(e, 0, "mano", "La Catrina");
  const v = poner(e, 1, "defensa", "Valefor");
  const t = poner(e, 1, "apoyo", "Templo Gótico");
  const os = oros(e, 1, 2);
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(N.tiene(e, c, "Exhumar"), true);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, t), "castillo");
  for (const o of os) assert.equal(zonaDe(e, o), "reserva");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("La Catrina: las cartas en el Cementerio oponente pierden su habilidad", () => {
  const e = mesa();
  poner(e, 0, "defensa", "La Catrina");
  const r = poner(e, 1, "cementerio", "Belial");
  const mia = poner(e, 0, "cementerio", "Belial");
  assert.equal(N.activa(e, r), false);
  assert.equal(N.activa(e, mia), true);
});

test("La Catrina: las cartas en el Destierro oponente pierden su habilidad", { todo: "continua: las cartas del Destierro oponente pierden su habilidad" }, () => {
  const e = mesa();
  poner(e, 0, "defensa", "La Catrina");
  const r = poner(e, 1, "destierro", "Belial");
  assert.equal(N.activa(e, r), false);
});

test("La Serpiente del Eden: tiene Furia y al entrar busca una carta que no sea Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "La Serpiente del Eden");
  const v = poner(e, 0, "castillo", "Valefor");
  const t = poner(e, 0, "castillo", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(s)));
  assert.equal(N.tiene(e, s, "Furia"), true);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === t), false);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
});

test("La Serpiente del Eden: en tu Fase Final Baraja y/o Destierra hasta dos cartas de los Cementerios y Roba una carta", () => {
  let e = mesa();
  poner(e, 0, "defensa", "La Serpiente del Eden");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, a);
  e = elegir(e, null);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("La Serpiente del Eden: cuando es Destruida tu oponente Bota tres cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "defensa", "La Serpiente del Eden");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(lucy)));
  e = elegir(e, s);
  assert.equal(zonaDe(e, s), "cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Lucifer el Caido: tiene Exhumar e Indesterrable y al entrar Destierra todos los Aliados oponentes", () => {
  let e = mesa();
  oros(e, 0, 3);
  const l = poner(e, 0, "mano", "Lucifer el Caido");
  const rs = [poner(e, 1, "defensa", "Valefor"), poner(e, 1, "ataque", "Guardia Real")];
  const prot = poner(e, 1, "defensa", "Espiritu Kotaix");
  const mio = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(l)));
  assert.equal(N.tiene(e, l, "Exhumar"), true);
  assert.equal(N.tiene(e, l, "Indesterrable"), true);
  for (const u of rs) assert.equal(zonaDe(e, u), "destierro");
  assert.equal(zonaDe(e, prot), "defensa");
  assert.equal(zonaDe(e, mio), "defensa");
});

test("Lucifer el Caido: cuando un Oro entra en juego bajo tu control, una carta en juego pierde su habilidad hasta tu próximo turno", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Lucifer el Caido");
  const r = poner(e, 1, "defensa", "Valefor");
  const o = poner(e, 0, "mano", "Drácula");
  e = aplicar(e, { tipo: "oro", uid: o });
  e = elegir(e, r);
  assert.equal(N.activa(e, r), false);
  assert.ok(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === r && f.fin.inicioDe === 0));
});

test("Lucifer el Caido: la carta elegida puede estar en el Cementerio", { todo: "efecto: pérdida de habilidad de una carta en el Cementerio" }, () => {
  let e = mesa();
  poner(e, 0, "defensa", "Lucifer el Caido");
  const r = poner(e, 1, "cementerio", "Belial");
  const o = poner(e, 0, "mano", "Drácula");
  e = aplicar(e, { tipo: "oro", uid: o });
  e = elegir(e, r);
  assert.equal(N.activa(e, r), false);
});

test("Malevolente: solo puedes controlar una copia", () => {
  const e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Malevolente");
  const otra = poner(e, 0, "mano", "Malevolente");
  assert.equal(puedeJugar(e, otra), false);
  const sola = mesa();
  oros(sola, 0, 1);
  const m = poner(sola, 0, "mano", "Malevolente");
  assert.equal(puedeJugar(sola, m), true);
});

test("Malevolente: Desterrándolo Anula un Talismán de coste 2 o menos o previene que una carta salga del juego", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {
  assert.fail("sin modelar");
});

test("Malevolente: entra en juego con una Raza a tu elección", { todo: "efecto: elegir la Raza de una carta al entrar en juego" }, () => {
  assert.fail("sin modelar");
});

test("Metalmorfo: tiene Furia y al entrar muestra hasta un Aliado y un Arma, los pone en tu mano y Baraja el resto", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Metalmorfo");
  const v = poner(e, 0, "castillo", "Valefor");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(N.tiene(e, m, "Furia"), true);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, p), "mano");
});

test("Metalmorfo: una vez por turno un Aliado es Imbloqueable y hace daño al Destierro este turno", () => {
  let e = mesa();
  const m = poner(e, 0, "defensa", "Metalmorfo");
  const v = poner(e, 0, "defensa", "Valefor");
  e = hacer(e, habilidad(m, "Metalmorfo"), v);
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
  assert.equal(N.tiene(e, m, "Imbloqueable"), false);
  assert.equal(puedeUsar(e, m), false);
});
