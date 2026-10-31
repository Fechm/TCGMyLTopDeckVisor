import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { cumple } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const usable = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);

function resolverTodo(e) {
  for (let i = 0; i < 40 && e.pendiente; i++) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  return e;
}

test("Humberstone: juega un Aliado del Cementerio reduciendo su coste en un Oro", () => {
  let e = mesa();
  const h = poner(e, 0, "apoyo", "Humberstone");
  const p = poner(e, 0, "cementerio", "Sir Persival");
  oros(e, 0, 2);
  e = aplicar(e, habilidad(h, "Humberstone"));
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 2);
  assert.equal(usable(e, h), false);
});

test("Humberstone: el coste reducido no baja de 1", () => {
  let e = mesa();
  const h = poner(e, 0, "apoyo", "Humberstone");
  const v = poner(e, 0, "mano", "Valefor");
  assert.equal(usable(e, h), false);
  oros(e, 0, 1);
  e = aplicar(e, habilidad(h, "Humberstone"));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Humberstone: no puede ser Anulado si el oponente usó varias habilidades o Talismanes", { todo: "anulación: no Anulable condicionado a habilidades o Talismanes usados por el oponente este turno" }, () => {});

test("Hy Brasil: el oponente Bota una carta por Tótem en juego y luego Destierras hasta tres cartas de un Cementerio", () => {
  let e = mesa();
  const h = poner(e, 0, "apoyo", "Hy Brasil");
  poner(e, 1, "apoyo", "Luxor");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Sir Persival");
  e = aplicar(e, habilidad(h, "Hy Brasil"));
  assert.equal(e.jugadores[1].cementerio.length, 3);
  e = elegir(e, b);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === a), false);
  e = elegir(e, null);
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, a), "cementerio");
});

test("Hy Brasil: Desterrar una carta de la mano para Anular un Talismán o Tótem", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Karakórum: mira tantas cartas como Aliados controles, pone dos en la mano y Baraja el resto", () => {
  let e = mesa();
  const k = poner(e, 0, "apoyo", "Karakórum");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "defensa", "Sir Persival");
  const tope = e.jugadores[0].castillo.slice(0, 3);
  e = hacer(e, habilidad(k, "Karakórum"), tope[0], tope[2]);
  assert.equal(zonaDe(e, tope[0]), "mano");
  assert.equal(zonaDe(e, tope[2]), "mano");
  assert.equal(zonaDe(e, tope[1]), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Karakórum: tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Karakórum");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, r), 3);
});

test("La Mancha: Indestructible e Indesterrable", () => {
  const e = mesa();
  const m = poner(e, 0, "apoyo", "La Mancha");
  assert.equal(N.tiene(e, m, "Indestructible"), true);
  assert.equal(N.tiene(e, m, "Indesterrable"), true);
});

test("La Mancha: Baraja cartas oponentes cuyos costes sumen 3 o menos", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "La Mancha");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = hacer(e, habilidad(m, "La Mancha"), "Barajar cartas oponentes cuyos costes sumen 3 o menos", v);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === p), false);
  e = elegir(e, g);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, p), "defensa");
});

test("La Mancha: busca una carta en tu Castillo", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "La Mancha");
  const t = poner(e, 0, "castillo", "Efigie");
  e = hacer(e, habilidad(m, "La Mancha"), "Buscar una carta en tu Castillo", nombreDe(e, "Efigie"));
  assert.equal(zonaDe(e, t), "mano");
});

test("La Mancha: en tu Fase Final Baraja hasta tres cartas de tu Cementerio, agrupa un Oro y Roba dos", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "La Mancha");
  const c = poner(e, 0, "cementerio", "Valefor");
  const o = poner(e, 0, "pagado", "Drácula");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, c);
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Laboratorio Siniestro: en tu Vigilia busca un Aliado y un Oro", () => {
  let e = mesa();
  const l = poner(e, 0, "apoyo", "Laboratorio Siniestro");
  const a = poner(e, 0, "castillo", "Valefor");
  const o = poner(e, 0, "castillo", "Vigilantes");
  e = hacer(e, habilidad(l, "Laboratorio Siniestro", 0), nombreDe(e, "Valefor"), nombreDe(e, "Vigilantes"));
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, o), "mano");
});

