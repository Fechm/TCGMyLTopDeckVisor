import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const portadorEs = (e, ctx) => N.portadorDe(e, ctx.fuente) === ctx.datos.uid;
const fuerzaPortador = (e, ctx) => {
  const p = N.portadorDe(e, ctx.fuente);
  return p ? N.fuerza(e, p) : 0;
};
const restoPortador = (e, ctx) => Math.max(0, fuerzaPortador(e, ctx) - (ctx.vars.c ?? []).length);

const barajarYDesterrar = [
  sel(["todos:cementerio"], {}, "c", { nf: "fuerzaPortador", hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "restoPortador", hasta: true }),
  mov("desterrar", "d"),
];

const salida = (hacer) => [{ cuando: ["sale"], hacer }];

const mismaRaza = (e, ctx) => {
  const aliados = N.aliadosDe(e, ctx.ctrl);
  if (!aliados.length) return false;
  let comun = N.carta(e, aliados[0]).razas ?? [];
  for (const a of aliados.slice(1)) comun = comun.filter((r) => (N.carta(e, a).razas ?? []).includes(r));
  return comun.length > 0;
};

const alDanarConRaza = (opciones) => ({
  cuando: ["haceDano"],
  quien: "cualquiera",
  si: "danoConRaza",
  opcional: true,
  hacer: [{ op: "modo", opciones }],
});
const danoConRaza = (e, ctx) => portadorEs(e, ctx) && mismaRaza(e, ctx);

const usoCompartido = (e, ctx) => e.usos[`${ctx.fuente}|${ctx.def}|0`] !== e.turno;
const marcarUso = (e, ctx) => {
  e.usos[`${ctx.fuente}|${ctx.def}|0`] = e.turno;
};

const navalPasos = [{ op: "botar", n: 5, quien: "rival" }, sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true, quien: "rival" }), mov("desterrar", "c")];

