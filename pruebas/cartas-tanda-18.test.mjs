import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const opcionesDe = (e) => e.pendiente.opciones.map((o) => o.valor);
const generados = (e, j) => (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  N.sacar(e, uid);
  e.jugadores[j].castillo.unshift(uid);
  return uid;
}

function ajena(e, j, zona, nombre) {
  const uid = poner(e, N.rival(j), zona, nombre);
  N.sacar(e, uid);
  e.jugadores[j][zona].push(uid);
  return uid;
}

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

test("Vampiro Eterno: tiene Exhumar, no puede ser Anulado y solo entra pagando su coste", () => {
  const e = mesa();
  const v = poner(e, 0, "mano", "Vampiro Eterno");
  assert.ok(N.carta(e, v).claves.includes("Exhumar"));
  assert.ok(N.carta(e, v).claves.includes("NoAnulable"));
  assert.equal(N.carta(e, v).soloPagando, true);
});

test("Vampiro Eterno: el oponente Bota la mitad de su Castillo redondeado hacia arriba y no genera Oro si Bota diez o más", () => {
  let e = mesa();
  oros(e, 0, 4);
  const v = poner(e, 0, "mano", "Vampiro Eterno");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(e.jugadores[1].castillo.length, 15);
  assert.equal(e.jugadores[1].cementerio.length, 15);
  assert.equal(generados(e, 0), 0);
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Vampiro Eterno: si el oponente Bota menos de diez cartas genera un Oro por el turno", () => {
  let e = mesa({ castillo: 15 });
  oros(e, 0, 4);
  const v = poner(e, 0, "mano", "Vampiro Eterno");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(e.jugadores[1].castillo.length, 7);
  assert.equal(e.jugadores[1].cementerio.length, 8);
  assert.equal(generados(e, 0), 1);
});

test("Vampiro Eterno: con Exhumar se juega desde tu Cementerio y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 4);
  const v = poner(e, 0, "cementerio", "Vampiro Eterno");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === v && a.desde === "cementerio"));
  e = sinRespuesta(aplicar(e, jugar(v, { desde: "cementerio" })));
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 15);
});

test("Viaje Temporal: se juega en tu turno pagando su coste y queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 5);
  const v = poner(e, 0, "mano", "Viaje Temporal");
  assert.equal(N.carta(e, v).soloPagando, true);
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(zonaDe(e, v), "destierro");
});

test("Viaje Temporal: no puede jugarse en el turno oponente", () => {
  const e = mesa();
  oros(e, 0, 5);
  const v = poner(e, 0, "mano", "Viaje Temporal");
  e.fase = "talismanes";
  e.prioridad = 0;
  assert.equal(puedeJugar(e, v), true);
  e.activo = 1;
  assert.equal(puedeJugar(e, v), false);
});

test("Viaje Temporal: al finalizar el turno ganas un turno extra en que el oponente no recibe daño", { todo: "efecto: turno extra al finalizar el turno, durante el cual el oponente no puede recibir daño" }, () => {});

test("Viaje en Globo: al resolverse queda Desterrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Viaje en Globo");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(zonaDe(e, v), "destierro");
});

test("Viaje en Globo: puede jugarse en la Agrupación", { todo: "momento: jugar un Talismán en la Agrupación" }, () => {});

test("Viaje en Globo: cada vez que fueras a recibir daño puedes Descartar una carta para prevenirlo", { todo: "prevención de daño: Descartar una carta de la mano para prevenir cada daño recibido durante el turno" }, () => {});

test("Viaje en Globo: en la Fase Final Robas dos y, si no Descartaste, Barajas una carta de coste 2 o menos", { todo: "disparo diferido: en la Fase Final de este turno" }, () => {});

