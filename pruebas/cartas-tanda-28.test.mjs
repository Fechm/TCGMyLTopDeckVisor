import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { disponibles } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const usable = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);

function resolverTodo(e) {
  for (let i = 0; i < 40 && e.pendiente; i++) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  return e;
}

function combate(e, atacantes) {
  e = aplicar(e, { tipo: "batalla" });
  for (const a of atacantes) e = resolverTodo(aplicar(e, { tipo: "atacar", uid: a }));
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

test("Ciudad Sin Nombre: una vez por turno un Aliado gana 5 de Fuerza", () => {
  let e = mesa();
  const ciudad = poner(e, 0, "apoyo", "Ciudad Sin Nombre");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(ciudad, "Ciudad Sin Nombre", 0));
  assert.equal(N.fuerza(e, v), 8);
  assert.equal(usable(e, ciudad, 0), false);
});

test("Ciudad Sin Nombre: Descartar dos cartas para subir una carta del Cementerio a la mano", () => {
  let e = mesa();
  const ciudad = poner(e, 0, "apoyo", "Ciudad Sin Nombre");
  const a = poner(e, 0, "mano", "Valefor");
  const b = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 0, "cementerio", "Sir Persival");
  e = hacer(e, habilidad(ciudad, "Ciudad Sin Nombre", 1), p);
  assert.equal(zonaDe(e, p), "mano");
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, b), "cementerio");
});

test("Ciudad de los Cesares: al entrar Baraja hasta una carta oponente de coste 3 o menos y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Ciudad de los Cesares");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Gusano Rojo");
  e = hacer(e, jugar(c), v);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Ciudad de los Cesares: Barajar una carta de tu mano para Desterrar una carta de coste 1 o menos", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Ciudad de los Cesares");
  const m = poner(e, 0, "mano", "Sir Persival");
  const v = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(c, "Ciudad de los Cesares"));
  assert.equal(zonaDe(e, m), "castillo");
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(usable(e, c), false);
});

const respuestasDe = (e, uid) => accionesLegales(e).filter((a) => a.tipo === "responder" && a.uid === uid).map((a) => a.h);

test("Ciudad de los Cesares: Barajar una carta de la mano para Anular una carta de coste 1 o menos", () => {
  let e = mesa();
  const c = poner(e, 1, "apoyo", "Ciudad de los Cesares");
  const m = poner(e, 1, "mano", "Sir Persival");
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  assert.deepEqual(respuestasDe(e, c), [1]);
  e = resolverTodo(aplicar(e, { tipo: "responder", uid: c, def: id("Ciudad de los Cesares"), h: 1 }));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, m), "castillo");
});

test("Ciudad de los Cesares: pagar un Oro para Anular una carta de coste 2 o más, una vez por turno", () => {
  let e = mesa();
  const c = poner(e, 1, "apoyo", "Ciudad de los Cesares");
  oros(e, 1, 1);
  oros(e, 0, 3);
  const g = poner(e, 0, "mano", "Guardia Real");
  e = aplicar(e, jugar(g));
  assert.deepEqual(respuestasDe(e, c), [2]);
  e = resolverTodo(aplicar(e, { tipo: "responder", uid: c, def: id("Ciudad de los Cesares"), h: 2 }));
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(e.jugadores[1].reserva.length, 0);
  poner(e, 1, "mano", "Sir Persival");
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  assert.deepEqual(respuestasDe(e, c), []);
});

test("Ciudadela Furia: Baraja un Aliado oponente y Descartas tantas cartas como su coste", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Ciudadela Furia");
  const p = poner(e, 1, "defensa", "Sir Persival");
  for (let i = 0; i < 4; i++) poner(e, 0, "mano", "Valefor");
  e = resolverTodo(aplicar(e, habilidad(c, "Ciudadela Furia")));
  assert.equal(zonaDe(e, p), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 3);
});

