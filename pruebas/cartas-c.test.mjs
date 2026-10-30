import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";

const nom = (e, n) => (v) => typeof v === "string" && N.carta(e, v).nombre === n;
const cualquiera = (v) => typeof v === "string";

function armarCastillo(e, j, nombres, relleno = 20) {
  e.jugadores[j].castillo = [];
  const uids = nombres.map((n) => poner(e, j, "castillo", n));
  for (let i = 0; i < relleno; i++) poner(e, j, "castillo", "Drácula");
  return uids;
}

function auto(e) {
  while (e.pendiente) {
    const ops = e.pendiente.opciones;
    const i = ops.findIndex((o) => o.valor === false);
    e = aplicar(e, { tipo: "elegir", i: i >= 0 ? i : ops.length - 1 });
  }
  return e;
}

function combate(e, ...uids) {
  e = aplicar(e, { tipo: "batalla" });
  for (const u of uids) e = aplicar(e, { tipo: "atacar", uid: u });
  e = aplicar(e, { tipo: "finAtaque" });
  return aplicar(e, { tipo: "finBloqueo" });
}

function cerrarCombate(e) {
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

const puedeJugar = (e, uid, portador) =>
  accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid && (portador === undefined || a.portador === portador));

const hab = (e, uid, nombre, h) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeHab = (e, uid, h) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);
const textos = (e) => e.pendiente.opciones.map((o) => o.texto);
const nombresOpc = (e) => e.pendiente.opciones.map((o) => (typeof o.valor === "string" ? N.carta(e, o.valor).nombre : o.valor));

test("Patrulla Nocturna: al entrar puede buscar un Arma en el Castillo y ponerla en la mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const pat = poner(e, 0, "mano", "Patrulla Nocturna");
  const arma = poner(e, 0, "castillo", "Espada Vikinga");
  e = hacer(e, { tipo: "jugar", uid: pat }, true, nom(e, "Espada Vikinga"));
  assert.equal(zonaDe(e, pat), "defensa");
  assert.equal(zonaDe(e, arma), "mano");
});

test("Patrulla Nocturna: al atacar puede buscar un Arma en el Cementerio y ponerla en la mano", () => {
  let e = mesa();
  const pat = poner(e, 0, "defensa", "Patrulla Nocturna");
  const arma = poner(e, 0, "cementerio", "Hacha Danesa");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: pat }, true, nom(e, "Hacha Danesa"));
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(zonaDe(e, pat), "ataque");
});

test("Patrulla Nocturna: la búsqueda es opcional y solo ofrece Armas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const pat = poner(e, 0, "mano", "Patrulla Nocturna");
  const arma = poner(e, 0, "castillo", "Espada Vikinga");
  poner(e, 0, "castillo", "Sir Persival");
  e = aplicar(e, { tipo: "jugar", uid: pat });
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [true, false]);
  e = elegir(e, true);
  assert.deepEqual(nombresOpc(e).filter((n) => n !== null), ["Espada Vikinga"]);
  e = elegir(e, null);
  assert.equal(zonaDe(e, arma), "castillo");
});

test("Patrulla Nocturna: tus Aliados ganan 1 de Fuerza y los oponentes no", () => {
  const e = mesa();
  const pat = poner(e, 0, "defensa", "Patrulla Nocturna");
  const propio = poner(e, 0, "defensa", "Sir Persival");
  const ajeno = poner(e, 1, "defensa", "Sir Persival");
  assert.equal(N.fuerza(e, pat), 4);
  assert.equal(N.fuerza(e, propio), 3);
  assert.equal(N.fuerza(e, ajeno), 2);
});

test("Patrulla Nocturna: tus Aliados pueden portar un Arma adicional", () => {
  const armar = (conPatrulla) => {
    const e = mesa();
    oros(e, 0, 1);
    const aliado = poner(e, 0, "defensa", "Sir Persival");
    poner(e, 0, "arma", "Hacha Danesa", { portador: aliado });
    const espada = poner(e, 0, "mano", "Espada Vikinga");
    if (conPatrulla) poner(e, 0, "defensa", "Patrulla Nocturna");
    return { e, aliado, espada };
  };
  const sin = armar(false);
  assert.equal(puedeJugar(sin.e, sin.espada, sin.aliado), false);
  const con = armar(true);
  assert.equal(puedeJugar(con.e, con.espada, con.aliado), true);
});

test("Sir Peter Hawkins: modo robar dos y descartar una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const peter = poner(e, 0, "mano", "Sir Peter Hawkins");
  e = hacer(e, { tipo: "jugar", uid: peter }, "Robar dos y descartar una", cualquiera);
  assert.equal(zonaDe(e, peter), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Sir Peter Hawkins: modo buscar un Arma en el Castillo y ponerla en la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const peter = poner(e, 0, "mano", "Sir Peter Hawkins");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  e = hacer(e, { tipo: "jugar", uid: peter }, "Buscar un Arma", nom(e, "Pedrenyal"));
  assert.equal(zonaDe(e, arma), "mano");
});

