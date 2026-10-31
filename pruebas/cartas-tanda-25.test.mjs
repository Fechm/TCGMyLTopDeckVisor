import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, aplicar, accionesLegales, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const armar = (e, j, nombre, portador) => poner(e, j, "arma", nombre, { portador });
const usable = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);

function combate(e, atacante) {
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  return e;
}

function hastaDano(e) {
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

function sacarDelJuego(e, uid) {
  N.mover(e, uid, "cementerio");
  resolver(e);
  return e;
}

test("Daga Bebedora: el portador gana 1 de Fuerza e Imbloqueable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Daga Bebedora", p);
  assert.equal(N.fuerza(e, p), 3);
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
});

test("Daga Bebedora: al entrar puedes Desterrar dos del tope para jugar gratis una copia del Castillo", () => {
  let e = mesa();
  const p1 = poner(e, 0, "defensa", "Sir Persival");
  const p2 = poner(e, 0, "defensa", "Draco Conjurador");
  oros(e, 0, 1);
  const daga = poner(e, 0, "mano", "Daga Bebedora");
  const copia = poner(e, 0, "castillo", "Daga Bebedora");
  e = hacer(e, jugar(daga, { portador: p1 }), true, copia, false);
  assert.equal(N.portadorDe(e, daga), p1);
  assert.equal(N.portadorDe(e, copia), p2);
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Daga Ritual: Exhumar y el portador gana 2 de Fuerza, Furia y daño al Destierro", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const daga = armar(e, 0, "Daga Ritual", p);
  assert.equal(N.tiene(e, daga, "Exhumar"), true);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(N.tiene(e, p, "DanoAlDestierro"), true);
});

test("Daga Ritual: cuando el portador hace daño pones un Oro del Destierro oponente en tu Oro Pagado", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  armar(e, 0, "Daga Ritual", g);
  e = hastaDano(combate(e, g));
  assert.equal(e.jugadores[1].destierro.length, 4);
  e = elegir(e, "Poner un Oro del Destierro oponente en tu Oro Pagado");
  const oro = e.pendiente.opciones[0].valor;
  e = elegir(e, oro);
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.ok(e.jugadores[0].pagado.includes(oro));
});

test("Daga Ritual: o buscas un Aliado y un Arma en tu Castillo", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  armar(e, 0, "Daga Ritual", g);
  const aliado = poner(e, 0, "castillo", "Sir Persival");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  e = hastaDano(combate(e, g));
  e = hacer(e, { tipo: "elegir", i: 1 }, aliado, arma);
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(zonaDe(e, arma), "mano");
});

test("Daga del Bandido: el portador gana 2 de Fuerza", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Daga del Bandido", p);
  assert.equal(N.fuerza(e, p), 4);
});

test("Daga del Bandido: al entrar cada jugador Bota cuatro y pones uno de los Oros Botados en tu Oro Pagado", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const daga = poner(e, 0, "mano", "Daga del Bandido");
  e = aplicar(e, jugar(daga, { portador: p }));
  const oro = e.pendiente.opciones.at(-1).valor;
  assert.equal(N.ubicar(e, oro).j, 1);
  e = elegir(e, oro);
  assert.equal(e.jugadores[0].castillo.length, 26);
  assert.equal(e.jugadores[1].castillo.length, 26);
  assert.equal(e.jugadores[0].cementerio.length + e.jugadores[1].cementerio.length, 7);
  assert.ok(e.jugadores[0].pagado.includes(oro));
});

test("Daga del Bandido: solo puede ser portada por Aliados Bandido", { todo: "restricción de portador: solo Aliados de cierta raza o Fuerza" }, () => {});

test("Daga del Bandido: el oponente paga un Oro adicional en tu Vigilia", { todo: "impuesto: el oponente paga un Oro adicional por jugar cartas y usar habilidades durante tu Vigilia" }, () => {});

test("Diabolista de Ébano: el portador gana 2 de Fuerza e Indesterrable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Diabolista de Ébano", p);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Indesterrable"), true);
});

