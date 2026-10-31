import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { limiteArmas } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const oro = (uid) => ({ tipo: "oro", uid });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeUsar = (e, uid, h) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && (h === undefined || a.h === h));
const nombres = (e, lista) => lista.map((u) => N.carta(e, u).nombre);

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  N.sacar(e, uid);
  e.jugadores[j].castillo.unshift(uid);
  return uid;
}

function aGuerra(e, atacante) {
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  e = aplicar(e, { tipo: "finAtaque" });
  return aplicar(e, { tipo: "finBloqueo" });
}

test("Don de Belial: al entrar en juego busca un Oro en tu Castillo y lo pone en tu mano", () => {
  let e = mesa();
  const don = poner(e, 0, "mano", "Don de Belial");
  e = hacer(e, oro(don), nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, don), "reserva");
  assert.deepEqual(nombres(e, e.jugadores[0].mano), ["Drácula"]);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Don de Belial: pagándolo y convirtiéndolo en Oro sin habilidad sube otro Oro a la mano y pone un Oro de la mano en el Oro Pagado", () => {
  let e = mesa();
  const don = poner(e, 0, "reserva", "Don de Belial");
  const [d] = oros(e, 0, 1);
  const h = poner(e, 0, "mano", "Huitzilin");
  e = hacer(e, habilidad(don, "Don de Belial"), h);
  assert.equal(zonaDe(e, don), "pagado");
  assert.equal(N.carta(e, don).sinHabilidad, true);
  assert.equal(zonaDe(e, d), "mano");
  assert.equal(zonaDe(e, h), "pagado");
});

test("Don de Belial: no puede usarse si no controlas otro Oro", () => {
  const e = mesa();
  const don = poner(e, 0, "reserva", "Don de Belial");
  assert.equal(puedeUsar(e, don), false);
});

test("Dulce Canasta: al entrar busca un Oro en tu Castillo o Cementerio", () => {
  let e = mesa();
  const canasta = poner(e, 0, "mano", "Dulce Canasta");
  const h = poner(e, 0, "cementerio", "Huitzilin");
  e = hacer(e, oro(canasta), h);
  assert.equal(zonaDe(e, h), "mano");
});

test("Dulce Canasta: una vez por turno un Aliado gana o pierde 2 de Fuerza permanentemente", () => {
  let e = mesa();
  const canasta = poner(e, 0, "reserva", "Dulce Canasta");
  const v = poner(e, 0, "defensa", "Valefor");
  e = hacer(e, habilidad(canasta, "Dulce Canasta"), texto("Gana"));
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(e.efectos.find((f) => f.uid === v).fin.mientras, true);
  assert.equal(puedeUsar(e, canasta), false);
  const r = poner(e, 1, "defensa", "Valefor");
  e.usos = {};
  e = hacer(e, habilidad(canasta, "Dulce Canasta"), r, texto("Pierde"));
  assert.equal(N.fuerza(e, r), 1);
});

test("Dulce Canasta: en tu Reserva los Aliados de coste 1 o menos no pueden ser Desterrados", () => {
  const e = mesa();
  const canasta = poner(e, 0, "reserva", "Dulce Canasta");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Guardia Real");
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
  assert.equal(N.tiene(e, g, "Indesterrable"), false);
  N.mover(e, canasta, "pagado");
  assert.equal(N.tiene(e, v, "Indesterrable"), false);
});

test("El Cuervo y Otros Poemas: al entrar puedes mostrar hasta un Aliado o Tótem de coste 1 y ponerlo en tu mano", () => {
  let e = mesa();
  const cuervo = poner(e, 0, "mano", "El Cuervo y Otros Poemas");
  const v = alTope(e, 0, "Valefor");
  const g = alTope(e, 0, "Guardia Real");
  e = hacer(e, oro(cuervo), true);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, g), "castillo");
});

