import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, jugadorQueDecide, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const valores = (e) => e.pendiente.opciones.map((o) => o.valor);
const algo = (v) => v !== null;
const jugable = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const conRaza = (e, nombre, razas) => {
  const k = id(nombre);
  e.catalogo = { ...e.catalogo, [k]: { ...e.catalogo[k], razas } };
};
const alTope = (e, j, uids) => {
  const c = e.jugadores[j].castillo.filter((u) => !uids.includes(u));
  e.jugadores[j].castillo = [...uids, ...c];
};
const guerraRival = (e, atacante) => {
  e.activo = 1;
  e.jugadores[1].defensa = e.jugadores[1].defensa.filter((u) => u !== atacante);
  e.jugadores[1].ataque.push(atacante);
  e.atacantes = [atacante];
  e.fase = "talismanes";
  e.prioridad = 0;
  e.pases = 0;
};

test("Aplastar: juega un Aliado de tu Cementerio pagando un Oro menos y Destierra Caballeros, Eternos, Guerreros y/o Héroes de coste total hasta 3", () => {
  let e = mesa();
  oros(e, 0, 3);
  const ap = poner(e, 0, "mano", "Aplastar");
  const il = poner(e, 0, "cementerio", "Ileana");
  const gr = poner(e, 1, "defensa", "Guardia Real");
  const ga = poner(e, 1, "defensa", "Sir Galahad");
  const va = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ap)));
  e = elegir(e, il);
  assert.equal(zonaDe(e, il), "defensa");
  assert.equal(N.ubicar(e, il).j, 0);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(valores(e).includes(va), false);
  assert.equal(valores(e).includes(ga), true);
  e = elegir(e, gr);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, gr), "destierro");
  assert.equal(zonaDe(e, ga), "defensa");
  assert.equal(zonaDe(e, il), "defensa");
});

test("Aplastar: un Daikaiju se juega reduciendo su coste en dos Oros", () => {
  let e = mesa();
  conRaza(e, "Daikaiju Furioso", ["Daikaiju"]);
  oros(e, 0, 3);
  const ap = poner(e, 0, "mano", "Aplastar");
  const dk = poner(e, 0, "cementerio", "Daikaiju Furioso");
  e = sinRespuesta(aplicar(e, jugar(ap)));
  e = elegir(e, dk);
  while (e.pendiente) e = elegir(e, null);
  assert.equal(zonaDe(e, dk), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Aplastar: la reducción no baja el coste de 1", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ap = poner(e, 0, "mano", "Aplastar");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ap)));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, v), "cementerio");
  e = mesa();
  oros(e, 0, 3);
  const ap2 = poner(e, 0, "mano", "Aplastar");
  const v2 = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ap2)));
  e = elegir(e, v2);
  assert.equal(zonaDe(e, v2), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Aqui Están Todos Locos: convierte un Aliado de coste 2 o menos en copia de otro Aliado propio del mismo coste y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Aqui Están Todos Locos");
  const il = poner(e, 0, "defensa", "Ileana");
  const gr = poner(e, 0, "defensa", "Guardia Real");
  e = sinRespuesta(aplicar(e, jugar(t)));
  e = elegir(e, il);
  assert.equal(N.tiene(e, il, "AtacaAlEntrar"), true);
  assert.equal(N.tiene(e, il, "Indestructible"), false);
  assert.equal(N.fuerza(e, il), N.fuerza(e, gr));
  assert.equal(zonaDe(e, t), "destierro");
});

test("Aqui Están Todos Locos: sin dos Aliados propios del mismo coste no se puede jugar", () => {
  const e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Aqui Están Todos Locos");
  poner(e, 0, "defensa", "Ileana");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(jugable(e, t), false);
});

test("Ardor Celestial: cancela el ataque de los Aliados oponentes", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Ardor Celestial");
  const v = poner(e, 1, "defensa", "Valefor");
  guerraRival(e, v);
  e = sinRespuesta(aplicar(e, jugar(a)));
  e = elegir(e, "Cancelar el ataque de los Aliados oponentes");
  e = elegir(e, null);
  assert.equal(zonaDe(e, v), "defensa");
  assert.deepEqual(e.atacantes, []);
});