test("Diabolista de Ébano: al entrar el oponente elige un Aliado suyo que pierde su habilidad y es Destruido", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const a = poner(e, 1, "defensa", "Sir Persival");
  const b = poner(e, 1, "defensa", "Jabberwocky");
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Diabolista de Ébano");
  e = aplicar(e, jugar(d, { portador: p }));
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, b);
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(zonaDe(e, a), "defensa");
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Diabolista de Ébano: si es el turno oponente, además él Bota cuatro cartas", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const a = poner(e, 1, "defensa", "Sir Persival");
  const d = armar(e, 0, "Diabolista de Ébano", p);
  e.activo = 1;
  N.disparar(e, "entra", { uid: d, j: 0 });
  resolver(e);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Diabolista de Ébano: se juega en Guerra de Talismanes o en la Fase Final oponente", { todo: "momento: jugar un Arma en la Guerra de Talismanes o al comienzo de una Fase" }, () => {});

test("El Huascar: el portador duplica su Fuerza y tus demás Aliados ganan Fuerza igual a su coste", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const otro = poner(e, 0, "defensa", "El Dracul");
  const rival = poner(e, 1, "defensa", "El Dracul");
  const h = armar(e, 0, "El Huascar", p);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.fuerza(e, otro), 3);
  assert.equal(N.fuerza(e, rival), 2);
  assert.equal(N.tiene(e, h, "Exhumar"), true);
});

test("El Huascar: una vez por turno Destierras hasta un Arma o Tótem y Robas dos cartas", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const h = armar(e, 0, "El Huascar", p);
  const r = poner(e, 1, "defensa", "Sir Persival");
  const ped = armar(e, 1, "Pedrenyal", r);
  e = hacer(e, habilidad(h, "El Huascar"), ped);
  assert.equal(zonaDe(e, ped), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(usable(e, h), false);
});

test("El Huascar: con Exhumar se juega desde el Cementerio", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 2);
  const h = poner(e, 0, "cementerio", "El Huascar");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === h && a.portador === p && a.desde === "cementerio"));
});

test("El Huascar: al entrar un Oro no puede ser agrupado el próximo turno", { todo: "efecto: un Oro no se agrupa en la próxima Agrupación" }, () => {});

test("Escudo de Energia: el portador gana 1 de Fuerza e Indesterrable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Escudo de Energia", p);
  assert.equal(N.fuerza(e, p), 3);
  assert.equal(N.tiene(e, p, "Indesterrable"), true);
});

test("Escudo de Energia: al entrar pones dos cartas del fondo de tu Castillo en tu mano", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const fondo = poner(e, 0, "castillo", "Sir Galahad");
  const esc = poner(e, 0, "mano", "Escudo de Energia");
  e = hacer(e, jugar(esc, { portador: p }), "Dos cartas del fondo de tu Castillo");
  assert.equal(zonaDe(e, fondo), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Escudo de Energia: al entrar pones dos cartas del tope de tu Castillo en tu mano", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const tope = e.jugadores[0].castillo[0];
  const esc = poner(e, 0, "mano", "Escudo de Energia");
  e = hacer(e, jugar(esc, { portador: p }), "Dos cartas del tope de tu Castillo");
  assert.equal(zonaDe(e, tope), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Escudo de Energia: Desterrarla reduce a 0 el daño de combate que recibirías este turno", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const r = poner(e, 1, "defensa", "Sir Persival");
  const esc = armar(e, 1, "Escudo de Energia", r);
  e = combate(e, g);
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, habilidad(esc, "Escudo de Energia"));
  assert.equal(zonaDe(e, esc), "destierro");
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Espada Divina: el portador gana 2 de Fuerza y Furia", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Espada Divina", p);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
});