test("El Cuervo y Otros Poemas: Desterrando un Oro que controles Destruye una carta de coste 2 o menos", () => {
  let e = mesa();
  const cuervo = poner(e, 0, "reserva", "El Cuervo y Otros Poemas");
  const v = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(cuervo, "El Cuervo y Otros Poemas"));
  assert.equal(zonaDe(e, cuervo), "destierro");
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(puedeUsar(e, cuervo), false);
});

test("El Démeter: al entrar muestra hasta un Aliado de coste 2 o menos y lo pone en tu mano", () => {
  let e = mesa();
  const demeter = poner(e, 0, "mano", "El Démeter");
  const v = alTope(e, 0, "Valefor");
  const g = alTope(e, 0, "Sir Galahad");
  e = aplicar(e, oro(demeter));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, g), "castillo");
});

test("El Démeter: una vez por turno elige un Aliado que debe bloquear este turno si puede", () => {
  let e = mesa();
  const demeter = poner(e, 0, "reserva", "El Démeter");
  const r = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(demeter, "El Démeter"));
  assert.equal(e.efectos.some((f) => f.tipo === "debeBloquear" && f.uid === r), true);
  assert.equal(puedeUsar(e, demeter), false);
});

test("El Démeter: en tu Reserva el ataque de tus Aliados no puede ser cancelado", () => {
  let e = mesa();
  poner(e, 0, "reserva", "El Démeter");
  const v = poner(e, 0, "defensa", "Valefor");
  const flor = poner(e, 1, "reserva", "Flor de Lis");
  poner(e, 1, "mano", "Drácula");
  assert.equal(N.tiene(e, v, "AtaqueNoCancelable"), true);
  e = aGuerra(e, v);
  e = hacer(e, habilidad(flor, "Flor de Lis"), v);
  assert.equal(zonaDe(e, v), "ataque");
});

test("El Mundo Perdido: tus Aliados pueden portar hasta dos Armas", () => {
  const e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(limiteArmas(e, v), 1);
  poner(e, 0, "reserva", "El Mundo Perdido");
  assert.equal(limiteArmas(e, v), 2);
});

test("El Mundo Perdido: las dos Armas deben tener distinto nombre", { todo: "límite de Armas: el Arma adicional debe tener distinto nombre" }, () => {});

test("El Mundo Perdido: cuando el oponente Anula tu Aliado, mostrando un Arma lo pones en juego como Aliado sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "pagado", "El Mundo Perdido");
  const martillo = poner(e, 0, "mano", "Martillo Sacro");
  const v = poner(e, 0, "mano", "Valefor");
  oros(e, 1, 1);
  const espada = poner(e, 1, "mano", "Espada Vikinga");
  e = aplicar(e, jugar(v));
  e = aplicar(e, { tipo: "responder", uid: espada });
  e = elegir(e, true);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.carta(e, v).sinHabilidad, true);
  assert.equal(zonaDe(e, martillo), "mano");
});

test("El Ultimo Hombre: por cada Aliado entre las tres primeras cartas de tu Castillo un Aliado gana 1 de Fuerza permanentemente", () => {
  let e = mesa();
  const hombre = poner(e, 0, "reserva", "El Ultimo Hombre");
  const v = poner(e, 0, "defensa", "Valefor");
  alTope(e, 0, "Guardia Real");
  alTope(e, 0, "Valefor");
  const antes = [...e.jugadores[0].castillo];
  e = aplicar(e, habilidad(hombre, "El Ultimo Hombre"));
  assert.equal(N.fuerza(e, v), 5);
  assert.deepEqual(e.jugadores[0].castillo, antes);
  assert.equal(puedeUsar(e, hombre), false);
});

test("Embrion Titán: al ponerlo sube otro Oro de tu Reserva a la mano y luego Robas dos cartas", () => {
  let e = mesa();
  const [d] = oros(e, 0, 1);
  const titan = poner(e, 0, "mano", "Embrion Titán");
  e = hacer(e, oro(titan), texto("Robar dos"));
  assert.equal(zonaDe(e, d), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Embrion Titán: o busca en tu Castillo una carta que no sea Talismán", () => {
  let e = mesa();
  const titan = poner(e, 0, "mano", "Embrion Titán");
  const g = poner(e, 0, "castillo", "Guardia Real");
  poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, oro(titan));
  e = elegir(e, texto("Buscar"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).tipo === "Talismán"), false);
  e = elegir(e, g);
  assert.equal(zonaDe(e, g), "mano");
});

