import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const con = (e, ...preds) => preds.reduce((s, p) => elegir(s, p), e);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);

function alTope(e, j, nombre, i = 0) {
  const uid = poner(e, j, "castillo", nombre);
  N.sacar(e, uid);
  e.jugadores[j].castillo.splice(i, 0, uid);
  return uid;
}

function aGuerra(e, atacante) {
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  e = aplicar(e, { tipo: "finAtaque" });
  return aplicar(e, { tipo: "finBloqueo" });
}

function hastaDano(e) {
  const antes = e.registro.length;
  for (let i = 0; i < 30 && e.registro.length === antes && !e.pendiente; i++) {
    const l = accionesLegales(e);
    e = aplicar(e, l.find((x) => ["finBloqueo", "pasar", "noResponder"].includes(x.tipo)) ?? l[0]);
  }
  return e;
}

test("Miguel Grau: al entrar Baraja hasta tres cartas de los Cementerios y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const miguel = poner(e, 0, "mano", "Miguel Grau");
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(miguel)));
  for (const u of c.slice(0, 3)) e = elegir(e, u);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "cementerio"]);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Miguel Grau: puedes Barajarlo para Destruir una carta de coste 2 o menos", () => {
  let e = mesa();
  const miguel = poner(e, 0, "defensa", "Miguel Grau");
  const v = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(miguel, "Miguel Grau"));
  assert.equal(zonaDe(e, miguel), "castillo");
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Miguel Grau: si es Botado desde tu Castillo por daño se dejan de Botar cartas y se Destierra", () => {
  let e = mesa();
  const jaques = poner(e, 0, "defensa", "Jaques de Molay");
  const miguel = alTope(e, 1, "Miguel Grau", 1);
  e = hastaDano(aGuerra(e, jaques));
  assert.equal(zonaDe(e, miguel), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Nanna: es Única", () => {
  const e = mesa();
  const nanna = poner(e, 0, "defensa", "Nanna");
  assert.equal(N.tiene(e, nanna, "UnaCopia"), true);
});

test("Nanna: no se juega una segunda copia si ya controlas una", { todo: "restricción: Única para cartas que no son Oro" }, () => {});

test("Nanna: puedes Desterrarla para Anular un Talismán oponente", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Origenes: al entrar Baraja hasta seis cartas de los Cementerios y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const o = poner(e, 0, "mano", "Origenes");
  const c = [0, 0, 0, 1, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(o)));
  for (const u of c.slice(0, 6)) e = elegir(e, u);
  assert.equal(c.filter((u) => zonaDe(e, u) === "castillo").length, 6);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Origenes: en tu Agrupación puedes Descartar una carta para subirlo de tu Cementerio a tu mano", () => {
  let e = mesa();
  const o = poner(e, 1, "cementerio", "Origenes");
  const v = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = elegir(e, true);
  assert.equal(zonaDe(e, o), "mano");
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Origenes: puede jugarse al comienzo del Bloqueo o de la Fase Final", { todo: "momento: jugar un Aliado al comienzo del Bloqueo o de la Fase Final" }, () => {});

test("Paladin de la Luz: Barajando un Arma Baraja y/o Destierra dos cartas de los Cementerios y busca un Aliado", () => {
  let e = mesa();
  const paladin = poner(e, 0, "defensa", "Paladin de la Luz");
  const v = poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "arma", "Pedrenyal", { portador: v });
  const a = poner(e, 0, "cementerio", "Drácula");
  const b = poner(e, 1, "cementerio", "Drácula");
  const buscado = poner(e, 0, "castillo", "Sir Galahad");
  e = hacer(e, habilidad(paladin, "Paladin de la Luz"), a, null, b, buscado);
  assert.equal(zonaDe(e, arma), "castillo");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, buscado), "mano");
  assert.equal(puedeUsar(e, paladin), false);
});

