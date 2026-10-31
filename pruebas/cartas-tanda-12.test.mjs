import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeJugar = (e, uid, desde) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid && a.desde === desde);
const puedeUsar = (e, uid, nombre) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.def === id(nombre));
const responde = (e, uid) => accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === uid);

function guerra() {
  const e = mesa();
  e.fase = "talismanes";
  e.prioridad = 1;
  e.pases = 0;
  return e;
}

test("Guerra Celestial: se juega en respuesta a un Aliado de coste 3 o menos; si el oponente no paga, el Aliado no tiene habilidades este turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "mano", "Valefor");
  const gc = poner(e, 1, "mano", "Guerra Celestial");
  oros(e, 1, 1);
  e = aplicar(e, jugar(v));
  assert.equal(responde(e, gc), true);
  e = aplicar(e, { tipo: "responder", uid: gc });
  e = sinRespuesta(e);
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, null);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.activa(e, v), false);
  assert.equal(zonaDe(e, gc), "cementerio");
  assert.equal(e.jugadores[1].mano.length, 0);
});

test("Guerra Celestial: si el oponente paga un Oro, conserva las habilidades y tú robas una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "mano", "Valefor");
  const gc = poner(e, 1, "mano", "Guerra Celestial");
  oros(e, 1, 1);
  e = aplicar(e, jugar(v));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: gc }));
  const [oro] = e.jugadores[0].reserva;
  e = elegir(e, oro);
  assert.equal(zonaDe(e, oro), "pagado");
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.activa(e, v), true);
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Guerra Celestial: no se puede jugar en respuesta a un Aliado de coste 4 ni fuera de respuesta", () => {
  let e = mesa();
  oros(e, 0, 4);
  const caro = poner(e, 0, "mano", "Vathek");
  const gc = poner(e, 1, "mano", "Guerra Celestial");
  oros(e, 1, 1);
  e = aplicar(e, jugar(caro));
  assert.equal(responde(e, gc), false);
  const g = guerra();
  const gc2 = poner(g, 1, "mano", "Guerra Celestial");
  oros(g, 1, 1);
  assert.equal(puedeJugar(g, gc2, undefined), false);
});

test("Guerra Celestial: también responde a Tótem de coste 3 o menos", { todo: "respuesta: filtro de la carta respondida por varios tipos (Aliado o Tótem)" }, () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Isla de Poveglia");
  const gc = poner(e, 1, "mano", "Guerra Celestial");
  oros(e, 1, 1);
  e = aplicar(e, jugar(t));
  assert.equal(responde(e, gc), true);
});

test("Gula: roba siete cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "mano", "Gula");
  e = sinRespuesta(aplicar(e, jugar(g)));
  assert.equal(e.jugadores[0].mano.length, 7);
  assert.equal(zonaDe(e, g), "cementerio");
});

test("Gula: al comienzo de tu Vigilia, desde tu Cementerio y sin Oros en Reserva, robas una carta", () => {
  let e = mesa();
  poner(e, 1, "cementerio", "Gula");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Gula: con Oros en Reserva no roba al comienzo de la Vigilia", () => {
  let e = mesa();
  poner(e, 1, "cementerio", "Gula");
  oros(e, 1, 1);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.jugadores[1].mano.length, 0);
});

test("Gula: cada vez que mueves Oros a tu Oro Pagado este turno, Barajas una de tu Cementerio y robas", { todo: "evento: cuando un jugador mueve Oros a su Oro Pagado" }, () => {
  assert.fail();
});

test("Hain: Baraja todos los Aliados y Tótem en juego y hasta cuatro cartas de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Hain");
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Sir Persival");
  const t = poner(e, 1, "apoyo", "Fortaleza Hoshi");
  const c1 = poner(e, 0, "cementerio", "Valefor");
  const c2 = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, c1);
  e = elegir(e, null);
  assert.deepEqual([a, b, t, c1].map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "castillo"]);
  assert.equal(zonaDe(e, c2), "cementerio");
  assert.equal(zonaDe(e, h), "cementerio");
});