test("Embrion Titán: no puede ser afectado por efectos en ninguna Zona", { todo: "protección: carta que no puede ser afectada por efectos en ninguna Zona" }, () => {});

test("Embrion Titán: al pagar un coste cuenta como dos Oros", { todo: "pago: un Oro que cuenta como dos Oros al pagar un coste" }, () => {});

test("Embrion Titán: subir un Oro de la Reserva es requisito para ponerlo en juego", { todo: "coste de Oro: requisito adicional para poner un Oro en juego" }, () => {});

test("Empanada: al entrar puedes buscar una Empanada en tu Castillo", () => {
  let e = mesa();
  const emp = poner(e, 0, "mano", "Empanada");
  const otra = poner(e, 0, "castillo", "Empanada");
  e = hacer(e, oro(emp), true, otra);
  assert.equal(zonaDe(e, otra), "mano");
});

test("Empanada: una vez por turno Descartas una carta para Robar una carta", () => {
  let e = mesa();
  const emp = poner(e, 0, "reserva", "Empanada");
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(emp, "Empanada"));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeUsar(e, emp), false);
});

test("Empanada: si controlas Pebre tus Aliados ganan 1 de Fuerza e Imbloqueable", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Empanada");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.tiene(e, v, "Imbloqueable"), false);
  poner(e, 0, "reserva", "Pebre");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
  assert.equal(N.fuerza(e, r), 3);
});

test("En las Montañas de la Locura: Barajándolo muestras cuatro cartas, pones los Aliados en tu mano y Barajas el resto", () => {
  let e = mesa();
  const m = poner(e, 0, "reserva", "En las Montañas de la Locura");
  e.jugadores[0].castillo = [];
  for (let i = 0; i < 4; i++) poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, habilidad(m, "En las Montañas de la Locura"));
  const mano = e.jugadores[0].mano;
  assert.ok(mano.length >= 3);
  assert.equal(mano.every((u) => N.carta(e, u).tipo === "Aliado"), true);
  assert.equal(mano.length + e.jugadores[0].castillo.length, 5);
  assert.equal(zonaDe(e, m), "castillo");
});

test("En las Montañas de la Locura: cuando el oponente afecta a tus Aliados Destierra dos cartas del tope de su Castillo", { todo: "disparo: cuando el oponente afecte a Aliados que controles" }, () => {});

test("Escamas de Azi: Descartando una carta buscas una carta Azi en tu Castillo", () => {
  let e = mesa();
  const esc = poner(e, 0, "reserva", "Escamas de Azi");
  const v = poner(e, 0, "mano", "Valefor");
  const azi = poner(e, 0, "castillo", "Azi Dahaka");
  e = aplicar(e, habilidad(esc, "Escamas de Azi"));
  e = elegir(e, texto("Descartar"));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [azi, null]);
  e = elegir(e, azi);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, azi), "mano");
  assert.equal(puedeUsar(e, esc), false);
});

test("Escamas de Azi: o Botando tres cartas", () => {
  let e = mesa();
  const esc = poner(e, 0, "reserva", "Escamas de Azi");
  const azi = poner(e, 0, "castillo", "Azi Dahaka");
  e = hacer(e, habilidad(esc, "Escamas de Azi"), texto("Botar"), azi);
  assert.equal(e.jugadores[0].cementerio.length, 3);
  assert.equal(zonaDe(e, azi), "mano");
});

test("Escamas de Azi: en tu Fase Final Destierras o Barajas hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Escamas de Azi");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, { tipo: "terminar" }, a, b, "Desterrar");
  assert.deepEqual([a, b, c].map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
});