test("Ardor Celestial: con Exhumar se juega desde el Cementerio, Destierra una carta de coste 2 o menos y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "cementerio", "Ardor Celestial");
  const v = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(a, { desde: "cementerio" })));
  e = elegir(e, "Desterrar una carta de coste 2 o menos");
  e = elegir(e, null);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, a), "destierro");
});

test("Ardor Celestial: Baraja y/o Destierra hasta cuatro cartas de los Cementerios y Roba una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Ardor Celestial");
  const c1 = poner(e, 1, "cementerio", "Valefor");
  const c2 = poner(e, 1, "cementerio", "Ileana");
  e = sinRespuesta(aplicar(e, jugar(a)));
  e = elegir(e, "Barajar y/o Desterrar hasta cuatro cartas de los Cementerios y robar una");
  e = elegir(e, null);
  e = elegir(e, c1);
  e = elegir(e, null);
  e = elegir(e, c2);
  assert.equal(zonaDe(e, c1), "castillo");
  assert.equal(zonaDe(e, c2), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Ardor Celestial: puede elegir dos efectos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Ardor Celestial");
  const v = poner(e, 1, "defensa", "Valefor");
  guerraRival(e, v);
  e = sinRespuesta(aplicar(e, jugar(a)));
  e = elegir(e, "Cancelar el ataque de los Aliados oponentes");
  e = elegir(e, "Desterrar una carta de coste 2 o menos");
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "destierro");
  assert.deepEqual(e.atacantes, []);
});

test("Aringa Ora: Roba tres, se Destierra y jugar el tipo nombrado cuesta un Oro más hasta el próximo turno oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ao = poner(e, 0, "mano", "Aringa Ora");
  const mio = poner(e, 0, "mano", "Bola de Fuego");
  const suyo = poner(e, 1, "mano", "Bola de Fuego");
  e = sinRespuesta(aplicar(e, jugar(ao)));
  e = elegir(e, "Nombrar Talismán");
  assert.equal(e.jugadores[0].mano.length, 4);
  assert.equal(zonaDe(e, ao), "destierro");
  assert.equal(costeDe(e, 0, mio).pagar, 3);
  assert.equal(costeDe(e, 1, suyo).pagar, 3);
  e.activo = 1;
  e.turno += 1;
  N.expirar(e, "inicio");
  assert.equal(costeDe(e, 1, suyo).pagar, 2);
});

test("Aringa Ora: jugarlo al comienzo de la Vigilia oponente", { todo: "momento: jugar un Talismán al comienzo de la Vigilia oponente" }, () => {});

test("Aringa Ora: nombrar Arma, Tótem u Oro encarece esas cartas", { todo: "efecto: jugar cartas de un tipo nombrado (no Talismán) cuesta un Oro adicional" }, () => {});

test("Artilleria Pesada: Roba hasta tener ocho cartas en la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ap = poner(e, 0, "mano", "Artilleria Pesada");
  poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Ileana");
  e = sinRespuesta(aplicar(e, jugar(ap)));
  assert.equal(e.jugadores[0].mano.length, 8);
  assert.equal(e.jugadores[0].castillo.length, 24);
});

test("Artilleria Pesada: si Robó más de cuatro no puede jugar más cartas este turno", { todo: "efecto: no puedes jugar ni poner en juego más cartas este turno" }, () => {});

test("Artilleria Pesada: en el Cementerio quita el límite de mano y no puede ser Desterrada", { todo: "continua desde el Cementerio: sin límite de cartas en la mano y la carta no puede ser Desterrada" }, () => {});

test("Asalto Estelar: muestra once cartas de un Castillo, pone tres en el Destierro de su dueño y Roba una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const as = poner(e, 0, "mano", "Asalto Estelar");
  const tope = e.jugadores[1].castillo.slice(0, 3);
  e = sinRespuesta(aplicar(e, jugar(as)));
  e = elegir(e, "Castillo oponente");
  for (const u of tope) e = elegir(e, u);
  e = elegir(e, "Destierro");
  assert.deepEqual(tope.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro"]);
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Asalto Estelar: puede poner las tres en el Cementerio de su dueño", () => {
  let e = mesa();
  oros(e, 0, 1);
  const as = poner(e, 0, "mano", "Asalto Estelar");
  const tope = e.jugadores[0].castillo.slice(0, 3);
  e = sinRespuesta(aplicar(e, jugar(as)));
  e = elegir(e, "tu Castillo");
  for (const u of tope) e = elegir(e, u);
  e = elegir(e, "Cementerio");
  assert.deepEqual(tope.map((u) => zonaDe(e, u)), ["cementerio", "cementerio", "cementerio"]);
});