test("Paladin de la Luz: si controlas Armas tus Aliados no cambian de controlador", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Paladin de la Luz");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.puedeTomar(e, v, 1), true);
  poner(e, 0, "arma", "Pedrenyal", { portador: v });
  assert.equal(N.puedeTomar(e, v, 1), false);
});

test("Paladin de la Luz: cuenta las Armas jugadas en tu turno anterior", { todo: "condición: jugaste cartas de cierto tipo en tu turno anterior" }, () => {});

test("Papa Legba: muestra hasta un Aliado con Furia y un Arma, uno a la mano y otro al Cementerio, y Destierra dos cartas de distinto nombre de un Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const papa = poner(e, 0, "mano", "Papa Legba");
  const arma = alTope(e, 0, "Pedrenyal");
  const furia = alTope(e, 0, "Valefor", 1);
  const g = poner(e, 1, "castillo", "Sir Galahad");
  e = sinRespuesta(aplicar(e, jugar(papa)));
  e = elegir(e, true);
  e = elegir(e, furia);
  assert.equal(zonaDe(e, furia), "mano");
  assert.equal(zonaDe(e, arma), "cementerio");
  e = elegir(e, "Castillo oponente");
  e = elegir(e, g);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, g), "destierro");
  assert.deepEqual(e.jugadores[1].destierro.map((u) => N.carta(e, u).nombre).sort(), ["Drácula", "Sir Galahad"]);
});

test("Papa Legba: si solo muestra uno de los dos no Destierra cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const papa = poner(e, 0, "mano", "Papa Legba");
  const furia = alTope(e, 0, "Valefor");
  e = sinRespuesta(aplicar(e, jugar(papa)));
  e = elegir(e, true);
  assert.equal(zonaDe(e, furia), "mano");
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].destierro.length, 0);
});

test("Serafin: entra en juego como Aliado de Fuerza 3", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Serafin");
  e = sinRespuesta(aplicar(e, jugar(s)));
  assert.equal(zonaDe(e, s), "defensa");
  assert.equal(N.fuerza(e, s), 3);
});

test("Serafin: al entrar nombra una carta y usar sus habilidades cuesta un Oro adicional", { todo: "restricción: usar habilidades de cartas nombradas cuesta un Oro" }, () => {});

test("Serafin: Desterrándolo previene que un Aliado o Tótem sea Anulado o su habilidad cancelada", { todo: "respuesta: prevenir que una carta propia sea Anulada o su habilidad cancelada desde una carta en juego" }, () => {});

test("Shade: si atacaste en tu turno anterior se juega sin pagar su coste", () => {
  const e = mesa();
  const shade = poner(e, 0, "mano", "Shade");
  assert.equal(costeDe(e, 0, shade).pagar, 1);
  e.jugadores[0].atacoTurnoAnterior = true;
  assert.equal(costeDe(e, 0, shade).pagar, 0);
});

test("Shade: al entrar gana Furia y el ataque de tus Aliados no puede ser cancelado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const shade = poner(e, 0, "mano", "Shade");
  const v = poner(e, 0, "defensa", "Valefor");
  e = con(sinRespuesta(aplicar(e, jugar(shade))), "Este Aliado gana Furia");
  assert.equal(N.tiene(e, shade, "Furia"), true);
  assert.equal(N.tiene(e, v, "AtaqueNoCancelable"), true);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
});

test("Shade: al entrar puede Barajar y/o Desterrar hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 1);
  const shade = poner(e, 0, "mano", "Shade");
  const [a, b] = [0, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = con(sinRespuesta(aplicar(e, jugar(shade))), "Barajar y/o Desterrar hasta tres cartas de los Cementerios", a, null, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(N.tiene(e, shade, "Furia"), false);
});

test("Shade: jugado sin pagar su coste no puede ser cancelado", { todo: "protección condicional: no puede ser Anulado mientras se cumpla una condición" }, () => {});

test("Ángel Miguel, el Protector: es Indestructible y al entrar Baraja y/o Destierra hasta seis cartas de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 2);
  const angel = poner(e, 0, "mano", "Ángel Miguel, el Protector");
  const [a, b] = [0, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = con(sinRespuesta(aplicar(e, jugar(angel))), b, null, a);
  assert.equal(N.tiene(e, angel, "Indestructible"), true);
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, a), "destierro");
});