test("Laboratorio Siniestro: un Aliado gana Furia y su daño va al Destierro", () => {
  let e = mesa();
  const l = poner(e, 0, "apoyo", "Laboratorio Siniestro");
  const p = poner(e, 0, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(l, "Laboratorio Siniestro", 1));
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(N.tiene(e, p, "DanoAlDestierro"), true);
});

test("Ladurum: reduce su coste en el coste total de las demás cartas de tu mano", () => {
  const e = mesa();
  const l = poner(e, 0, "mano", "Ladurum");
  assert.equal(costeDe(e, 0, l).pagar, 7);
  poner(e, 0, "mano", "Sir Persival");
  poner(e, 0, "mano", "Guardia Real");
  assert.equal(costeDe(e, 0, l).pagar, 2);
});

test("Ladurum: muestra hasta un Aliado y un Arma o Tótem, los pone en tu mano y Baraja el resto", () => {
  let e = mesa();
  const l = poner(e, 0, "apoyo", "Ladurum");
  const c = e.jugadores[0].castillo;
  const t = poner(e, 0, "castillo", "Luxor");
  const a = poner(e, 0, "castillo", "Valefor");
  c.unshift(c.pop(), c.pop());
  c.splice(1, 0, c.shift());
  assert.equal(c[0], t);
  e = aplicar(e, habilidad(l, "Ladurum"));
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, t), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Leng: no puede ser Anulado", () => {
  const e = mesa();
  const l = poner(e, 0, "mano", "Leng");
  assert.equal(N.carta(e, l).claves.includes("NoAnulable"), true);
});

test("Leng: al entrar el oponente Destierra del tope tantas cartas como Oros tenga en su Reserva", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 3);
  const l = poner(e, 0, "mano", "Leng");
  e = aplicar(e, jugar(l));
  assert.equal(zonaDe(e, l), "apoyo");
  assert.equal(e.jugadores[1].destierro.length, 3);
});

test("Leng: al comienzo de tu turno el oponente Destierra del tope tantas cartas como Oros en su Reserva", () => {
  let e = mesa();
  poner(e, 1, "apoyo", "Leng");
  oros(e, 0, 2);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[0].destierro.length, 2);
});

test("Leng: se juega al comienzo de cualquier Fase y cuesta un Oro menos en turno oponente", { todo: "momentos: jugar Tótems al comienzo de cualquier Fase, también en el turno oponente, con reducción de coste" }, () => {});

test("Londres: Indesterrable", () => {
  const e = mesa();
  const l = poner(e, 0, "apoyo", "Londres");
  assert.equal(N.tiene(e, l, "Indesterrable"), true);
});

test("Londres: al entrar busca un Aliado o Tótem y lo juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 4);
  const l = poner(e, 0, "mano", "Londres");
  const p = poner(e, 0, "castillo", "Sir Persival");
  e = hacer(e, jugar(l), nombreDe(e, "Sir Persival"));
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 4);
});

test("Londres: el Aliado buscado de coste 1 entra gratis", () => {
  let e = mesa();
  oros(e, 0, 2);
  const l = poner(e, 0, "mano", "Londres");
  const v = poner(e, 0, "castillo", "Valefor");
  e = hacer(e, jugar(l), nombreDe(e, "Valefor"));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Londres: los Aliados oponentes pierden 1 de Fuerza permanentemente y una carta pierde su habilidad", () => {
  let e = mesa();
  const l = poner(e, 0, "apoyo", "Londres");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(l, "Londres"));
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.activa(e, v), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.activa(e, v), true);
});

test("Luxor: Descarta una carta que no sea Talismán para buscar una del mismo tipo", () => {
  let e = mesa();
  const l = poner(e, 0, "apoyo", "Luxor");
  const d = poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Efigie");
  const t = poner(e, 0, "castillo", "Sir Persival");
  e = aplicar(e, habilidad(l, "Luxor"));
  assert.equal(e.pendiente.opciones.every((o) => o.valor === null || N.carta(e, o.valor).tipo === "Aliado"), true);
  e = elegir(e, nombreDe(e, "Sir Persival"));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, t), "mano");
});