test("Espada Divina: al entrar Destruye una carta que no sea Oro, Robas una y el oponente Bota tres", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const r = poner(e, 1, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const esp = poner(e, 0, "mano", "Espada Divina");
  e = hacer(e, jugar(esp, { portador: p }), "Destruir una carta en juego que no sea Oro", r);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Espada Divina: o Destruye hasta dos Tótems cuyos costes sumen hasta 3", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const isla = poner(e, 1, "apoyo", "Isla de Poveglia");
  const templo = poner(e, 1, "apoyo", "Templo Gótico");
  const hoshi = poner(e, 1, "apoyo", "Fortaleza Hoshi");
  oros(e, 0, 1);
  const esp = poner(e, 0, "mano", "Espada Divina");
  e = hacer(e, jugar(esp, { portador: p }), "Destruir hasta dos Tótems cuyos costes sumen hasta 3", isla);
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [templo, null]);
  e = elegir(e, templo);
  if (e.pendiente) e = elegir(e, false);
  assert.equal(zonaDe(e, isla), "cementerio");
  assert.equal(zonaDe(e, templo), "cementerio");
  assert.equal(zonaDe(e, hoshi), "apoyo");
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Espada Divina: también se dispara cuando su portador ataca", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Sir Galahad");
  armar(e, 0, "Espada Divina", g);
  const r = poner(e, 1, "defensa", "Sir Persival");
  e = combate(e, g);
  e = hacer(e, { tipo: "elegir", i: 0 }, r);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Espada Divina: con dos o más Armas su habilidad no puede ser cancelada", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});

test("Espada Larga: el portador gana 1 de Fuerza y al entrar Robas dos cartas", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 2);
  const esp = poner(e, 0, "mano", "Espada Larga");
  e = aplicar(e, jugar(esp, { portador: p }));
  assert.equal(N.fuerza(e, p), 3);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Espada Veyrazh: Exhumar y el portador gana 2 de Fuerza y Furia", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const v = armar(e, 0, "Espada Veyrazh", p);
  assert.equal(N.tiene(e, v, "Exhumar"), true);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
});

test("Espada Veyrazh: una vez por turno Destierras una carta en juego que no sea Oro", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const v = armar(e, 0, "Espada Veyrazh", p);
  const r = poner(e, 1, "defensa", "Sir Persival");
  e = hacer(e, habilidad(v, "Espada Veyrazh"), r);
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(usable(e, v), false);
});

test("Espada Veyrazh: cuando sale del juego puedes buscar una carta en tu Castillo", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const v = armar(e, 0, "Espada Veyrazh", p);
  const buscada = poner(e, 0, "castillo", "Sir Galahad");
  e = hacer(e, habilidad(v, "Espada Veyrazh"), v, true, buscada);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, buscada), "mano");
});

test("Espada de Akmallah: Exhumar y el portador gana 2 de Fuerza y no puede ser Barajado", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const a = armar(e, 0, "Espada de Akmallah", p);
  assert.equal(N.tiene(e, a, "Exhumar"), true);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "NoBarajable"), true);
});

test("Espada de Akmallah: Desterrarla deja hasta dos Aliados con Fuerza 0 por el turno", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const a = armar(e, 0, "Espada de Akmallah", p);
  const r1 = poner(e, 1, "defensa", "Jaques de Molay");
  const r2 = poner(e, 1, "defensa", "Padre Dagón");
  e = hacer(e, habilidad(a, "Espada de Akmallah"), r1, r2);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(N.fuerza(e, r1), 0);
  assert.equal(N.fuerza(e, r2), 0);
  assert.equal(N.fuerza(e, p), 2);
});

test("Espada de Akmallah: en tu Fase Final agrupa tus Aliados", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Espada de Akmallah", p);
  const atacante = poner(e, 0, "ataque", "Sir Galahad");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(zonaDe(e, atacante), "defensa");
});

test("Espada de Luz: Exhumar", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  assert.equal(N.tiene(e, armar(e, 0, "Espada de Luz", p), "Exhumar"), true);
});