test("Sir Peter Hawkins: tiene Furia y puede atacar el turno en que entra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const peter = poner(e, 0, "mano", "Sir Peter Hawkins");
  e = hacer(e, { tipo: "jugar", uid: peter }, "Robar dos y descartar una", cualquiera);
  assert.ok(N.tiene(e, peter, "Furia"));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
});

test("Sir Peter Hawkins: permite jugar Armas en Guerra de Talismanes", () => {
  const armar = (conPeter) => {
    let e = mesa();
    const atacante = poner(e, 0, "defensa", "Sir Persival");
    const portador = poner(e, 1, "defensa", "Sir Persival");
    if (conPeter) poner(e, 1, "defensa", "Sir Peter Hawkins");
    const espada = poner(e, 1, "mano", "Espada Vikinga");
    oros(e, 1, 1);
    e = combate(e, atacante);
    return { e, espada, portador };
  };
  const sin = armar(false);
  assert.equal(sin.e.fase, "talismanes");
  assert.equal(puedeJugar(sin.e, sin.espada), false);
  const con = armar(true);
  assert.equal(puedeJugar(con.e, con.espada, con.portador), true);
});

test("Guardia Real: puede atacar el turno en que entra", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "mano", "Guardia Real");
  e = hacer(e, { tipo: "jugar", uid: g });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === g));
});

test("Guardia Real: en la Fase Final se destruye si no fue declarada atacante", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "mano", "Guardia Real");
  e = hacer(e, { tipo: "jugar", uid: g });
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, g), "cementerio");
});

test("Guardia Real: sobrevive a la Fase Final si fue declarada atacante", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "mano", "Guardia Real");
  e = hacer(e, { tipo: "jugar", uid: g });
  e = cerrarCombate(combate(e, g));
  assert.equal(zonaDe(e, g), "ataque");
});

test("Sir Galahad: al hacer daño al Castillo oponente descarta una carta de su mano al azar", () => {
  let e = mesa();
  oros(e, 0, 3);
  const galahad = poner(e, 0, "mano", "Sir Galahad");
  poner(e, 1, "mano", "Jabberwocky");
  poner(e, 1, "mano", "Valefor");
  e = hacer(e, { tipo: "jugar", uid: galahad });
  e = cerrarCombate(combate(e, galahad));
  assert.equal(e.jugadores[1].mano.length, 1);
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Sir Galahad: puede atacar el turno en que entra", () => {
  let e = mesa();
  oros(e, 0, 3);
  const galahad = poner(e, 0, "mano", "Sir Galahad");
  e = hacer(e, { tipo: "jugar", uid: galahad });
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === galahad));
});

test("Sir Galahad: si es bloqueado y no hace daño al Castillo no descarta", () => {
  let e = mesa();
  oros(e, 0, 3);
  const galahad = poner(e, 0, "mano", "Sir Galahad");
  const bloqueador = poner(e, 1, "defensa", "Guardia Real");
  poner(e, 1, "mano", "Jabberwocky");
  poner(e, 1, "mano", "Valefor");
  e = hacer(e, { tipo: "jugar", uid: galahad });
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: galahad });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "bloquear", uid: bloqueador, atacante: galahad });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = cerrarCombate(e);
  assert.equal(e.jugadores[1].mano.length, 2);
  assert.equal(zonaDe(e, galahad), "cementerio");
});

test("Sir Persival: al entrar baraja un Aliado oponente en juego (único objetivo)", () => {
  let e = mesa();
  oros(e, 0, 3);
  const persival = poner(e, 0, "mano", "Sir Persival");
  const rival = poner(e, 1, "defensa", "Jabberwocky");
  e = hacer(e, { tipo: "jugar", uid: persival });
  assert.equal(zonaDe(e, rival), "castillo");
  assert.equal(e.jugadores[1].castillo.length, 31);
  assert.equal(zonaDe(e, persival), "defensa");
});

test("Sir Persival: con varios Aliados oponentes elige cuál barajar", () => {
  let e = mesa();
  oros(e, 0, 3);
  const persival = poner(e, 0, "mano", "Sir Persival");
  const a = poner(e, 1, "defensa", "Jabberwocky");
  const b = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, { tipo: "jugar", uid: persival }, b);
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, a), "defensa");
});

test("Sir Persival: no afecta a Aliados propios", () => {
  let e = mesa();
  oros(e, 0, 3);
  const persival = poner(e, 0, "mano", "Sir Persival");
  const propio = poner(e, 0, "defensa", "Jabberwocky");
  e = hacer(e, { tipo: "jugar", uid: persival });
  assert.equal(zonaDe(e, propio), "defensa");
});

