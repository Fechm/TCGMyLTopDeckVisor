import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { disponibles, resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const legal = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const usable = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const luego = (e, ...preds) => preds.reduce((x, p) => elegir(x, p), e);
const textos = (e) => e.pendiente.opciones.map((o) => o.texto);

test("Pegana: no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  poner(e, 1, "mano", "Ciempiés-SP");
  const p = poner(e, 0, "mano", "Pegana");
  e = aplicar(e, jugar(p));
  assert.equal(zonaDe(e, p), "apoyo");
});

test("Pegana: no se pueden jugar cartas con el nombre de una carta del propio Cementerio, excepto Aliados", () => {
  let e = mesa();
  oros(e, 0, 4);
  const p = poner(e, 0, "mano", "Pegana");
  poner(e, 0, "cementerio", "Llamar a la Manada");
  poner(e, 0, "cementerio", "Valefor");
  const manada = poner(e, 0, "mano", "Llamar a la Manada");
  const valefor = poner(e, 0, "mano", "Valefor");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  poner(e, 1, "cementerio", "Regresa Lucy");
  assert.ok(legal(e, manada));
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(legal(e, manada), false);
  assert.ok(legal(e, valefor));
  assert.ok(legal(e, lucy));
});

test("Pegana: una carta que llega después al Cementerio también queda restringida", () => {
  let e = mesa();
  oros(e, 0, 5);
  const p = poner(e, 0, "mano", "Pegana");
  const m1 = poner(e, 0, "mano", "Llamar a la Manada");
  const m2 = poner(e, 0, "mano", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(p)));
  e = sinRespuesta(aplicar(e, jugar(m1)));
  assert.equal(zonaDe(e, m1), "cementerio");
  assert.equal(legal(e, m2), false);
});

test("Pegana: se puede jugar al comienzo de cualquier Fase con coste reducido en el turno oponente", { todo: "momento: jugar un Tótem al comienzo de cualquier Fase (con reducción de coste en el turno oponente)" }, () => {
  assert.fail();
});

test("Piedra de la Iglesia: tiene Indestructible", () => {
  const e = mesa();
  const p = poner(e, 0, "apoyo", "Piedra de la Iglesia");
  assert.equal(N.tiene(e, p, "Indestructible"), true);
});

test("Piedra de la Iglesia: al comienzo de cada Vigilia mira tres cartas de un Castillo y pone una en el Cementerio", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Piedra de la Iglesia");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, "Castillo oponente");
  assert.equal(e.pendiente.opciones.length, 3);
  e = aplicar(e, { tipo: "elegir", i: 0 });
  assert.equal(e.jugadores[1].cementerio.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Piedra de la Iglesia: una vez por turno Destruye una carta que controles para Robar una carta", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "Piedra de la Iglesia");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(p, "Piedra de la Iglesia"));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, p), "apoyo");
  assert.equal(e.jugadores[0].mano.length, 1);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(usable(e, p), false);
});

test("Pirámide de Guiza: al entrar elige una Raza y tus Aliados de esa Raza ganan 2 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 3);
  const p = poner(e, 0, "mano", "Pirámide de Guiza");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Guardia Real");
  const r = poner(e, 1, "defensa", "Valefor");
  e = luego(sinRespuesta(aplicar(e, jugar(p))), "Dragón");
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.fuerza(e, r), 3);
});

test("Pirámide de Guiza: sólo puedes controlar una copia", () => {
  const e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "apoyo", "Pirámide de Guiza");
  const otra = poner(e, 0, "mano", "Pirámide de Guiza");
  assert.equal(legal(e, otra), false);
});

test("Pirámide de Guiza: al ser Destruida Destruye todos los Aliados que no sean de la Raza elegida", () => {
  let e = mesa();
  oros(e, 0, 3);
  const p = poner(e, 0, "mano", "Pirámide de Guiza");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Guardia Real");
  const rv = poner(e, 1, "defensa", "Valefor");
  const rg = poner(e, 1, "defensa", "Guardia Real");
  e = luego(sinRespuesta(aplicar(e, jugar(p))), "Dragón");
  N.mover(e, p, "cementerio");
  resolver(e);
  assert.deepEqual([v, g, rv, rg].map((u) => zonaDe(e, u)), ["defensa", "cementerio", "defensa", "cementerio"]);
});