test("Espada de Luz: si el portador es coste 2 o menos pierde su habilidad, es Destruido y Botas su Fuerza", () => {
  let e = mesa();
  const d = poner(e, 0, "defensa", "El Dracul");
  oros(e, 0, 1);
  const luz = poner(e, 0, "mano", "Espada de Luz");
  e = aplicar(e, jugar(luz, { portador: d }));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, luz), "cementerio");
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Espada de Luz: no afecta a portadores de coste 3 o más", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const luz = poner(e, 0, "mano", "Espada de Luz");
  e = aplicar(e, jugar(luz, { portador: p }));
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Espada de Luz: solo una vez por turno", () => {
  let e = mesa();
  const d1 = poner(e, 0, "defensa", "El Dracul");
  const d2 = poner(e, 0, "defensa", "El Dracul");
  oros(e, 0, 2);
  const l1 = poner(e, 0, "mano", "Espada de Luz");
  const l2 = poner(e, 0, "mano", "Espada de Luz");
  e = aplicar(e, jugar(l1, { portador: d1 }));
  e = aplicar(e, jugar(l2, { portador: d2 }));
  assert.equal(zonaDe(e, d1), "cementerio");
  assert.equal(zonaDe(e, d2), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Espada de Luz: su habilidad no puede ser cancelada ni prevenida", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});

test("Espada de O'Higgins: Exhumar y el portador gana 2 de Fuerza e Indesterrable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const o = armar(e, 0, "Espada de O'Higgins", p);
  assert.equal(N.tiene(e, o, "Exhumar"), true);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Indesterrable"), true);
});

test("Espada de O'Higgins: en tu Vigilia Barajas una carta que no sea Oro", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const o = armar(e, 0, "Espada de O'Higgins", p);
  const r = poner(e, 1, "defensa", "Jaques de Molay");
  e = hacer(e, habilidad(o, "Espada de O'Higgins"), "Barajar una carta en juego que no sea Oro", r);
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(usable(e, o), false);
});

test("Espada de O'Higgins: o buscas un Oro en tu Castillo y lo pones en tu mano", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const o = armar(e, 0, "Espada de O'Higgins", p);
  e = hacer(e, habilidad(o, "Espada de O'Higgins"), "Buscar un Oro en tu Castillo", (v) => v !== null);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].mano[0]).tipo, "Oro");
});

test("Espada de O'Higgins: en tu Fase Final Destierras hasta tres cartas de los Cementerios y Robas dos", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Espada de O'Higgins", p);
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Sir Galahad"));
  e = hacer(e, { tipo: "terminar" }, c[0], c[1], c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro", "cementerio"]);
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Espada de San Jeronimo: el portador gana 2 de Fuerza", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Espada de San Jeronimo", p);
  assert.equal(N.fuerza(e, p), 4);
});

test("Espada de San Jeronimo: un Aliado de coste 2 o menos tiene Fuerza 0 hasta tu próximo turno", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const s = armar(e, 0, "Espada de San Jeronimo", p);
  const r = poner(e, 1, "defensa", "El Dracul");
  poner(e, 1, "defensa", "Jaques de Molay");
  e = aplicar(e, habilidad(s, "Espada de San Jeronimo"));
  assert.equal(N.fuerza(e, r), 0);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(N.fuerza(e, r), 0);
});

test("Espada de San Jeronimo: se juega en Guerra de Talismanes", { todo: "momento: jugar un Arma en la Guerra de Talismanes o al comienzo de una Fase" }, () => {});

test("Espada del Guerrero Inmortal: el portador gana 2 de Fuerza y Furia y tus Aliados ganan 1", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const otro = poner(e, 0, "defensa", "El Dracul");
  const rival = poner(e, 1, "defensa", "El Dracul");
  armar(e, 0, "Espada del Guerrero Inmortal", p);
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(N.fuerza(e, otro), 3);
  assert.equal(N.fuerza(e, rival), 2);
});

test("Espada del Guerrero Inmortal: en tu Vigilia buscas un Aliado y un Arma o Robas dos", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const g = armar(e, 0, "Espada del Guerrero Inmortal", p);
  const aliado = poner(e, 0, "castillo", "Sir Galahad");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  let f = hacer(e, habilidad(g, "Espada del Guerrero Inmortal"), "Buscar un Aliado y un Arma", aliado, arma);
  assert.equal(zonaDe(f, aliado), "mano");
  assert.equal(zonaDe(f, arma), "mano");
  assert.equal(usable(f, g), false);
  f = hacer(e, habilidad(g, "Espada del Guerrero Inmortal"), "Robar dos cartas");
  assert.equal(f.jugadores[0].mano.length, 2);
});

