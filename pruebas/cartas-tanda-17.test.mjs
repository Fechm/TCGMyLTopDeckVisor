import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const puedeResponder = (e, uid) => accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === uid);

let nFicticia = 0;
function ficticia(e, j, zona, datos = {}) {
  const idf = `ficticia17-${nFicticia++}`;
  e.catalogo = {
    ...e.catalogo,
    [idf]: { id: idf, nombre: idf, tipo: "Aliado", coste: 1, fuerza: 2, razas: [], sinHabilidad: false, oroInicial: false, texto: "", ...datos },
  };
  const uid = `${j}-g${nFicticia}`;
  e.instancias[uid] = idf;
  e.jugadores[j][zona].push(uid);
  return uid;
}

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  const c = e.jugadores[j].castillo;
  c.splice(c.indexOf(uid), 1);
  c.unshift(uid);
  return uid;
}

function ajena(e, j, zona, nombre) {
  const uid = poner(e, N.rival(j), zona, nombre);
  N.sacar(e, uid);
  e.jugadores[j][zona].push(uid);
  return uid;
}

function enComienzoDeFase(nombre) {
  let e = mesa();
  oros(e, 1, 1);
  const carta = poner(e, 1, "mano", nombre);
  poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  assert.equal(e.fase, "momento");
  e = aplicar(e, { tipo: "pasarMomento" });
  return puedeJugar(e, carta);
}

function responderCon(e, carta, respuesta) {
  e = aplicar(e, jugar(carta));
  e = aplicar(e, { tipo: "responder", uid: respuesta });
  return sinRespuesta(e);
}

test("Sexto Sello: no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 4);
  const sello = poner(e, 0, "mano", "Sexto Sello");
  poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(sello));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
});

test("Sexto Sello: busca un Sello, Destruye todo lo que no es Oro y cada jugador Bota seis", () => {
  let e = mesa();
  oros(e, 0, 3);
  const primer = poner(e, 0, "castillo", "Primer Sello");
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  const sello = poner(e, 0, "mano", "Sexto Sello");
  e = hacer(e, jugar(sello), primer, texto("Destruir"));
  assert.equal(zonaDe(e, primer), "mano");
  assert.equal(zonaDe(e, propio), "cementerio");
  assert.equal(zonaDe(e, rival), "cementerio");
  assert.equal(e.jugadores[0].castillo.length, 24);
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(zonaDe(e, sello), "cementerio");
});

test("Sexto Sello: puede Desterrar en vez de Destruir", () => {
  let e = mesa();
  oros(e, 0, 3);
  const rival = poner(e, 1, "defensa", "Valefor");
  const sello = poner(e, 0, "mano", "Sexto Sello");
  e = hacer(e, jugar(sello), texto("Desterrar"));
  assert.equal(zonaDe(e, rival), "destierro");
});

test("Sexto Sello: por cada Sello Botado el oponente Bota una carta adicional", () => {
  let e = mesa();
  oros(e, 0, 3);
  alTope(e, 1, "Primer Sello");
  alTope(e, 1, "Segundo Sello");
  const sello = poner(e, 0, "mano", "Sexto Sello");
  e = hacer(e, jugar(sello), texto("Destruir"));
  assert.equal(e.jugadores[0].castillo.length, 24);
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(e.jugadores[1].cementerio.length, 8);
});

test("Sheut: cuesta un Oro menos si controlas menos Oros que tu oponente", () => {
  const e = mesa();
  const sheut = poner(e, 1, "mano", "Sheut");
  oros(e, 1, 2);
  oros(e, 0, 2);
  assert.equal(costeDe(e, 1, sheut).pagar, 1);
  oros(e, 0, 1);
  assert.equal(costeDe(e, 1, sheut).pagar, 0);
});

test("Sheut: Anula un Aliado de coste 1 o menos y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const valefor = poner(e, 0, "mano", "Valefor");
  const sheut = poner(e, 1, "mano", "Sheut");
  e = responderCon(e, valefor, sheut);
  assert.equal(zonaDe(e, valefor), "cementerio");
  assert.equal(zonaDe(e, sheut), "destierro");
});