test("Pirámide de Guiza: si es Barajada no Destruye Aliados", () => {
  let e = mesa();
  oros(e, 0, 3);
  const p = poner(e, 0, "mano", "Pirámide de Guiza");
  const g = poner(e, 1, "defensa", "Guardia Real");
  e = luego(sinRespuesta(aplicar(e, jugar(p))), "Dragón");
  N.mover(e, p, "castillo");
  resolver(e);
  assert.equal(zonaDe(e, g), "defensa");
});

test("Planta de la Juventud: en tu Vigilia, una vez por turno, juega un Tótem de tu Cementerio pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const p = poner(e, 0, "apoyo", "Planta de la Juventud");
  const s = poner(e, 0, "cementerio", "Sarras");
  e = aplicar(e, habilidad(p, "Planta de la Juventud"));
  assert.equal(zonaDe(e, s), "apoyo");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(usable(e, p), false);
});

test("Planta de la Juventud: no se puede usar sin Oros para pagar el Tótem", () => {
  const e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 0, "apoyo", "Planta de la Juventud");
  poner(e, 0, "cementerio", "Sarras");
  assert.equal(usable(e, p), false);
});

test("Plaza de Armas: no puede ser Anulada", () => {
  const e = mesa();
  const p = poner(e, 0, "apoyo", "Plaza de Armas");
  assert.ok(N.carta(e, p).claves.includes("NoAnulable"));
});

test("Plaza de Armas: muestra hasta un Arma, la pone en tu mano y genera un Oro para Armas", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "Plaza de Armas");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  e = aplicar(e, habilidad(p, "Plaza de Armas"));
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(disponibles(e, 0, "Arma"), 1);
  assert.equal(disponibles(e, 0, "Talismán"), 0);
  assert.equal(usable(e, p), false);
});

test("Plaza de Armas: el Oro generado solo sirve para Armas de coste 2 o más", { todo: "generar: Oro generado restringido a cartas de coste mínimo" }, () => {
  assert.fail();
});

test("Plaza de Armas: si controlas Aliados de coste 1 o más, jugar Talismanes en Vigilia cuesta un Oro adicional", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Plaza de Armas");
  const manada = poner(e, 0, "mano", "Llamar a la Manada");
  assert.equal(costeDe(e, 0, manada).pagar, 1);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, manada).pagar, 2);
  e.fase = "talismanes";
  assert.equal(costeDe(e, 0, manada).pagar, 1);
});

test("Plaza de Armas - Sp: nombra Talismán; los Talismanes cuestan un Oro más y tus Aliados ganan 1 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 2);
  const p = poner(e, 0, "mano", "Plaza de Armas - Sp");
  const v = poner(e, 0, "defensa", "Valefor");
  const manada = poner(e, 1, "mano", "Llamar a la Manada");
  e = luego(sinRespuesta(aplicar(e, jugar(p))), "Talismán");
  assert.equal(costeDe(e, 1, manada).pagar, 2);
  assert.equal(N.fuerza(e, v), 4);
  assert.ok(N.carta(e, p).claves.includes("NoAnulable"));
});

test("Plaza de Armas - Sp: no puedes controlar más copias", () => {
  const e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "apoyo", "Plaza de Armas - Sp");
  const otra = poner(e, 0, "mano", "Plaza de Armas - Sp");
  assert.equal(legal(e, otra), false);
});

test("Plaza de Armas - Sp: nombrar Arma o Tótem encarece las cartas de ese tipo", { todo: "efecto: jugar cartas de un tipo nombrado (no Talismán) cuesta un Oro adicional" }, () => {
  assert.fail();
});

test("Pnyx: al entrar Baraja una carta de coste 2 o menos y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const p = poner(e, 0, "mano", "Pnyx");
  const r = poner(e, 1, "defensa", "Valefor");
  e = luego(sinRespuesta(aplicar(e, jugar(p))), r);
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Pnyx: tiene Exhumar", () => {
  const e = mesa();
  oros(e, 0, 2);
  const p = poner(e, 0, "cementerio", "Pnyx");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === p && a.desde === "cementerio"));
});

test("Pnyx: una carta en juego y una de un Cementerio pierden su habilidad hasta tu próximo turno", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "Pnyx");
  const patrulla = poner(e, 1, "defensa", "Patrulla Nocturna");
  const v = poner(e, 1, "defensa", "Valefor");
  const vision = poner(e, 1, "cementerio", "Vision Heroica");
  assert.equal(N.fuerza(e, v), 4);
  e = hacer(e, habilidad(p, "Pnyx"), patrulla, vision);
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.activa(e, vision), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.activa(e, vision), false);
  e.activo = 0;
  e.turno += 1;
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.activa(e, vision), true);
});