test("Espada del Juicio: el portador gana 2 de Fuerza e Imbloqueable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Espada del Juicio", p);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
});

test("Espada del Juicio: al entrar Destierra tres del tope de un Castillo y Robas una", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const j = poner(e, 0, "mano", "Espada del Juicio");
  e = hacer(e, jugar(j, { portador: p }), "Castillo oponente");
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Espada del Juicio: en tu Agrupación vuelve a Desterrar tres del tope de un Castillo y Robas una", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Espada del Juicio", p);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, "tu Castillo");
  assert.equal(e.jugadores[0].destierro.length, 3);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Espada del Juicio: Desterrarla de tu Cementerio hace que un Aliado pierda 2 de Fuerza permanentemente", () => {
  let e = mesa();
  const j = poner(e, 0, "cementerio", "Espada del Juicio");
  const r = poner(e, 1, "defensa", "Jaques de Molay");
  e = hacer(e, habilidad(j, "Espada del Juicio"), "Pierde 2 de Fuerza");
  assert.equal(zonaDe(e, j), "destierro");
  assert.equal(N.fuerza(e, r), 2);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(N.fuerza(e, r), 2);
});

test("Espada del Juicio: o que un Aliado gane 2 de Fuerza", () => {
  let e = mesa();
  const j = poner(e, 0, "cementerio", "Espada del Juicio");
  const a = poner(e, 0, "defensa", "Sir Persival");
  e = hacer(e, habilidad(j, "Espada del Juicio"), "Gana 2 de Fuerza");
  assert.equal(N.fuerza(e, a), 4);
});

test("Espada del Orden: el portador gana 2 de Fuerza e Indesterrable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Espada del Orden", p);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Indesterrable"), true);
});

test("Espada del Orden: al entrar sube dos cartas al azar de tu Cementerio y un Aliado oponente de coste 2 o menos a la mano", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  [1, 2, 3].forEach(() => poner(e, 0, "cementerio", "Sir Galahad"));
  const r = poner(e, 1, "defensa", "El Dracul");
  const o = poner(e, 0, "mano", "Espada del Orden");
  e = hacer(e, jugar(o, { portador: p }), true, r);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(zonaDe(e, r), "mano");
  assert.equal(N.ubicar(e, r).j, 1);
});

test("Espada del Orden: cuando es Destruida puedes Descartar una carta para subirla a tu mano", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const o = armar(e, 0, "Espada del Orden", p);
  const d = poner(e, 0, "mano", "Sir Galahad");
  e = sacarDelJuego(e, o);
  e = elegir(e, true);
  assert.equal(zonaDe(e, o), "mano");
  assert.equal(zonaDe(e, d), "cementerio");
});

test("Espada del Orden: se juega en Guerra de Talismanes", { todo: "momento: jugar un Arma en la Guerra de Talismanes o al comienzo de una Fase" }, () => {});

test("Estaca: el portador gana 2 de Fuerza y Furia", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Estaca", p);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
});

test("Estaca: Robas tres, Barajas una carta oponente que no sea Oro y tantas de tu mano como su coste", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const s = armar(e, 0, "Estaca", p);
  const r = poner(e, 1, "defensa", "El Dracul");
  e = aplicar(e, habilidad(s, "Estaca"));
  assert.equal(zonaDe(e, r), "castillo");
  e = elegir(e, e.pendiente.opciones[0].valor);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.equal(usable(e, s), false);
});

test("Estaca: Desterrarla previene que una carta sea afectada por un efecto oponente", { todo: "efecto: prevenir un efecto" }, () => {});

test("Estaca y Martillo: el portador gana 2 de Fuerza", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Estaca y Martillo", p);
  assert.equal(N.fuerza(e, p), 4);
});

test("Estaca y Martillo: Barajas un Aliado de coste 2 o menos", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const s = armar(e, 0, "Estaca y Martillo", p);
  const r = poner(e, 1, "defensa", "El Dracul");
  e = hacer(e, habilidad(s, "Estaca y Martillo"), "Barajar un Aliado de coste 2 o menos");
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(usable(e, s), false);
});