test("Asalto Estelar: se Destierra de tu Cementerio para Barajar hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const as = poner(e, 0, "cementerio", "Asalto Estelar");
  const c1 = poner(e, 1, "cementerio", "Valefor");
  const c2 = poner(e, 0, "cementerio", "Ileana");
  e = hacer(e, habilidad(as, "Asalto Estelar"), c1, c2);
  assert.equal(zonaDe(e, as), "destierro");
  assert.equal(zonaDe(e, c1), "castillo");
  assert.equal(zonaDe(e, c2), "castillo");
});

test("Asalto Estelar: si es Anulado se convierte en Oro", { todo: "disparo: al ser Anulado" }, () => {});

test("Ascenso de Enoc: Baraja una carta sin habilidad que no sea Oro y pone en tu mano el primer Aliado del Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const as = poner(e, 0, "mano", "Ascenso de Enoc");
  const v = poner(e, 1, "defensa", "Valefor");
  const il = poner(e, 1, "defensa", "Ileana");
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: v, fin: "turno" }, 0);
  const al = poner(e, 0, "castillo", "Guardia Real");
  const [d1, d2] = e.jugadores[0].castillo;
  alTope(e, 0, [d1, d2, al]);
  e = sinRespuesta(aplicar(e, jugar(as)));
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, il), "defensa");
  assert.equal(zonaDe(e, al), "mano");
  assert.equal(zonaDe(e, d1), "castillo");
});

test("Ascenso de Enoc: jugarlo al comienzo de cualquier Fase", { todo: "momento: jugar un Talismán al comienzo de cualquier Fase" }, () => {});

test("Ascenso de Enoc: en el Cementerio protege a tus Aliados y a sí mismo", { todo: "continua desde el Cementerio: tus Aliados no pierden la habilidad y la carta no puede ser Desterrada" }, () => {});

test("Asimilar Materia: cuesta un Oro menos por cada Oro que controles, hasta 0", () => {
  const e = mesa();
  const am = poner(e, 0, "mano", "Asimilar Materia");
  oros(e, 0, 2);
  assert.equal(costeDe(e, 0, am).pagar, 2);
  oros(e, 0, 3);
  assert.equal(costeDe(e, 0, am).pagar, 0);
});

test("Asimilar Materia: Roba una, hasta dos Aliados hacen daño al Destierro y no se juega otra este turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const am = poner(e, 0, "mano", "Asimilar Materia");
  const otra = poner(e, 0, "mano", "Asimilar Materia");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Ileana");
  e = sinRespuesta(aplicar(e, jugar(am)));
  e = elegir(e, v);
  e = elegir(e, null);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
  assert.equal(N.tiene(e, r, "DanoAlDestierro"), false);
  assert.equal(e.jugadores[0].mano.length, 2);
  oros(e, 0, 2);
  assert.equal(jugable(e, otra), false);
});

test("Asimilar Materia: las cartas en los Cementerios pierden su habilidad", { todo: "efecto: las cartas en los Cementerios pierden su habilidad por el turno" }, () => {});

test("Atacar al Vampiro: convierte una carta en otra del mismo tipo sin habilidad y gana el control de una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const av = poner(e, 0, "mano", "Atacar al Vampiro");
  const ga = poner(e, 1, "defensa", "Sir Galahad");
  const il = poner(e, 1, "defensa", "Ileana");
  e = sinRespuesta(aplicar(e, jugar(av)));
  e = elegir(e, ga);
  assert.equal(N.carta(e, ga).tipo, "Aliado");
  assert.equal(N.carta(e, ga).sinHabilidad, true);
  assert.equal(N.tiene(e, ga, "AtacaAlEntrar"), false);
  assert.equal(zonaDe(e, il), "defensa");
  assert.equal(N.ubicar(e, il).j, 0);
  assert.equal(N.ubicar(e, ga).j, 1);
});

test("Atacar al Vampiro: tiene Exhumar", () => {
  const e = mesa();
  oros(e, 0, 3);
  const av = poner(e, 0, "cementerio", "Atacar al Vampiro");
  poner(e, 1, "defensa", "Ileana");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === av && a.desde === "cementerio"), true);
});