test("Puerta del Firmamento: en tu Vigilia busca un Tótem en tu Castillo", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "Puerta del Firmamento");
  const s = poner(e, 0, "castillo", "Sarras");
  e = hacer(e, habilidad(p, "Puerta del Firmamento"), "Buscar un Tótem", s);
  assert.equal(zonaDe(e, s), "mano");
});

test("Puerta del Firmamento: o genera un Oro para Tótems", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "Puerta del Firmamento");
  e = hacer(e, habilidad(p, "Puerta del Firmamento"), "Generar un Oro para Tótems");
  assert.equal(disponibles(e, 0, "Tótem"), 1);
  assert.equal(disponibles(e, 0, "Aliado"), 0);
  assert.equal(usable(e, p), true);
});

test("Puerta del Firmamento: el Oro generado solo sirve para Tótems de coste 2 o más", { todo: "generar: Oro generado restringido a cartas de coste mínimo" }, () => {
  assert.fail();
});

test("Puerta del Firmamento: convierte un Tótem en un Aliado de Fuerza igual a su coste con Furia por el turno", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "Puerta del Firmamento");
  const reni = poner(e, 0, "apoyo", "Reni");
  e = hacer(e, habilidad(p, "Puerta del Firmamento", 1), reni);
  assert.equal(zonaDe(e, reni), "defensa");
  assert.equal(N.carta(e, reni).tipo, "Aliado");
  assert.equal(N.fuerza(e, reni), 2);
  assert.equal(N.tiene(e, reni, "Furia"), true);
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === reni));
  e = aplicar(e, { tipo: "finAtaque" });
  assert.equal(e.activo, 1);
  assert.equal(zonaDe(e, reni), "apoyo");
  assert.equal(N.carta(e, reni).tipo, "Tótem");
});

test("Quicaví: tiene Exhumar y al entrar genera un Oro por el turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const q = poner(e, 0, "cementerio", "Quicaví");
  e = sinRespuesta(aplicar(e, jugar(q, { desde: "cementerio" })));
  assert.equal(zonaDe(e, q), "apoyo");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(disponibles(e, 0), 1);
});

test("Quicaví: hasta tu próximo turno una carta de tu Cementerio gana Exhumar y no recibes daño de combate", () => {
  let e = mesa();
  const q = poner(e, 0, "apoyo", "Quicaví");
  const lucy = poner(e, 0, "cementerio", "Regresa Lucy");
  e = aplicar(e, habilidad(q, "Quicaví"));
  assert.equal(N.tiene(e, lucy, "Exhumar"), true);
  assert.ok(e.efectos.some((f) => f.tipo === "prevenirDano" && f.j === 0));
  e = aplicar(e, { tipo: "terminar" });
  const atacante = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(N.tiene(e, lucy, "Exhumar"), true);
});

test("Quicaví: su habilidad al entrar no puede ser cancelada", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {
  assert.fail();
});

test("Reino de Midgard: al entrar puedes Robar dos cartas y Descartar una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const r = poner(e, 0, "mano", "Reino de Midgard");
  e = luego(sinRespuesta(aplicar(e, jugar(r))), true);
  e = aplicar(e, { tipo: "elegir", i: 0 });
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 1);
});

test("Reino de Midgard: en tu Fase Final Destierra hasta dos cartas de cualquier Cementerio", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Reino de Midgard");
  const c = [0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, { tipo: "terminar" }, c[0], c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
});

test("Reino de Midgard: en la Fase Final oponente tu oponente Bota una carta", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Reino de Midgard");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Reni: al entrar puedes subir hasta dos Aliados de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const r = poner(e, 0, "mano", "Reni");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Guardia Real");
  const c = poner(e, 0, "cementerio", "Sir Galahad");
  e = luego(sinRespuesta(aplicar(e, jugar(r))), true, a, b);
  assert.deepEqual([a, b, c].map((u) => zonaDe(e, u)), ["mano", "mano", "cementerio"]);
});

test("Reni: tus Aliados ganan uno de Fuerza por cada Aliado de coste distinto que controles", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Reni");
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 4);
  poner(e, 0, "defensa", "Guardia Real");
  assert.equal(N.fuerza(e, v), 5);
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, r), 3);
});

test("Santuario de la Fuerza: tus Aliados pueden atacar el turno que entran y ganan 1 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "apoyo", "Santuario de la Fuerza");
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(N.fuerza(e, v), 4);
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === v));
});