test("Sheut: no Anula Aliados de coste mayor que 1", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const balaur = poner(e, 0, "mano", "Balaur");
  const sheut = poner(e, 1, "mano", "Sheut");
  e = aplicar(e, jugar(balaur));
  assert.equal(puedeResponder(e, sheut), false);
});

test("Sheut: no puede responder a un Talismán de coste 1", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const manada = poner(e, 0, "mano", "Llamar a la Manada");
  const sheut = poner(e, 1, "mano", "Sheut");
  e = aplicar(e, jugar(manada));
  assert.equal(puedeResponder(e, sheut), false);
});

test("Sheut: cancela la habilidad de una carta", { todo: "respuesta: cancelar una habilidad" }, () => {});

test("Sheut: Anula un Tótem de coste 1 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const totem = ficticia(e, 0, "mano", { tipo: "Tótem", coste: 1, fuerza: null });
  const sheut = poner(e, 1, "mano", "Sheut");
  e = aplicar(e, jugar(totem));
  assert.equal(puedeResponder(e, sheut), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: sheut }));
  assert.equal(zonaDe(e, totem), "cementerio");
  assert.equal(zonaDe(e, sheut), "destierro");
});

test("Sidhes del Bosque: Roba una carta", () => {
  let e = mesa();
  const sidhes = poner(e, 0, "mano", "Sidhes del Bosque");
  poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, jugar(sidhes), texto("Robar"));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Sidhes del Bosque: sube un Aliado de tu Cementerio a tu mano", () => {
  let e = mesa();
  const sidhes = poner(e, 0, "mano", "Sidhes del Bosque");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, jugar(sidhes), texto("Subir"));
  assert.equal(zonaDe(e, v), "mano");
});

test("Sidhes del Bosque: se juega en respuesta a que el oponente busque en un Castillo", { todo: "respuesta: a que el oponente busque cartas en un Castillo" }, () => {});

test("Sidhes del Bosque: el oponente muestra lo que busca y no puede buscar las cartas nombradas", { todo: "efecto: el oponente no puede buscar cartas con nombres dados y debe mostrar lo que busca" }, () => {});

test("Silenciar Mundo: Armas y Tótems oponentes pierden su habilidad hasta el final de tu próximo turno y Robas hasta dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const portador = poner(e, 1, "defensa", "Valefor");
  const martillo = poner(e, 1, "arma", "Martillo Sacro", { portador });
  const totem = ficticia(e, 1, "apoyo", { tipo: "Tótem", coste: 2 });
  const silenciar = poner(e, 0, "mano", "Silenciar Mundo");
  e = hacer(e, jugar(silenciar), 2);
  assert.equal(N.activa(e, martillo), false);
  assert.equal(N.activa(e, totem), false);
  assert.equal(e.jugadores[0].mano.length, 2);
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, martillo), false);
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, martillo), true);
});

test("Silenciar Mundo: si el coste total supera 3 no Robas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const portador = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "arma", "Martillo Sacro", { portador });
  poner(e, 1, "apoyo", "Fortaleza Hoshi");
  const silenciar = poner(e, 0, "mano", "Silenciar Mundo");
  e = sinRespuesta(aplicar(e, jugar(silenciar)));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Silenciar Mundo: no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 4);
  const silenciar = poner(e, 0, "mano", "Silenciar Mundo");
  poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(silenciar));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
});

test("Sin Tregua: busca dos cartas en un Castillo y las Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 1, "castillo", "Valefor");
  const b = poner(e, 1, "castillo", "Balaur");
  const tregua = poner(e, 0, "mano", "Sin Tregua");
  e = hacer(e, jugar(tregua), texto("Castillo oponente"), a, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Sin Tregua: al comienzo de tu Vigilia puedes subirla de tu Cementerio a tu mano", () => {
  let e = mesa();
  const tregua = poner(e, 0, "cementerio", "Sin Tregua");
  N.disparar(e, "comienzoVigilia", { j: 0 });
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, tregua), "mano");
});