test("Ángel Miguel, el Protector: también se dispara al bloquear", { todo: "disparo: al bloquear" }, () => {});

test("Ángel Miguel, el Protector: con Tótem los Aliados oponentes de coste 2 o menos no disparan al entrar", { todo: "continua: solo los Aliados oponentes de coste ≤ n no disparan al entrar" }, () => {});

test("Ambrosio O'Higgins: es Imbloqueable y una vez por turno busca un Arma en tu Castillo", () => {
  let e = mesa();
  const amb = poner(e, 0, "defensa", "Ambrosio O'Higgins");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  assert.equal(N.tiene(e, amb, "Imbloqueable"), true);
  e = hacer(e, habilidad(amb, "Ambrosio O'Higgins"), arma);
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(puedeUsar(e, amb), false);
});

test("Ambrosio O'Higgins: al comienzo del Ataque, Desterrándolo de tu mano o Cementerio un Aliado no puede atacar", { todo: "disparo: al comienzo de la fase de Ataque desde la mano o el Cementerio" }, () => {});

test("Andinia-X 2: cuando juegas un Arma puedes subirlo de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const andinia = poner(e, 0, "cementerio", "Andinia-X 2");
  const v = poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  e = aplicar(e, jugar(arma, { portador: v }));
  e = sinRespuesta(elegir(e, true));
  assert.equal(zonaDe(e, andinia), "mano");
  assert.equal(zonaDe(e, arma), "arma");
});

test("Andinia-X 2: su coste baja en uno si tienes un Arma o Tótem en tu mano o Cementerio", () => {
  const e = mesa();
  const andinia = poner(e, 0, "mano", "Andinia-X 2");
  assert.equal(costeDe(e, 0, andinia).pagar, 3);
  poner(e, 0, "cementerio", "Templo Gótico");
  assert.equal(costeDe(e, 0, andinia).pagar, 2);
});

test("Andinia-X 2: el daño de combate de los Aliados que porten Armas va al Destierro", { todo: "continua: los Aliados que porten Armas ganan una clave" }, () => {});

test("Arturo Pendragón, Rey Paladín: al entrar hasta dos Aliados ganan Furia e Imbloqueable por el turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const arturo = poner(e, 0, "mano", "Arturo Pendragón, Rey Paladín");
  const v = poner(e, 0, "defensa", "Sir Galahad");
  e = con(sinRespuesta(aplicar(e, jugar(arturo))), v, arturo);
  for (const u of [v, arturo]) {
    assert.equal(N.tiene(e, u, "Furia"), true);
    assert.equal(N.tiene(e, u, "Imbloqueable"), true);
  }
});

test("Arturo Pendragón, Rey Paladín: al comienzo de cada Vigilia tu oponente Bota dos y Descarta una", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Arturo Pendragón, Rey Paladín");
  const d = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("Arturo Pendragón, Rey Paladín: tus demás Aliados ganan 1 de Fuerza y no cambian de controlador", () => {
  const e = mesa();
  const arturo = poner(e, 0, "defensa", "Arturo Pendragón, Rey Paladín");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, arturo), 2);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, r), 3);
  assert.equal(N.puedeTomar(e, v, 1), false);
});

test("Arturo Prat: cuando ataca solo duplica su Fuerza y es Destruido en la Fase Final", () => {
  let e = mesa();
  const prat = poner(e, 0, "defensa", "Arturo Prat");
  assert.equal(N.tiene(e, prat, "Furia"), true);
  e = aGuerra(e, prat);
  assert.equal(N.fuerza(e, prat), 8);
  e = hastaDano(e);
  assert.equal(e.jugadores[1].castillo.length, 22);
  e = elegir(e, false);
  assert.equal(zonaDe(e, prat), "cementerio");
});