test("Jaques de Molay: al atacar el turno en que entra busca dos Talismanes oponentes y los envía a su Cementerio", () => {
  let e = mesa();
  oros(e, 0, 4);
  const jaques = poner(e, 0, "mano", "Jaques de Molay");
  const t1 = poner(e, 1, "castillo", "Llamar a la Manada");
  const t2 = poner(e, 1, "castillo", "Guillatún");
  e = hacer(e, { tipo: "jugar", uid: jaques });
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: jaques }, nom(e, "Llamar a la Manada"), nom(e, "Guillatún"));
  assert.equal(zonaDe(e, t1), "cementerio");
  assert.equal(zonaDe(e, t2), "cementerio");
  assert.equal(N.dueno(t1), 1);
});

test("Jaques de Molay: si no entró este turno no busca Talismanes al atacar", () => {
  let e = mesa();
  const jaques = poner(e, 0, "defensa", "Jaques de Molay");
  const t1 = poner(e, 1, "castillo", "Llamar a la Manada");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: jaques });
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, t1), "castillo");
});

test("Jaques de Molay: puede atacar el turno en que entra", () => {
  let e = mesa();
  oros(e, 0, 4);
  const jaques = poner(e, 0, "mano", "Jaques de Molay");
  e = hacer(e, { tipo: "jugar", uid: jaques });
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === jaques));
});

test("Zweihander Brutal: reduce su coste en un Oro por cada Aliado que controles, mínimo 1", () => {
  const armar = (aliados, orosN) => {
    const e = mesa();
    const lista = Array.from({ length: aliados }, () => poner(e, 0, "defensa", "Sir Persival"));
    oros(e, 0, orosN);
    const arma = poner(e, 0, "mano", "Zweihander Brutal");
    return { e, arma, portador: lista[0] };
  };
  const a = armar(1, 1);
  assert.equal(puedeJugar(a.e, a.arma, a.portador), false);
  const b = armar(1, 2);
  assert.equal(puedeJugar(b.e, b.arma, b.portador), true);
  const c = armar(3, 1);
  assert.equal(puedeJugar(c.e, c.arma, c.portador), true);
  const d = hacer(c.e, { tipo: "jugar", uid: c.arma, portador: c.portador });
  assert.equal(d.jugadores[0].pagado.length, 1);
  assert.deepEqual(d.armas[c.portador], [c.arma]);
});

test("Zweihander Brutal: el portador gana 2 de Fuerza y Furia", () => {
  const e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  e.jugadores[0].nuevos.push(aliado);
  assert.equal(N.tiene(e, aliado, "Furia"), false);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
  poner(e, 0, "arma", "Zweihander Brutal", { portador: aliado });
  assert.equal(N.fuerza(e, aliado), 4);
  assert.ok(N.tiene(e, aliado, "Furia"));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
});

test("Vieja Snaphance: al entrar un Oro o carta de coste 2 o menos pierde su habilidad este turno y el próximo, y robas una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const portador = poner(e, 0, "defensa", "Sir Persival");
  const snap = poner(e, 0, "mano", "Vieja Snaphance");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  assert.ok(N.activa(e, jab));
  e = hacer(e, { tipo: "jugar", uid: snap, portador }, jab);
  assert.equal(N.activa(e, jab), false);
  assert.equal(e.jugadores[0].mano.length, 1);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.turno, 2);
  assert.equal(N.activa(e, jab), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.turno, 3);
  assert.equal(N.activa(e, jab), true);
});

test("Vieja Snaphance: no cuenta para el Límite de Armas", () => {
  const armar = (segunda) => {
    const e = mesa();
    oros(e, 0, 1);
    const aliado = poner(e, 0, "defensa", "Sir Persival");
    poner(e, 0, "arma", "Hacha Danesa", { portador: aliado });
    const arma = poner(e, 0, "mano", segunda);
    return { e, aliado, arma };
  };
  const snap = armar("Vieja Snaphance");
  assert.equal(puedeJugar(snap.e, snap.arma, snap.aliado), true);
  const otra = armar("Espada Vikinga");
  assert.equal(puedeJugar(otra.e, otra.arma, otra.aliado), false);
});

test("Vieja Snaphance: el portador gana 1 de Fuerza y no puede cambiar de controlador", () => {
  const e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  assert.equal(N.puedeTomar(e, aliado, 1), true);
  poner(e, 0, "arma", "Vieja Snaphance", { portador: aliado });
  assert.equal(N.fuerza(e, aliado), 3);
  assert.equal(N.puedeTomar(e, aliado, 1), false);
});

test("Pedrenyal: el portador gana 2 de Fuerza e Indestructible", () => {
  const e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  poner(e, 0, "arma", "Pedrenyal", { portador: aliado });
  assert.equal(N.fuerza(e, aliado), 4);
  assert.ok(N.tiene(e, aliado, "Indestructible"));
});

test("Pedrenyal: el portador sobrevive a un combate que de otro modo lo destruiría", () => {
  let e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  poner(e, 0, "arma", "Pedrenyal", { portador: aliado });
  const bloqueador = poner(e, 1, "defensa", "Padre Dagón");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: aliado });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "bloquear", uid: bloqueador, atacante: aliado });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = cerrarCombate(e);
  assert.equal(zonaDe(e, aliado), "ataque");
});