test("Hain: Desterrarlo de tu Cementerio cuesta un Oro adicional", { todo: "restricción: el oponente paga un coste para Desterrar esta carta del Cementerio" }, () => {
  assert.fail();
});

test("Hain: mientras esté en tu Cementerio no se pueden Buscar cartas en los Castillos", { todo: "continua desde el Cementerio: no se pueden Buscar cartas en los Castillos" }, () => {
  assert.fail();
});

test("Haka Pei: Destruye una carta oponente de coste 1 o menos, Baraja y/o Destierra hasta tres de los Cementerios y roba una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const hp = poner(e, 0, "mano", "Haka Pei");
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "defensa", "Sir Persival");
  const c = [0, 0, 1].map((j) => poner(e, j, "cementerio", "Jabberwocky"));
  e = sinRespuesta(aplicar(e, jugar(hp)));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, p), "defensa");
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  e = elegir(e, null);
  e = elegir(e, c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro"]);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Haka Pei: cuando un efecto oponente lo pone en tu Cementerio, se juega sin pagar y se Destierra", { todo: "disparada: al ser puesto en tu Cementerio por un efecto oponente" }, () => {
  assert.fail();
});

test("Hambre del Vacio: robas una y el oponente elige dos Oros con habilidad que controle y quedan sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const hv = poner(e, 0, "mano", "Hambre del Vacio");
  const onsen = poner(e, 1, "reserva", "Onsen");
  const tyet = poner(e, 1, "reserva", "Tyet");
  const agua = poner(e, 1, "reserva", "Agua Sagrada");
  poner(e, 1, "reserva", "Drácula");
  e = sinRespuesta(aplicar(e, jugar(hv)));
  assert.equal(e.pendiente.jugador, 1);
  assert.equal(e.pendiente.opciones.length, 3);
  e = elegir(e, onsen);
  e = elegir(e, tyet);
  assert.equal(N.activa(e, onsen), false);
  assert.equal(N.activa(e, tyet), false);
  assert.equal(N.carta(e, onsen).sinHabilidad, true);
  assert.equal(N.activa(e, agua), true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Hambre del Vacio: puede jugarse en la Fase Final", { todo: "momento: jugar un Talismán en la Fase Final" }, () => {
  assert.fail();
});

test("Hambre del Vacio: en tu Cementerio no puede ser Desterrado y las cartas en juego no pueden perder la habilidad", { todo: "continua desde el Cementerio: las cartas en juego no pueden perder la habilidad y la carta no puede ser Desterrada" }, () => {
  assert.fail();
});

test("Heraldos del Titán: en tu turno, hasta dos Aliados deben atacar o bloquear y generas un Oro para Armas o Tótem", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "mano", "Heraldos del Titán");
  const v = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, v);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma", "Tótem"] }]);
  assert.equal(e.efectos.some((f) => f.tipo === "debeAtacar" && f.uid === v), true);
  assert.equal(e.efectos.some((f) => f.tipo === "debeBloquear" && f.uid === v), true);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "terminar"), false);
});

test("Heraldos del Titán: fuera de tu turno tus Aliados ganan 1 de Fuerza, Indestructible e Indesterrable", () => {
  let e = guerra();
  oros(e, 1, 1);
  const h = poner(e, 1, "mano", "Heraldos del Titán");
  const v = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, null);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "Indestructible"), true);
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
  assert.equal((e.jugadores[1].generados ?? []).length, 0);
});

test("Heraldos del Titán: puede jugarse al comienzo de cualquier Fase", { todo: "momento: jugar un Talismán al comienzo de cualquier Fase" }, () => {
  assert.fail();
});

test("Herido Peleo Mejor: cada jugador conserva un Aliado y Baraja los demás; con tres o más genera un Oro para Aliados", () => {
  let e = mesa();
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Herido Peleo Mejor");
  const [a1, a2, a3] = [1, 2, 3].map(() => poner(e, 0, "defensa", "Valefor"));
  const [b1, b2] = [1, 2].map(() => poner(e, 1, "defensa", "Sir Persival"));
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, a1);
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, b1);
  assert.deepEqual([a1, a2, a3, b1, b2].map((u) => zonaDe(e, u)), ["defensa", "castillo", "castillo", "defensa", "castillo"]);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Aliado"] }]);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Herido Peleo Mejor: con menos de tres Aliados Barajados robas dos cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Herido Peleo Mejor");
  const a1 = poner(e, 0, "defensa", "Valefor");
  const a2 = poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, a1);
  assert.equal(zonaDe(e, a2), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal((e.jugadores[0].generados ?? []).length, 0);
});