test("Arturo Prat: si ataca acompañado no duplica su Fuerza", () => {
  let e = mesa();
  const prat = poner(e, 0, "defensa", "Arturo Prat");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: prat });
  e = aplicar(e, { tipo: "atacar", uid: v });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.equal(N.fuerza(e, prat), 4);
});

test("Arturo Prat: cuando otro Aliado tuyo hace daño puedes Barajar una carta de coste 3 o menos, una vez por turno", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Arturo Prat");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Sir Persival");
  e = hastaDano(aGuerra(e, v));
  e = hacer(e, { tipo: "elegir", i: 0 }, r);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Arturo de Bretaña: al entrar busca hasta dos Armas, juega una pagando un Oro menos y pone la otra en tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const arturo = poner(e, 0, "mano", "Arturo de Bretaña");
  const v = poner(e, 0, "defensa", "Valefor");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  const m = poner(e, 0, "cementerio", "Martillo Sacro");
  e = sinRespuesta(aplicar(e, jugar(arturo)));
  e = hacer(e, { tipo: "elegir", i: 0 }, p, m, "Jugarla pagando un Oro menos (mínimo 1)", v, "Ponerla en tu mano");
  assert.equal(zonaDe(e, p), "arma");
  assert.equal(N.portadorDe(e, p), v);
  assert.equal(zonaDe(e, m), "mano");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].jugadas.Arma, 1);
});

test("Arturo de Bretaña: una vez por turno un Arma de tu Cementerio gana Exhumar por el turno", () => {
  let e = mesa();
  const arturo = poner(e, 0, "defensa", "Arturo de Bretaña");
  const p = poner(e, 0, "cementerio", "Pedrenyal");
  oros(e, 0, 1);
  e = aplicar(e, habilidad(arturo, "Arturo de Bretaña"));
  assert.equal(N.tiene(e, p, "Exhumar"), true);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === p));
  assert.equal(puedeUsar(e, arturo), false);
});

test("Aubrey: cuando atacas con un solo Aliado juega gratis un Aliado de coste 2 o menos de tu Castillo, que entra atacando", () => {
  let e = mesa();
  const aubrey = poner(e, 0, "defensa", "Aubrey");
  const v = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: aubrey });
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "ataque");
  assert.ok(e.atacantes.includes(v));
});

test("Aubrey: puedes jugar Armas en la Guerra de Talismanes", () => {
  let e = mesa();
  const aubrey = poner(e, 0, "defensa", "Aubrey");
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Pedrenyal");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: aubrey });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === p));
});

test("Aubrey: afectar a tus Aliados cuesta un Oro adicional al oponente en la Guerra de Talismanes", { todo: "efecto: afectar a tus Aliados cuesta un Oro adicional al oponente" }, () => {});

test("Baron Vordenburg: al entrar el oponente Bota la Fuerza de un Aliado tuyo más una por cada Arma", () => {
  let e = mesa();
  oros(e, 0, 3);
  const baron = poner(e, 0, "mano", "Baron Vordenburg");
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Pedrenyal", { portador: v });
  e = con(sinRespuesta(aplicar(e, jugar(baron))), v);
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Baron Vordenburg: tus Aliados hacen daño al Destierro y su ataque no puede ser cancelado", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Baron Vordenburg");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
  assert.equal(N.tiene(e, v, "AtaqueNoCancelable"), true);
  e = hastaDano(aGuerra(e, v));
  assert.equal(e.jugadores[1].destierro.length, 3);
});