test("Escamas de Azi: los Aliados Azi y los Oros ganan Indesterrable", { todo: "continua: ganar una clave filtrando por nombre y aplicada también a Oros" }, () => {});

test("Escamas de Dragón: al entrar cada jugador Bota tres cartas y tú Robas una", () => {
  let e = mesa();
  const esc = poner(e, 0, "mano", "Escamas de Dragón");
  e = aplicar(e, oro(esc));
  assert.equal(e.jugadores[0].cementerio.length, 3);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 26);
});

test("Escamas de Dragón: en tu Vigilia Descartas una carta para poner una carta de tu Castillo en tu Cementerio", () => {
  let e = mesa();
  const esc = poner(e, 0, "reserva", "Escamas de Dragón");
  const v = poner(e, 0, "mano", "Valefor");
  const g = poner(e, 0, "castillo", "Guardia Real");
  e = hacer(e, habilidad(esc, "Escamas de Dragón"), g);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(puedeUsar(e, esc), false);
});

test("Escarapela Nacional: al comienzo de la Vigilia oponente, si no controlas más Oros, la pones en juego y no puedes poner Oros en tu próximo turno", () => {
  let e = mesa();
  const esc = poner(e, 0, "mano", "Escarapela Nacional");
  oros(e, 1, 1);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = elegir(e, true);
  e = elegir(e, texto("Robar dos"));
  assert.equal(zonaDe(e, esc), "reserva");
  assert.equal(e.jugadores[0].mano.length, 3);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 0);
  assert.equal(e.jugadores[0].mano.some((u) => N.carta(e, u).tipo === "Oro"), true);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "oro"), false);
});

test("Escarapela Nacional: no se pone si controlas más Oros que tu oponente", () => {
  let e = mesa();
  const esc = poner(e, 0, "mano", "Escarapela Nacional");
  oros(e, 0, 1);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, esc), "mano");
});

test("Escarapela Nacional: al entrar puede buscar un Aliado u Oro en tu Castillo", () => {
  let e = mesa();
  const esc = poner(e, 0, "mano", "Escarapela Nacional");
  const g = poner(e, 0, "castillo", "Guardia Real");
  e = hacer(e, oro(esc), texto("Buscar"), g);
  assert.equal(zonaDe(e, g), "mano");
});

test("Escritura Sagrada: al entrar puedes poner los Oros mostrados en el fondo de tu Castillo", () => {
  let e = mesa();
  const esc = poner(e, 0, "mano", "Escritura Sagrada");
  const v = alTope(e, 0, "Valefor");
  const h = alTope(e, 0, "Huitzilin");
  e = hacer(e, oro(esc), h);
  assert.equal(e.jugadores[0].castillo.at(-1), h);
  assert.equal(e.jugadores[0].castillo[0], v);
});

test("Escritura Sagrada: juega mostrando las dos primeras cartas y puedes jugarlas pagando su coste por el turno", { todo: "zona de juego: jugar cartas desde el tope del Castillo pagando su coste por el turno" }, () => {});

test("Escritura Sagrada: subiéndolo a tu mano previenes recibir daño", () => {
  let e = mesa();
  const esc = poner(e, 0, "reserva", "Escritura Sagrada");
  e = aplicar(e, habilidad(esc, "Escritura Sagrada", 0));
  assert.equal(zonaDe(e, esc), "mano");
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano" && f.j === 0 && f.unaVez), true);
});