test("Ataque Bandido: Busca un Bandido en tu Castillo y lo pone en tu mano", () => {
  let e = mesa();
  conRaza(e, "Valefor", ["Bandido"]);
  const ab = poner(e, 0, "mano", "Ataque Bandido");
  const b = poner(e, 0, "castillo", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ab)));
  e = elegir(e, "Buscar un Bandido en tu Castillo");
  e = elegir(e, b);
  assert.equal(zonaDe(e, b), "mano");
});

test("Ataque Bandido: juega un Tótem de tu Cementerio pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ab = poner(e, 0, "mano", "Ataque Bandido");
  const t = poner(e, 0, "cementerio", "Isla de Poveglia");
  e = sinRespuesta(aplicar(e, jugar(ab)));
  e = elegir(e, "Jugar un Arma o Tótem de tu Cementerio o Destierro pagando su coste");
  if (e.pendiente) e = elegir(e, false);
  assert.equal(zonaDe(e, t), "apoyo");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ataque Bandido: juega un Arma de tu Destierro pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ab = poner(e, 0, "mano", "Ataque Bandido");
  const v = poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "destierro", "Pedrenyal");
  e = sinRespuesta(aplicar(e, jugar(ab)));
  e = elegir(e, "Jugar un Arma o Tótem de tu Cementerio o Destierro pagando su coste");
  assert.deepEqual(e.armas[v], [arma]);
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ataque Bandido: sin Oros para pagar no ofrece jugar el Tótem", () => {
  let e = mesa();
  const ab = poner(e, 0, "mano", "Ataque Bandido");
  poner(e, 0, "cementerio", "Isla de Poveglia");
  e = sinRespuesta(aplicar(e, jugar(ab)));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.texto), ["Buscar un Bandido en tu Castillo"]);
});

test("Ataque Bandido: pagando un Oro y Desterrándolo de tu mano, un Arma o Tótem de coste 3 o menos pierde su habilidad y es Destruido", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ab = poner(e, 0, "mano", "Ataque Bandido");
  const t = poner(e, 1, "apoyo", "Isla de Poveglia");
  e = aplicar(e, habilidad(ab, "Ataque Bandido"));
  assert.equal(zonaDe(e, ab), "destierro");
  assert.equal(zonaDe(e, t), "cementerio");
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ataque Feerico: muestra hasta dos Aliados de coste 2 de distinto nombre, juega uno gratis, el otro a la mano y Baraja el resto", () => {
  let e = mesa();
  oros(e, 0, 2);
  const af = poner(e, 0, "mano", "Ataque Feerico");
  const v = poner(e, 0, "castillo", "Valefor");
  const il = poner(e, 0, "castillo", "Ileana");
  const il2 = poner(e, 0, "castillo", "Ileana");
  const gr = poner(e, 0, "castillo", "Guardia Real");
  alTope(e, 0, [v, il, il2, gr]);
  e = sinRespuesta(aplicar(e, jugar(af)));
  e = elegir(e, gr);
  assert.equal(zonaDe(e, gr), "defensa");
  assert.equal(zonaDe(e, il), "mano");
  assert.equal(zonaDe(e, il2), "castillo");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ataque Feerico: se Destierra de tu Cementerio para que un Aliado pierda 2 de Fuerza", () => {
  let e = mesa();
  const af = poner(e, 0, "cementerio", "Ataque Feerico");
  const v = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(af, "Ataque Feerico"));
  assert.equal(zonaDe(e, af), "destierro");
  assert.equal(N.fuerza(e, v), 1);
  e.turno += 3;
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, v), 1);
});

test("Aun Tenemos Patria: tu oponente Bota tres y tú Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Aun Tenemos Patria");
  e = sinRespuesta(aplicar(e, jugar(a)));
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Aun Tenemos Patria: jugarlo en la Fase Final", { todo: "momento: jugar un Talismán en la Fase Final" }, () => {});

test("Aun Tenemos Patria: desde el Cementerio el segundo Aliado del turno no puede ser Anulado", { todo: "efecto: el segundo Aliado que juegues este turno no puede ser Anulado" }, () => {});