test("Vision de Noé: cada jugador conserva un Aliado de cada coste, Baraja el resto, el oponente Destierra cinco y tú Robas tres", () => {
  let e = mesa();
  oros(e, 0, 2);
  const noe = poner(e, 0, "mano", "Vision de Noé");
  const mios = [1, 2, 3].map(() => poner(e, 0, "defensa", "Valefor"));
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  const suyos = [1, 2].map(() => poner(e, 1, "defensa", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(noe)));
  assert.equal(mios.filter((u) => zonaDe(e, u) === "defensa").length, 1);
  assert.equal(zonaDe(e, guardia), "defensa");
  assert.equal(suyos.filter((u) => zonaDe(e, u) === "defensa").length, 1);
  assert.equal(e.jugadores[1].destierro.length, 5);
  assert.equal(e.jugadores[1].castillo.length, 30 + 1 - 5);
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Vision de Noé: si el oponente Baraja tres o más y tú menos de dos, no Destierra ni Robas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const noe = poner(e, 0, "mano", "Vision de Noé");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  for (let i = 0; i < 4; i++) poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(noe)));
  assert.equal(e.jugadores[1].destierro.length, 0);
  assert.equal(e.jugadores[1].castillo.length, 33);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Visión de Enoc: Anula un Talismán de coste 2 o menos y luego se Baraja en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  const valefor = poner(e, 1, "defensa", "Valefor");
  const enoc = poner(e, 1, "mano", "Visión de Enoc");
  e = aplicar(e, jugar(lucy));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === enoc));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: enoc }));
  assert.equal(zonaDe(e, lucy), "cementerio");
  assert.equal(zonaDe(e, valefor), "defensa");
  assert.equal(zonaDe(e, enoc), "castillo");
  assert.equal(e.jugadores[1].castillo.length, 31);
});

test("Visión de Enoc: no responde a Talismanes de coste 3 o más ni se juega por sí sola", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const felices = poner(e, 0, "mano", "Y Vivieron Felices");
  const enoc = poner(e, 1, "mano", "Visión de Enoc");
  e = aplicar(e, jugar(felices));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === enoc), false);
  const f = mesa();
  oros(f, 0, 1);
  const propia = poner(f, 0, "mano", "Visión de Enoc");
  assert.equal(puedeJugar(f, propia), false);
});

test("Visión de Enoc: previene que un Aliado sea afectado por un efecto oponente", { todo: "protección: prevenir que un Aliado sea afectado por un efecto oponente" }, () => {});

test("Visión de Enoc: cuando la Botas por daño puedes Barajar hasta cinco cartas de los Cementerios", () => {
  let e = mesa();
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  const enoc = alTope(e, 1, "Visión de Enoc");
  const otra = poner(e, 0, "cementerio", "Valefor");
  e = atacarSolo(e, guardia);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  e = elegir(e, true);
  e = elegir(e, enoc);
  e = elegir(e, otra);
  e = elegir(e, null);
  assert.equal(zonaDe(e, enoc), "castillo");
  assert.equal(zonaDe(e, otra), "castillo");
  assert.equal(e.jugadores[1].cementerio.length, 2);
});

test("Vive: Robas tres, tus Aliados ganan 2 y los oponentes pierden su habilidad y 2 de Fuerza por el turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const vive = poner(e, 0, "mano", "Vive");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(vive)));
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(N.fuerza(e, mio), 5);
  assert.equal(N.fuerza(e, suyo), 1);
  assert.equal(N.activa(e, suyo), false);
  assert.equal(N.activa(e, mio), true);
  N.expirar(e, "finTurno");
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, suyo), 3);
  assert.equal(N.activa(e, suyo), true);
});

test("Vive: puedes Descartar una carta para reducir su coste en un Oro", { todo: "coste alternativo: Descartar cartas al jugarla para reducir su coste" }, () => {});

test("Voces de Hielo: Destruye una carta de coste 2 o menos y Baraja hasta tres cartas de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const voces = poner(e, 0, "mano", "Voces de Hielo");
  const suyo = poner(e, 1, "defensa", "Valefor");
  const c1 = poner(e, 0, "cementerio", "Valefor");
  const c2 = poner(e, 0, "cementerio", "Valefor");
  const ajenoCem = poner(e, 1, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(voces)));
  e = elegir(e, suyo);
  assert.equal(opcionesDe(e).includes(ajenoCem), false);
  e = elegir(e, c1);
  e = elegir(e, c2);
  assert.equal(zonaDe(e, suyo), "cementerio");
  assert.equal(zonaDe(e, c1), "castillo");
  assert.equal(zonaDe(e, c2), "castillo");
  assert.equal(zonaDe(e, voces), "cementerio");
});