test("Ciudadela Furia: no puede ser Barajada", () => {
  const e = mesa();
  const c = poner(e, 0, "apoyo", "Ciudadela Furia");
  assert.equal(N.tiene(e, c, "NoBarajable"), true);
});

test("Ciudadela Furia: al comienzo de la Vigilia oponente, sin Oros en Reserva, agrupa un Oro", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Ciudadela Furia");
  const o = poner(e, 0, "pagado", "Drácula");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = elegir(e, true);
  assert.equal(zonaDe(e, o), "reserva");
});

test("Cueva de Montesinos: al entrar Robas dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Cueva de Montesinos");
  e = aplicar(e, jugar(c));
  assert.equal(zonaDe(e, c), "apoyo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Cueva de Montesinos: Destruirla para que el oponente Bote cuatro cartas", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Montesinos");
  e = hacer(e, habilidad(c, "Cueva de Montesinos"), "Tu oponente Bota cuatro cartas");
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 4);
});

test("Cueva de Montesinos: Destruirla para que el oponente Descarte una carta", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Montesinos");
  const x = poner(e, 1, "mano", "Valefor");
  e = hacer(e, habilidad(c, "Cueva de Montesinos"), "Tu oponente Descarta una carta");
  assert.equal(zonaDe(e, x), "cementerio");
});

test("Cueva de Montesinos: vuelve a la mano cuando el oponente va a afectar Cementerios", { todo: "reacción: subir esta carta del Cementerio a la mano cuando el oponente vaya a Barajar o Desterrar cartas de un Cementerio" }, () => {});

test("Cueva de Salamanca: si controlas Aliados de coste 1 o más su coste se reduce en un Oro", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Cueva de Salamanca");
  assert.equal(costeDe(e, 0, c).pagar, 2);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, c).pagar, 1);
});

test("Cueva de Salamanca: pone cartas de la mano en el fondo del Castillo y Roba la misma cantidad", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Salamanca");
  const a = poner(e, 0, "mano", "Valefor");
  const b = poner(e, 0, "mano", "Sir Persival");
  poner(e, 0, "mano", "Sir Galahad");
  e = hacer(e, habilidad(c, "Cueva de Salamanca"), a, b, null);
  assert.deepEqual(e.jugadores[0].castillo.slice(-2), [a, b]);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Cueva de Xalpen: en tu Vigilia busca un Arma o Tótem de coste 2 o más", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Xalpen");
  const t = poner(e, 0, "castillo", "Fortaleza Hoshi");
  e = hacer(e, habilidad(c, "Cueva de Xalpen", 0), "Buscar un Arma o Tótem de coste 2 o más", nombreDe(e, "Fortaleza Hoshi"));
  assert.equal(zonaDe(e, t), "mano");
});

test("Cueva de Xalpen: genera un Oro para Armas o Tótems", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Xalpen");
  e = hacer(e, habilidad(c, "Cueva de Xalpen", 0), "Generar un Oro para Armas o Tótems");
  assert.equal(disponibles(e, 0, { tipo: "Tótem", coste: 2 }), 1);
});

test("Cueva de Xalpen: el Oro generado solo sirve para cartas de coste 2 o más", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Xalpen");
  e = hacer(e, habilidad(c, "Cueva de Xalpen", 0), "Generar un Oro para Armas o Tótems");
  assert.equal(disponibles(e, 0, { tipo: "Arma", coste: 1 }), 0);
  assert.equal(disponibles(e, 0, { tipo: "Arma", coste: 2 }), 1);
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 3 }), 0);
});

test("Cueva de Xalpen: un Aliado duplica su Fuerza por el turno", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Xalpen");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(c, "Cueva de Xalpen", 1), "Duplicar su Fuerza");
  assert.equal(N.fuerza(e, v), 6);
});

test("Cueva de Xalpen: un Aliado tiene Fuerza 0 por el turno", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cueva de Xalpen");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(c, "Cueva de Xalpen", 1), "Fuerza 0");
  assert.equal(N.fuerza(e, v), 0);
});