test("Avaricia: busca tres Oros, dos al Oro Pagado sin habilidad y uno a la mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const av = poner(e, 0, "mano", "Avaricia");
  e = sinRespuesta(aplicar(e, jugar(av)));
  e = elegir(e, algo);
  e = elegir(e, algo);
  e = elegir(e, algo);
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].pagado.length, 4);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 27);
  const nuevos = e.jugadores[0].pagado.slice(2);
  for (const u of nuevos) assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === u), true);
});

test("Avaricia: si controlas siete o más Oros Robas dos", () => {
  let e = mesa();
  oros(e, 0, 5);
  const av = poner(e, 0, "mano", "Avaricia");
  e = sinRespuesta(aplicar(e, jugar(av)));
  e = elegir(e, algo);
  e = elegir(e, algo);
  e = elegir(e, algo);
  assert.equal(N.orosDe(e, 0).length, 7);
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Avaricia: al poner un Oro en juego puedes subirla de tu Cementerio a tu mano", () => {
  let e = mesa();
  const av = poner(e, 0, "cementerio", "Avaricia");
  const o = poner(e, 0, "mano", "Drácula");
  e = aplicar(e, { tipo: "oro", uid: o });
  e = elegir(e, true);
  assert.equal(zonaDe(e, av), "mano");
});

test("Aventuras de Sancho: cuesta un Oro menos por cada carta de coste 1 o más que controles, hasta 1", () => {
  const e = mesa();
  const s = poner(e, 0, "mano", "Aventuras de Sancho");
  oros(e, 0, 3);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Ileana");
  assert.equal(costeDe(e, 0, s).pagar, 2);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, s).pagar, 1);
});

test("Aventuras de Sancho: las cartas que no sean Oro pierden su habilidad y son Barajadas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const s = poner(e, 0, "mano", "Aventuras de Sancho");
  const v = poner(e, 0, "defensa", "Valefor");
  const il = poner(e, 0, "defensa", "Ileana");
  const gr = poner(e, 1, "defensa", "Guardia Real");
  const t = poner(e, 1, "apoyo", "Isla de Poveglia");
  e = sinRespuesta(aplicar(e, jugar(s)));
  assert.equal(e.pendiente, null);
  for (const u of [v, il, gr, t]) assert.equal(zonaDe(e, u), "castillo");
  assert.equal(N.orosDe(e, 0).length, 2);
});

test("Aventuras de Sancho: hasta tu próximo turno solo se ponen dos cartas que no sean Oro", { todo: "efecto: máximo de cartas que no sean Oro puestas en juego por turno, para ambos jugadores" }, () => {});

test("Avistamientos: mira la mano oponente y Baraja en su Castillo una carta que no sea Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Avistamientos");
  const o = poner(e, 1, "mano", "Drácula");
  const v = poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(a)));
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, o), "mano");
  assert.equal(e.jugadores[1].castillo.length, 31);
});

test("Avistamientos: elegir efecto y mover un Oro oponente al Oro Pagado en su próxima Fase Final", { todo: "disparo diferido: en la próxima Fase Final oponente" }, () => {});

test("Bajo el Traiguen: Baraja una carta oponente de coste 2 o menos y luego se Baraja en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Bajo el Traiguen");
  const v = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 31);
  assert.equal(e.jugadores[0].cementerio.length, 0);
});

test("Bajo el Traiguen: sin cartas oponentes de coste 2 o menos no se puede jugar", () => {
  const e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Bajo el Traiguen");
  poner(e, 1, "defensa", "Sir Galahad");
  assert.equal(jugable(e, b), false);
});

test("Bajo el Traiguen: si es Botado por daño detiene el Bote y se Destierra", { todo: "reacción: al ser Botada por daño detiene el Bote y se Destierra" }, () => {});

test("Bajo la Higuera: Robas cuatro si tu oponente no Destierra las cinco primeras de su Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bajo la Higuera");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(jugadorQueDecide(e), 1);
  e = elegir(e, null);
  assert.equal(e.jugadores[0].mano.length, 4);
  assert.equal(e.jugadores[1].destierro.length, 0);
});

test("Bajo la Higuera: si tu oponente Destierra las cinco primeras de su Castillo no Robas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bajo la Higuera");
  e = sinRespuesta(aplicar(e, jugar(b)));
  e = elegir(e, algo);
  assert.equal(e.jugadores[0].mano.length, 0);
  assert.equal(e.jugadores[1].destierro.length, 5);
  assert.equal(e.jugadores[1].castillo.length, 25);
});