test("Voces de Hielo: Anula un Tótem de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const abadia = poner(e, 0, "mano", "Abadía de Carfax");
  const voces = poner(e, 1, "mano", "Voces de Hielo");
  e = aplicar(e, jugar(abadia));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === voces));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: voces }));
  assert.equal(zonaDe(e, abadia), "cementerio");
  assert.equal(zonaDe(e, voces), "cementerio");
});

test("Voces de Hielo: puedes pagar un Oro para subirla de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const voces = poner(e, 0, "cementerio", "Voces de Hielo");
  e = aplicar(e, habilidad(voces, "Voces de Hielo"));
  assert.equal(zonaDe(e, voces), "mano");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Voladora: no puede ser Anulada y busca en tu Castillo o Cementerio una carta que no sea Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  const vol = poner(e, 0, "mano", "Voladora");
  assert.ok(N.carta(e, vol).claves.includes("NoAnulable"));
  const valefor = poner(e, 0, "cementerio", "Valefor");
  const lucy = poner(e, 0, "cementerio", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(vol)));
  assert.equal(opcionesDe(e).includes(lucy), false);
  e = elegir(e, valefor);
  assert.equal(zonaDe(e, valefor), "mano");
});

test("Voladora: genera un Oro para jugar cartas de coste 3 o más", { todo: "generar: Oro restringido por raza y coste mínimo" }, () => {});

test("Voladora: desde tu Cementerio, pagando un Oro y Desterrándola, busca dos cartas de distinto tipo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const vol = poner(e, 0, "cementerio", "Voladora");
  const valefor = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, habilidad(vol, "Voladora"));
  e = elegir(e, valefor);
  assert.equal(opcionesDe(e).some((v) => v !== null && N.carta(e, v).tipo === "Aliado"), false);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, vol), "destierro");
  assert.equal(zonaDe(e, valefor), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Vuelo del Raiquen: Destierra un Aliado con Furia, Exhumar o Indestructible de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const vuelo = poner(e, 0, "mano", "Vuelo del Raiquen");
  const ileana = poner(e, 1, "defensa", "Ileana");
  const guardia = poner(e, 1, "defensa", "Guardia Real");
  const balaur = poner(e, 1, "defensa", "Balaur");
  e = sinRespuesta(aplicar(e, jugar(vuelo)));
  assert.equal(zonaDe(e, ileana), "destierro");
  assert.equal(zonaDe(e, guardia), "defensa");
  assert.equal(zonaDe(e, balaur), "defensa");
});

test("Vuelo del Raiquen: sin objetivo válido no se puede jugar", () => {
  const e = mesa();
  oros(e, 0, 1);
  const vuelo = poner(e, 0, "mano", "Vuelo del Raiquen");
  poner(e, 1, "defensa", "Guardia Real");
  assert.equal(puedeJugar(e, vuelo), false);
});

test("Vínculo de Sangre: se Destierra, Baraja hasta tres cartas de los Cementerios y Roba hasta dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const vinculo = poner(e, 0, "mano", "Vínculo de Sangre");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(vinculo)));
  e = elegir(e, a);
  e = elegir(e, b);
  e = elegir(e, 2);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(zonaDe(e, vinculo), "destierro");
});

test("Vínculo de Sangre: para afectar las cartas elegidas el oponente paga un Oro adicional", { todo: "efecto: afectar a ciertas cartas cuesta un Oro adicional al oponente mientras otra carta siga en juego" }, () => {});

test("Y Vivieron Felices: las cartas del tipo elegido pierden su habilidad y son Barajadas", () => {
  let e = mesa();
  oros(e, 0, 3);
  const felices = poner(e, 0, "mano", "Y Vivieron Felices");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Balaur");
  const totem = poner(e, 1, "apoyo", "Abadía de Carfax");
  e = sinRespuesta(aplicar(e, jugar(felices)));
  e = elegir(e, "Aliado");
  assert.equal(zonaDe(e, mio), "castillo");
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.equal(zonaDe(e, totem), "apoyo");
  assert.equal(zonaDe(e, felices), "destierro");
  assert.equal(e.pendiente, null);
});

test("Y Vivieron Felices: tu oponente no puede Desterrar cartas de tu Castillo por efectos por el resto del juego", { todo: "efecto: el oponente no puede Desterrar cartas de tu Castillo por efectos" }, () => {});