test("Sin Tregua: no se dispara en la Vigilia oponente", () => {
  const e = mesa();
  poner(e, 0, "cementerio", "Sin Tregua");
  N.disparar(e, "comienzoVigilia", { j: 1 });
  resolver(e);
  assert.equal(e.pendiente, null);
});

test("Sin Tregua: desde tu Cementerio, jugar cartas de coste 0 o sin pagar exige Barajar una carta de la mano", { todo: "restricción desde el Cementerio: jugar cartas de coste 0 o sin pagar su coste exige Barajar una carta de la mano" }, () => {});

test("Soberbia: un Aliado gana la habilidad de Barajar los Aliados de menor Fuerza una vez por turno en tu Vigilia", () => {
  let e = mesa();
  oros(e, 0, 1);
  const balaur = poner(e, 0, "defensa", "Balaur");
  const debil = poner(e, 1, "defensa", "Valefor");
  const propio = poner(e, 0, "defensa", "Valefor");
  const fuerte = poner(e, 1, "defensa", "Daikaiju Furioso");
  const soberbia = poner(e, 0, "mano", "Soberbia");
  e = hacer(e, jugar(soberbia), balaur);
  assert.equal(puedeUsar(e, balaur), true);
  e = aplicar(e, habilidad(balaur, "Soberbia"));
  assert.equal(zonaDe(e, debil), "castillo");
  assert.equal(zonaDe(e, propio), "castillo");
  assert.equal(zonaDe(e, fuerte), "defensa");
  assert.equal(puedeUsar(e, balaur), false);
});

test("Soberbia: desde el Cementerio no da la habilidad a nadie", () => {
  const e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "cementerio", "Soberbia");
  assert.equal(puedeUsar(e, v), false);
});

test("Soberbia: desde tu Cementerio protege a tu Aliado de mayor coste de Aliados oponentes de menor coste", { todo: "protección desde el Cementerio: tu Aliado de mayor coste no puede ser afectado por Aliados oponentes de menor coste" }, () => {});

test("Sombra Etérea: muestra cartas hasta una del tipo nombrado y la pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "castillo", "Valefor");
  const sombra = poner(e, 0, "mano", "Sombra Etérea");
  e = hacer(e, jugar(sombra), texto("Nombrar una carta de tipo Aliado"));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Sombra Etérea: tiene Exhumar y se juega desde el Cementerio", () => {
  const e = mesa();
  oros(e, 0, 1);
  const sombra = poner(e, 0, "cementerio", "Sombra Etérea");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === sombra && a.desde === "cementerio"), true);
});

test("Sombra Etérea: se puede jugar al comienzo de cualquier Fase", () => {
  assert.equal(enComienzoDeFase("Sombra Etérea"), true);
});

test("Sombra Etérea: no se pueden utilizar habilidades de cartas con el nombre nombrado por el turno", { todo: "efecto: no se pueden utilizar habilidades de cartas con un nombre por el turno" }, () => {});

test("Supremacia Kaiju: Baraja y Destierra hasta tres cartas de los Cementerios, busca una carta y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = [0, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  const b = poner(e, 0, "castillo", "Balaur");
  const sup = poner(e, 0, "mano", "Supremacia Kaiju");
  e = hacer(e, jugar(sup), c[0], c[1], null, c[2], b);
  assert.equal(zonaDe(e, c[0]), "castillo");
  assert.equal(zonaDe(e, c[1]), "castillo");
  assert.equal(zonaDe(e, c[2]), "destierro");
  assert.equal(zonaDe(e, c[3]), "cementerio");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(zonaDe(e, sup), "destierro");
});

test("Supremacia Kaiju: se puede jugar al comienzo de cualquier Fase", () => {
  assert.equal(enComienzoDeFase("Supremacia Kaiju"), true);
});