test("Bastón de la Bestia: una vez por turno, pagando un Oro sube un Aliado o Tótem de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bastón de la Bestia");
  const v = poner(e, 0, "cementerio", "Valefor");
  poner(e, 0, "cementerio", "Isla de Poveglia");
  e = hacer(e, habilidad(b, "Bastón de la Bestia"), v);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].reserva.length, 1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === b), false);
});

test("Bastón de la Bestia: en Guerra de Talismanes sin Oros en Reserva, Descartando una carta cancela el ataque de un Aliado", () => {
  let e = mesa();
  const b = poner(e, 0, "mano", "Bastón de la Bestia");
  const x = poner(e, 0, "mano", "Valefor");
  const v = poner(e, 1, "defensa", "Valefor");
  guerraRival(e, v);
  e = hacer(e, habilidad(b, "Bastón de la Bestia", 1), x, "Cancelar el ataque de un Aliado");
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(zonaDe(e, v), "defensa");
  assert.deepEqual(e.atacantes, []);
});

test("Bastón de la Bestia: en Guerra de Talismanes hasta tres Aliados ganan 1 de Fuerza", () => {
  let e = mesa();
  const b = poner(e, 0, "mano", "Bastón de la Bestia");
  const m = poner(e, 0, "defensa", "Valefor");
  const v = poner(e, 1, "defensa", "Valefor");
  guerraRival(e, v);
  e = hacer(e, habilidad(b, "Bastón de la Bestia", 1), "Hasta tres Aliados ganan 1 de Fuerza", m, null);
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(N.fuerza(e, m), 4);
  assert.equal(N.fuerza(e, v), 3);
});

test("Bastón de la Bestia: con Oros en Reserva no puede usar la habilidad de Guerra", () => {
  const e = mesa();
  const b = poner(e, 0, "mano", "Bastón de la Bestia");
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  guerraRival(e, v);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === b && a.h === 1), false);
});

test("Batalla de Azincourt: Anula un Aliado de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const il = poner(e, 0, "mano", "Ileana");
  const az = poner(e, 1, "mano", "Batalla de Azincourt");
  e = aplicar(e, jugar(il));
  assert.equal(jugadorQueDecide(e), 1);
  e = aplicar(e, { tipo: "responder", uid: az });
  e = sinRespuesta(e);
  assert.equal(zonaDe(e, il), "cementerio");
  assert.equal(zonaDe(e, az), "cementerio");
});

test("Batalla de Azincourt: no puede Anular un Aliado de coste 3 ni jugarse sola", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const ga = poner(e, 0, "mano", "Sir Galahad");
  const az = poner(e, 1, "mano", "Batalla de Azincourt");
  const propia = poner(e, 0, "mano", "Batalla de Azincourt");
  assert.equal(jugable(e, propia), false);
  e = aplicar(e, jugar(ga));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === az), false);
});

test("Batalla de Azincourt: desde el Cementerio previene la destrucción de un Aliado propio", { todo: "reemplazo desde el Cementerio: Desterrarla para prevenir la destrucción de un Aliado propio" }, () => {});

test("Batalla de Rancagua: Roba dos, Destierra un Aliado de coste 3 o menos o un Tótem, se Destierra y otorga la habilidad de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 1);
  const r = poner(e, 0, "mano", "Batalla de Rancagua");
  const v = poner(e, 0, "defensa", "Valefor");
  const gr = poner(e, 1, "defensa", "Guardia Real");
  const t = poner(e, 1, "apoyo", "Isla de Poveglia");
  const gusano = poner(e, 1, "defensa", "Gusano Rojo");
  e = sinRespuesta(aplicar(e, jugar(r)));
  assert.equal(valores(e).includes(t), true);
  assert.equal(valores(e).includes(gusano), false);
  e = elegir(e, gr);
  e = elegir(e, v);
  assert.equal(zonaDe(e, gr), "destierro");
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  const c1 = poner(e, 1, "cementerio", "Valefor");
  const c2 = poner(e, 1, "cementerio", "Ileana");
  e = hacer(e, habilidad(v, "Batalla de Rancagua"), c1, null, c2);
  assert.equal(zonaDe(e, c1), "castillo");
  assert.equal(zonaDe(e, c2), "destierro");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === v), false);
});