test("Escritura Sagrada: convirtiéndolo en un Oro sin habilidad previenes recibir daño", () => {
  let e = mesa();
  const esc = poner(e, 1, "reserva", "Escritura Sagrada");
  const g = poner(e, 0, "defensa", "Guardia Real");
  e = aGuerra(e, g);
  e = aplicar(e, habilidad(esc, "Escritura Sagrada", 1));
  assert.equal(zonaDe(e, esc), "reserva");
  assert.equal(N.carta(e, esc).sinHabilidad, true);
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Escritura Sagrada: se usa en respuesta a ir a recibir daño", { todo: "respuesta: al ir a recibir daño, usar la habilidad para prevenirlo" }, () => {});

test("Escudo Nacional: al entrar busca una copia en tu Castillo", () => {
  let e = mesa();
  const esc = poner(e, 0, "mano", "Escudo Nacional");
  const otra = poner(e, 0, "castillo", "Escudo Nacional");
  e = hacer(e, oro(esc), otra);
  assert.equal(zonaDe(e, otra), "mano");
});

test("Escudo Nacional: en tu Vigilia pagas tres Escudo Nacional para jugar un Aliado de tu mano sin pagar su coste", () => {
  let e = mesa();
  const esc = [1, 2, 3].map(() => poner(e, 0, "reserva", "Escudo Nacional"));
  const g = poner(e, 0, "mano", "Guardia Real");
  e = sinRespuesta(aplicar(e, habilidad(esc[0], "Escudo Nacional")));
  assert.deepEqual(esc.map((u) => zonaDe(e, u)), ["pagado", "pagado", "pagado"]);
  assert.equal(zonaDe(e, g), "defensa");
});

test("Escudo Nacional: no se usa con menos de tres copias en tu Reserva", () => {
  const e = mesa();
  const esc = [1, 2].map(() => poner(e, 0, "reserva", "Escudo Nacional"));
  poner(e, 0, "mano", "Guardia Real");
  assert.equal(puedeUsar(e, esc[0]), false);
});

test("Escudo Nacional: puedes tener más de tres copias en tu Castillo", { todo: "construcción de mazo: carta sin límite de copias" }, () => {});

test("Escudo de Vlad III: al entrar muestra hasta un Aliado y un Oro, pone uno en tu mano y Baraja el resto", () => {
  let e = mesa();
  const vlad = poner(e, 0, "mano", "Escudo de Vlad III");
  const v = alTope(e, 0, "Valefor");
  e = hacer(e, oro(vlad), v);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Escudo de Vlad III: una vez por turno, cuando una carta es puesta en un Cementerio, puedes Desterrarla", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "reserva", "Escudo de Vlad III");
  const manada = poner(e, 0, "mano", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(manada)));
  e = elegir(e, true);
  assert.equal(zonaDe(e, manada), "destierro");
  const v = poner(e, 0, "mano", "Valefor");
  N.mover(e, v, "cementerio");
  assert.equal(e.cola.length, 0);
});

test("Escudo de Vlad III: los Aliados en juego pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Escudo de Vlad III");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.fuerza(e, r), 2);
});

test("Espada Ceremonial: al entrar Barajas hasta dos cartas de tu Cementerio y Robas una", () => {
  let e = mesa();
  const esp = poner(e, 0, "mano", "Espada Ceremonial");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, oro(esp), a, b);
  assert.equal(e.jugadores[0].cementerio.length, 0);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("Espada Ceremonial: sin Oros en tu Reserva tus Aliados ganan 1 de Fuerza cuando bloquean", () => {
  const e = mesa();
  poner(e, 0, "pagado", "Espada Ceremonial");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "ataque", "Valefor");
  assert.equal(N.fuerza(e, v), 3);
  e.bloqueos[v] = r;
  assert.equal(N.fuerza(e, v), 4);
  oros(e, 0, 1);
  assert.equal(N.fuerza(e, v), 3);
});

test("Espada Ceremonial: sin Oros en tu Reserva tus Aliados pueden bloquear Aliados Imbloqueables", { todo: "bloqueo: permitir bloquear Aliados Imbloqueables" }, () => {});

test("Espejo Magico: al entrar Robas una carta", () => {
  let e = mesa();
  const esp = poner(e, 0, "mano", "Espejo Magico");
  e = aplicar(e, oro(esp));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Espejo Magico: una vez por turno pagas un Oro para buscar una carta que no sea Talismán", () => {
  let e = mesa();
  const [d] = oros(e, 0, 1);
  const esp = poner(e, 0, "reserva", "Espejo Magico");
  const g = poner(e, 0, "castillo", "Guardia Real");
  e = hacer(e, habilidad(esp, "Espejo Magico"), g);
  assert.equal(zonaDe(e, g), "mano");
  assert.equal(zonaDe(e, d), "pagado");
  assert.equal(puedeUsar(e, esp), false);
});