test("Supremacia Kaiju: el próximo Oro del oponente entra sin habilidad por el turno", { todo: "efecto: el próximo Oro que ponga en juego el oponente entra sin habilidad por el turno" }, () => {});

test("Ta Kona: cuesta un Oro adicional por cada Aliado que controles hasta un máximo de 3", () => {
  const e = mesa();
  const ta = poner(e, 0, "mano", "Ta Kona");
  assert.equal(costeDe(e, 0, ta).pagar, 0);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, ta).pagar, 2);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, ta).pagar, 3);
});

test("Ta Kona: solo se juega al comienzo del ataque", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const ta = poner(e, 0, "mano", "Ta Kona");
  assert.equal(puedeJugar(e, ta), false);
  e = aplicar(e, { tipo: "batalla" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, ta), true);
  e = aplicar(e, { tipo: "pasarMomento" });
  e = aplicar(e, { tipo: "pasarMomento" });
  e = aplicar(e, { tipo: "atacar", uid: v });
  e = aplicar(e, { tipo: "finAtaque" });
  while (e.fase === "momento") e = aplicar(e, { tipo: "pasarMomento" });
  e = aplicar(e, { tipo: "finBloqueo" });
  assert.equal(e.fase, "talismanes");
  assert.equal(puedeJugar(e, ta), false);
});

test("Ta Kona: al final de la Batalla agrupas tus Aliados y ganas una Batalla Mitológica adicional", { todo: "efecto: Batalla Mitológica adicional en el turno" }, () => {});

test("Tapati: Destierra todo lo que no sea Oro y por cada carta Desterrada Baraja o Destierra hasta dos de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  const oro = poner(e, 1, "reserva", "Onsen");
  const c = [1, 1, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Balaur"));
  const tapati = poner(e, 0, "mano", "Tapati");
  e = hacer(e, jugar(tapati), c[0], c[1], null, c[2], c[3]);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, oro), "reserva");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro", "destierro", "cementerio"]);
});

test("Tapati: si es Anulado agrupa un Oro y busca una carta en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 4);
  const tapati = poner(e, 0, "mano", "Tapati");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  const b = poner(e, 0, "castillo", "Balaur");
  e = responderCon(e, tapati, dorado);
  const [pagado] = e.jugadores[0].pagado;
  e = elegir(e, pagado);
  e = elegir(e, b);
  assert.equal(zonaDe(e, tapati), "cementerio");
  assert.equal(zonaDe(e, pagado), "reserva");
  assert.equal(zonaDe(e, b), "mano");
});

test("Tempilcahue: busca una carta, Roba una y no puedes jugar más cartas este turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const b = poner(e, 0, "castillo", "Balaur");
  const v = poner(e, 0, "mano", "Valefor");
  const t = poner(e, 0, "mano", "Tempilcahue");
  e = hacer(e, jugar(t), texto("Buscar"), b);
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(puedeJugar(e, v), false);
});

test("Tempilcahue: paga dos Oros para Barajar cartas de coste total 4 o menos y Robar dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const balaur = poner(e, 1, "defensa", "Daikaiju Furioso");
  const v = poner(e, 1, "defensa", "Valefor");
  const otro = poner(e, 1, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Tempilcahue");
  e = hacer(e, jugar(t), texto("Pagar"), balaur, v);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === otro), false);
  e = elegir(e, null);
  assert.equal(zonaDe(e, balaur), "castillo");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, otro), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Tentaciones Divinas: Aliados ganan 1 de Fuerza y daño al Destierro, y Robas tres y Descartas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Tentaciones Divinas");
  e = hacer(e, jugar(t), texto("Hasta tres"), texto("Robar"), v);
  const mano = [...e.jugadores[0].mano];
  e = elegir(e, mano[0]);
  e = elegir(e, mano[1]);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 2);
  assert.equal(zonaDe(e, t), "destierro");
});