test("Herido Peleo Mejor: tiene Exhumar y se juega desde el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const h = poner(e, 0, "cementerio", "Herido Peleo Mejor");
  assert.equal(puedeJugar(e, h, "cementerio"), true);
  e = sinRespuesta(aplicar(e, jugar(h, { desde: "cementerio" })));
  assert.equal(zonaDe(e, h), "destierro");
});

test("Hijo Mortal: destruye una carta de coste 2 o menos y busca una carta de tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const hm = poner(e, 0, "mano", "Hijo Mortal");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  const v = poner(e, 0, "castillo", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(hm)));
  e = elegir(e, "Destruir una carta de coste 2 o menos");
  e = elegir(e, "Buscar una carta en tu Castillo y ponerla en tu mano");
  e = elegir(e, jab);
  e = elegir(e, nombreDe(e, "Valefor"));
  assert.equal(zonaDe(e, jab), "cementerio");
  assert.equal(zonaDe(e, v), "mano");
});

test("Hijo Mortal: una carta en juego pierde su habilidad hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const hm = poner(e, 0, "mano", "Hijo Mortal");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(hm)));
  e = elegir(e, "Una carta en juego pierde su habilidad hasta tu próximo turno");
  e = elegir(e, null);
  e = elegir(e, p);
  assert.equal(N.activa(e, p), false);
  assert.equal(e.efectos.find((f) => f.uid === p).fin.inicioDe, 0);
});

test("Hijos de la Noche: Destierra hasta una carta de cada tipo del Castillo oponente; con más de tres no hay efecto adicional", () => {
  let e = mesa();
  oros(e, 0, 2);
  const hn = poner(e, 0, "mano", "Hijos de la Noche");
  const v = poner(e, 1, "castillo", "Valefor");
  const p = poner(e, 1, "castillo", "Pedrenyal");
  const t = poner(e, 1, "castillo", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(hn)));
  e = elegir(e, v);
  e = elegir(e, p);
  e = elegir(e, t);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(e.pendiente, null);
  assert.deepEqual([v, p, t].map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro"]);
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Hijos de la Noche: con tres o menos Desterradas puedes poner el Oro Desterrado en tu Oro Pagado y robar dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const hn = poner(e, 0, "mano", "Hijos de la Noche");
  const v = poner(e, 1, "castillo", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(hn)));
  e = elegir(e, v);
  e = elegir(e, nombreDe(e, "Drácula"));
  e = elegir(e, true);
  e = elegir(e, "Poner un Oro Desterrado en tu Oro Pagado y robar dos cartas");
  const oro = e.jugadores[0].pagado.find((u) => N.dueno(u) === 1);
  assert.ok(oro);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Hijos de la Noche: o jugar una carta del Destierro oponente reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 4);
  const hn = poner(e, 0, "mano", "Hijos de la Noche");
  const sp = poner(e, 1, "destierro", "Sir Persival");
  poner(e, 1, "destierro", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(hn)));
  e = elegir(e, null);
  e = elegir(e, true);
  assert.deepEqual(e.pendiente.opciones.map((o) => o.texto), ["Jugar una carta que no sea Talismán del Destierro oponente reduciendo su coste en un Oro"]);
  e = elegir(e, "Jugar una carta que no sea Talismán del Destierro oponente reduciendo su coste en un Oro");
  assert.equal(zonaDe(e, sp), "defensa");
  assert.equal(N.controlador(e, sp), 0);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Honor del Quijote: su coste baja un Oro por cada carta jugada por el oponente este turno, hasta 0", () => {
  const e = mesa();
  const h = poner(e, 0, "mano", "Honor del Quijote");
  assert.equal(costeDe(e, 0, h).pagar, 2);
  e.jugadores[1].jugadas.Talismán = 1;
  assert.equal(costeDe(e, 0, h).pagar, 1);
  e.jugadores[1].jugadas.Aliado = 2;
  assert.equal(costeDe(e, 0, h).pagar, 0);
});