test("Espíritu de la Máquina: al entrar, si no es tu primer turno, genera un Oro para Armas o Tótem", () => {
  let e = mesa();
  e.turno = 4;
  const esp = poner(e, 0, "mano", "Espíritu de la Máquina");
  e = aplicar(e, oro(esp));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma", "Tótem"] }]);
});

test("Espíritu de la Máquina: en tu primer turno no genera Oro", () => {
  let e = mesa();
  const esp = poner(e, 0, "mano", "Espíritu de la Máquina");
  e = aplicar(e, oro(esp));
  assert.equal((e.jugadores[0].generados ?? []).length, 0);
});

test("Espíritu de la Máquina: una vez por turno Barajas o Destierras una carta de un Cementerio", () => {
  let e = mesa();
  const esp = poner(e, 0, "reserva", "Espíritu de la Máquina");
  const r = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(esp, "Espíritu de la Máquina"), "Desterrar");
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(puedeUsar(e, esp), false);
});

test("Estandarte del Guerrero: al entrar Robas una carta", () => {
  let e = mesa();
  const est = poner(e, 0, "mano", "Estandarte del Guerrero");
  e = aplicar(e, oro(est));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Estandarte del Guerrero: pagándolo buscas dos cartas en cada Castillo y las pones en el Cementerio", () => {
  let e = mesa();
  const est = poner(e, 0, "reserva", "Estandarte del Guerrero");
  e = aplicar(e, habilidad(est, "Estandarte del Guerrero"));
  for (let i = 0; i < 4; i++) e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, est), "pagado");
  assert.equal(e.jugadores[0].cementerio.length, 2);
  assert.equal(e.jugadores[1].cementerio.length, 2);
});

test("Estandarte del Guerrero: en tu Reserva, las cartas puestas en el Cementerio por daño de combate no tienen habilidad por el turno", () => {
  let e = mesa();
  poner(e, 1, "reserva", "Estandarte del Guerrero");
  const onsen = alTope(e, 1, "Onsen");
  poner(e, 0, "defensa", "Ileana");
  const g = poner(e, 0, "defensa", "Guardia Real");
  e = aGuerra(e, g);
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.fase, "finalizando");
  assert.equal(zonaDe(e, onsen), "cementerio");
  assert.equal(N.carta(e, onsen).sinHabilidad, true);
  assert.equal(N.activa(e, onsen), false);
});

test("Estrella de Kirin: al entrar muestra hasta un Oro y un Arma o Tótem y los pone en tu mano", () => {
  let e = mesa();
  const est = poner(e, 0, "mano", "Estrella de Kirin");
  const m = alTope(e, 0, "Martillo Sacro");
  const v = alTope(e, 0, "Valefor");
  e = aplicar(e, oro(est));
  assert.equal(zonaDe(e, m), "mano");
  assert.equal(zonaDe(e, v), "castillo");
  assert.deepEqual(nombres(e, e.jugadores[0].mano).sort(), ["Drácula", "Martillo Sacro"]);
});

test("Estrella de Kirin: pagándola y convirtiéndola en Oro sin habilidad, un Oro o carta de coste 2 o menos queda sin habilidad", () => {
  let e = mesa();
  const est = poner(e, 0, "reserva", "Estrella de Kirin");
  const onsen = poner(e, 1, "reserva", "Onsen");
  e = aplicar(e, habilidad(est, "Estrella de Kirin"));
  assert.equal(zonaDe(e, est), "pagado");
  assert.equal(N.carta(e, est).sinHabilidad, true);
  assert.equal(N.carta(e, onsen).sinHabilidad, true);
  assert.equal(N.carta(e, onsen).tipo, "Oro");
});