test("Tentaciones Divinas: un Oro o carta de coste 2 o menos pierde su habilidad hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const onsen = poner(e, 1, "reserva", "Onsen");
  const balaur = poner(e, 1, "defensa", "Balaur");
  const t = poner(e, 0, "mano", "Tentaciones Divinas");
  e = hacer(e, jugar(t), texto("Un Oro"), texto("Robar"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === balaur), false);
  e = elegir(e, onsen);
  const mano = [...e.jugadores[0].mano];
  e = elegir(e, mano[0]);
  e = elegir(e, mano[1]);
  assert.equal(N.activa(e, onsen), false);
});

test("Tercer Sello: busca un Sello, los Aliados pierden 3 de Fuerza y se Barajan los oponentes de Fuerza 0", () => {
  let e = mesa();
  oros(e, 0, 2);
  const primer = poner(e, 0, "castillo", "Primer Sello");
  const propio = poner(e, 0, "defensa", "Valefor");
  const debil = poner(e, 1, "defensa", "Valefor");
  const fuerte = poner(e, 1, "defensa", "Balaur");
  const sello = poner(e, 0, "mano", "Tercer Sello");
  e = hacer(e, jugar(sello), primer);
  assert.equal(zonaDe(e, primer), "mano");
  assert.equal(zonaDe(e, propio), "defensa");
  assert.equal(N.fuerza(e, propio), 0);
  assert.equal(zonaDe(e, debil), "castillo");
  assert.equal(N.fuerza(e, fuerte), 2);
});

test("Tercer Sello: los Aliados que entran hasta tu próximo turno pierden 3 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 3);
  const sello = poner(e, 0, "mano", "Tercer Sello");
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(sello)));
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(N.fuerza(e, v), 0);
  e.activo = 0;
  e.turno += 2;
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, v), 3);
});

test("Tercer Sello: los Aliados de Fuerza 0 no pueden disparar sus habilidades", () => {
  let e = mesa();
  oros(e, 0, 2);
  const disparadas = [{ cuando: ["comienzoVigilia"], quien: "yo", hacer: [{ op: "robar", n: 1, quien: "yo" }] }];
  ficticia(e, 0, "defensa", { fuerza: 3, disparadas });
  ficticia(e, 0, "defensa", { fuerza: 5, disparadas });
  const sello = poner(e, 0, "mano", "Tercer Sello");
  e = sinRespuesta(aplicar(e, jugar(sello)));
  const mano = e.jugadores[0].mano.length;
  N.disparar(e, "comienzoVigilia", { j: 0 });
  resolver(e);
  assert.equal(e.jugadores[0].mano.length, mano + 1);
});

test("Terremoto: un Aliado duplica su Fuerza y al atacar Botas tantas cartas como su Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Terremoto");
  e = sinRespuesta(aplicar(e, jugar(t)));
  assert.equal(N.fuerza(e, v), 6);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: v });
  assert.equal(e.jugadores[0].castillo.length, 24);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Terremoto: si el Aliado porta Anticucho triplica su Fuerza y Botas su Fuerza impresa", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Anticucho", { portador: v });
  const t = poner(e, 0, "mano", "Terremoto");
  const antes = N.fuerza(e, v);
  e = sinRespuesta(aplicar(e, jugar(t)));
  assert.equal(N.fuerza(e, v), 3 * antes);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: v });
  while (e.pendiente) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  assert.equal(e.jugadores[0].castillo.length, 27);
});

test("Terremoto: solo uno por turno y solo en tu Vigilia", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Valefor");
  const a = poner(e, 0, "mano", "Terremoto");
  const b = poner(e, 0, "mano", "Terremoto");
  e = sinRespuesta(aplicar(e, jugar(a)));
  assert.equal(puedeJugar(e, b), false);
  const f = mesa();
  oros(f, 0, 1);
  poner(f, 0, "defensa", "Valefor");
  const c = poner(f, 0, "mano", "Terremoto");
  f.fase = "talismanes";
  f.prioridad = 0;
  f.pases = 0;
  assert.equal(puedeJugar(f, c), false);
});