test("Santuario de la Fuerza: cuando un Aliado o Arma que juegas va al Cementerio por ser Anulado, puedes subirlo a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  poner(e, 0, "apoyo", "Santuario de la Fuerza");
  const v = poner(e, 0, "mano", "Valefor");
  const c = poner(e, 1, "mano", "Ciempiés-SP");
  e = aplicar(e, jugar(v));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: c }));
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, true);
  assert.equal(zonaDe(e, v), "mano");
});

test("Santuario de la Fuerza: reduce en un Oro el coste de tus Aliados de coste 3 o más", { todo: "continua: reduce en un Oro el coste de tus Aliados de coste N o más" }, () => {
  assert.fail();
});

test("Sarras: en tu Vigilia busca un Talismán de coste 3 o más en tu Castillo", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Sarras");
  const aaru = poner(e, 0, "castillo", "Aaru");
  const manada = poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, habilidad(s, "Sarras"));
  assert.ok(!e.pendiente.opciones.some((o) => o.valor === manada));
  e = elegir(e, aaru);
  assert.equal(zonaDe(e, aaru), "mano");
  assert.equal(zonaDe(e, manada), "castillo");
});

test("Stonehenge: en tu Vigilia Bota dos cartas para subir una carta que no sea Talismán de tu Cementerio", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Stonehenge");
  const v = poner(e, 0, "cementerio", "Valefor");
  const m = poner(e, 0, "cementerio", "Llamar a la Manada");
  e = aplicar(e, habilidad(s, "Stonehenge"));
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.ok(!e.pendiente.opciones.some((o) => o.valor === m));
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(usable(e, s), false);
});

test("Stonehenge: no puedes controlar más copias", () => {
  const e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "apoyo", "Stonehenge");
  const otra = poner(e, 0, "mano", "Stonehenge");
  assert.equal(legal(e, otra), false);
});

test("Stonehenge: Descartar una carta de tu mano reduce su coste en un Oro", { todo: "coste alternativo: Descartar cartas al jugarla para reducir su coste" }, () => {
  assert.fail();
});

test("Templo de Hatshepsut: al entrar Baraja o Destierra una carta oponente de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Templo de Hatshepsut");
  const r = poner(e, 1, "defensa", "Valefor");
  const j = poner(e, 1, "defensa", "Jaques de Molay");
  e = luego(sinRespuesta(aplicar(e, jugar(t))), "Desterrar");
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(zonaDe(e, j), "defensa");
  assert.ok(N.carta(e, t).claves.includes("Exhumar"));
});

test("Templo de Hatshepsut: en tu Vigilia, una vez por turno, Destierra o Baraja hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Templo de Hatshepsut");
  const c = [0, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(t, "Templo de Hatshepsut"), c[0], c[1], c[2], "Desterrar");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro", "cementerio"]);
  assert.equal(usable(e, t), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
});

test("Templo de Hatshepsut: si no la usaste en la Vigilia, puedes usarla al comienzo de tu Fase Final", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Templo de Hatshepsut");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, { tipo: "terminar" }, true, c, "Barajar");
  assert.equal(zonaDe(e, c), "castillo");
});

test("Templo de los Eternos: una vez por turno Baraja hasta un Aliado o Tótem y hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Templo de los Eternos");
  const r = poner(e, 1, "defensa", "Valefor");
  const c = [0, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(t, "Templo de los Eternos"), r, c[0], c[1], c[2]);
  assert.deepEqual([r, ...c].map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "castillo", "cementerio"]);
  assert.equal(usable(e, t), false);
});

test("Templo de los Eternos: puede entrar sin habilidad por el turno para reducir su coste en un Oro", { todo: "coste alternativo: entrar en juego sin habilidad por el turno para reducir el coste" }, () => {
  assert.fail();
});

test("Templo de los Eternos: al oponente le cuesta un Oro adicional Desterrar tus demás cartas en juego", { todo: "efecto: afectar a ciertas cartas cuesta un Oro adicional al oponente" }, () => {
  assert.fail();
});

test("Torre de Babel: al entrar cartas cuyos costes sumen 4 o menos pierden su habilidad y son Barajadas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const t = poner(e, 0, "mano", "Torre de Babel");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const j = poner(e, 1, "defensa", "Jaques de Molay");
  e = sinRespuesta(aplicar(e, jugar(t)));
  assert.ok(e.pendiente.opciones.some((o) => o.valor === j));
  e = hacer(e, { tipo: "elegir", i: e.pendiente.opciones.findIndex((o) => o.valor === v) }, g);
  assert.ok(!e.pendiente.opciones.some((o) => o.valor === j));
  e = elegir(e, null);
  assert.deepEqual([v, g, j].map((u) => zonaDe(e, u)), ["castillo", "castillo", "defensa"]);
});