test("Beauchef: al jugar un Arma el oponente Descarta una y tú Barajas hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 1);
  const beau = poner(e, 0, "defensa", "Beauchef");
  const d = poner(e, 1, "mano", "Valefor");
  const c = poner(e, 0, "cementerio", "Valefor");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  assert.equal(N.tiene(e, beau, "Imbloqueable"), true);
  e = sinRespuesta(hacer(e, jugar(arma, { portador: beau }), c, null));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, c), "castillo");
});

test("Beauchef: no se dispara al jugar un Aliado", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Beauchef");
  const d = poner(e, 1, "mano", "Valefor");
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(zonaDe(e, d), "mano");
});

test("Bernardo O'Higgins: Barajando un Arma de tu mano Destierra una carta de coste 3 o menos", () => {
  let e = mesa();
  const bern = poner(e, 0, "defensa", "Bernardo O'Higgins");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  const r = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(bern, "Bernardo O'Higgins"), arma, r);
  assert.equal(zonaDe(e, arma), "castillo");
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(puedeUsar(e, bern), false);
});

test("Bernardo O'Higgins: los Talismanes cuestan un Oro adicional", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Bernardo O'Higgins");
  const t = poner(e, 1, "mano", "Llamar a la Manada");
  assert.equal(costeDe(e, 1, t).pagar, 2);
});

test("Bernardo O'Higgins: puede cancelar una habilidad", { todo: "respuesta: cancelar una habilidad" }, () => {});

test("Bernardo O'Higgins: no se pueden Barajar Aliados con Arma y los Tótem cuestan un Oro adicional", { todo: "continua: los Aliados que porten Armas ganan una clave; continua: los Tótems cuestan un Oro adicional" }, () => {});

test("Caballero Espejado: al entrar Destruye una carta de coste 2 o menos y juega gratis un Aliado de coste 1 de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const cab = poner(e, 0, "mano", "Caballero Espejado");
  const r = poner(e, 1, "defensa", "Valefor");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = con(sinRespuesta(aplicar(e, jugar(cab))), true, r, v);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(zonaDe(e, v), "defensa");
  for (const k of ["Furia", "Imbloqueable", "DanoAlDestierro"]) assert.equal(N.tiene(e, cab, k), true);
});

test("Camael: al entrar juega gratis un Arma de tu Castillo y al jugarla el oponente Descarta y Baraja una carta que no sea Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const camael = poner(e, 0, "mano", "Camael");
  const v = poner(e, 0, "defensa", "Valefor");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  const d = poner(e, 1, "mano", "Drácula");
  const r = poner(e, 1, "defensa", "Valefor");
  e = con(sinRespuesta(aplicar(e, jugar(camael))), true, p, v);
  assert.equal(N.portadorDe(e, p), v);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, r), "castillo");
});

test("Capitan Obrien: al entrar una carta de coste 2 o menos pierde su habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const cap = poner(e, 0, "mano", "Capitan Obrien");
  const r = poner(e, 1, "defensa", "Valefor");
  e = con(sinRespuesta(aplicar(e, jugar(cap))), true, r);
  assert.equal(N.activa(e, r), false);
  assert.equal(N.tiene(e, r, "Furia"), false);
});

test("Capitan Obrien: en tu Fase Final Baraja y/o Destierra tantas cartas de los Cementerios como su Fuerza", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Capitan Obrien");
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = hacer(e, { tipo: "elegir", i: 0 }, c[0], c[1], null, c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro", "cementerio"]);
});

test("Capitán del Demeter: su coste baja en uno si controlas Armas", () => {
  const e = mesa();
  const cap = poner(e, 0, "mano", "Capitán del Demeter");
  assert.equal(costeDe(e, 0, cap).pagar, 3);
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Pedrenyal", { portador: v });
  assert.equal(costeDe(e, 0, cap).pagar, 2);
});