test("Estaca y Martillo: o buscas una carta que no sea Talismán", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const s = armar(e, 0, "Estaca y Martillo", p);
  const tal = poner(e, 0, "castillo", "Llamar a la Manada");
  const ali = poner(e, 0, "castillo", "Sir Galahad");
  e = aplicar(e, habilidad(s, "Estaca y Martillo"));
  e = elegir(e, "Buscar una carta que no sea Talismán");
  assert.equal(e.pendiente.opciones.some((o) => o.valor === tal), false);
  e = elegir(e, ali);
  assert.equal(zonaDe(e, ali), "mano");
});

test("Estaca y Martillo: se juega al comienzo de cualquier Fase o en Guerra de Talismanes", { todo: "momento: jugar un Arma en la Guerra de Talismanes o al comienzo de una Fase" }, () => {});

test("Estaca y Martillo: el portador no puede ser afectado por Aliados oponentes", { todo: "protección: el portador no puede ser afectado por Aliados oponentes" }, () => {});

test("Flechar Xoon: Exhumar y el portador gana 2 de Fuerza e Indesterrable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const x = armar(e, 0, "Flechar Xoon", p);
  assert.equal(N.tiene(e, x, "Exhumar"), true);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Indesterrable"), true);
});

test("Flechar Xoon: cuando sale del juego puedes Desterrar una carta de coste 2 o menos", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const x = armar(e, 0, "Flechar Xoon", p);
  const r = poner(e, 1, "defensa", "El Dracul");
  e = sacarDelJuego(e, x);
  e = elegir(e, true);
  assert.equal(zonaDe(e, r), "destierro");
});

test("Flechar Xoon: subir una carta que controles para Anular un Talismán o Tótem de coste 2 o menos", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Garfio Pirata: el portador gana 2 de Fuerza y Furia y al entrar no puede salir del juego hasta tu próximo turno", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Garfio Pirata");
  e = aplicar(e, jugar(g, { portador: p }));
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(N.puedeSalir(e, p), false);
});

test("Garfio Pirata: cuando el portador de coste 1 o más ataca, Robas una carta o generas un Oro", () => {
  let e = mesa();
  const a = poner(e, 0, "defensa", "Sir Galahad");
  armar(e, 0, "Garfio Pirata", a);
  e = combate(e, a);
  const f = elegir(e, "Robar una carta");
  assert.equal(f.jugadores[0].mano.length, 1);
  const g = elegir(e, "Generar un Oro");
  assert.equal(g.jugadores[0].generados.reduce((s, x) => s + x.n, 0), 1);
});

test("Garfio Pirata: tienes la prioridad en Guerra de Talismanes", { todo: "prioridad: el controlador tiene la prioridad en la Guerra de Talismanes" }, () => {});

test("Garras de Demonio: al entrar buscas una carta que no sea Talismán", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 1);
  const b = poner(e, 0, "castillo", "Sir Galahad");
  const g = poner(e, 0, "mano", "Garras de Demonio");
  e = hacer(e, jugar(g, { portador: p }), b);
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(N.fuerza(e, p), 2);
});

test("Garras de Demonio: en tu Fase Final puedes Barajar hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Garras de Demonio", p);
  const c1 = poner(e, 0, "cementerio", "Sir Galahad");
  const c2 = poner(e, 1, "cementerio", "Sir Galahad");
  e = hacer(e, { tipo: "terminar" }, true, c1, c2);
  assert.equal(zonaDe(e, c1), "castillo");
  assert.equal(zonaDe(e, c2), "castillo");
});

test("Garras de Demonio: cuando sale del juego el oponente Bota cuatro cartas", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const g = armar(e, 0, "Garras de Demonio", p);
  e = sacarDelJuego(e, g);
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Garras de Dragón: Exhumar y el portador gana Fuerza igual a su coste y no puede ser Barajado", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const otro = poner(e, 0, "defensa", "El Dracul");
  const g = armar(e, 0, "Garras de Dragón", p);
  assert.equal(N.tiene(e, g, "Exhumar"), true);
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.fuerza(e, otro), 2);
  assert.equal(N.tiene(e, p, "NoBarajable"), true);
});