export const HABILIDADES = {
  "Alas de Ángel": {
    portador: { claves: ["Imbloqueable"] },
    disparadas: [
      { cuando: ["entra"], hacer: [robar(2), { op: "fn", f: "angel" }] },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "quitar" }] },
    ],
    fns: {
      angel: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (!p || !(N.carta(e, p).razas ?? []).includes("Ángel")) return;
        for (const clave of ["Indestructible", "Indesterrable"]) N.agregarEfecto(e, { tipo: "gana", clave, uid: p, origen: ctx.fuente, fin: "mientras" }, ctx.ctrl);
      },
      quitar: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => f.origen !== ctx.fuente);
      },
    },
  },
  "Ama-No-Saka-Hoko": {
    portador: { fuerza: 1, claves: ["Indesterrable"] },
    disparadas: [{ cuando: ["faseFinal"], quien: "cualquiera", opcional: true, hacer: [robar(1)] }],
  },
  Anticucho: {
    portador: { fuerza: 2 },
    disparadas: [
      {
        cuando: ["ataca"],
        quien: "cualquiera",
        si: "portadorEs",
        hacer: [
          {
            op: "opcional",
            texto: "Poner un Oro de tu Cementerio en tu Oro Pagado",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Oro" } },
            pasos: [
              sel(["yo:cementerio"], { tipo: "Oro" }, "o"),
              { op: "si", f: "combo", entonces: [{ op: "ponerOro", var: "o", a: "reserva" }, { op: "fn", f: "fijar" }], sino: [{ op: "ponerOro", var: "o", a: "pagado" }] },
            ],
          },
        ],
      },
    ],
    fns: {
      portadorEs,
      combo: (e, ctx) => {
        if (e.jugadores[ctx.ctrl].jugadas.nombres.Terremoto) return true;
        return N.orosDe(e, ctx.ctrl).some((o) => ["Empanada", "Pebre"].includes(N.carta(e, o).nombre));
      },
      fijar: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (p) N.agregarEfecto(e, { tipo: "noSale", uid: p }, ctx.ctrl);
      },
    },
  },
  "Arco Patagon": {
    claves: ["Exhumar"],
    portador: { fuerza: 1, claves: ["Furia"] },
    disparadas: salida([robar(2)]),
    activadas: [
      {
        texto: "Destruir un Aliado que controles: Barajar una carta en juego de coste 3 o menos",
        veces: "turno",
        requiere: "puede",
        coste: [sel(["yo:aliados"], {}, "d", { para: "destruir" }), mov("destruir", "d")],
        hacer: [sel(["todos:enJuego"], { costeMax: 3 }), mov("barajar")],
      },
    ],
    fns: {
      puede: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => !N.tiene(e, a, "Indestructible") && N.puedeSalir(e, a)) && N.todoEnJuego(e).some((u) => coste(e, u) <= 3),
    },
  },
  "Armadura Celestial": {
    portador: { fuerza: 1, claves: ["Indesterrable"] },
    disparadas: salida([
      {
        op: "opcional",
        texto: "Descartar una carta para poner Armadura Celestial en tu mano",
        requiere: { de: ["yo:mano"], filtro: {} },
        pasos: [sel(["yo:mano"], {}, "m"), mov("cementerio", "m"), sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ]),
  },
  "Armadura Dorada": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Indestructible"] },
    disparadas: [{ cuando: ["entra"], hacer: [robar(2)] }],
  },
  "Armas Campesinas": {
    portador: { fuerza: 2, claves: ["Indestructible"] },
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:aliados"], {}, "a"), { op: "fn", f: "aCero" }, { op: "botar", nf: "perdida", quien: "rival" }, robar(2)] }],
    fns: {
      aCero: (e, ctx) => {
        let total = 0;
        for (const u of ctx.vars.a ?? []) {
          const f = N.fuerza(e, u);
          total += f;
          if (f > 0) N.agregarEfecto(e, { tipo: "fuerza", n: -f, uid: u }, ctx.ctrl);
        }
        ctx.vars.perdida = total;
      },
      perdida: (e, ctx) => ctx.vars.perdida ?? 0,
    },
  },
  "Arpon Ballenero": {
    portador: { fuerza: 2, claves: ["Indestructible"] },
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["yo:castillo"], { tipo: "Aliado" }, "b"), sel(["yo:castillo"], { tipo: "Arma" }, "b2"), mov("mano", "b"), mov("mano", "b2"), barajar()] },
      { cuando: ["faseFinal"], quien: "cualquiera", si: "ataco", hacer: barajarYDesterrar },
    ],
    fns: {
      fuerzaPortador,
      restoPortador,
      ataco: (e, ctx) => e.activo === ctx.ctrl && e.jugadores[ctx.ctrl].atacoEsteTurno,
    },
  },
  Atgeir: {
    claves: ["Exhumar"],
    portador: { fuerza: 2 },
    activadas: [{ texto: "Barajar y/o Desterrar tantas cartas de los Cementerios como Fuerza tenga el portador", momento: "vigilia", veces: "turno", hacer: barajarYDesterrar }],
    disparadas: [{ cuando: ["faseFinal"], si: "libre", opcional: true, hacer: [{ op: "fn", f: "marcar" }, ...barajarYDesterrar] }],
    fns: { fuerzaPortador, restoPortador, libre: usoCompartido, marcar: marcarUso },
  },
  Atlatl: {
    portador: { fuerza: 2 },
    disparadas: [
      { cuando: ["haceDano"], quien: "cualquiera", si: "portadorEs", hacer: [{ op: "fn", f: "marcar" }] },
      { cuando: ["faseFinal"], si: "hizo", opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Oro" }, "pagado") },
    ],
    fns: {
      portadorEs,
      marcar: (e, ctx) => {
        e.usos[`atlatl|${ctx.fuente}`] = e.turno;
      },
      hizo: (e, ctx) => e.usos[`atlatl|${ctx.fuente}`] === e.turno,
    },
  },
  "Ballesta Abismal": {
    claves: ["Exhumar"],
    portador: { fuerza: 1 },
    disparadas: [
      alDanarConRaza([
        {
          texto: "Buscar tres cartas en un Castillo y Desterrarlas",
          pasos: [castilloElegido((quien) => [sel([`${quien}:castillo`], {}, "b", { n: 3 }), mov("desterrar", "b"), barajar(quien)])],
        },
        {
          texto: "Desterrar una carta de coste 3 o menos",
          requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 }, para: "desterrar" },
          pasos: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { para: "desterrar" }), mov("desterrar")],
        },
      ]),
    ],
    fns: { danoConRaza },
  },
  "Baston de la Noche": {
    claves: ["Exhumar"],
    portador: { fuerza: 1 },
    disparadas: [
      alDanarConRaza([
        {
          texto: "Poner en juego un Aliado de coste 2 o menos de tu Cementerio",
          requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado", costeMax: 2 } },
          pasos: [sel(["yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "a"), { op: "fn", f: "poner" }],
        },
        { texto: "Robar dos cartas", pasos: [robar(2)] },
      ]),
    ],
    fns: {
      danoConRaza,
      poner: (e, ctx, api) => {
        for (const u of ctx.vars.a ?? []) api.entrarEnJuego(e, u, ctx.ctrl, undefined, { pagado: false, desde: "cementerio" });
      },
    },
  },
  "Brown Bess": {
    portador: { fuerza: 2 },
    disparadas: [
      {
        cuando: ["juega"],
        quien: "yo",
        si: "esArma",
        hacer: [
          {
            op: "opcional",
            texto: "Un Aliado que controles gana 1 de Fuerza Permanentemente",
            requiere: { de: ["yo:aliados"], filtro: {} },
            pasos: [sel(["yo:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 1 }, "juego")],
          },
        ],
      },
    ],
    fns: { esArma: (e, ctx) => ctx.datos.tipo === "Arma" },
  },
  "Cadenas del Abismo": {
    portador: { fuerza: 1 },
    activadas: [{ texto: "Buscar un Arma en tu Castillo y ponerla en tu mano", momento: "vigilia", veces: "turno", hacer: buscar(["yo:castillo"], { tipo: "Arma" }) }],
    disparadas: [{ cuando: ["faseFinal"], hacer: barajarYDesterrar }],
    fns: { fuerzaPortador, restoPortador },
  },
  "Carro Egipcio": {
    portador: { fuerza: 1, claves: ["Furia", "Imbloqueable", "DanoAlDestierro"] },
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { noTipo: ["Talismán"] }) }],
  },
  "Carruaje Infernal": {
    requiere: "sinCopia",
    portador: { fuerza: 1, noCambia: true },
    activadas: [
      {
        texto: "Desterrar una carta de un Cementerio",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["todos:cementerio"], filtro: {} },
        hacer: [sel(["todos:cementerio"], {}, "c"), mov("desterrar", "c")],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [{ op: "opcional", texto: "Desterrar una carta de un Cementerio", requiere: { de: ["todos:cementerio"], filtro: {} }, pasos: [sel(["todos:cementerio"], {}, "c"), mov("desterrar", "c")] }],
      },
      {
        cuando: ["faseFinal"],
        quien: "rival",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Tu oponente Bota dos cartas", pasos: [{ op: "botar", n: 2, quien: "rival" }] },
              { texto: "Barajar hasta dos cartas de tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")] },
            ],
          },
        ],
      },
    ],
    fns: { sinCopia: (e, ctx) => !N.armasDe(e, ctx.ctrl).some((u) => N.carta(e, u).nombre === "Carruaje Infernal") },
  },
  "Casco de Esparta": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Furia"] },
    disparadas: [{ cuando: ["entra"], hacer: [robar(2)] }],
  },
  "Cañon Naval": {
    portador: { fuerza: 2, claves: ["Imbloqueable"] },
    activadas: [{ texto: "Tu oponente Bota cinco cartas y Destierra hasta tres cartas de los Cementerios", veces: "turno", hacer: navalPasos }],
    disparadas: [
      ...salida(navalPasos),
      {
        cuando: ["faseFinal"],
        hacer: [
          {
            op: "opcional",
            texto: "Botar las primeras dos cartas de tu Castillo para agrupar un Oro",
            requiere: "puedeAgrupar",
            pasos: [{ op: "botar", n: 2, quien: "yo" }, sel(["yo:pagado"], { tipo: "Oro" }, "o"), mov("reserva", "o")],
          },
        ],
      },
    ],
    fns: {
      puedeAgrupar: (e, ctx) => e.jugadores[ctx.ctrl].castillo.length > 2 && e.jugadores[ctx.ctrl].pagado.some((o) => N.carta(e, o).tipo === "Oro"),
    },
  },
  "Cañon Silverado": {
    claves: ["Exhumar"],
    portador: { fuerza: 3, claves: ["Indesterrable"] },
    continuas: [{ impuestoTalisman: true }],
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "silverado" }] },
      { cuando: ["ataca"], quien: "cualquiera", si: "portadorEs", hacer: [{ op: "fn", f: "silverado" }] },
    ],
    fns: {
      portadorEs,
      silverado: () => [
        sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { hasta: true, para: "desterrar" }),
        mov("desterrar"),
        sel(["rival:mano"], {}, "m", { quien: "rival" }),
        mov("desterrar", "m"),
      ],
    },
  },
  "Cañon de Fusion": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [sel(["rival:enJuego"], { noTipo: ["Oro"] }), mov("barajar")] }],
    activadas: [
      {
        texto: "Barajar una carta de tu mano para Robar dos cartas",
        veces: "turno",
        requiere: { de: ["yo:mano"], filtro: {} },
        coste: [sel(["yo:mano"], {}, "m"), mov("barajar", "m")],
        hacer: [robar(2)],
      },
    ],
  },
  "Cañon de Plasma": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    activadas: [
      {
        texto: "Buscar un Arma en tu Castillo; si lo haces, Desterrar una carta del Castillo oponente de coste igual o menor",
        veces: "turno",
        hacer: [
          sel(["yo:castillo"], { tipo: "Arma" }, "b"),
          mov("mano", "b"),
          barajar(),
          { op: "si", f: "hallo", entonces: [sel(["rival:castillo"], { f: "menorIgual" }, "d"), mov("desterrar", "d"), barajar("rival")] },
        ],
      },
    ],
    fns: {
      hallo: (e, ctx) => (ctx.vars.b ?? []).length > 0,
      menorIgual: (e, ctx, u) => coste(e, u) <= Math.max(...(ctx.vars.b ?? []).map((b) => coste(e, b))),
    },
  },
  "Cañón Helios": {
    portador: { fuerza: 2, claves: ["Furia"] },
    disparadas: [
      { cuando: ["entra"], hacer: [robar(2)] },
      {
        cuando: ["ataca"],
        quien: "cualquiera",
        si: "portadorEs",
        hacer: [
          {
            op: "opcional",
            texto: "Elegir un Aliado oponente para que bloquee al portador",
            requiere: { de: ["rival:aliados"], filtro: {} },
            pasos: [sel(["rival:aliados"], {}, "b"), { op: "fn", f: "forzar" }],
          },
        ],
      },
    ],
    fns: {
      portadorEs,
      forzar: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (!p) return;
        for (const uid of ctx.vars.b ?? []) N.agregarEfecto(e, { tipo: "debeBloquearA", uid, atacante: p }, ctx.ctrl);
      },
    },
  },
  "Cetro Demoniaco": {
    reduce: "red",
    portador: { fuerza: 3, claves: ["Indesterrable"] },
    continuas: [{ reduceDanoCastillo: 999 }],
    activadas: [
      {
        texto: "Generar un Oro y Desterrar cuatro cartas del tope de un Castillo",
        veces: "turno",
        hacer: [{ op: "generar", n: 1 }, castilloElegido((quien) => [{ op: "desterrarTope", n: 4, quien }])],
      },
    ],
    fns: {
      red: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        if (N.armasDe(e, ctx.ctrl).length || (p.jugadas.Arma ?? 0) > 0 || p.jugadas.nombres.Lucifer) return 1;
        return N.aliadosDe(e, ctx.ctrl).some((a) => N.carta(e, a).nombre === "Lucifer") ? 1 : 0;
      },
    },
  },
  Chakram: {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    activadas: [
      {
        texto: "Mirar la mano oponente, elegir una carta que no sea Oro que no podrá jugar hasta tu próximo turno, y Robar una carta",
        veces: "turno",
        hacer: [sel(["rival:mano"], { noTipo: ["Oro"] }, "n"), { op: "fn", f: "vetar" }, robar(1)],
      },
    ],
    fns: {
      vetar: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "noJugarNombre", j: N.rival(ctx.ctrl), nombre: N.carta(e, u).nombre, fin: "proximoTurno" }, ctx.ctrl);
      },
    },
  },
  "Corvo Campesino": {
    claves: ["Exhumar"],
    portador: { fuerza: 3, claves: ["Furia"] },
    activadas: [
      {
        texto: "Buscar un Aliado de coste 2 o menos en tu Castillo y jugarlo sin pagar su coste, sin habilidad por el turno y pudiendo atacar",
        momento: "tuTurno",
        veces: "turno",
        hacer: [
          sel(["yo:castillo"], { tipo: "Aliado", costeMax: 2 }, "b"),
          efecto("b", { tipo: "pierdeHabilidad" }, "turno"),
          efecto("b", { tipo: "gana", clave: "AtacaAlEntrar" }, "turno"),
          { op: "jugarGratis", var: "b" },
          barajar(),
        ],
      },
    ],
  },
};