test("Hacha Danesa: el portador gana 2 de Fuerza", () => {
  const e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  poner(e, 0, "arma", "Hacha Danesa", { portador: aliado });
  assert.equal(N.fuerza(e, aliado), 4);
});

test("Hacha Danesa: en tu Vigilia baraja un Aliado oponente de coste 2 o menos y robas una carta, una vez por turno", () => {
  let e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  const hacha = poner(e, 0, "arma", "Hacha Danesa", { portador: aliado });
  const jab1 = poner(e, 1, "defensa", "Jabberwocky");
  poner(e, 1, "defensa", "Guardia Real");
  assert.ok(puedeHab(e, hacha, 0));
  e = hacer(e, hab(e, hacha, "Hacha Danesa", 0), jab1);
  assert.equal(zonaDe(e, jab1), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeHab(e, hacha, 0), false);
});

test("Hacha Danesa: no se puede usar si el oponente solo controla Aliados de coste 3 o más", () => {
  const e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  const hacha = poner(e, 0, "arma", "Hacha Danesa", { portador: aliado });
  poner(e, 1, "defensa", "Sir Persival");
  assert.equal(puedeHab(e, hacha, 0), false);
});

test("Hacha Danesa: no puede perder su habilidad y tus Aliados no pueden cambiar de controlador", () => {
  const e = mesa();
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  const otro = poner(e, 0, "defensa", "Jabberwocky");
  const hacha = poner(e, 0, "arma", "Hacha Danesa", { portador: aliado });
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: hacha }, 1);
  assert.ok(N.activa(e, hacha));
  assert.equal(N.puedeTomar(e, otro, 1), false);
});

test("Isla de Poveglia: al entrar convierte la primera carta del Castillo oponente en un Aliado de Fuerza 2 sin habilidad bajo tu control", () => {
  let e = mesa();
  oros(e, 0, 1);
  const isla = poner(e, 0, "mano", "Isla de Poveglia");
  const tope = e.jugadores[1].castillo[0];
  e = hacer(e, { tipo: "jugar", uid: isla }, true, "Castillo oponente");
  assert.equal(zonaDe(e, isla), "apoyo");
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.controlador(e, tope), 0);
  assert.equal(N.carta(e, tope).tipo, "Aliado");
  assert.equal(N.fuerza(e, tope), 2);
  assert.ok(N.carta(e, tope).sinHabilidad);
});

test("Isla de Poveglia: también puede convertir la primera carta de tu propio Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const isla = poner(e, 0, "mano", "Isla de Poveglia");
  const tope = e.jugadores[0].castillo[0];
  e = hacer(e, { tipo: "jugar", uid: isla }, true, "tu Castillo");
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.carta(e, tope).tipo, "Aliado");
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Isla de Poveglia: la conversión es opcional", () => {
  let e = mesa();
  oros(e, 0, 1);
  const isla = poner(e, 0, "mano", "Isla de Poveglia");
  e = hacer(e, { tipo: "jugar", uid: isla }, false);
  assert.equal(e.jugadores[0].defensa.length, 0);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Isla de Poveglia: puede jugarse desde el Cementerio Botando tres cartas y pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const isla = poner(e, 0, "cementerio", "Isla de Poveglia");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === isla && a.desde === "cementerio"));
  e = hacer(e, { tipo: "jugar", uid: isla, desde: "cementerio" }, false);
  assert.equal(zonaDe(e, isla), "apoyo");
  assert.equal(e.jugadores[0].castillo.length, 27);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Isla de Poveglia: no puede jugarse desde el Cementerio si el Castillo no tiene más de tres cartas", () => {
  const juego = (n) => {
    const e = mesa({ castillo: n });
    oros(e, 0, 1);
    const isla = poner(e, 0, "cementerio", "Isla de Poveglia");
    return puedeJugar(e, isla);
  };
  assert.equal(juego(3), false);
  assert.equal(juego(4), true);
});

test("Isla de Poveglia: al salir del juego también puede convertir la primera carta de un Castillo", () => {
  let e = mesa();
  const isla = poner(e, 0, "apoyo", "Isla de Poveglia");
  const tope = e.jugadores[1].castillo[0];
  N.mover(e, isla, "cementerio");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  e = elegir(e, "Castillo oponente");
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.controlador(e, tope), 0);
  assert.equal(zonaDe(e, isla), "cementerio");
});

test("Fortaleza Hoshi: al entrar muestra hasta dos Tótem de coste 2 o menos de distinto nombre y los juega gratis", () => {
  let e = mesa();
  oros(e, 0, 3);
  const hoshi = poner(e, 0, "mano", "Fortaleza Hoshi");
  const [, isla1, isla2, templo] = armarCastillo(e, 0, ["Drácula", "Isla de Poveglia", "Isla de Poveglia", "Templo Gótico"]);
  e = auto(aplicar(e, { tipo: "jugar", uid: hoshi }));
  assert.equal(zonaDe(e, hoshi), "apoyo");
  assert.equal(zonaDe(e, isla1), "apoyo");
  assert.equal(zonaDe(e, templo), "apoyo");
  assert.equal(zonaDe(e, isla2), "castillo");
});