test("Y Vivieron Felices: al final de tu turno Robas una carta adicional por el resto del juego", { todo: "efecto permanente: robar una carta adicional al final de tu turno" }, () => {});

test("Yo Soy el Rey: no puede ser Anulado, solo entra pagando, se Destierra y Robas tres", () => {
  let e = mesa();
  oros(e, 0, 3);
  const rey = poner(e, 0, "mano", "Yo Soy el Rey");
  assert.ok(N.carta(e, rey).claves.includes("NoAnulable"));
  assert.equal(N.carta(e, rey).soloPagando, true);
  e = sinRespuesta(aplicar(e, jugar(rey)));
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(zonaDe(e, rey), "destierro");
});

test("Yo Soy el Rey: tu oponente no puede Barajar, Desterrar, subir ni jugar cartas de los Cementerios", { todo: "efecto: el oponente no puede Barajar, Desterrar, subir a la mano ni jugar cartas de los Cementerios por el resto del juego" }, () => {});

test("Ajo Protector: una vez por turno Baraja tu Castillo y Bota una carta; con coste 0 no Bota más", () => {
  let e = mesa();
  const ajo = poner(e, 0, "reserva", "Ajo Protector");
  assert.equal(N.carta(e, ajo).oroInicial, true);
  e = aplicar(e, habilidad(ajo, "Ajo Protector"));
  assert.equal(e.jugadores[0].cementerio.length, 1);
  assert.equal(puedeUsar(e, ajo), false);
});

test("Ajo Protector: si la carta Botada tiene coste 1 o más, Bota tantas cartas como su coste", () => {
  let e = mesa({ castillo: 0 });
  for (let i = 0; i < 10; i++) poner(e, 0, "castillo", "Guardia Real");
  poner(e, 1, "castillo", "Drácula");
  const ajo = poner(e, 0, "reserva", "Ajo Protector");
  e = aplicar(e, habilidad(ajo, "Ajo Protector"));
  assert.equal(e.jugadores[0].cementerio.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 7);
});

test("Ajo Protector: si controlas Bestias, Dragones o Sombras las cartas en tu Cementerio no pierden su habilidad", { todo: "continua condicional: las cartas en tu Cementerio no pierden su habilidad" }, () => {});

test("Alicanto: Desterrándolo previene el próximo daño del turno y convierte una carta de tu mano en Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  const alicanto = poner(e, 1, "reserva", "Alicanto");
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  const carta = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: guardia });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  assert.equal(puedeUsar(e, alicanto), true);
  e = aplicar(e, habilidad(alicanto, "Alicanto"));
  e = elegir(e, carta);
  assert.equal(zonaDe(e, alicanto), "destierro");
  assert.equal(zonaDe(e, carta), "pagado");
  assert.equal(N.carta(e, carta).tipo, "Oro");
  assert.equal(N.carta(e, carta).sinHabilidad, true);
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Alicanto: se usa en respuesta a que fueras a recibir cualquier daño", { todo: "respuesta: al ir a recibir daño, Desterrar esta carta para prevenirlo" }, () => {});

test("Alicanto: los Aliados de coste 2 o más pagados con este Oro no pueden ser Anulados", { todo: "efecto: cartas pagadas con un Oro concreto no pueden ser Anuladas" }, () => {});

test("Alicia en el Pais de las Maravillas: en tu Vigilia, si no controlas más Oros, pagas un Oro para ponerla desde tu mano en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const alicia = poner(e, 0, "mano", "Alicia en el Pais de las Maravillas");
  e = aplicar(e, habilidad(alicia, "Alicia en el Pais de las Maravillas"));
  assert.equal(zonaDe(e, alicia), "pagado");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Alicia en el Pais de las Maravillas: no se pone desde la mano si controlas más Oros que tu oponente", () => {
  const e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const alicia = poner(e, 0, "mano", "Alicia en el Pais de las Maravillas");
  assert.equal(puedeUsar(e, alicia), false);
});