test("Cuevas de Ajanta: en tu Vigilia un Aliado gana 2 de Fuerza y Furia", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cuevas de Ajanta");
  const p = poner(e, 0, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(c, "Cuevas de Ajanta"));
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
});

test("Cuevas de Ajanta: en tu Fase Final Destierra o Baraja tantas cartas de los Cementerios como Aliados atacaron", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Cuevas de Ajanta");
  const v = poner(e, 0, "defensa", "Guardia Real");
  const a = poner(e, 1, "cementerio", "Sir Persival");
  const b = poner(e, 1, "cementerio", "Sir Galahad");
  e = combate(e, [v]);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === a), true);
  e = elegir(e, a);
  e = elegir(e, "Desterrar");
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "cementerio");
});

test("El Abismo: el oponente Destierra una carta por cada Tótem y tú Robas dos", () => {
  let e = mesa();
  const a = poner(e, 0, "apoyo", "El Abismo");
  poner(e, 0, "apoyo", "Abadía de Carfax");
  e = aplicar(e, habilidad(a, "El Abismo", 0));
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("El Abismo: mira la mano oponente y Baraja una carta de coste 2 o menos que no sea Aliado", () => {
  let e = mesa();
  const a = poner(e, 0, "apoyo", "El Abismo");
  const t = poner(e, 1, "mano", "Llamar a la Manada");
  const v = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, habilidad(a, "El Abismo", 1));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [t, null]);
  e = elegir(e, t);
  assert.equal(zonaDe(e, t), "castillo");
  assert.equal(zonaDe(e, v), "mano");
});

test("El Abismo: tus Tótems no pueden perder su habilidad", () => {
  const e = mesa();
  const a = poner(e, 0, "apoyo", "El Abismo");
  const t = poner(e, 0, "apoyo", "Abadía de Carfax");
  const r = poner(e, 1, "apoyo", "Abadía de Carfax");
  const v = poner(e, 0, "defensa", "Valefor");
  for (const u of [a, t, r, v]) N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: u, fin: "turno" }, 1);
  assert.equal(N.activa(e, a), true);
  assert.equal(N.activa(e, t), true);
  assert.equal(N.activa(e, r), false);
  assert.equal(N.activa(e, v), false);
});

test("El Arca: al entrar puedes pagar un Oro para Robar tres cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "El Arca");
  e = hacer(e, jugar(c), true, "Robar tres cartas");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("El Arca: al entrar puedes pagar un Oro para buscar un Oro y ponerlo en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "El Arca");
  e = hacer(e, jugar(c), true, "Buscar un Oro y ponerlo en tu Oro Pagado", nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("El Arca: en tu Fase Final Baraja hasta dos cartas de los Cementerios por cada Tótem", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "El Arca");
  const cs = [0, 1, 2].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, cs[0]);
  e = elegir(e, cs[1]);
  assert.equal(zonaDe(e, cs[0]), "castillo");
  assert.equal(zonaDe(e, cs[1]), "castillo");
  assert.equal(zonaDe(e, cs[2]), "cementerio");
});

test("El Arca: subirla a la mano para prevenir que una carta salga del juego", { todo: "respuesta: devolver esta carta a la mano para prevenir que una carta salga del juego o cambie de controlador" }, () => {});

test("El Fantasma: paga el coste de una carta oponente, la Destruye sin habilidad y la juega bajo tu control", () => {
  let e = mesa();
  const f = poner(e, 0, "apoyo", "El Fantasma");
  oros(e, 0, 3);
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(f, "El Fantasma"));
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(N.controlador(e, p), 0);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(N.activa(e, p), true);
});

test("El Fantasma: no se puede usar sin Oros para pagar el coste", () => {
  const e = mesa();
  const f = poner(e, 0, "apoyo", "El Fantasma");
  oros(e, 0, 2);
  poner(e, 1, "defensa", "Sir Persival");
  assert.equal(usable(e, f), false);
});