test("Honor del Quijote: busca una carta de coste 1 o más y, si pagaste Oros, Baraja una carta de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const h = poner(e, 0, "mano", "Honor del Quijote");
  const v = poner(e, 0, "castillo", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Drácula"), false);
  e = elegir(e, v);
  e = elegir(e, r);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, r), "castillo");
});

test("Honor del Quijote: sin pagar Oros no Baraja", () => {
  let e = mesa();
  const h = poner(e, 0, "mano", "Honor del Quijote");
  const v = poner(e, 0, "castillo", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Persival");
  e.jugadores[1].jugadas.Aliado = 2;
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, v);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, r), "defensa");
});

test("Hp Lovecraft: se Destierra y un Aliado gana una habilidad de una vez por turno para Desterrar y hacer Desterrar de la mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const hp = poner(e, 0, "mano", "Hp Lovecraft");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Persival");
  const m = poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(hp)));
  e = elegir(e, v);
  assert.equal(zonaDe(e, hp), "destierro");
  assert.equal(puedeUsar(e, r, "Hp Lovecraft"), false);
  assert.equal(puedeUsar(e, v, "Hp Lovecraft"), true);
  e = aplicar(e, habilidad(v, "Hp Lovecraft"));
  e = elegir(e, r);
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(zonaDe(e, m), "destierro");
  assert.equal(puedeUsar(e, v, "Hp Lovecraft"), false);
});

test("Hp Lovecraft: el Aliado pierde la habilidad ganada al salir del juego", () => {
  let e = mesa();
  oros(e, 0, 2);
  const hp = poner(e, 0, "mano", "Hp Lovecraft");
  const v = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(hp)));
  N.mover(e, v, "mano");
  assert.equal(e.ganadas[v], undefined);
});

test("Huida de Marte: se Destierra y robas dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "mano", "Huida de Marte");
  e = sinRespuesta(aplicar(e, jugar(h)));
  assert.equal(zonaDe(e, h), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Huida de Marte: hasta tu próximo turno solo se puede atacar con hasta dos Aliados por turno", { todo: "efecto: máximo de Aliados atacantes por turno, para ambos jugadores" }, () => {
  assert.fail();
});

test("Hundir Barcos: Baraja una carta de coste 2 o menos y roba una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "mano", "Hundir Barcos");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, jab);
  assert.equal(zonaDe(e, jab), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Hundir Barcos: no puede ser Anulado por Aliados ni Armas", { todo: "protección: no puede ser Anulado por cartas de ciertos tipos" }, () => {
  assert.fail();
});

test("Hundir Barcos: si es Descartado por efecto oponente, robas dos y se convierte en Oro sin habilidad en tu Oro Pagado", { todo: "disparada: al ser Descartado por un efecto oponente" }, () => {
  assert.fail();
});

test("Héroes de la Concepcion: Baraja una carta de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "mano", "Héroes de la Concepcion");
  const r = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = elegir(e, "Barajar una carta de coste 3 o menos");
  e = elegir(e, r);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Héroes de la Concepcion: la otra opción roba una carta y tiene Exhumar", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "cementerio", "Héroes de la Concepcion");
  assert.equal(puedeJugar(e, h, "cementerio"), true);
  e = sinRespuesta(aplicar(e, jugar(h, { desde: "cementerio" })));
  e = elegir(e, "Cambiar los objetivos de un efecto oponente a una carta que controles y robar una carta");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, h), "destierro");
});

test("Héroes de la Concepcion: cambia los objetivos de un efecto oponente a una carta que controles", { todo: "efecto: cambiar los objetivos de un efecto oponente" }, () => {
  assert.fail();
});

test("Identidad Secreta: Anula un Arma de coste 3 o menos y la Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  const is = poner(e, 1, "mano", "Identidad Secreta");
  oros(e, 1, 1);
  e = aplicar(e, jugar(arma, { portador: v }));
  assert.equal(responde(e, is), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: is }));
  assert.equal(zonaDe(e, arma), "destierro");
  assert.equal(e.armas[v], undefined);
});