test("Fortaleza Hoshi: una vez por turno Destierra tantas cartas del tope de un Castillo como Tótem controles", () => {
  let e = mesa();
  const hoshi = poner(e, 0, "apoyo", "Fortaleza Hoshi");
  poner(e, 0, "apoyo", "Isla de Poveglia");
  assert.ok(puedeHab(e, hoshi, 0));
  e = hacer(e, hab(e, hoshi, "Fortaleza Hoshi", 0), "Castillo oponente");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 28);
  assert.equal(puedeHab(e, hoshi, 0), false);
});

test("Fortaleza Hoshi: puede desterrar del tope de tu propio Castillo", () => {
  let e = mesa();
  const hoshi = poner(e, 0, "apoyo", "Fortaleza Hoshi");
  e = hacer(e, hab(e, hoshi, "Fortaleza Hoshi", 0), "tu Castillo");
  assert.equal(e.jugadores[0].destierro.length, 1);
  assert.equal(e.jugadores[1].destierro.length, 0);
});

test("Llamada Sombría: busca un Arma de coste 1 en un Castillo y la juega sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 3);
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  const llamada = poner(e, 0, "mano", "Llamada Sombría");
  const arma = poner(e, 1, "castillo", "Espada Vikinga");
  poner(e, 1, "castillo", "Zweihander Brutal");
  e = hacer(e, { tipo: "jugar", uid: llamada }, nom(e, "Espada Vikinga"));
  assert.deepEqual(e.armas[aliado], [arma]);
  assert.equal(zonaDe(e, llamada), "cementerio");
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Llamada Sombría: no trae Armas de coste distinto de 1", () => {
  let e = mesa();
  oros(e, 0, 3);
  const aliado = poner(e, 0, "defensa", "Sir Persival");
  const llamada = poner(e, 0, "mano", "Llamada Sombría");
  poner(e, 0, "castillo", "Zweihander Brutal");
  e = hacer(e, { tipo: "jugar", uid: llamada });
  assert.equal(e.armas[aliado], undefined);
});

test("Llamada Sombría: solo se puede jugar si controlas tres o más Oros y un Aliado", () => {
  const juego = (orosN, aliado) => {
    const e = mesa();
    oros(e, 0, orosN);
    if (aliado) poner(e, 0, "defensa", "Sir Persival");
    const llamada = poner(e, 0, "mano", "Llamada Sombría");
    return puedeJugar(e, llamada);
  };
  assert.equal(juego(2, true), false);
  assert.equal(juego(3, false), false);
  assert.equal(juego(3, true), true);
});

test("Toque Helado: un Aliado pierde su habilidad y no puede atacar ni bloquear", () => {
  let e = mesa();
  oros(e, 0, 2);
  const aliado = poner(e, 0, "defensa", "Jabberwocky");
  const toque = poner(e, 0, "mano", "Toque Helado");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
  e = hacer(e, { tipo: "jugar", uid: toque }, "Un Aliado pierde su habilidad y no puede atacar ni bloquear", null);
  assert.equal(N.activa(e, aliado), false);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
});

test("Toque Helado: nombrar una carta impide al oponente jugarla hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 5);
  const toque = poner(e, 0, "mano", "Toque Helado");
  const guardia = poner(e, 1, "mano", "Guardia Real");
  const galahad = poner(e, 1, "mano", "Sir Galahad");
  e = hacer(e, { tipo: "jugar", uid: toque }, "Nombrar una carta", null, nom(e, "Guardia Real"));
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.turno, 2);
  assert.equal(puedeJugar(e, guardia), false);
  assert.equal(puedeJugar(e, galahad), true);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.turno, 3);
  assert.equal(e.efectos.some((f) => f.tipo === "noJugarNombre"), false);
});

test("Toque Helado: no se puede atacar hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const mio = poner(e, 0, "defensa", "Sir Persival");
  poner(e, 1, "defensa", "Sir Persival");
  const toque = poner(e, 0, "mano", "Toque Helado");
  e = hacer(e, { tipo: "jugar", uid: toque }, "No se puede atacar hasta tu próximo turno", null);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.turno, 2);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.turno, 3);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
  assert.equal(zonaDe(e, mio), "defensa");
});

test("Toque Helado: permite elegir hasta dos efectos", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 5);
  const toque = poner(e, 0, "mano", "Toque Helado");
  const guardia = poner(e, 1, "mano", "Guardia Real");
  poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "jugar", uid: toque });
  e = elegir(e, "Nombrar una carta");
  e = elegir(e, "No se puede atacar hasta tu próximo turno");
  e = elegir(e, nom(e, "Guardia Real"));
  assert.ok(e.efectos.some((f) => f.tipo === "noAtacar"));
  assert.ok(e.efectos.some((f) => f.tipo === "noJugarNombre"));
  assert.equal(zonaDe(e, guardia), "mano");
});