test("Batalla de Rancagua: la habilidad otorgada no se usa desde la mano", () => {
  const e = mesa();
  const r = poner(e, 0, "mano", "Batalla de Rancagua");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === r), false);
});

test("Batalla de Rancagua: si es Anulada genera un Oro para jugar Aliados", { todo: "disparo: al ser Anulado" }, () => {});

test("Batalla de Trafalgar: cuesta un Oro menos por cada Aliado oponente y sube hasta tres Aliados oponentes de coste 1 o menos a la mano", () => {
  let e = mesa();
  const bt = poner(e, 0, "mano", "Batalla de Trafalgar");
  const v1 = poner(e, 1, "defensa", "Valefor");
  const v2 = poner(e, 1, "defensa", "Valefor");
  const il = poner(e, 1, "defensa", "Ileana");
  assert.equal(costeDe(e, 0, bt).pagar, 0);
  e = sinRespuesta(aplicar(e, jugar(bt)));
  e = elegir(e, v1);
  e = elegir(e, v2);
  assert.equal(zonaDe(e, v1), "mano");
  assert.equal(zonaDe(e, v2), "mano");
  assert.equal(zonaDe(e, il), "defensa");
});

test("Bola de Fuego: Destruye una carta en juego que no sea Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bola de Fuego");
  const gr = poner(e, 1, "defensa", "Guardia Real");
  const il = poner(e, 1, "defensa", "Ileana");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(zonaDe(e, gr), "cementerio");
  assert.equal(zonaDe(e, il), "defensa");
});

test("Bola de Fuego: sin objetivos destruibles que no sean Oro no se puede jugar", () => {
  const e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bola de Fuego");
  poner(e, 1, "defensa", "Ileana");
  assert.equal(jugable(e, b), false);
});

test("Bomba Electrica: cada jugador elige un Aliado que controle y Baraja el resto", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bomba Electrica");
  const v = poner(e, 0, "defensa", "Valefor");
  const il = poner(e, 0, "defensa", "Ileana");
  const gr = poner(e, 1, "defensa", "Guardia Real");
  const ga = poner(e, 1, "defensa", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(jugadorQueDecide(e), 0);
  e = elegir(e, il);
  assert.equal(jugadorQueDecide(e), 1);
  e = elegir(e, ga);
  assert.equal(zonaDe(e, il), "defensa");
  assert.equal(zonaDe(e, ga), "defensa");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, gr), "castillo");
});

test("Bomba Electrica: hasta tu próximo turno no más de dos cartas de cada tipo por turno", { todo: "efecto: máximo de cartas de cada tipo puestas en juego por turno, para ambos jugadores" }, () => {});

test("Bomba Electrica: si es Botada por daño detiene el Bote y se Destierra", { todo: "reacción: al ser Botada por daño detiene el Bote y se Destierra" }, () => {});

test("Brujas de Belial: un Aliado de coste 2 o menos gana Indestructible, debe atacar y no cambia de controlador", () => {
  let e = mesa();
  const b = poner(e, 0, "mano", "Brujas de Belial");
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(N.tiene(e, v, "Indestructible"), true);
  assert.equal(N.puedeTomar(e, v, 1), false);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "terminar"), false);
  e.activo = 1;
  e.turno += 1;
  N.expirar(e, "finTurno");
  N.expirar(e, "inicio");
  assert.equal(N.tiene(e, v, "Indestructible"), true);
  e.activo = 0;
  e.turno += 1;
  N.expirar(e, "inicio");
  assert.equal(N.tiene(e, v, "Indestructible"), false);
});

test("Brujas de Belial: el Aliado no puede ser convertido", { todo: "efecto: no puede ser convertido" }, () => {});

test("Brujas de Belial: Desterrarla del Cementerio y pagar un Oro para Anular un Talismán de coste 1", { todo: "respuesta desde el Cementerio: Anular" }, () => {});

test("Caceria de Brujas: tu oponente Descarta todos los Talismanes de su mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Caceria de Brujas");
  const t1 = poner(e, 1, "mano", "Bola de Fuego");
  const t2 = poner(e, 1, "mano", "Avaricia");
  const v = poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(c)));
  assert.equal(zonaDe(e, t1), "cementerio");
  assert.equal(zonaDe(e, t2), "cementerio");
  assert.equal(zonaDe(e, v), "mano");
});