test("Torre de Babel: Baraja una carta de tu mano para Barajar o Desterrar hasta cinco cartas de los Cementerios y Robar dos", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Torre de Babel");
  const m = poner(e, 0, "mano", "Valefor");
  const c = [1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(t, "Torre de Babel"), c[0], c[1], "Desterrar");
  assert.equal(zonaDe(e, m), "castillo");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro"]);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(usable(e, t), false);
});

test("Transilvania: al entrar puedes pagar un Oro para convertir una carta de coste 4 o menos en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 3);
  const t = poner(e, 0, "mano", "Transilvania");
  const j = poner(e, 1, "defensa", "Jaques de Molay");
  e = luego(sinRespuesta(aplicar(e, jugar(t))), true, j);
  assert.equal(zonaDe(e, j), "pagado");
  assert.equal(N.controlador(e, j), 0);
  assert.equal(N.carta(e, j).tipo, "Oro");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Transilvania: al salir del juego también puede convertir una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "apoyo", "Transilvania");
  const v = poner(e, 1, "defensa", "Valefor");
  N.mover(e, t, "cementerio");
  resolver(e);
  e = hacer(e, { tipo: "elegir", i: 0 }, v);
  assert.equal(zonaDe(e, v), "pagado");
});

test("Transilvania: en tu Fase Final agrupa y Roba una carta", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Transilvania");
  const o = poner(e, 0, "pagado", "Drácula");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Transilvania: las habilidades de tus demás cartas de coste 2 o más no pueden ser canceladas", { todo: "protección: las habilidades de tus demás cartas de cierto coste no pueden ser canceladas" }, () => {
  assert.fail();
});

test("Tumba de la Esperanza: una vez por turno Destruye una carta de coste 0", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Tumba de la Esperanza");
  const [o] = oros(e, 1, 1);
  e = aplicar(e, habilidad(t, "Tumba de la Esperanza"));
  assert.equal(zonaDe(e, o), "cementerio");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === t && a.h === 0));
});

test("Tumba de la Esperanza: Anular una carta de coste 0", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {
  assert.fail();
});

test("Tumba de la Esperanza: una vez por turno Descarta una carta para Robar dos", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Tumba de la Esperanza");
  const m = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(t, "Tumba de la Esperanza", 1));
  assert.equal(zonaDe(e, m), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.h === 1));
});

test("Tumba de la Esperanza: en tu Fase Final puedes Desterrar una carta de tu mano para agrupar un Oro", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Tumba de la Esperanza");
  const m = poner(e, 0, "mano", "Valefor");
  const o = poner(e, 0, "pagado", "Drácula");
  e = hacer(e, { tipo: "terminar" }, true);
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(zonaDe(e, o), "reserva");
});

test("Tunel de Madriguera: sólo puedes jugarlo si controlas dos o más Aliados y/o Tótem", () => {
  const e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Tunel de Madriguera");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(legal(e, t), false);
  poner(e, 0, "apoyo", "Sarras");
  assert.equal(legal(e, t), true);
});

test("Tunel de Madriguera: en tu Vigilia busca un Arma o Tótem en tu Castillo", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Tunel de Madriguera");
  const a = poner(e, 0, "castillo", "Pedrenyal");
  e = hacer(e, habilidad(t, "Tunel de Madriguera"), a);
  assert.equal(zonaDe(e, a), "mano");
});

test("Tunel de Madriguera: en tu Fase Final puedes Robar una carta o hacer que tu oponente Bote tres", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Tunel de Madriguera");
  e = hacer(e, { tipo: "terminar" }, true, "El oponente Bota tres cartas");
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Tótem de la Visión Eterna: Baraja cartas en juego de coste total 4 o menos y Roba dos; no se repite en tu próximo turno", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Tótem de la Visión Eterna");
  const v = poner(e, 1, "defensa", "Valefor");
  const j = poner(e, 1, "defensa", "Jaques de Molay");
  e = hacer(e, habilidad(t, "Tótem de la Visión Eterna"), "Barajar cartas en juego de coste total 4 o menos y robar dos", v);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, j), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(usable(e, t), false);
  e.turno += 2;
  e = aplicar(e, habilidad(t, "Tótem de la Visión Eterna"));
  assert.deepEqual(textos(e), ["Buscar una carta en tu Castillo y el oponente Descarta una carta"]);
  e = mesa();
  const t2 = poner(e, 0, "apoyo", "Tótem de la Visión Eterna");
  e.usos[`vision|${t2}|0`] = e.turno;
  e.turno += 4;
  e = aplicar(e, habilidad(t2, "Tótem de la Visión Eterna"));
  assert.equal(e.pendiente.opciones.length, 2);
});