test("Alicia en el Pais de las Maravillas: pagando un Oro Robas tres y Barajas dos de tu mano, una vez por turno", () => {
  let e = mesa();
  const alicia = poner(e, 0, "reserva", "Alicia en el Pais de las Maravillas");
  oros(e, 0, 1);
  e = aplicar(e, habilidad(alicia, "Alicia en el Pais de las Maravillas", 1));
  e = elegir(e, texto("Robar tres"));
  const [a, b] = e.jugadores[0].mano;
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
  assert.equal(puedeUsar(e, alicia), false);
});

test("Alicia en el Pais de las Maravillas: pagando un Oro juega un Arma reduciendo su coste en uno", () => {
  let e = mesa();
  const alicia = poner(e, 0, "reserva", "Alicia en el Pais de las Maravillas");
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  e = aplicar(e, habilidad(alicia, "Alicia en el Pais de las Maravillas", 1));
  e = elegir(e, texto("Jugar un Arma"));
  assert.deepEqual(e.armas[guardia], [arma]);
  assert.equal(N.fuerza(e, guardia), 5);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Altar de Moloch: al entrar Robas una carta y tus Aliados no salen del juego en combate hasta tu próximo turno", () => {
  let e = mesa();
  const altar = poner(e, 0, "mano", "Altar de Moloch");
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  e = aplicar(e, { tipo: "oro", uid: altar });
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.tiene(e, guardia, "Indestructible"), true);
});

test("Altar de Moloch: una vez por turno pagas el coste de una carta tuya que controla el oponente para subirla y jugarla gratis", () => {
  let e = mesa();
  const altar = poner(e, 0, "reserva", "Altar de Moloch");
  oros(e, 0, 1);
  const robada = ajena(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(puedeUsar(e, altar), true);
  e = aplicar(e, habilidad(altar, "Altar de Moloch"));
  assert.equal(zonaDe(e, robada), "defensa");
  assert.equal(N.controlador(e, robada), 0);
  assert.equal(e.jugadores[0].reserva.length, 1);
  assert.equal(puedeUsar(e, altar), false);
});

test("Altar de Moloch: la protección aplica solo en Batalla Mitológica", { todo: "efecto: los Aliados no pueden salir del juego durante el combate" }, () => {});

test("Amuleto Indibi: al entrar en juego Robas una carta", () => {
  let e = mesa();
  const amuleto = poner(e, 0, "mano", "Amuleto Indibi");
  e = aplicar(e, { tipo: "oro", uid: amuleto });
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Amuleto Indibi: Barajándolo hasta dos Aliados ganan 1 de Fuerza y su daño va al Destierro este turno", () => {
  let e = mesa();
  const amuleto = poner(e, 0, "reserva", "Amuleto Indibi");
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  e = aplicar(e, habilidad(amuleto, "Amuleto Indibi"));
  e = elegir(e, guardia);
  assert.equal(zonaDe(e, amuleto), "castillo");
  assert.equal(N.fuerza(e, guardia), 4);
  assert.equal(N.tiene(e, guardia, "DanoAlDestierro"), true);
  e = atacarSolo(e, guardia);
  assert.equal(e.jugadores[1].destierro.length, 4);
});

test("Amuleto Indibi: una vez por turno, cuando una carta va a un Cementerio puedes Barajarla", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Amuleto Indibi");
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  const suyo = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(lucy)));
  e = elegir(e, suyo);
  e = elegir(e, true);
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, lucy), "cementerio");
});

test("Amuleto de Serpiente: al entrar puedes mostrar tres y poner en tu mano un Aliado de coste 1 o menos o con Furia, o un Arma", () => {
  let e = mesa();
  const amuleto = poner(e, 0, "mano", "Amuleto de Serpiente");
  const arma = alTope(e, 0, "Pedrenyal");
  const guardia = alTope(e, 0, "Guardia Real");
  const valefor = alTope(e, 0, "Valefor");
  e = aplicar(e, { tipo: "oro", uid: amuleto });
  e = elegir(e, true);
  assert.deepEqual(opcionesDe(e), [valefor, arma, null]);
  e = elegir(e, valefor);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, valefor), "mano");
  assert.equal(zonaDe(e, guardia), "castillo");
});

test("Amuleto de Serpiente: también se dispara al comienzo de tu Vigilia", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Amuleto de Serpiente");
  const arma = alTope(e, 0, "Pedrenyal");
  N.disparar(e, "comienzoVigilia", { j: 0 });
  resolver(e);
  e = elegir(e, true);
  e = elegir(e, arma);
  assert.equal(zonaDe(e, arma), "mano");
});