test("Llamar a la Manada: roba tres cartas del Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const llamar = poner(e, 0, "mano", "Llamar a la Manada");
  e = hacer(e, { tipo: "jugar", uid: llamar });
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 27);
  assert.equal(zonaDe(e, llamar), "cementerio");
});

test("Hija del Caos: si la primera carta es un Oro, la pone en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const hija = poner(e, 0, "mano", "Hija del Caos");
  e = hacer(e, { tipo: "jugar", uid: hija });
  assert.equal(e.jugadores[0].pagado.length, 2);
  assert.equal(e.jugadores[0].mano.length, 0);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Hija del Caos: si la primera carta es de coste 2 o menos, robas tantas cartas como su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const hija = poner(e, 0, "mano", "Hija del Caos");
  e.jugadores[0].castillo = [];
  for (let i = 0; i < 10; i++) poner(e, 0, "castillo", "Jabberwocky");
  e = hacer(e, { tipo: "jugar", uid: hija });
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 7);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Hija del Caos: si la primera carta es de coste 3 o más, el oponente Destierra tantas cartas como su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const hija = poner(e, 0, "mano", "Hija del Caos");
  e.jugadores[0].castillo = [];
  for (let i = 0; i < 10; i++) poner(e, 0, "castillo", "Sir Persival");
  e = hacer(e, { tipo: "jugar", uid: hija });
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 9);
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Gusano Vampiro: destierra dos cartas del tope del Castillo oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const gusano = poner(e, 0, "mano", "Gusano Vampiro");
  const [a, b, c] = armarCastillo(e, 1, ["Jabberwocky", "Valefor", "Guardia Real"]);
  e = hacer(e, { tipo: "jugar", uid: gusano }, "Desterrar dos del tope");
  assert.deepEqual(e.jugadores[1].destierro, [a, b]);
  assert.equal(zonaDe(e, c), "castillo");
});

test("Gusano Vampiro: destierra dos cartas del fondo del Castillo oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const gusano = poner(e, 0, "mano", "Gusano Vampiro");
  const a = poner(e, 1, "castillo", "Jabberwocky");
  const b = poner(e, 1, "castillo", "Valefor");
  e = hacer(e, { tipo: "jugar", uid: gusano }, "Desterrar dos del fondo");
  assert.deepEqual(e.jugadores[1].destierro, [a, b]);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Gusano Vampiro: en el Cementerio, los Aliados de coste 1 o menos con Furia pierden 1 de Fuerza", () => {
  const e = mesa();
  const peter = poner(e, 0, "defensa", "Sir Peter Hawkins");
  const patrulla = poner(e, 0, "defensa", "Patrulla Nocturna");
  const persival = poner(e, 1, "defensa", "Sir Persival");
  const antes = [N.fuerza(e, peter), N.fuerza(e, patrulla), N.fuerza(e, persival)];
  poner(e, 0, "cementerio", "Gusano Vampiro");
  assert.equal(N.fuerza(e, peter), antes[0] - 1);
  assert.equal(N.fuerza(e, patrulla), antes[1]);
  assert.equal(N.fuerza(e, persival), antes[2]);
});

test("Aaru: baraja cartas de tu mano en el Castillo y roba esa cantidad más dos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const aaru = poner(e, 0, "mano", "Aaru");
  const x = poner(e, 0, "mano", "Jabberwocky");
  const y = poner(e, 0, "mano", "Valefor");
  e = hacer(e, { tipo: "jugar", uid: aaru }, x, y);
  assert.equal(e.jugadores[0].mano.length, 4);
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.equal(zonaDe(e, aaru), "cementerio");
});

test("Aaru: sin barajar cartas, roba dos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const aaru = poner(e, 0, "mano", "Aaru");
  poner(e, 0, "mano", "Jabberwocky");
  e = hacer(e, { tipo: "jugar", uid: aaru }, null);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Aaru: cuesta un Oro menos por cada Oro que controles", () => {
  const juego = (orosN) => {
    const e = mesa();
    oros(e, 0, orosN);
    const aaru = poner(e, 0, "mano", "Aaru");
    return puedeJugar(e, aaru);
  };
  assert.equal(juego(1), false);
  assert.equal(juego(2), true);
  const e = mesa();
  oros(e, 0, 3);
  const aaru = poner(e, 0, "mano", "Aaru");
  const r = hacer(e, { tipo: "jugar", uid: aaru });
  assert.equal(r.jugadores[0].pagado.length, 0);
});

test("Aaru: solo puedes jugar un Aaru por turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const a1 = poner(e, 0, "mano", "Aaru");
  const a2 = poner(e, 0, "mano", "Aaru");
  assert.ok(puedeJugar(e, a1));
  e = hacer(e, { tipo: "jugar", uid: a1 }, null);
  assert.equal(puedeJugar(e, a2), false);
});