test("Flor de Lis: al entrar muestra hasta un Oro, lo pone en tu mano y Baraja el resto", () => {
  let e = mesa();
  const flor = poner(e, 0, "mano", "Flor de Lis");
  const v = alTope(e, 0, "Valefor");
  e = aplicar(e, oro(flor));
  assert.deepEqual(nombres(e, e.jugadores[0].mano), ["Drácula"]);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Flor de Lis: Descartando un Oro cancelas el ataque de hasta dos Aliados de coste 2 o menos", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const flor = poner(e, 1, "reserva", "Flor de Lis");
  const d = poner(e, 1, "mano", "Drácula");
  e = aGuerra(e, v);
  e = hacer(e, habilidad(flor, "Flor de Lis"), v);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, v), "defensa");
  assert.deepEqual(e.atacantes, []);
});

test("Flor de Lis: no se usa sin un Oro en tu mano", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const flor = poner(e, 1, "reserva", "Flor de Lis");
  e = aGuerra(e, v);
  assert.equal(puedeUsar(e, flor), false);
});

for (const nombre of ["Frankenstein o el Moderno Prometeo", "Frankenstein o el Nuevo Prometeo"]) {
  test(`${nombre}: en tu turno, pagándolo y Barajando una carta de tu mano, un Oro o carta de coste 2 o menos pierde su habilidad`, () => {
    let e = mesa();
    const f = poner(e, 0, "reserva", nombre);
    const v = poner(e, 0, "mano", "Valefor");
    const onsen = poner(e, 1, "reserva", "Onsen");
    e = hacer(e, habilidad(f, nombre, 0), onsen);
    assert.equal(zonaDe(e, f), "pagado");
    assert.equal(zonaDe(e, v), "castillo");
    assert.equal(N.activa(e, onsen), false);
  });

  test(`${nombre}: una vez por turno Descartas una carta para que una carta pierda su habilidad por el turno`, () => {
    let e = mesa();
    const f = poner(e, 0, "pagado", nombre);
    const v = poner(e, 0, "mano", "Valefor");
    const r = poner(e, 1, "defensa", "Ileana");
    e = hacer(e, habilidad(f, nombre, 1), r);
    assert.equal(zonaDe(e, v), "cementerio");
    assert.equal(N.activa(e, r), false);
    assert.equal(N.tiene(e, r, "Indestructible"), false);
    assert.equal(puedeUsar(e, f, 1), false);
  });
}

test("Fuente de la Juventud: al entrar Robas dos cartas", () => {
  let e = mesa();
  const f = poner(e, 0, "mano", "Fuente de la Juventud");
  e = aplicar(e, oro(f));
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Fuente de la Juventud: jugar Talismanes cuesta un Oro más a quien ya jugó Talismanes este turno", { todo: "impuesto: Oro adicional por tipo para el jugador que ya jugó ese tipo este turno" }, () => {});

test("Fuente de la Juventud: poner Oros cuesta un Oro más a quien ya puso Oros este turno", { todo: "impuesto: coste adicional para poner Oros en juego" }, () => {});

test("Garrote Vil: al entrar muestra hasta un Tótem y un Oro, los pone en tu mano y Baraja el resto", () => {
  let e = mesa();
  const g = poner(e, 0, "mano", "Garrote Vil");
  const t = alTope(e, 0, "Abadía de Carfax");
  const v = alTope(e, 0, "Valefor");
  e = aplicar(e, oro(g));
  assert.equal(zonaDe(e, t), "mano");
  assert.equal(zonaDe(e, v), "castillo");
  assert.deepEqual(nombres(e, e.jugadores[0].mano).sort(), ["Abadía de Carfax", "Drácula"]);
});

test("Garrote Vil: convirtiéndolo en Oro sin habilidad Barajas o Destierras hasta cuatro cartas de los Cementerios", () => {
  let e = mesa();
  const g = poner(e, 0, "reserva", "Garrote Vil");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(g, "Garrote Vil"), a, b, "Desterrar");
  assert.equal(N.carta(e, g).sinHabilidad, true);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(puedeUsar(e, g), false);
});