test("Amuleto de Serpiente: si lo haces, jugar Talismanes cuesta un Oro adicional a quien ya jugó Talismanes en el turno", { todo: "efecto: jugar Talismanes cuesta un Oro adicional al jugador que ya jugó un Talismán en el turno" }, () => {});

test("Angelus: al entrar muestra cinco cartas y pone una en tu mano", () => {
  let e = mesa();
  const angelus = poner(e, 0, "mano", "Angelus");
  const valefor = alTope(e, 0, "Valefor");
  e = aplicar(e, { tipo: "oro", uid: angelus });
  assert.deepEqual(e.pendiente.opciones.map((o) => o.texto), ["Una carta a tu mano"]);
  e = elegir(e, texto("Una carta"));
  e = elegir(e, valefor);
  assert.equal(zonaDe(e, valefor), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Angelus: o pone dos Armas y/o Tótem de las cinco en tu mano", () => {
  let e = mesa();
  const angelus = poner(e, 0, "mano", "Angelus");
  const arma = alTope(e, 0, "Pedrenyal");
  const totem = alTope(e, 0, "Abadía de Carfax");
  e = aplicar(e, { tipo: "oro", uid: angelus });
  e = elegir(e, texto("Dos Armas"));
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(zonaDe(e, totem), "mano");
});

test("Angelus: con dos o más Armas y/o Tótem, Anular o Desterrar tus Armas y Tótem cuesta un Oro adicional", { todo: "efecto: Anular o Desterrar ciertas cartas cuesta un Oro adicional" }, () => {});

test("Animita: al entrar cada jugador Bota tres cartas y tú Robas una", () => {
  let e = mesa();
  const animita = poner(e, 0, "mano", "Animita");
  e = aplicar(e, { tipo: "oro", uid: animita });
  assert.equal(e.jugadores[0].cementerio.length, 3);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 26);
});

test("Animita: en tu Vigilia, una vez por turno, una carta de tu Cementerio que no sea Talismán gana Exhumar", () => {
  let e = mesa();
  const animita = poner(e, 0, "reserva", "Animita");
  oros(e, 0, 1);
  const valefor = poner(e, 0, "cementerio", "Valefor");
  poner(e, 0, "cementerio", "Regresa Lucy");
  assert.equal(puedeJugar(e, valefor), false);
  e = aplicar(e, habilidad(animita, "Animita"));
  assert.equal(N.tiene(e, valefor, "Exhumar"), true);
  assert.equal(puedeJugar(e, valefor), true);
  assert.equal(puedeUsar(e, animita), false);
});

test("Argos: Desterrando dos cartas de tu Cementerio entra desde él como un Aliado sin habilidad de Fuerza 2", () => {
  let e = mesa();
  const argos = poner(e, 0, "cementerio", "Argos");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(argos, "Argos"));
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, argos), "defensa");
  assert.equal(N.carta(e, argos).tipo, "Aliado");
  assert.equal(N.carta(e, argos).sinHabilidad, true);
  assert.equal(N.fuerza(e, argos), 2);
});

test("Argos: sin dos cartas más en tu Cementerio no se puede usar", () => {
  const e = mesa();
  const argos = poner(e, 0, "cementerio", "Argos");
  poner(e, 0, "cementerio", "Valefor");
  assert.equal(puedeUsar(e, argos), false);
});

test("Argos: hasta tu próximo turno la primera carta de coste 1 o menos de cada jugador cuesta un Oro adicional", { todo: "efecto: la primera carta de coste N o menos que pone en juego cada jugador en cada turno cuesta un Oro adicional" }, () => {});

test("Armeria del Guerrero: es Oro Inicial y tus Aliados de coste 1 o más ganan 1 de Fuerza", () => {
  const e = mesa();
  const armeria = poner(e, 0, "reserva", "Armeria del Guerrero");
  assert.equal(N.carta(e, armeria).oroInicial, true);
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, mio), 4);
  assert.equal(N.fuerza(e, suyo), 3);
});