test("Capitán del Demeter: al entrar dos cartas al azar de la mano oponente no se pueden jugar hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const cap = poner(e, 0, "mano", "Capitán del Demeter");
  poner(e, 1, "mano", "Valefor");
  poner(e, 1, "mano", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(cap)));
  const vetadas = e.efectos.filter((f) => f.tipo === "noJugarNombre" && f.j === 1).map((f) => f.nombre).sort();
  assert.deepEqual(vetadas, ["Llamar a la Manada", "Valefor"]);
});

test("Casimiro Marco del Pont: al entrar convierte dos cartas de un Cementerio y/o tope de un Castillo en Aliados de Fuerza 2", () => {
  let e = mesa();
  oros(e, 0, 2);
  const cas = poner(e, 0, "mano", "Casimiro Marco del Pont");
  const r = poner(e, 1, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(cas)));
  e = con(e, r, "tu Castillo");
  const nuevos = e.jugadores[0].defensa.filter((u) => u !== cas);
  assert.equal(nuevos.length, 2);
  assert.ok(nuevos.includes(r));
  for (const u of nuevos) {
    assert.equal(N.carta(e, u).tipo, "Aliado");
    assert.equal(N.fuerza(e, u), 2);
    assert.equal(N.activa(e, u), false);
  }
});

test("Casimiro Marco del Pont: genera un Oro para jugar Armas y al usarlo puedes Barajar una carta de coste 3 o menos", () => {
  let e = mesa();
  const cas = poner(e, 0, "defensa", "Casimiro Marco del Pont");
  const p = poner(e, 0, "mano", "Pedrenyal");
  const r = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(cas, "Casimiro Marco del Pont"));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === p));
  e = sinRespuesta(hacer(e, jugar(p, { portador: cas }), true, r));
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(N.portadorDe(e, p), cas);
});

test("Custodios: al entrar juega gratis un Arma de coste 2 o menos de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 3);
  const cus = poner(e, 0, "mano", "Custodios");
  const v = poner(e, 0, "defensa", "Valefor");
  const p = poner(e, 0, "cementerio", "Pedrenyal");
  e = con(sinRespuesta(aplicar(e, jugar(cus))), true, v);
  assert.equal(N.portadorDe(e, p), v);
  assert.equal(N.tiene(e, cus, "Imbloqueable"), true);
  assert.equal(N.tiene(e, cus, "Furia"), true);
});

test("Custodios: Barajando un Arma previene un efecto que afecte a tus cartas", { todo: "efecto: prevenir un efecto" }, () => {});

test("Danel: al entrar cada jugador Descarta una carta y si se Descarta un Arma Robas una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const danel = poner(e, 0, "mano", "Danel");
  const p = poner(e, 0, "mano", "Pedrenyal");
  const d = poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(danel)));
  assert.equal(zonaDe(e, p), "cementerio");
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Danel: si controlas Armas tus Aliados ganan Furia", () => {
  const e = mesa();
  const danel = poner(e, 0, "defensa", "Danel");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  assert.equal(N.tiene(e, g, "Furia"), false);
  poner(e, 0, "arma", "Pedrenyal", { portador: danel });
  assert.equal(N.tiene(e, g, "Furia"), true);
});

test("Danel: los Talismanes puestos este turno en los Cementerios pierden su habilidad", { todo: "efecto: cartas en el Cementerio pierden su habilidad" }, () => {});

test("Dorian Gray: al entrar Baraja cartas de tu mano y Roba esa cantidad más una", () => {
  let e = mesa();
  oros(e, 0, 2);
  const dorian = poner(e, 0, "mano", "Dorian Gray");
  const a = poner(e, 0, "mano", "Valefor");
  const b = poner(e, 0, "mano", "Pedrenyal");
  e = con(sinRespuesta(aplicar(e, jugar(dorian))), a, b);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Dorian Gray: si controlas o jugaste Armas no se puede Anular ni cancelar su habilidad", { todo: "protección condicional: no puede ser Anulado mientras se cumpla una condición" }, () => {});