test("Identidad Secreta: también Anula un Tótem de coste 3 o menos", { todo: "respuesta: filtro de la carta respondida por varios tipos (Arma o Tótem)" }, () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Isla de Poveglia");
  const is = poner(e, 1, "mano", "Identidad Secreta");
  oros(e, 1, 1);
  e = aplicar(e, jugar(t));
  assert.equal(responde(e, is), true);
});

test("Identidad Secreta: Destierra las Armas en juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  const is = poner(e, 0, "mano", "Identidad Secreta");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Persival");
  const a1 = poner(e, 0, "arma", "Pedrenyal", { portador: v });
  const a2 = poner(e, 1, "arma", "Hacha Danesa", { portador: r });
  const t = poner(e, 1, "apoyo", "Fortaleza Hoshi");
  e = sinRespuesta(aplicar(e, jugar(is)));
  e = elegir(e, "Desterrar las Armas en juego");
  assert.equal(zonaDe(e, a1), "destierro");
  assert.equal(zonaDe(e, a2), "destierro");
  assert.equal(zonaDe(e, t), "apoyo");
});

test("Identidad Secreta: o Destierra un Tótem", () => {
  let e = mesa();
  oros(e, 0, 1);
  const is = poner(e, 0, "mano", "Identidad Secreta");
  const t = poner(e, 1, "apoyo", "Fortaleza Hoshi");
  e = sinRespuesta(aplicar(e, jugar(is)));
  e = elegir(e, "Desterrar un Tótem");
  assert.equal(zonaDe(e, t), "destierro");
});

test("Identidad Secreta: pagando un Oro sube de tu Cementerio a tu mano y robas una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const is = poner(e, 0, "cementerio", "Identidad Secreta");
  assert.equal(puedeUsar(e, is, "Identidad Secreta"), true);
  e = aplicar(e, habilidad(is, "Identidad Secreta"));
  assert.equal(zonaDe(e, is), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Illuminati: se Destierra y cancela la habilidad de una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const il = poner(e, 0, "mano", "Illuminati");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(il)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).nombre === "Sir Persival"), false);
  e = elegir(e, jab);
  assert.equal(N.activa(e, jab), false);
  assert.equal(zonaDe(e, il), "destierro");
});

test("Iluminar el Camino: se juega en respuesta, no puede ser Anulado y no Anula la carta respondida", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const ic = poner(e, 1, "mano", "Iluminar el Camino");
  oros(e, 1, 1);
  assert.equal(N.carta(e, ic).claves.includes("NoAnulable"), true);
  e = aplicar(e, jugar(v));
  assert.equal(responde(e, ic), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: ic }));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(zonaDe(e, ic), "cementerio");
});

test("Iluminar el Camino: solo en respuesta a la segunda carta del turno oponente", { todo: "momento: jugar en respuesta a que el oponente juegue su segunda carta del turno" }, () => {
  assert.fail();
});

test("Iluminar el Camino: el oponente solo juega una carta más de ese tipo y tú no juegas más cartas este turno", { todo: "efecto: límite de cartas jugadas de un tipo por turno para el oponente y no jugar más cartas para ti" }, () => {
  assert.fail();
});

test("Intervencion Divina: una carta pierde su habilidad por el turno", () => {
  let e = mesa();
  const id0 = poner(e, 0, "mano", "Intervencion Divina");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(id0)));
  e = elegir(e, "Una carta pierde su habilidad por el turno");
  assert.equal(N.activa(e, p), false);
  assert.equal(e.efectos.find((f) => f.uid === p).fin.finTurno, e.turno);
});

test("Intervencion Divina: Baraja y/o Destierra hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const id0 = poner(e, 0, "mano", "Intervencion Divina");
  const c = [0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(id0)));
  e = elegir(e, "Barajar y/o Desterrar hasta tres cartas de los Cementerios");
  e = elegir(e, c[0]);
  e = elegir(e, null);
  e = elegir(e, c[1]);
  e = elegir(e, null);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "destierro", "cementerio"]);
});

