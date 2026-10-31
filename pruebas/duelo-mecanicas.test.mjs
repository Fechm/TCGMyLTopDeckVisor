import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, aplicar, accionesLegales, sinRespuesta, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { OPS } from "../web/duelo/efectos.js";

function con(e, nombre, extra) {
  const k = id(nombre);
  e.catalogo = { ...e.catalogo, [k]: { ...e.catalogo[k], ...extra } };
  return e;
}

const jugarDe = (e, uid) => accionesLegales(e).filter((a) => a.tipo === "jugar" && a.uid === uid);

test("mecánica: coste alternativo Botando cartas reduce los Oros a pagar", () => {
  let e = con(mesa(), "Balaur", { costeAlternativo: { botar: 2, reduce: 2 } });
  oros(e, 0, 1);
  const balaur = poner(e, 0, "mano", "Balaur");
  assert.deepEqual(jugarDe(e, balaur), [{ tipo: "jugar", uid: balaur, alternativo: true }]);
  e = sinRespuesta(aplicar(e, { tipo: "jugar", uid: balaur, alternativo: true }));
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.equal(e.jugadores[0].cementerio.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, balaur), "defensa");
});

test("mecánica: con Oro suficiente se ofrecen el coste normal y el alternativo", () => {
  const e = con(mesa(), "Balaur", { costeAlternativo: { botar: 2, reduce: 2 } });
  oros(e, 0, 3);
  const balaur = poner(e, 0, "mano", "Balaur");
  assert.equal(jugarDe(e, balaur).length, 2);
});

test("mecánica: una carta que solo entra pagando su coste no entra por efecto", () => {
  const e = con(mesa(), "Balaur", { soloPagando: true });
  const balaur = poner(e, 0, "castillo", "Balaur");
  OPS.entrar(e, { uid: balaur, datos: { pagado: false } }, { ctx: { ctrl: 0, vars: {} } });
  assert.equal(zonaDe(e, balaur), "castillo");
});

test("mecánica: efecto noJugarMas impide jugar cartas y Oros este turno", () => {
  const e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "mano", "Balaur");
  poner(e, 0, "mano", "Drácula");
  N.agregarEfecto(e, { tipo: "noJugarMas", j: 0, fin: "turno" }, 0);
  assert.equal(accionesLegales(e).filter((a) => a.tipo === "jugar" || a.tipo === "oro").length, 0);
});

test("mecánica: maxPorTipo y maxNoOro limitan las jugadas del turno", () => {
  let e = mesa();
  oros(e, 0, 6);
  const a = poner(e, 0, "mano", "Balaur");
  const b = poner(e, 0, "mano", "Balaur");
  N.agregarEfecto(e, { tipo: "maxPorTipo", n: 1, fin: "turno" }, 0);
  e = sinRespuesta(aplicar(e, { tipo: "jugar", uid: a }));
  assert.equal(jugarDe(e, b).length, 0);
  e.efectos = [];
  N.agregarEfecto(e, { tipo: "maxNoOro", n: 1, fin: "turno" }, 1);
  assert.equal(jugarDe(e, b).length, 0);
});

test("mecánica: al Anular se registra la carta anulada y se dispara «anulada»", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 4);
  const balaur = poner(e, 0, "mano", "Balaur");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, { tipo: "jugar", uid: balaur });
  assert.ok(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === dorado));
  e = aplicar(e, { tipo: "responder", uid: dorado });
  for (let i = 0; i < 10 && (e.pila.length || e.pendiente); i++) {
    e = e.pendiente ? aplicar(e, { tipo: "elegir", i: 0 }) : aplicar(e, accionesLegales(e)[0]);
  }
  assert.equal(zonaDe(e, balaur), "cementerio");
  assert.equal(e.jugadores[0].jugadas.anuladas.Aliado, 1);
});