test("El Fantasma: las cartas oponentes no disparan al salir del juego", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "El Fantasma");
  const s = poner(e, 0, "apoyo", "Estela Sagrada");
  const h = poner(e, 1, "apoyo", "Hospital San José");
  oros(e, 0, 1);
  e = hacer(e, habilidad(s, "Estela Sagrada"), "Barajar una carta de coste 2 o menos", h);
  assert.equal(zonaDe(e, h), "castillo");
  assert.equal(e.jugadores[0].cementerio.length, 0);
});

test("El Fantasma: tus propias cartas sí disparan al salir del juego", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "El Fantasma");
  const s = poner(e, 0, "apoyo", "Estela Sagrada");
  const h = poner(e, 0, "apoyo", "Hospital San José");
  oros(e, 0, 1);
  e = hacer(e, habilidad(s, "Estela Sagrada"), "Barajar una carta de coste 2 o menos", h);
  assert.equal(e.jugadores[1].cementerio.length, 5);
});

test("Esfinge Antartica: al entrar convierte un Aliado oponente de coste 2 o menos en uno sin habilidad bajo tu control", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Esfinge Antartica");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(s), true);
  assert.equal(N.controlador(e, v), 0);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.carta(e, v).sinHabilidad, true);
});

test("Esfinge Antartica: Baraja hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Esfinge Antartica");
  const cs = [0, 1, 2].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = hacer(e, habilidad(s, "Esfinge Antartica"), cs[0], cs[2]);
  assert.equal(zonaDe(e, cs[0]), "castillo");
  assert.equal(zonaDe(e, cs[1]), "cementerio");
  assert.equal(zonaDe(e, cs[2]), "castillo");
});

test("Espira del Delirio: al jugar un Aliado puedes subirla de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "cementerio", "Espira del Delirio");
  const v = poner(e, 0, "mano", "Valefor");
  e = hacer(e, jugar(v), true);
  assert.equal(zonaDe(e, s), "mano");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Espira del Delirio: no se dispara al jugar un Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "cementerio", "Espira del Delirio");
  const t = poner(e, 0, "mano", "Llamar a la Manada");
  e = aplicar(e, jugar(t));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, s), "cementerio");
});

test("Espira del Delirio: una vez por turno Robas tres cartas", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Espira del Delirio");
  e = aplicar(e, habilidad(s, "Espira del Delirio"));
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(usable(e, s), false);
});

test("Espira del Delirio: Desterrar o Barajar tu Cementerio le cuesta un Oro más al oponente", { todo: "efecto: afectar a ciertas cartas cuesta un Oro adicional al oponente" }, () => {});

test("Estacion Dos: mientras está en juego no se puede declarar ataque", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Valefor");
  const s = poner(e, 0, "mano", "Estacion Dos");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), true);
  e = aplicar(e, jugar(s));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
});

test("Estacion Dos: al comienzo de tu Vigilia puedes Destruirla para generar dos Oros", () => {
  let e = mesa();
  const s = poner(e, 1, "apoyo", "Estacion Dos");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  assert.equal(zonaDe(e, s), "cementerio");
  assert.deepEqual(e.jugadores[1].generados, [{ n: 2, tipos: null }]);
});

test("Estacion Dos: desde el Cementerio solo se ponen cartas en juego desde la mano", { todo: "restricción desde el Cementerio: los jugadores solo pueden poner cartas en juego desde su mano" }, () => {});

test("Estacion Gaia: al entrar Roba dos, Descarta una y el oponente Destierra dos del tope", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Estacion Gaia");
  e = resolverTodo(aplicar(e, jugar(g)));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(e.jugadores[1].destierro.length, 2);
});

test("Estacion Gaia: tiene Exhumar y tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const g = poner(e, 0, "apoyo", "Estacion Gaia");
  const v = poner(e, 0, "defensa", "Valefor");
  const w = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, g, "Exhumar"), true);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, w), 3);
});