test("Armeria del Guerrero: al comienzo del turno oponente Baraja y/o Destierra hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Armeria del Guerrero");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = elegir(e, a);
  e = elegir(e, null);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Armeria del Guerrero: no se ponen Oros en juego por efectos si ya se pusieron por efectos en la partida", { todo: "restricción: no poner Oros en juego por efectos si ya se pusieron Oros por efectos durante la partida" }, () => {});

test("Arpa de David: se juega desde tu Cementerio como si estuviera en tu mano y al entrar Robas una", () => {
  let e = mesa();
  const arpa = poner(e, 0, "cementerio", "Arpa de David");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === arpa && a.desde === "cementerio"));
  e = aplicar(e, { tipo: "oro", uid: arpa, desde: "cementerio" });
  assert.equal(zonaDe(e, arpa), "reserva");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Arpa de David: en tu Vigilia Barajas una carta que controles para Barajar una oponente de coste 1 o menos", () => {
  let e = mesa();
  const arpa = poner(e, 0, "reserva", "Arpa de David");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  const caro = poner(e, 1, "defensa", "Guardia Real");
  e = aplicar(e, habilidad(arpa, "Arpa de David"));
  e = elegir(e, mio);
  assert.equal(zonaDe(e, mio), "castillo");
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.equal(zonaDe(e, caro), "defensa");
  assert.equal(puedeUsar(e, arpa), false);
});

test("Arpon Sagrado: al entrar busca un Oro o un Arma en tu Castillo", () => {
  let e = mesa();
  const arpon = poner(e, 0, "mano", "Arpon Sagrado");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  e = aplicar(e, { tipo: "oro", uid: arpon });
  assert.equal(opcionesDe(e).includes(arma), true);
  e = elegir(e, arma);
  assert.equal(zonaDe(e, arma), "mano");
});

test("Arpon Sagrado: una vez por turno se convierte en un Arma que da 2 de Fuerza, Indestructible y daño al Destierro hasta tu próximo turno", () => {
  let e = mesa();
  const arpon = poner(e, 0, "reserva", "Arpon Sagrado");
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  e = aplicar(e, habilidad(arpon, "Arpon Sagrado"));
  assert.deepEqual(e.armas[guardia], [arpon]);
  assert.equal(N.carta(e, arpon).tipo, "Arma");
  assert.equal(N.fuerza(e, guardia), 5);
  assert.equal(N.tiene(e, guardia, "Indestructible"), true);
  assert.equal(N.tiene(e, guardia, "DanoAlDestierro"), true);
  assert.equal(N.orosDe(e, 0).includes(arpon), false);
  e.turno += 2;
  N.expirar(e, "inicio");
  assert.equal(zonaDe(e, arpon), "reserva");
  assert.equal(N.carta(e, arpon).tipo, "Oro");
  assert.equal(N.fuerza(e, guardia), 3);
});

test("Aurora de Chile: al entrar Robas una carta", () => {
  let e = mesa();
  const aurora = poner(e, 0, "mano", "Aurora de Chile");
  e = aplicar(e, { tipo: "oro", uid: aurora });
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Aurora de Chile: al salir del juego busca dos Oros que no sean Aurora, uno a tu Oro Pagado y otro a tu mano", () => {
  let e = mesa({ castillo: 0 });
  const otraAurora = poner(e, 0, "castillo", "Aurora de Chile");
  poner(e, 1, "castillo", "Drácula");
  const o1 = poner(e, 0, "castillo", "Huitzilin");
  const o2 = poner(e, 0, "castillo", "Drácula");
  poner(e, 0, "castillo", "Valefor");
  const aurora = poner(e, 0, "reserva", "Aurora de Chile");
  N.mover(e, aurora, "cementerio");
  resolver(e);
  assert.equal(opcionesDe(e).includes(otraAurora), false);
  e = elegir(e, o2);
  e = elegir(e, o1);
  assert.equal(zonaDe(e, o2), "pagado");
  assert.equal(zonaDe(e, o1), "mano");
  assert.equal(zonaDe(e, otraAurora), "castillo");
});

test("Aurora de Chile: en tu turno tus Aliados no pueden ser afectados por Talismanes oponentes", { todo: "protección: los Aliados no pueden ser afectados por Talismanes oponentes" }, () => {});