test("Luxor: tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Luxor");
  const v = poner(e, 0, "defensa", "Sir Persival");
  assert.equal(N.fuerza(e, v), 3);
});

test("Magog: Destruye un Aliado de coste 3 o menos y Roba una carta", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Magog");
  const p = poner(e, 1, "defensa", "Sir Persival");
  poner(e, 1, "defensa", "Gusano Rojo");
  e = aplicar(e, habilidad(m, "Magog"));
  assert.equal(zonaDe(e, p), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Magog: un Oro elegido no puede ser agrupado el próximo turno", { todo: "efecto: un Oro elegido no se agrupa en el próximo turno" }, () => {});

test("Manicomio: muestra cartas hasta un Aliado de coste 2 o menos y lo pone en tu mano", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Manicomio");
  const c = e.jugadores[0].castillo;
  const p = poner(e, 0, "castillo", "Sir Persival");
  const g = poner(e, 0, "castillo", "Guardia Real");
  c.unshift(c.pop());
  c.unshift(c.pop());
  assert.equal(c[0], p);
  e = aplicar(e, habilidad(m, "Manicomio"));
  assert.equal(zonaDe(e, g), "mano");
  assert.equal(zonaDe(e, p), "castillo");
});

test("Manicomio: al jugar un Aliado de coste 2 o menos se lanza un dado", { todo: "dado: al jugar un Aliado de coste bajo se lanza un dado y si sale impar no dispara sus habilidades al entrar" }, () => {});

test("Mar de Azufre: no puede ser afectado por cartas de coste 1", () => {
  const e = mesa();
  const m = poner(e, 0, "apoyo", "Mar de Azufre");
  assert.equal(cumple(e, { ctrl: 1, costeFuente: 1, vars: {} }, m, {}), false);
  assert.equal(cumple(e, { ctrl: 1, costeFuente: 2, vars: {} }, m, {}), true);
});

test("Mar de Azufre: protección contra Oros y cartas oponentes de coste 0", { todo: "protección: no puede ser afectado por Oros ni cartas oponentes de coste n o menos" }, () => {});

test("Mar de Azufre: se juega al comienzo de cualquier Fase", { todo: "momentos: jugar Tótems al comienzo de cualquier Fase, también en el turno oponente, con reducción de coste" }, () => {});

test("Mar de Azufre: no se puede generar Oros, reducir costes ni jugar sin pagar", { todo: "prohibición global: generar Oros, reducir costes y jugar cartas sin pagar su coste" }, () => {});

test("Mesa del Te: Exhumar y tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const m = poner(e, 0, "apoyo", "Mesa del Te");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.tiene(e, m, "Exhumar"), true);
  assert.equal(N.fuerza(e, v), 4);
});

test("Mesa del Te: se juega desde el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "cementerio", "Mesa del Te");
  e = aplicar(e, jugar(m, { desde: "cementerio" }));
  assert.equal(zonaDe(e, m), "apoyo");
});

test("Mesa del Te: sube a la mano un Aliado que fuera a ser afectado por un efecto oponente", { todo: "reemplazo: cuando un Aliado propio fuera a ser afectado por un efecto oponente, subirlo a la mano y Robar" }, () => {});

test("Metropolitan: al entrar genera un Oro para Aliados", () => {
  let e = mesa();
  oros(e, 0, 3);
  const m = poner(e, 0, "mano", "Metropolitan");
  e = hacer(e, jugar(m), "Generar un Oro para Aliados");
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Aliado"] }]);
});

test("Metropolitan: al entrar Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 3);
  const m = poner(e, 0, "mano", "Metropolitan");
  e = hacer(e, jugar(m), "Robar dos cartas");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Metropolitan: en tu Vigilia se convierte en Aliado de Fuerza 3 hasta la Fase Final", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Metropolitan");
  e = aplicar(e, habilidad(m, "Metropolitan"));
  assert.equal(zonaDe(e, m), "defensa");
  assert.equal(N.carta(e, m).tipo, "Aliado");
  assert.equal(N.fuerza(e, m), 3);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, m), "apoyo");
  assert.equal(N.carta(e, m).tipo, "Tótem");
});