test("Intervencion Divina: mueve un Aliado a la Línea de Ataque", () => {
  let e = mesa();
  const id0 = poner(e, 0, "mano", "Intervencion Divina");
  const v = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(id0)));
  e = elegir(e, "Mover un Aliado a la Línea de Ataque");
  assert.equal(zonaDe(e, v), "ataque");
});

test("Intervencion Divina: puede jugarse al comienzo de cualquier Fase", { todo: "momento: jugar un Talismán al comienzo de cualquier Fase" }, () => {
  assert.fail();
});

test("Invasión: un Oro oponente pierde su habilidad, es Desterrado y robas dos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const inv = poner(e, 0, "mano", "Invasión");
  const onsen = poner(e, 1, "reserva", "Onsen");
  e = sinRespuesta(aplicar(e, jugar(inv)));
  e = elegir(e, "Un Oro oponente pierde su habilidad y es Desterrado");
  assert.equal(zonaDe(e, onsen), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Invasión: o hasta dos cartas que no sean Oro pierden su habilidad y son Desterradas", () => {
  let e = mesa();
  oros(e, 0, 3);
  const inv = poner(e, 0, "mano", "Invasión");
  const a = poner(e, 1, "defensa", "Sir Persival");
  const b = poner(e, 1, "apoyo", "Carcosa");
  e = sinRespuesta(aplicar(e, jugar(inv)));
  e = elegir(e, "Hasta dos cartas que no sean Oro pierden su habilidad y son Desterradas");
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 0);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Invasión: tiene Exhumar y no puede ser Anulado", () => {
  const e = mesa();
  oros(e, 0, 3);
  const inv = poner(e, 0, "cementerio", "Invasión");
  assert.equal(N.tiene(e, inv, "NoAnulable"), true);
  assert.equal(puedeJugar(e, inv, "cementerio"), true);
});

test("Invasión: solo puede ser jugada pagando su coste", { todo: "restricción: la carta solo puede jugarse pagando su coste" }, () => {
  assert.fail();
});

test("Invocar Anfibios: cancela la habilidad de una carta en juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ia = poner(e, 0, "mano", "Invocar Anfibios");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(ia)));
  e = elegir(e, p);
  assert.equal(N.activa(e, p), false);
});

test("Invocar Anfibios: cancela la habilidad de una carta fuera del juego y se juega mostrando la mano", { todo: "efecto: cancelar la habilidad de una carta fuera del juego; coste: mostrar la mano" }, () => {
  assert.fail();
});

test("Invocar Ángeles: juega un Aliado Ángel de tu Cementerio reduciendo su coste en un Oro", () => {
  let e = mesa();
  const base = e.catalogo[id("Sir Persival")];
  e.catalogo = { ...e.catalogo, [base.id]: { ...base, razas: ["Ángel"] } };
  oros(e, 0, 5);
  const ia = poner(e, 0, "mano", "Invocar Ángeles");
  const sp = poner(e, 0, "cementerio", "Sir Persival");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ia)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === v), false);
  e = elegir(e, sp);
  assert.equal(zonaDe(e, sp), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Invocar Ángeles: solo desde tu mano pagando su coste, y el oponente juega mostrando su mano", { todo: "restricción: la carta solo puede jugarse pagando su coste; efecto: el oponente juega con la mano revelada" }, () => {
  assert.fail();
});

test("Ira: un Aliado gana Furia, Imbloqueable, 3 de Fuerza y daño al Destierro por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ira = poner(e, 0, "mano", "Ira");
  const v = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ira)));
  assert.equal(N.fuerza(e, v), 6);
  for (const k of ["Furia", "Imbloqueable", "DanoAlDestierro"]) assert.equal(N.tiene(e, v, k), true);
});

test("Ira: Desterrándola del Cementerio un Aliado gana 1 de Fuerza y su ataque no puede ser cancelado", () => {
  let e = mesa();
  const ira = poner(e, 0, "cementerio", "Ira");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(ira, "Ira"));
  assert.equal(zonaDe(e, ira), "destierro");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "AtaqueNoCancelable"), true);
});