test("Biblioteca de Caballeria: en la Fase Final oponente, sin Aliados, robas y pones la primera carta de un Castillo como Aliado de Fuerza 2 sin habilidad", () => {
  let e = mesa();
  poner(e, 1, "reserva", "Biblioteca de Caballeria");
  const tope = e.jugadores[0].castillo[0];
  e = hacer(e, { tipo: "terminar" }, "Castillo oponente");
  assert.equal(e.jugadores[1].mano.length, 1);
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.controlador(e, tope), 1);
  assert.equal(N.carta(e, tope).tipo, "Aliado");
  assert.equal(N.fuerza(e, tope), 2);
  assert.ok(N.carta(e, tope).sinHabilidad);
});

test("Biblioteca de Caballeria: también puede usar la primera carta de tu propio Castillo", () => {
  let e = mesa();
  poner(e, 1, "reserva", "Biblioteca de Caballeria");
  const tope = e.jugadores[1].castillo[1];
  e = hacer(e, { tipo: "terminar" }, "tu Castillo");
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.controlador(e, tope), 1);
});

test("Biblioteca de Caballeria: no hace nada si controlas Aliados", () => {
  let e = mesa();
  poner(e, 1, "reserva", "Biblioteca de Caballeria");
  poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].mano.length, 0);
  assert.equal(e.jugadores[1].defensa.length, 1);
});

test("Biblioteca de Caballeria: no se activa en tu propia Fase Final", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Biblioteca de Caballeria");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].defensa.length, 0);
});

test("Tyet: al entrar busca un Arma o un Oro en tu Castillo y lo pone en tu mano", () => {
  let e = mesa();
  const tyet = poner(e, 0, "mano", "Tyet");
  const arma = poner(e, 0, "castillo", "Espada Vikinga");
  poner(e, 0, "castillo", "Sir Persival");
  e = aplicar(e, { tipo: "oro", uid: tyet });
  assert.deepEqual(nombresOpc(e).filter((n) => n !== null).sort(), ["Drácula", "Espada Vikinga"]);
  e = elegir(e, nom(e, "Espada Vikinga"));
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(zonaDe(e, tyet), "reserva");
});

test("Tyet: puede pagarse para que un Oro pierda su habilidad este turno y moverlo al Oro Pagado", () => {
  let e = mesa();
  const tyet = poner(e, 0, "reserva", "Tyet");
  const was = poner(e, 1, "reserva", "Was");
  assert.ok(puedeHab(e, tyet, 0));
  e = hacer(e, hab(e, tyet, "Tyet", 0));
  assert.equal(zonaDe(e, tyet), "pagado");
  assert.equal(zonaDe(e, was), "pagado");
  assert.equal(N.activa(e, was), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad"), false);
});

test("Tyet: la habilidad de Oro Pagado solo se puede usar estando en la Reserva", () => {
  const e = mesa();
  const tyet = poner(e, 0, "pagado", "Tyet");
  poner(e, 1, "reserva", "Was");
  assert.equal(puedeHab(e, tyet, 0), false);
});

test("Tyet: desde la mano, pone esta y otra carta en el fondo del Castillo y roba dos, una vez por turno", () => {
  let e = mesa();
  const tyet = poner(e, 0, "mano", "Tyet");
  const tyet2 = poner(e, 0, "mano", "Tyet");
  const otra = poner(e, 0, "mano", "Jabberwocky");
  assert.ok(puedeHab(e, tyet, 1));
  e = hacer(e, hab(e, tyet, "Tyet", 1), otra);
  const c = e.jugadores[0].castillo;
  assert.deepEqual(c.slice(-2), [tyet, otra]);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(zonaDe(e, tyet2), "mano");
  assert.equal(puedeHab(e, tyet2, 1), false);
});

test("Relicario de San Pancracio: al entrar mira cuatro cartas, pone una en la mano y otra en el Cementerio", () => {
  let e = mesa();
  const rel = poner(e, 0, "mano", "Relicario de San Pancracio");
  const [a, b, c, d] = armarCastillo(e, 0, ["Jabberwocky", "Valefor", "Guardia Real", "Sir Persival"]);
  e = hacer(e, { tipo: "oro", uid: rel }, b, c, "Cementerio");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, d), "castillo");
});

test("Relicario de San Pancracio: la segunda carta puede ir al Destierro", () => {
  let e = mesa();
  const rel = poner(e, 0, "mano", "Relicario de San Pancracio");
  const [a, b, c] = armarCastillo(e, 0, ["Jabberwocky", "Valefor", "Guardia Real", "Sir Persival"]);
  e = hacer(e, { tipo: "oro", uid: rel }, a, c, "Destierro");
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(zonaDe(e, b), "castillo");
});