test("Garras de Dragón: al entrar cada jugador Bota tantas como Oros controle su oponente y pones un Oro de un Cementerio en tu Oro Pagado", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  oros(e, 0, 2);
  oros(e, 1, 3);
  const g = poner(e, 0, "mano", "Garras de Dragón");
  e = aplicar(e, jugar(g, { portador: p }));
  assert.equal(e.jugadores[0].castillo.length, 27);
  assert.equal(e.jugadores[1].castillo.length, 28);
  e = elegir(e, e.pendiente.opciones[0].valor);
  assert.equal(N.orosDe(e, 0).length, 3);
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Gatling: el portador gana 3 de Fuerza e Imbloqueable", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Gatling", p);
  assert.equal(N.fuerza(e, p), 5);
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
});

test("Gatling: una vez por turno una carta pierde su habilidad por el turno y Robas una", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const g = armar(e, 0, "Gatling", p);
  const r = poner(e, 1, "defensa", "Jaques de Molay");
  e = hacer(e, habilidad(g, "Gatling"), r);
  assert.equal(N.activa(e, r), false);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(usable(e, g), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(N.activa(e, r), true);
});

test("Gatling: no se puede atacar con más Aliados que Oros controlados", { todo: "restricción: cada jugador ataca con a lo sumo tantos Aliados como Oros controla" }, () => {});

test("Guadaña Gigante: el portador pierde 4 de Fuerza y no puede salir del juego; el Arma no pierde su habilidad", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Padre Dagón");
  const g = armar(e, 0, "Guadaña Gigante", p);
  assert.equal(N.tiene(e, g, "Exhumar"), true);
  assert.equal(N.fuerza(e, p), 2);
  assert.equal(N.puedeSalir(e, p), false);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: g }, 1);
  assert.equal(N.activa(e, g), true);
});

test("Guadaña Gigante: al entrar el portador pierde su habilidad, Destierras dos del tope y el oponente Roba una", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Padre Dagón");
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Guadaña Gigante");
  e = aplicar(e, jugar(g, { portador: p }));
  assert.equal(N.activa(e, p), false);
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Guadaña Gigante: al comienzo de la Vigilia oponente Destierras dos del tope y el oponente Roba una", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Padre Dagón");
  armar(e, 0, "Guadaña Gigante", p);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Guadaña de Santa Muerte: el portador gana 2 de Fuerza e Indestructible", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Guadaña de Santa Muerte", p);
  assert.equal(N.fuerza(e, p), 4);
  assert.equal(N.tiene(e, p, "Indestructible"), true);
});

test("Guadaña de Santa Muerte: al entrar puedes Destruir un Aliado", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  const r = poner(e, 1, "defensa", "Jaques de Molay");
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Guadaña de Santa Muerte");
  e = hacer(e, jugar(g, { portador: p }), true);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(zonaDe(e, p), "defensa");
});

test("Guadaña de Santa Muerte: en tu Fase Final, sin Aliados con Furia o Imbloqueable, agrupas un Oro y muestras hasta un Talismán", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Guadaña de Santa Muerte", p);
  const oro = poner(e, 0, "pagado", "Drácula");
  const tal = poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, oro), "reserva");
  assert.equal(zonaDe(e, tal), "mano");
});

test("Guadaña de Santa Muerte: si controlas un Aliado con Furia no se dispara en la Fase Final", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Sir Persival");
  armar(e, 0, "Guadaña de Santa Muerte", p);
  poner(e, 0, "defensa", "El Dracul");
  const oro = poner(e, 0, "pagado", "Drácula");
  const tal = poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, oro), "pagado");
  assert.equal(zonaDe(e, tal), "castillo");
});

test("Guadaña de Santa Muerte: no puede portarse en Aliados de Fuerza 2 o 3", { todo: "restricción de portador: solo Aliados de cierta raza o Fuerza" }, () => {});