test("Metropolitan: cuando ataca otro Aliado pasa a Fuerza 5 por el turno", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Metropolitan");
  const p = poner(e, 0, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(m, "Metropolitan"));
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: m });
  assert.equal(N.fuerza(e, p), 5);
});

test("Metropolitan: el Aliado afectado también pasa a coste 5", { todo: "conversión: un Aliado pasa a tener Fuerza y coste fijos por el turno" }, () => {});

test("Mina Maldita: al entrar Destierra las cartas oponentes de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 4);
  const m = poner(e, 0, "mano", "Mina Maldita");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const p = poner(e, 1, "defensa", "Sir Persival");
  const o = poner(e, 1, "reserva", "Drácula");
  e = aplicar(e, jugar(m));
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, g), "destierro");
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(zonaDe(e, o), "reserva");
});

test("Mina Maldita: Roba dos cartas", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Mina Maldita");
  e = hacer(e, habilidad(m, "Mina Maldita"), "Robar dos cartas");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(usable(e, m), false);
});

test("Mina Maldita: convierte una carta al azar de la mano oponente en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Mina Maldita");
  const x = poner(e, 1, "mano", "Sir Persival");
  e = hacer(e, habilidad(m, "Mina Maldita"), "Convertir una carta al azar de la mano oponente en Oro");
  assert.equal(e.jugadores[0].pagado.includes(x), true);
  assert.equal(N.carta(e, x).tipo, "Oro");
  assert.equal(N.carta(e, x).sinHabilidad, true);
});

test("Monte Hermon: al entrar busca un Tótem Monte", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "mano", "Monte Hermon");
  const t = poner(e, 0, "castillo", "Monte Meguido");
  poner(e, 0, "castillo", "Luxor");
  e = aplicar(e, jugar(h));
  assert.equal(e.pendiente.opciones.some((o) => o.valor && N.carta(e, o.valor).nombre === "Luxor"), false);
  e = elegir(e, nombreDe(e, "Monte Meguido"));
  assert.equal(zonaDe(e, t), "mano");
});

test("Monte Hermon: Descarta un Aliado o Tótem para mostrar hasta un Talismán y ponerlo en tu mano", () => {
  let e = mesa();
  const h = poner(e, 0, "apoyo", "Monte Hermon");
  const d = poner(e, 0, "mano", "Valefor");
  const c = e.jugadores[0].castillo;
  const t = poner(e, 0, "castillo", "Efigie");
  c.splice(2, 0, c.pop());
  e = aplicar(e, habilidad(h, "Monte Hermon"));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, t), "mano");
});

test("Monte Hermon: los Aliados oponentes pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Monte Hermon");
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.fuerza(e, p), 3);
});

test("Monte Meguido: al entrar busca un Tótem Monte", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Monte Meguido");
  const t = poner(e, 0, "castillo", "Monte Hermon");
  e = hacer(e, jugar(m), nombreDe(e, "Monte Hermon"));
  assert.equal(zonaDe(e, t), "mano");
});

test("Monte Meguido: Descarta una carta para jugar un Aliado de coste 3 o más del Cementerio con un Oro menos", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Monte Meguido");
  const d = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 0, "cementerio", "Sir Persival");
  oros(e, 0, 2);
  e = aplicar(e, habilidad(m, "Monte Meguido"));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Monte Meguido: tus Aliados ganan 1 de Fuerza e Indestructible", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Monte Meguido");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "Indestructible"), true);
});

test("Monumento Heroico: al entrar Baraja hasta cuatro cartas de los Cementerios y Roba tres", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Monumento Heroico");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Sir Persival");
  e = hacer(e, jugar(m), a, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Monumento Heroico: tus Aliados no pierden su habilidad y ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Monumento Heroico");
  const v = poner(e, 0, "defensa", "Valefor");
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: v }, 1);
  assert.equal(N.activa(e, v), true);
  assert.equal(N.fuerza(e, v), 4);
});