test("mecánica: Anular cuesta Oros adicionales y respeta la protección por coste", () => {
  let e = con(mesa(), "Balaur", { anularCuestaMas: 10 });
  oros(e, 0, 3);
  oros(e, 1, 4);
  const balaur = poner(e, 0, "mano", "Balaur");
  poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, { tipo: "jugar", uid: balaur });
  assert.equal(accionesLegales(e).some((x) => x.tipo === "responder"), false);
  let f = con(mesa(), "Balaur", { noAnulableCosteMax: 9 });
  oros(f, 0, 3);
  oros(f, 1, 4);
  const otro = poner(f, 0, "mano", "Balaur");
  poner(f, 1, "mano", "Dragón Dorado");
  f = aplicar(f, { tipo: "jugar", uid: otro });
  assert.equal(accionesLegales(f).some((x) => x.tipo === "responder"), false);
});

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

test("mecánica: prevenirDano de una vez evita el próximo daño al Castillo", () => {
  let e = mesa();
  const balaur = poner(e, 0, "defensa", "Balaur");
  N.agregarEfecto(e, { tipo: "prevenirDano", j: 1, unaVez: true, fin: "juego" }, 1);
  e = atacarSolo(e, balaur);
  assert.equal(e.jugadores[1].castillo.length, 30);
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano"), false);
});

test("mecánica: reduceDanoCastillo resta daño de combate", () => {
  let e = con(mesa(), "Sir Galahad", { continuas: [{ reduceDanoCastillo: 2 }] });
  const balaur = poner(e, 0, "defensa", "Balaur");
  poner(e, 1, "apoyo", "Sir Galahad");
  const f = N.fuerza(e, balaur);
  e = atacarSolo(e, balaur);
  assert.equal(e.jugadores[1].castillo.length, 30 - Math.max(0, f - 2));
});

test("mecánica: fuerzaPor, tusDemasAliados y filtros de raza y coste mínimo", () => {
  const e = con(mesa(), "Balaur", {
    continuas: [
      { a: "propia", fuerzaPor: "orosPagados" },
      { a: "tusDemasAliados", fuerza: 1, raza: "Dragón" },
      { a: "tusDemasAliados", gana: "Furia", costeMin: 3 },
    ],
    fns: { orosPagados: (e, ctx) => e.jugadores[ctx.ctrl].pagado.length },
  });
  const balaur = poner(e, 0, "defensa", "Balaur");
  const otro = poner(e, 0, "defensa", "Balaur");
  const base = e.catalogo[id("Balaur")].fuerza;
  poner(e, 0, "pagado", "Drácula");
  poner(e, 0, "pagado", "Drácula");
  assert.equal(N.fuerza(e, balaur), base + 2 + 1);
  assert.equal(N.tiene(e, otro, "Furia"), true);
});

test("mecánica: NoBarajable impide Barajar un Aliado en juego", () => {
  const e = con(mesa(), "Balaur", { claves: ["NoBarajable"] });
  const balaur = poner(e, 0, "defensa", "Balaur");
  OPS.mover(e, { var: "x", a: "barajar" }, { ctx: { ctrl: 1, vars: { x: [balaur] } } });
  assert.equal(zonaDe(e, balaur), "defensa");
});

test("mecánica: salenDelCastillo informa si fue por daño", () => {
  let e = con(mesa(), "Sir Galahad", {
    disparadas: [{ cuando: ["salenDelCastillo"], quien: "cualquiera", si: "porDano", hacer: [{ op: "fn", f: "marca" }] }],
    fns: { porDano: (e, ctx) => ctx.datos.porDano, marca: (e) => { e.usos.marcaDano = (e.usos.marcaDano ?? 0) + 1; } },
  });
  const balaur = poner(e, 0, "defensa", "Balaur");
  poner(e, 1, "apoyo", "Sir Galahad");
  e = atacarSolo(e, balaur);
  assert.equal(e.usos.marcaDano, 1);
});