test("Estacion Gaia: tus Aliados en juego aumentan su coste", { todo: "continua: modificar el coste de los Aliados en juego" }, () => {});

test("Estación Fantasma: nombra una carta y el oponente Baraja las que controle con ese nombre", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Estación Fantasma");
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = hacer(e, habilidad(s, "Estación Fantasma"), a);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, p), "defensa");
});

test("Estación Fantasma: al atacar un Aliado con Furia no hace daño y el oponente Destierra del fondo tanto como su Fuerza", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Estación Fantasma");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: v });
  e = elegir(e, v);
  assert.equal(e.jugadores[1].destierro.length, 3);
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Estela Sagrada: paga un Oro para buscar una carta en tu Castillo", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Estela Sagrada");
  oros(e, 0, 1);
  const p = poner(e, 0, "castillo", "Sir Persival");
  e = hacer(e, habilidad(s, "Estela Sagrada"), "Buscar una carta en tu Castillo", nombreDe(e, "Sir Persival"));
  assert.equal(zonaDe(e, p), "mano");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Estela Sagrada: paga un Oro para Barajar una carta de coste 2 o menos", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Estela Sagrada");
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(s, "Estela Sagrada"), "Barajar una carta de coste 2 o menos", v);
  assert.equal(zonaDe(e, v), "castillo");
});

test("Estela Sagrada: el daño de combate a tu Castillo se reduce en 1 por cada Tótem de coste 1 o más", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Estela Sagrada");
  poner(e, 1, "apoyo", "Abadía de Carfax");
  const v = poner(e, 0, "defensa", "Valefor");
  e = combate(e, [v]);
  assert.equal(e.jugadores[1].cementerio.length, 2);
});

test("Estela Sagrada: también reduce el daño directo", { todo: "efecto: reducir el daño directo recibido por tu Castillo" }, () => {});

test("Fonda: al jugar un Talismán el oponente Bota dos cartas", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Fonda");
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Llamar a la Manada");
  e = aplicar(e, jugar(t));
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Fonda: si es un Terremoto además Robas dos cartas", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Fonda");
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Terremoto");
  e = resolverTodo(aplicar(e, jugar(t)));
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Fonda: solo hasta dos veces por turno", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Fonda");
  oros(e, 0, 3);
  const ts = [0, 1, 2].map(() => poner(e, 0, "mano", "Llamar a la Manada"));
  for (const t of ts) e = aplicar(e, jugar(t));
  assert.equal(e.jugadores[1].cementerio.length, 4);
});

test("Fonda: con Anticucho, Empanada y Pebre no Botas ni Destierras de tu Castillo", { todo: "protección condicional: no Botar ni Desterrar cartas del propio Castillo" }, () => {});

test("Fuerte de Niebla: genera un Oro para Armas y busca un Arma", () => {
  let e = mesa();
  const f = poner(e, 0, "apoyo", "Fuerte de Niebla");
  const a = poner(e, 0, "castillo", "Pedrenyal");
  e = hacer(e, habilidad(f, "Fuerte de Niebla"), nombreDe(e, "Pedrenyal"));
  assert.equal(zonaDe(e, a), "mano");
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma"] }]);
});

test("Fuerte de Niebla: Descartar o Destruir un Arma para que no pueda ser Anulado", { todo: "protección: Destruir o Descartar una carta propia para que no pueda ser Anulada" }, () => {});

test("Fuerte de Niebla: tus Aliados que porten Armas ganan Furia", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Fuerte de Niebla");
  const armado = poner(e, 0, "defensa", "Guardia Real");
  const desnudo = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Pedrenyal", { portador: armado });
  const rival = poner(e, 1, "defensa", "Guardia Real");
  poner(e, 1, "arma", "Pedrenyal", { portador: rival });
  assert.equal(N.tiene(e, armado, "Furia"), true);
  assert.equal(N.tiene(e, desnudo, "Furia"), false);
  assert.equal(N.tiene(e, rival, "Furia"), false);
});