test("Monumento Heroico: tus Tótems no pierden su habilidad", { todo: "protección: Tótems propios no pueden perder su habilidad" }, () => {});

test("Monumento Heroico: las cartas oponentes pierden Indestructible e Indesterrable", { todo: "efecto: las cartas oponentes pierden Indestructible e Indesterrable" }, () => {});

test("Monumento Inmortal: Desterrarlo de la mano Anula un Aliado de coste 0", () => {
  let e = mesa();
  const m = poner(e, 1, "mano", "Monumento Inmortal");
  const a = poner(e, 0, "mano", "Hijos del Fuego Blanco");
  e = aplicar(e, jugar(a));
  assert.equal(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === m), true);
  e = aplicar(e, { tipo: "responder", uid: m });
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(zonaDe(e, a), "cementerio");
});

test("Monumento Inmortal: Anular un Aliado jugado sin pagar o desde el juego", { todo: "respuesta: Anular con una carta en juego o un Aliado jugado sin pagar su coste" }, () => {});

test("Monumento Inmortal: la primera carta de coste 1 de cada jugador por turno cuesta un Oro más", { todo: "impuesto: la primera carta de coste n que juegue cada jugador por turno cuesta un Oro más" }, () => {});

test("Monumento Inmortal: cuando sale del juego Robas dos cartas", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Monumento Inmortal");
  const o = poner(e, 1, "apoyo", "Ojo Antiguo");
  e.activo = 1;
  e = hacer(e, habilidad(o, "Ojo Antiguo"), "Destruir todas las cartas de coste 1 o menos y Robar una carta");
  assert.equal(zonaDe(e, m), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Morro de Arica: al entrar puede buscar un Arma de coste 2", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Morro de Arica");
  const a = poner(e, 0, "castillo", "Espada Larga");
  e = hacer(e, jugar(m), true, nombreDe(e, "Espada Larga"));
  assert.equal(zonaDe(e, a), "mano");
});

test("Morro de Arica: genera un Oro para jugar Armas", () => {
  let e = mesa();
  const m = poner(e, 0, "apoyo", "Morro de Arica");
  e = aplicar(e, habilidad(m, "Morro de Arica"));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma"] }]);
  assert.equal(usable(e, m), false);
});

test("Morro de Arica: el Arma de coste 2 o más pagada con ese Oro no puede ser Anulada y Robas", { todo: "generar: efecto adicional al gastar el Oro generado en una carta (no Anulable, Robar)" }, () => {});

test("Nunca Jamas: solo se juega si controlas Aliados", () => {
  let e = mesa();
  oros(e, 0, 2);
  const n = poner(e, 0, "mano", "Nunca Jamas");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === n), false);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === n), true);
  assert.equal(N.carta(e, n).claves.includes("Exhumar"), true);
});

test("Nunca Jamas: hasta dos Aliados ganan o pierden 2 de Fuerza por el turno", () => {
  let e = mesa();
  const n = poner(e, 0, "apoyo", "Nunca Jamas");
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, habilidad(n, "Nunca Jamas"), a, b, "Pierden 2 de Fuerza");
  assert.equal(N.fuerza(e, a), 1);
  assert.equal(N.fuerza(e, b), 1);
});

test("Nunca Jamas: Aliados de Fuerza 4 o más no atacan y sus habilidades cuestan más", { todo: "continua: Aliados con Fuerza mínima no pueden atacar y sus habilidades cuestan un Oro más" }, () => {});

test("Ojo Antiguo: previene que otra carta salga del juego", () => {
  let e = mesa();
  const o = poner(e, 0, "apoyo", "Ojo Antiguo");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(o, "Ojo Antiguo"), "Prevenir que otra carta salga del juego");
  assert.equal(N.puedeSalir(e, v), false);
});

test("Ojo Antiguo: Destruye todas las cartas de coste 1 o menos y Roba una", () => {
  let e = mesa();
  const o = poner(e, 0, "apoyo", "Ojo Antiguo");
  const v = poner(e, 1, "defensa", "Valefor");
  const l = poner(e, 1, "apoyo", "Luxor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, habilidad(o, "Ojo Antiguo"), "Destruir todas las cartas de coste 1 o menos y Robar una carta");
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, l), "cementerio");
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Ojo Antiguo: tus Aliados ganan Indestructible e Indesterrable", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Ojo Antiguo");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.tiene(e, v, "Indestructible"), true);
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
});