test("Terremoto: al bloquear también Botas tantas cartas como su Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const atacante = poner(e, 1, "defensa", "Daikaiju Furioso");
  const t = poner(e, 0, "mano", "Terremoto");
  e = elegir(sinRespuesta(aplicar(e, jugar(t))), v);
  assert.equal(N.fuerza(e, v), 6);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  e = aplicar(e, { tipo: "finAtaque" });
  const antes = e.jugadores[0].castillo.length;
  e = aplicar(e, { tipo: "bloquear", uid: v, atacante });
  assert.equal(e.jugadores[0].castillo.length, antes - 6);
});

test("Tierra del Fuego: cada jugador Baraja un Aliado de coste 1 o menos y pagas para Desterrar un Arma y Robar tres", () => {
  let e = mesa();
  oros(e, 0, 2);
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  const portador = poner(e, 1, "defensa", "Balaur");
  const martillo = poner(e, 1, "arma", "Martillo Sacro", { portador });
  const t = poner(e, 0, "mano", "Tierra del Fuego");
  e = hacer(e, jugar(t), texto("Cada jugador"), texto("Pagar un Oro: Desterrar"), texto("Pagar un Oro: Robar"));
  assert.equal(zonaDe(e, mio), "castillo");
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.equal(zonaDe(e, martillo), "destierro");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, t), "destierro");
});

test("Tierra del Fuego: sin Oros no se ofrecen los efectos que exigen pagar", () => {
  let e = mesa();
  const t = poner(e, 0, "mano", "Tierra del Fuego");
  e = sinRespuesta(aplicar(e, jugar(t)));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.texto), ["Cada jugador Baraja un Aliado de coste 1 o menos que controle", "listo"]);
});

test("Tifon de Huesos: Baraja y Destierra hasta cuatro de los Cementerios, Roba y al resolverse se Baraja y busca un Daikaiju", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = [1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  const kaiju = poner(e, 0, "castillo", "Daikaiju Furioso");
  const tifon = poner(e, 0, "mano", "Tifon de Huesos");
  e = hacer(e, jugar(tifon), c[0], null, c[1]);
  assert.equal(zonaDe(e, c[0]), "castillo");
  assert.equal(zonaDe(e, c[1]), "destierro");
  e = elegir(e, kaiju);
  assert.equal(zonaDe(e, kaiju), "mano");
  assert.equal(zonaDe(e, tifon), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Tifon de Huesos: si es Anulado queda en el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 4);
  const tifon = poner(e, 0, "mano", "Tifon de Huesos");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  e = responderCon(e, tifon, dorado);
  while (e.pendiente) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  assert.equal(zonaDe(e, tifon), "cementerio");
});

test("Tifon de Huesos: se puede jugar al comienzo de cualquier Fase", () => {
  assert.equal(enComienzoDeFase("Tifon de Huesos"), true);
});

test("Toma del Morro: Destierra una carta oponente y juega de tu Castillo una de igual o menor coste reduciéndola en un Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const rival = poner(e, 1, "defensa", "Valefor");
  const mio = poner(e, 0, "castillo", "Valefor");
  poner(e, 0, "castillo", "Balaur");
  const toma = poner(e, 0, "mano", "Toma del Morro");
  e = hacer(e, jugar(toma), mio);
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Balaur"), false);
  e = elegir(e, texto("Jugarla"));
  assert.equal(zonaDe(e, rival), "destierro");
  assert.equal(zonaDe(e, mio), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Toma del Morro: puede poner la carta buscada en tu mano y no puede ser Anulada", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 4);
  poner(e, 1, "mano", "Dragón Dorado");
  poner(e, 1, "defensa", "Balaur");
  const b = poner(e, 0, "castillo", "Balaur");
  const toma = poner(e, 0, "mano", "Toma del Morro");
  e = aplicar(e, jugar(toma));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
  e = sinRespuesta(e);
  e = elegir(e, b);
  e = elegir(e, texto("Ponerla"));
  assert.equal(zonaDe(e, b), "mano");
});