test("Gehena: Destierra una carta del Castillo oponente y pone otra de tu Castillo en tu mano", () => {
  let e = mesa();
  const g = poner(e, 0, "apoyo", "Gehena");
  const v = poner(e, 1, "castillo", "Valefor");
  const p = poner(e, 0, "castillo", "Sir Persival");
  e = hacer(e, habilidad(g, "Gehena"), v, nombreDe(e, "Sir Persival"));
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, p), "mano");
});

test("Gehena: en tu Fase Final agrupa un Oro y Roba una carta", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Gehena");
  const o = poner(e, 0, "pagado", "Drácula");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Gran Maelstrm: en la Fase Final sin Aliados pone el tope de un Castillo como Aliado de Fuerza 3 sin habilidad", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Gran Maelstrm");
  const tope = e.jugadores[1].castillo[0];
  e = hacer(e, { tipo: "terminar" }, true, "El tope del Castillo oponente");
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.controlador(e, tope), 0);
  assert.equal(N.carta(e, tope).tipo, "Aliado");
  assert.equal(N.fuerza(e, tope), 3);
  assert.equal(N.carta(e, tope).sinHabilidad, true);
});

test("Gran Maelstrm: no se dispara si controlas Aliados", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Gran Maelstrm");
  poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(e.activo, 1);
});

test("Gran Maelstrm: Desterrarlo para no recibir daño hasta tu próximo turno", () => {
  let e = mesa();
  const g = poner(e, 1, "apoyo", "Gran Maelstrm");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: v });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, habilidad(g, "Gran Maelstrm"));
  assert.equal(zonaDe(e, g), "destierro");
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Gran Yggdrasil: al entrar juega un Tótem de coste 3 de tu Castillo sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 4);
  const y = poner(e, 0, "mano", "Gran Yggdrasil");
  const c = poner(e, 0, "castillo", "Ciudad Sin Nombre");
  e = hacer(e, jugar(y), nombreDe(e, "Ciudad Sin Nombre"));
  assert.equal(zonaDe(e, y), "apoyo");
  assert.equal(zonaDe(e, c), "apoyo");
});

test("Gran Yggdrasil: en tu Vigilia el oponente Destierra del tope una carta por cada Tótem", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Gran Yggdrasil");
  poner(e, 1, "apoyo", "Abadía de Carfax");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[0].destierro.length, 2);
});

test("Gran Yggdrasil: los Aliados en juego pierden su habilidad", { todo: "continua: los Aliados en juego pierden su habilidad" }, () => {});

test("Guardia Gozosa: al entrar un Aliado oponente pierde su habilidad y es Destruido", () => {
  let e = mesa();
  oros(e, 0, 3);
  const g = poner(e, 0, "mano", "Guardia Gozosa");
  const s = poner(e, 1, "defensa", "Sir Galahad");
  e = aplicar(e, jugar(g));
  assert.equal(zonaDe(e, s), "cementerio");
});

test("Guardia Gozosa: Destruirla para Barajar una carta de tu Cementerio en tu Castillo", () => {
  let e = mesa();
  const g = poner(e, 0, "apoyo", "Guardia Gozosa");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, habilidad(g, "Guardia Gozosa"), v);
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(zonaDe(e, v), "castillo");
});

test("Hangar de la Ciudadela: al entrar el oponente Baraja una carta de su mano y tú Robas dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "mano", "Hangar de la Ciudadela");
  const x = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, jugar(h));
  assert.equal(zonaDe(e, x), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Hangar de la Ciudadela: si se Bota por daño se dejan de Botar cartas y se Destierra", () => {
  let e = mesa();
  const h = poner(e, 1, "castillo", "Hangar de la Ciudadela");
  const c = e.jugadores[1].castillo;
  c.splice(c.indexOf(h), 1);
  c.splice(1, 0, h);
  const a = poner(e, 0, "defensa", "Guardia Real");
  const b = poner(e, 0, "defensa", "Guardia Real");
  e = combate(e, [a, b]);
  assert.equal(zonaDe(e, h), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Hangar de la Ciudadela: los Aliados de coste 0 no disparan sus habilidades", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Hangar de la Ciudadela");
  poner(e, 0, "mano", "Valefor");
  const h = poner(e, 0, "mano", "Hijos del Fuego Blanco");
  e = aplicar(e, jugar(h));
  assert.equal(zonaDe(e, h), "defensa");
  assert.equal(e.pendiente, null);
});