test("Ojo Antiguo: tus cartas de coste 2 o más no pierden su habilidad", { todo: "protección: cartas propias de coste mínimo no pueden perder su habilidad" }, () => {});

test("Olimpia: al jugar un Talismán sin controlar Aliados el oponente Bota una carta", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Olimpia");
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Caminar el Tablón");
  poner(e, 1, "mano", "Valefor");
  e = aplicar(e, jugar(t));
  assert.equal(e.jugadores[1].cementerio.length >= 1, true);
  assert.equal(N.carta(e, e.jugadores[1].cementerio[0]).nombre, "Drácula");
});

test("Olimpia: con Aliados no se dispara", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Olimpia");
  poner(e, 0, "defensa", "Valefor");
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Caminar el Tablón");
  poner(e, 1, "mano", "Sir Persival");
  e = resolverTodo(aplicar(e, jugar(t)));
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Olimpia: en tu Fase Final sin Aliados busca un Talismán de coste 3 o más", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Olimpia");
  const t = poner(e, 0, "castillo", "Efigie");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  e = elegir(e, nombreDe(e, "Efigie"));
  assert.equal(zonaDe(e, t), "mano");
});

test("Olimpia: los Talismanes de coste 3 o más que juegues no pueden ser Anulados", { todo: "anulación: tus Talismanes de coste mínimo no pueden ser Anulados" }, () => {});

test("Palacio de la Real Audiencia: al entrar Baraja hasta tres cartas oponentes cuyos costes sumen 3", () => {
  let e = mesa();
  oros(e, 0, 2);
  const p = poner(e, 0, "mano", "Palacio de la Real Audiencia");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const s = poner(e, 1, "defensa", "Sir Persival");
  e = hacer(e, jugar(p), v);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === s), false);
  e = elegir(e, g);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, s), "defensa");
  assert.equal(N.tiene(e, p, "Exhumar"), true);
});

test("Palacio de la Real Audiencia: al jugar un Aliado Baraja hasta dos cartas de un Cementerio y Roba", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Palacio de la Real Audiencia");
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const a = poner(e, 1, "cementerio", "Sir Persival");
  const b = poner(e, 0, "cementerio", "Guardia Real");
  e = aplicar(e, jugar(v));
  e = elegir(e, true);
  e = elegir(e, a);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Palacio de la Real Audiencia: no puede ser Desterrado del Cementerio", { todo: "protección: no puede ser Desterrada desde el Cementerio" }, () => {});

test("París: busca un Oro sin habilidad y lo pone en tu Oro Pagado", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "París");
  e = hacer(e, habilidad(p, "París", 0), nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("París: pone una carta de la mano en el tope del Castillo y dos del fondo en la mano", () => {
  let e = mesa();
  const p = poner(e, 0, "apoyo", "París");
  const m = poner(e, 0, "mano", "Valefor");
  const fondo = e.jugadores[0].castillo.slice(-2);
  e = aplicar(e, habilidad(p, "París", 1));
  assert.equal(e.jugadores[0].castillo[0], m);
  assert.equal(zonaDe(e, fondo[0]), "mano");
  assert.equal(zonaDe(e, fondo[1]), "mano");
});

test("París: al comienzo de la Vigilia oponente puedes jugar un Tótem de tu mano pagando su coste", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "París");
  const k = poner(e, 0, "mano", "Karakórum");
  oros(e, 0, 1);
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  assert.equal(zonaDe(e, k), "apoyo");
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("París: al comienzo de la Vigilia oponente puedes jugar un Arma de tu mano pagando su coste", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "París");
  const v = poner(e, 0, "defensa", "Valefor");
  const a = poner(e, 0, "mano", "Espada Larga");
  oros(e, 0, 2);
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  assert.equal(e.armas[v]?.includes(a), true);
  assert.equal(e.jugadores[0].pagado.length, 2);
});