test("Tótem de la Visión Eterna: Busca una carta en tu Castillo y tu oponente Descarta una carta", () => {
  let e = mesa();
  const t = poner(e, 0, "apoyo", "Tótem de la Visión Eterna");
  const r = [0, 1].map(() => poner(e, 1, "mano", "Valefor"));
  e = hacer(e, habilidad(t, "Tótem de la Visión Eterna"), "Buscar una carta en tu Castillo y el oponente Descarta una carta", nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, r[0]);
  assert.equal(zonaDe(e, r[0]), "cementerio");
});

test("Tótem del Dragón Ancestral: al entrar Baraja o Destierra hasta tres cartas de los Cementerios y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Tótem del Dragón Ancestral");
  const c = [0, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = luego(sinRespuesta(aplicar(e, jugar(t))), c[0], c[1], "Desterrar", "Robar dos cartas");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro"]);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.ok(N.carta(e, t).claves.includes("Exhumar"));
});

test("Tótem del Dragón Ancestral: o Destruye una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Tótem del Dragón Ancestral");
  const v = poner(e, 1, "defensa", "Valefor");
  e = luego(sinRespuesta(aplicar(e, jugar(t))), "Barajar", "Destruir una carta de coste 2 o menos", v);
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Tótem del Dragón Ancestral: en tu turno Barajarlo para Anular un Aliado o cancelar una habilidad", { todo: "respuesta: Anular con una habilidad activada de una carta en juego; efecto: cancelar una habilidad" }, () => {
  assert.fail();
});

test("Túneles Secretos: al entrar juega una carta de tu mano reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const t = poner(e, 0, "mano", "Túneles Secretos");
  const g = poner(e, 0, "mano", "Guardia Real");
  e = sinRespuesta(aplicar(e, jugar(t)));
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Túneles Secretos: puede jugar un Talismán de tu Cementerio con coste reducido", () => {
  let e = mesa();
  oros(e, 0, 2);
  const t = poner(e, 0, "mano", "Túneles Secretos");
  const m = poner(e, 0, "cementerio", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(t)));
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(zonaDe(e, m), "cementerio");
});

test("Túneles Secretos: una vez por turno, cuando uno de tus Aliados salga del juego, puedes subirlo a tu mano", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Túneles Secretos");
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Valefor");
  N.mover(e, a, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, a), "mano");
  N.mover(e, b, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, b), "cementerio");
});

test("Túneles Secretos: en tu Fase Final Baraja o Destierra hasta cinco cartas de los Cementerios y Roba una carta", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Túneles Secretos");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, { tipo: "terminar" }, c, "Desterrar");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Vinland: una vez por turno sube un Tótem de tu Cementerio a tu mano y Descarta una carta", () => {
  let e = mesa();
  const v = poner(e, 0, "apoyo", "Vinland");
  const s = poner(e, 0, "cementerio", "Sarras");
  const d = poner(e, 0, "mano", "Valefor");
  e = hacer(e, habilidad(v, "Vinland"), d);
  assert.equal(zonaDe(e, s), "mano");
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(usable(e, v), false);
});

test("Vinland: los Aliados oponentes pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Vinland");
  const r = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, r), 2);
  assert.equal(N.fuerza(e, m), 3);
});

test("Virreinato del Peru: al entrar Robas dos cartas y tu oponente Bota cuatro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "mano", "Virreinato del Peru");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[1].cementerio.length, 4);
  assert.ok(N.carta(e, v).claves.includes("Exhumar"));
});

test("Virreinato del Peru: puedes Destruirlo para Robar dos cartas y Descartar una", () => {
  let e = mesa();
  const v = poner(e, 0, "apoyo", "Virreinato del Peru");
  e = aplicar(e, habilidad(v, "Virreinato del Peru"));
  e = aplicar(e, { tipo: "elegir", i: 0 });
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 2);
});

test("Virreinato del Peru: los Aliados que controles ganan 2 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Virreinato del Peru");
  const a = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, a), 5);
  assert.equal(N.fuerza(e, r), 3);
});