test("Hangar de la Ciudadela: los Aliados de Fuerza 0 no disparan sus habilidades", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Hangar de la Ciudadela");
  oros(e, 0, 3);
  const m = poner(e, 0, "mano", "Mecha-Daikaiju");
  N.agregarEfecto(e, { tipo: "fuerza", uid: m, n: -5 }, 1);
  e = aplicar(e, jugar(m));
  assert.equal(zonaDe(e, m), "defensa");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Hangar de la Ciudadela: los Aliados de coste o Fuerza 0 no pueden atacar", { todo: "restricción: los Aliados que cumplan un filtro (coste o Fuerza) no pueden atacar" }, () => {});

test("Hiva: es Indesterrable y una vez por turno Destruye un Aliado", () => {
  let e = mesa();
  const h = poner(e, 0, "apoyo", "Hiva");
  const v = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, h, "Indesterrable"), true);
  e = aplicar(e, habilidad(h, "Hiva"));
  assert.equal(zonaDe(e, v), "cementerio");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(usable(e, h), false);
});

test("Hiva: con Aliados de coste 1 o más los demás Tótems pierden la habilidad", { todo: "continua: los demás Tótems pierden su habilidad bajo condición" }, () => {});

test("Hiva: los Oros del oponente sin Aliados no disparan", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Hiva");
  poner(e, 1, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Tetramorfo");
  e = aplicar(e, { tipo: "oro", uid: t });
  assert.equal(zonaDe(e, t), "reserva");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Hiva: si ningún jugador controla Aliados, tampoco disparan tus Oros", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Hiva");
  const t = poner(e, 0, "mano", "Tetramorfo");
  e = aplicar(e, { tipo: "oro", uid: t });
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Hiva: los Oros de un jugador con Aliados sí disparan", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Hiva");
  poner(e, 0, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Tetramorfo");
  e = aplicar(e, { tipo: "oro", uid: t });
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Hiva: tus Oros no disparan si no controlas Aliados aunque el oponente sí", { todo: "silenciar disparos solo de las cartas propias del controlador de la continua" }, () => {});

test("Hospital San José: al entrar puedes Desterrar el Cementerio oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Hospital San José");
  const cs = [0, 1, 2].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = hacer(e, jugar(h), true);
  for (const c of cs) assert.equal(zonaDe(e, c), "destierro");
});

test("Hospital San José: Baraja hasta seis cartas de los Cementerios y Roba por cada Tótem de distinto coste", () => {
  let e = mesa();
  const h = poner(e, 0, "apoyo", "Hospital San José");
  poner(e, 0, "apoyo", "Abadía de Carfax");
  poner(e, 0, "apoyo", "Carcosa");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(h, "Hospital San José"), c);
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Hospital San José: en la Fase Final oponente el oponente Bota cinco cartas", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Hospital San José");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[0].cementerio.length, 5);
});

test("Hospital San José: cuando sale del juego el oponente Bota cinco cartas", () => {
  let e = mesa();
  const s = poner(e, 0, "apoyo", "Estela Sagrada");
  const h = poner(e, 0, "apoyo", "Hospital San José");
  oros(e, 0, 1);
  e = hacer(e, habilidad(s, "Estela Sagrada"), "Barajar una carta de coste 2 o menos", h);
  assert.equal(zonaDe(e, h), "castillo");
  assert.equal(e.jugadores[1].cementerio.length, 5);
});