test("Toma del Morro: tiene Exhumar", () => {
  const e = mesa();
  oros(e, 0, 2);
  poner(e, 1, "defensa", "Valefor");
  const toma = poner(e, 0, "cementerio", "Toma del Morro");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === toma && a.desde === "cementerio"), true);
});

test("Transformacion: Roba una carta y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Transformacion");
  e = hacer(e, jugar(t), texto("Prevenir que"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, t), "destierro");
});

test("Transformacion: busca un Aliado en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "castillo", "Valefor");
  const t = poner(e, 0, "mano", "Transformacion");
  e = hacer(e, jugar(t), texto("Prevenir un efecto"), v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Transformacion: se juega en respuesta a que el oponente juegue una carta o utilice una habilidad", { todo: "respuesta: a que el oponente juegue una carta o utilice una habilidad, sin Anularla" }, () => {});

test("Transformacion: previene que una carta propia sea afectada o un efecto que te afectaría", { todo: "efecto: prevenir un efecto" }, () => {});

test("Transformación de Lucy: ganas el control de un Aliado del que eres dueño y Descartas tantas cartas como su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = ajena(e, 1, "defensa", "Balaur");
  const ajeno = poner(e, 1, "defensa", "Valefor");
  const mano = [1, 2, 3, 4].map(() => poner(e, 0, "mano", "Valefor"));
  const t = poner(e, 0, "mano", "Transformación de Lucy");
  e = hacer(e, jugar(t), texto("Ganar"), mano[0], mano[1], mano[2]);
  assert.equal(N.controlador(e, b), 0);
  assert.equal(N.controlador(e, ajeno), 1);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 3);
  assert.equal(zonaDe(e, t), "destierro");
});

test("Transformación de Lucy: al final del turno un Aliado gana 2 de Fuerza permanentemente e Indesterrable", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Transformación de Lucy");
  e = hacer(e, jugar(t), texto("Al final"));
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.tiene(e, v, "Indesterrable"), false);
  e = aplicar(e, { tipo: "terminar" });
  N.expirar(e, "finTurno");
  e.turno += 3;
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
});

for (const nombre of ["Trempulcahue", "Trempulcahue Bestiarium"]) {
  test(`${nombre}: Anula una carta de coste 2 o menos y Barajas una carta de tu mano`, () => {
    let e = mesa();
    oros(e, 0, 1);
    oros(e, 1, 1);
    const v = poner(e, 0, "mano", "Valefor");
    const t = poner(e, 1, "mano", nombre);
    const x = poner(e, 1, "mano", "Balaur");
    e = responderCon(e, v, t);
    assert.equal(zonaDe(e, v), "cementerio");
    assert.equal(zonaDe(e, x), "castillo");
    assert.equal(zonaDe(e, t), "cementerio");
  });

  test(`${nombre}: no Anula cartas de coste 3 o más`, () => {
    let e = mesa();
    oros(e, 0, 3);
    oros(e, 1, 1);
    const b = poner(e, 0, "mano", "Balaur");
    const t = poner(e, 1, "mano", nombre);
    e = aplicar(e, jugar(b));
    assert.equal(puedeResponder(e, t), false);
  });

  test(`${nombre}: Barajar la carta de la mano es un coste que se paga al jugarlo`, { todo: "coste adicional: Barajar una carta de la mano al jugar un Talismán (se paga aunque sea Anulado)" }, () => {});
}

test("Tripulación Maldita: solo se juega con siete o más cartas en el Cementerio oponente", () => {
  const e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Tripulación Maldita");
  for (let i = 0; i < 6; i++) poner(e, 1, "cementerio", "Valefor");
  assert.equal(puedeJugar(e, t), false);
  poner(e, 1, "cementerio", "Valefor");
  assert.equal(puedeJugar(e, t), true);
});