test("Relicario de San Pancracio: al comienzo de la Vigilia oponente mira tres cartas del fondo de un Castillo y Destierra una", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Relicario de San Pancracio");
  const f1 = poner(e, 1, "castillo", "Jabberwocky");
  const f2 = poner(e, 1, "castillo", "Valefor");
  const f3 = poner(e, 1, "castillo", "Guardia Real");
  e = hacer(e, { tipo: "terminar" }, true, "Castillo oponente", f2);
  assert.equal(e.turno, 2);
  assert.equal(zonaDe(e, f2), "destierro");
  assert.equal(zonaDe(e, f1), "castillo");
  assert.equal(zonaDe(e, f3), "castillo");
});

test("Nocturlabio de Liull: al entrar muestra un Oro, un Aliado y un Tótem y pone una carta en la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const noc = poner(e, 0, "mano", "Nocturlabio de Liull");
  const [oro, aliado, totem] = armarCastillo(e, 0, ["Drácula", "Sir Persival", "Isla de Poveglia"]);
  e = hacer(e, { tipo: "oro", uid: noc }, "Una a la mano", aliado);
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(zonaDe(e, oro), "castillo");
  assert.equal(zonaDe(e, totem), "castillo");
});

test("Nocturlabio de Liull: pagando un Oro pone las tres cartas en la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const noc = poner(e, 0, "mano", "Nocturlabio de Liull");
  const tres = armarCastillo(e, 0, ["Drácula", "Sir Persival", "Isla de Poveglia"]).slice(0, 3);
  e = hacer(e, { tipo: "oro", uid: noc }, "Pagar un Oro: las tres a la mano");
  for (const u of tres) assert.equal(zonaDe(e, u), "mano");
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Nocturlabio de Liull: con solo él en la Reserva, puede pagarse a sí mismo para llevarse las tres cartas", () => {
  let e = mesa();
  const noc = poner(e, 0, "mano", "Nocturlabio de Liull");
  armarCastillo(e, 0, ["Drácula", "Sir Persival", "Isla de Poveglia"]);
  e = aplicar(e, { tipo: "oro", uid: noc });
  assert.deepEqual(textos(e), ["Una a la mano", "Pagar un Oro: las tres a la mano"]);
});

test("Onsen: al entrar busca en tu Castillo una carta que no sea Aliado ni Talismán", () => {
  let e = mesa();
  const onsen = poner(e, 0, "mano", "Onsen");
  const arma = poner(e, 0, "castillo", "Espada Vikinga");
  poner(e, 0, "castillo", "Sir Persival");
  poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, { tipo: "oro", uid: onsen });
  assert.deepEqual(nombresOpc(e).filter((n) => n !== null).sort(), ["Drácula", "Espada Vikinga"]);
  e = elegir(e, nom(e, "Espada Vikinga"));
  assert.equal(zonaDe(e, arma), "mano");
});

test("Onsen: puede Destruirse para Desterrar hasta cinco cartas de los Cementerios", () => {
  let e = mesa();
  const onsen = poner(e, 0, "reserva", "Onsen");
  const a = poner(e, 0, "cementerio", "Jabberwocky");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Guardia Real");
  assert.ok(puedeHab(e, onsen, 1) || puedeHab(e, onsen, 0));
  e = hacer(e, hab(e, onsen, "Onsen", 0), a, b, null, "Desterrar");
  assert.equal(zonaDe(e, onsen), "cementerio");
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Onsen: puede Barajar las cartas de los Cementerios en el Castillo de su dueño", () => {
  let e = mesa();
  const onsen = poner(e, 0, "reserva", "Onsen");
  const a = poner(e, 0, "cementerio", "Jabberwocky");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, hab(e, onsen, "Onsen", 0), a, b, null, "Barajar");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(N.ubicar(e, b).j, 1);
});

test("Was: al entrar muestra cartas hasta mostrar dos que no sean Talismán y las pone en la mano", () => {
  let e = mesa();
  const was = poner(e, 0, "mano", "Was");
  const [t1, aliado, t2, oro] = armarCastillo(e, 0, ["Llamar a la Manada", "Sir Persival", "Guillatún", "Drácula"]);
  e = hacer(e, { tipo: "oro", uid: was });
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(zonaDe(e, oro), "mano");
  assert.equal(zonaDe(e, t1), "castillo");
  assert.equal(zonaDe(e, t2), "castillo");
});

test("Was: en tu Fase Final, con tres o más Aliados, puedes Desterrar dos cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Was");
  for (let i = 0; i < 3; i++) poner(e, 0, "defensa", "Sir Persival");
  const a = poner(e, 0, "cementerio", "Jabberwocky");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, { tipo: "terminar" }, true);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
});

test("Was: con menos de tres Aliados no destierra nada en la Fase Final", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Was");
  for (let i = 0; i < 2; i++) poner(e, 0, "defensa", "Sir Persival");
  const a = poner(e, 0, "cementerio", "Jabberwocky");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, b), "cementerio");
});