test("Ira: el ataque del Aliado no puede ser cancelado", { todo: "efecto: el ataque de ciertos Aliados no puede ser cancelado" }, () => {
  assert.fail();
});

test("Jauria: Destruye una carta oponente que no sea Oro; si tenía coste 3 o más, Barajas una de tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const j = poner(e, 0, "mano", "Jauria");
  const m = poner(e, 0, "mano", "Valefor");
  const sp = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(j)));
  e = elegir(e, "Destruir una carta oponente que no sea Oro");
  assert.equal(zonaDe(e, sp), "cementerio");
  assert.equal(zonaDe(e, m), "castillo");
});

test("Jauria: o Destierra una carta oponente; con coste menor a 3 no Barajas de tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const j = poner(e, 0, "mano", "Jauria");
  const m = poner(e, 0, "mano", "Valefor");
  const v = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(j)));
  e = elegir(e, "Desterrar una carta oponente que no sea Oro");
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, m), "mano");
});

test("Jauria: Desterrándola del Cementerio y pagando un Oro buscas un Arma o Tótem", () => {
  let e = mesa();
  oros(e, 0, 1);
  const j = poner(e, 0, "cementerio", "Jauria");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  e = aplicar(e, habilidad(j, "Jauria"));
  e = elegir(e, arma);
  assert.equal(zonaDe(e, j), "destierro");
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Jugando con el Demonio: por el turno tus Aliados ganan Imbloqueable, 1 de Fuerza y ataque que no se puede cancelar", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jd = poner(e, 0, "mano", "Jugando con el Demonio");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(jd)));
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
  assert.equal(N.tiene(e, v, "AtaqueNoCancelable"), true);
  assert.equal(N.fuerza(e, r), 3);
  assert.equal(N.tiene(e, r, "Imbloqueable"), false);
});

test("Jugando con el Demonio: si atacaste en tu turno anterior, pagas un Oro y la Destierras de tu mano o Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jd = poner(e, 0, "mano", "Jugando con el Demonio");
  const jc = poner(e, 0, "cementerio", "Jugando con el Demonio");
  assert.equal(puedeUsar(e, jd, "Jugando con el Demonio"), false);
  e.jugadores[0].atacoTurnoAnterior = true;
  assert.equal(puedeUsar(e, jc, "Jugando con el Demonio"), true);
  e = aplicar(e, { tipo: "habilidad", uid: jd, def: id("Jugando con el Demonio"), h: 0 });
  assert.equal(zonaDe(e, jd), "destierro");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.efectos.some((f) => f.tipo === "inmuneRival" && f.j === 0), true);
});

test("Jugando con el Demonio: no eres afectado por efectos oponentes este turno, requiere haber atacado con dos o más Aliados", { todo: "efecto: el jugador no es afectado por efectos oponentes; condición: cantidad de Aliados atacantes en el turno anterior" }, () => {
  assert.fail();
});

test("Juicio de Metatron: Baraja una carta; el oponente Destierra del tope tantas como su coste y robas tantas como su coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const jm = poner(e, 0, "mano", "Juicio de Metatron");
  const sp = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(jm)));
  e = elegir(e, "Barajar");
  e = elegir(e, "Tantas como su coste");
  assert.equal(zonaDe(e, sp), "castillo");
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Juicio de Metatron: Destierra una carta y el oponente Destierra tantas como su Fuerza", () => {
  let e = mesa();
  oros(e, 0, 2);
  const jm = poner(e, 0, "mano", "Juicio de Metatron");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  e = sinRespuesta(aplicar(e, jugar(jm)));
  e = elegir(e, "Desterrar");
  e = elegir(e, "Tantas como su Fuerza");
  assert.equal(zonaDe(e, jab), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.tiene(e, jm, "NoAnulable"), true);
});

test("Juicio de Metatron: Desterrándolo del Cementerio los Aliados pierden 1 de Fuerza por el turno", () => {
  let e = mesa();
  const jm = poner(e, 0, "cementerio", "Juicio de Metatron");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(jm, "Juicio de Metatron"));
  assert.equal(zonaDe(e, jm), "destierro");
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.fuerza(e, r), 1);
});