test("Tripulación Maldita: si la carta al azar es la nombrada, la juegas reduciendo su coste en dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const cem = Array.from({ length: 7 }, () => poner(e, 1, "cementerio", "Valefor"));
  const t = poner(e, 0, "mano", "Tripulación Maldita");
  e = hacer(e, jugar(t), cem[0]);
  const jugada = cem.find((u) => zonaDe(e, u) === "defensa");
  assert.ok(jugada);
  assert.equal(N.controlador(e, jugada), 0);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Tripulación Maldita: si no es la nombrada Robas dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  for (let i = 0; i < 7; i++) poner(e, 1, "cementerio", "Drácula");
  const nombrada = poner(e, 0, "mano", "Valefor");
  const t = poner(e, 0, "mano", "Tripulación Maldita");
  e = hacer(e, jugar(t), nombrada);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[1].cementerio.length, 7);
});

test("Tumulto Voraz: muestra cartas hasta un Oro y lo pone en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = alTope(e, 0, "Valefor");
  const oro = e.jugadores[0].castillo[1];
  const t = poner(e, 0, "mano", "Tumulto Voraz");
  e = sinRespuesta(aplicar(e, jugar(t)));
  assert.equal(zonaDe(e, oro), "pagado");
  assert.equal(zonaDe(e, v), "castillo");
});

test("Tumulto Voraz: al buscar en el Castillo oponente, el oponente Destierra una carta del tope", { todo: "evento: cuando buscas cartas en el Castillo oponente" }, () => {});

test("Un Nuevo Guardián: muestra hasta una carta de cada tipo que no sea Talismán, las pone en tu mano y Baraja", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "castillo", "Valefor");
  const m = poner(e, 0, "castillo", "Martillo Sacro");
  const f = poner(e, 0, "castillo", "Fortaleza Hoshi");
  const ng = poner(e, 0, "mano", "Un Nuevo Guardián");
  e = sinRespuesta(aplicar(e, jugar(ng)));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, m), "mano");
  assert.equal(zonaDe(e, f), "mano");
  assert.equal(e.jugadores[0].mano.length, 4);
});

test("Un Nuevo Guardián: Desterrarlo de tu Cementerio cancela el ataque de un Aliado oponente", () => {
  let e = mesa();
  const ng = poner(e, 1, "cementerio", "Un Nuevo Guardián");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: v });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  assert.equal(puedeUsar(e, ng), true);
  e = hacer(e, habilidad(ng, "Un Nuevo Guardián"), texto("Cancelar"));
  assert.equal(zonaDe(e, ng), "destierro");
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.atacantes.length, 0);
});

test("Un Nuevo Guardián: Desterrarlo de tu Cementerio Baraja hasta dos cartas de un Cementerio", () => {
  let e = mesa();
  const ng = poner(e, 0, "cementerio", "Un Nuevo Guardián");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(ng, "Un Nuevo Guardián"), texto("Barajar hasta dos cartas del Cementerio oponente"), a, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, ng), "destierro");
});

test("Union Espacial: los Aliados de Fuerza 4 o más pierden su habilidad y son Barajados", () => {
  let e = mesa();
  oros(e, 0, 2);
  const balaur = poner(e, 1, "defensa", "Balaur");
  const kaiju = poner(e, 0, "defensa", "Daikaiju Furioso");
  const v = poner(e, 1, "defensa", "Valefor");
  const u = poner(e, 0, "mano", "Union Espacial");
  e = sinRespuesta(aplicar(e, jugar(u)));
  assert.equal(zonaDe(e, balaur), "castillo");
  assert.equal(zonaDe(e, kaiju), "castillo");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Union Espacial: desde tu Cementerio los jugadores atacan con hasta tantos Aliados como Oros controlen", { todo: "restricción desde el Cementerio: cada jugador ataca con hasta tantos Aliados como Oros controle" }, () => {});
