import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const disp = (e, j, tipo) =>
  e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).filter((g) => !g.tipos || g.tipos.includes(tipo)).reduce((s, g) => s + g.n, 0);

const contar = (e, j, c) => {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
};

const jugarReducido = (e, ctx, api, uid) => {
  const j = ctx.ctrl;
  const c = N.carta(e, uid);
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, j, Math.max(0, coste(e, uid) - 1), c.tipo);
  contar(e, j, c);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  const datos = { pagado: true, desde };
  if (c.tipo === "Arma") return [{ op: "sel", de: ["yo:aliados"], filtro: { armaLibre: uid }, como: "_port" }, { op: "portar", arma: uid, en: "_port", datos }];
  return [{ op: "entrar", uid, datos }];
};

const pagableReducido = (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= disp(e, ctx.ctrl, N.carta(e, u).tipo);

const barajarYDesterrar = (n) => [
  sel(["todos:cementerio"], {}, "c", { n, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
  mov("desterrar", "d"),
];

const desterrarFuente = [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")];

const desanular = (e, ctx) => {
  const item = e.pila[ctx.objetivoPila];
  if (item) item.anulado = false;
};

const jugadasDe = (e, j) => {
  const p = e.jugadores[j];
  return ["Aliado", "Arma", "Tótem", "Talismán"].reduce((s, t) => s + (p.jugadas[t] ?? 0), 0) + (p.oroJugado ? 1 : 0);
};

const TIPOS = ["Aliado", "Arma", "Tótem", "Talismán", "Oro"];

const FUERA = ["todos:enJuego", "todos:cementerio", "todos:destierro"];

export const HABILIDADES = {
  "Guerra Celestial": {
    soloRespuesta: true,
    respuesta: {
      anula: { tipo: ["Aliado", "Tótem"], costeMax: 3 },
      pasos: [{ op: "fn", f: "objetivo" }, sel(["rival:reserva"], {}, "o", { hasta: true, quien: "rival" }), { op: "fn", f: "resolver" }],
    },
    fns: {
      objetivo: (e, ctx) => {
        desanular(e, ctx);
        const item = e.pila[ctx.objetivoPila];
        ctx.vars.obj = item ? [item.uid] : [];
      },
      resolver: (e, ctx) => {
        const pago = ctx.vars.o ?? [];
        if (pago.length) {
          for (const u of pago) N.mover(e, u, "pagado", { j: N.rival(ctx.ctrl) });
          N.robar(e, ctx.ctrl, 1);
          return;
        }
        for (const u of ctx.vars.obj ?? []) N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: u }, ctx.ctrl);
      },
    },
  },
  Gula: {
    talisman: [robar(7)],
    disparadas: [{ zona: ["cementerio"], cuando: ["comienzoVigilia"], quien: "yo", si: "sinReserva", hacer: [robar(1)] }],
    fns: { sinReserva: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length === 0 },
  },
  Hain: {
    talisman: [
      sel(["todos:enJuego"], { tipo: ["Aliado", "Tótem"] }, "x", { n: 99 }),
      mov("barajar"),
      sel(["yo:cementerio"], {}, "c", { n: 4, hasta: true }),
      mov("barajar", "c"),
    ],
  },
  "Haka Pei": {
    talisman: [
      sel(["rival:enJuego"], { costeMax: 1 }, "x", { para: "destruir" }),
      mov("destruir"),
      ...barajarYDesterrar(3),
      robar(1),
    ],
    fns: { resto: (e, ctx) => 3 - (ctx.vars.c ?? []).length },
  },
  "Hambre del Vacio": {
    momentos: ["faseFinal"],
    claves: ["IndesterrableCementerio"],
    talisman: [robar(1), sel(["rival:oros"], { tipo: "Oro", conHabilidad: true }, "o", { n: 2, quien: "rival" }), { op: "fn", f: "apagar" }],
    fns: {
      apagar: (e, ctx) => {
        for (const u of ctx.vars.o ?? []) e.conv[u] = { tipo: "Oro", sinHabilidad: true };
      },
    },
  },
  "Heraldos del Titán": {
    momentos: ["comienzoFase"],
    talisman: [
      sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }),
      efecto("a", { tipo: "debeAtacar" }),
      efecto("a", { tipo: "debeBloquear" }),
      {
        op: "si",
        f: "miTurno",
        entonces: [{ op: "generar", n: 1, tipos: ["Arma", "Tótem"] }],
        sino: [
          sel(["yo:aliados"], {}, "y", { n: 99 }),
          efecto("y", { tipo: "fuerza", n: 1 }),
          efecto("y", { tipo: "gana", clave: "Indestructible" }),
          efecto("y", { tipo: "gana", clave: "Indesterrable" }),
        ],
      },
    ],
    fns: { miTurno: (e, ctx) => e.activo === ctx.ctrl },
  },
  "Herido Peleo Mejor": {
    claves: ["Exhumar"],
    talisman: [sel(["yo:aliados"], {}, "k1"), sel(["rival:aliados"], {}, "k2", { quien: "rival" }), { op: "fn", f: "resto" }],
    fns: {
      resto: (e, ctx) => {
        const quedan = [...(ctx.vars.k1 ?? []), ...(ctx.vars.k2 ?? [])];
        ctx.vars.r = [...N.aliadosDe(e, ctx.ctrl), ...N.aliadosDe(e, N.rival(ctx.ctrl))].filter((u) => !quedan.includes(u));
        return [mov("barajar", "r"), { op: "si", f: "tres", entonces: [{ op: "generar", n: 1, tipos: ["Aliado"] }], sino: [robar(2)] }];
      },
      tres: (e, ctx) => (ctx.vars.r ?? []).filter((u) => N.ubicar(e, u)?.zona === "castillo").length >= 3,
    },
  },
  "Hijo Mortal": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        n: 2,
        hasta: true,
        opciones: [
          {
            texto: "Una carta en juego pierde su habilidad hasta tu próximo turno",
            requiere: { de: ["todos:enJuego"], filtro: {} },
            pasos: [sel(["todos:enJuego"], {}, "p"), efecto("p", { tipo: "pierdeHabilidad" }, "proximoTurno")],
          },
          {
            texto: "Destruir una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "destruir" },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "d", { para: "destruir" }), mov("destruir", "d")],
          },
          { texto: "Buscar una carta en tu Castillo y ponerla en tu mano", pasos: buscar(["yo:castillo"], {}) },
        ],
      },
    ],
  },
  "Hijos de la Noche": {
    talisman: [
      ...TIPOS.map((tipo, i) => sel(["rival:castillo"], { tipo }, `h${i}`, { hasta: true })),
      { op: "fn", f: "juntar" },
      mov("desterrar", "d"),
      barajar("rival"),
      {
        op: "si",
        f: "pocas",
        entonces: [
          {
            op: "opcional",
            texto: "Usar el efecto adicional de Hijos de la Noche",
            pasos: [
              {
                op: "modo",
                opciones: [
                  {
                    texto: "Poner un Oro Desterrado en tu Oro Pagado y robar dos cartas",
                    requiere: { de: ["var:d"], filtro: { tipo: "Oro", zona: "destierro" } },
                    pasos: [sel(["var:d"], { tipo: "Oro", zona: "destierro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }, robar(2)],
                  },
                  {
                    texto: "Jugar una carta que no sea Talismán del Destierro oponente reduciendo su coste en un Oro",
                    requiere: { de: ["rival:destierro"], filtro: { noTipo: ["Talismán"], f: "pagable" } },
                    pasos: [sel(["rival:destierro"], { noTipo: ["Talismán"], f: "pagable" }, "j"), { op: "fn", f: "jugar" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      juntar: (e, ctx) => {
        ctx.vars.d = TIPOS.flatMap((_, i) => ctx.vars[`h${i}`] ?? []);
      },
      pocas: (e, ctx) => (ctx.vars.d ?? []).filter((u) => N.ubicar(e, u)?.zona === "destierro").length <= 3,
      pagable: pagableReducido,
      jugar: (e, ctx, api) => (ctx.vars.j ?? []).flatMap((u) => jugarReducido(e, ctx, api, u)),
    },
  },
  "Honor del Quijote": {
    orosMenos: "porJugadas",
    talisman: [{ op: "fn", f: "recordarPago" }, ...buscar(["yo:castillo"], { costeMin: 1 }), { op: "si", f: "pago", entonces: [sel(["todos:enJuego"], { costeMax: 3 }, "z"), mov("barajar", "z")] }],
    fns: {
      porJugadas: (e, ctx) => jugadasDe(e, N.rival(ctx.ctrl)),
      recordarPago: (e, ctx) => {
        ctx.vars.pago = 2 - jugadasDe(e, N.rival(ctx.ctrl)) > 0;
      },
      pago: (e, ctx) => ctx.vars.pago === true,
    },
  },
  "Hp Lovecraft": {
    destierroAlJugar: true,
    requiere: { de: ["todos:aliados"], filtro: {} },
    talisman: [sel(["todos:aliados"], {}, "a"), { op: "fn", f: "otorgar" }],
    activadas: [
      {
        texto: "Desterrar hasta una carta de coste 3 o menos y tu oponente Destierra una carta de su mano",
        veces: "turno",
        hacer: [
          sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true, para: "desterrar" }),
          mov("desterrar"),
          sel(["rival:mano"], {}, "m", { quien: "rival" }),
          mov("desterrar", "m"),
        ],
      },
    ],
    fns: {
      otorgar: (e, ctx) => {
        for (const u of ctx.vars.a ?? []) e.ganadas[u] = [...(e.ganadas[u] ?? []), ctx.def];
      },
    },
  },
  "Huida de Marte": {
    destierroAlJugar: true,
    talisman: [{ op: "efecto", efecto: { tipo: "maxAtacantes", n: 2 }, fin: "proximoTurno" }, robar(2)],
  },
  "Hundir Barcos": {
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar"), robar(1)],
  },
  "Héroes de la Concepcion": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Cambiar los objetivos de un efecto oponente a una carta que controles y robar una carta", pasos: [robar(1)] },
          {
            texto: "Barajar una carta de coste 3 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 } },
            pasos: [sel(["todos:enJuego"], { costeMax: 3 }), mov("barajar")],
          },
        ],
      },
    ],
  },
  "Identidad Secreta": {
    respuesta: { anula: { tipo: ["Arma", "Tótem"], costeMax: 3 }, pasos: [{ op: "fn", f: "aDestierro" }] },
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Desterrar las Armas en juego",
            requiere: { de: ["todos:armas"], filtro: {}, para: "desterrar" },
            pasos: [sel(["todos:armas"], {}, "a", { n: 99, para: "desterrar" }), mov("desterrar", "a")],
          },
          {
            texto: "Desterrar un Tótem",
            requiere: { de: ["todos:apoyo"], filtro: { tipo: "Tótem" }, para: "desterrar" },
            pasos: [sel(["todos:apoyo"], { tipo: "Tótem" }, "t", { para: "desterrar" }), mov("desterrar", "t")],
          },
        ],
      },
    ],
    activadas: [{ texto: "Pagar un Oro: subirlo del Cementerio a tu mano y robar una carta", zona: "cementerio", oros: 1, hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo"), robar(1)] }],
    fns: {
      aDestierro: (e, ctx) => {
        const item = e.pila[ctx.objetivoPila];
        if (item) item.destierro = true;
      },
    },
  },
  Illuminati: {
    destierroAlJugar: true,
    requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }), efecto("x", { tipo: "pierdeHabilidad" })],
  },
  "Iluminar el Camino": {
    soloRespuesta: true,
    claves: ["NoAnulable"],
    respuesta: { anula: {}, pasos: [{ op: "fn", f: "seguir" }, { op: "efecto", efecto: { tipo: "noJugarMas" }, jugador: "yo" }] },
    fns: { seguir: desanular },
  },
  "Intervencion Divina": {
    momentos: ["comienzoFase"],
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Una carta pierde su habilidad por el turno",
            requiere: { de: ["todos:enJuego"], filtro: {} },
            pasos: [sel(["todos:enJuego"], {}, "p"), efecto("p", { tipo: "pierdeHabilidad" })],
          },
          { texto: "Barajar y/o Desterrar hasta tres cartas de los Cementerios", pasos: barajarYDesterrar(3) },
          {
            texto: "Mover un Aliado a la Línea de Ataque",
            requiere: { de: ["todos:defensa"], filtro: { tipo: "Aliado" } },
            pasos: [sel(["todos:defensa"], { tipo: "Aliado" }, "m"), { op: "fn", f: "alAtaque" }],
          },
        ],
      },
    ],
    fns: {
      resto: (e, ctx) => 3 - (ctx.vars.c ?? []).length,
      alAtaque: (e, ctx) => {
        for (const u of ctx.vars.m ?? []) {
          const j = N.controlador(e, u);
          N.sacar(e, u);
          e.jugadores[j].ataque.push(u);
          if (j === e.activo && ["ataque", "bloqueo", "talismanes"].includes(e.fase) && !e.atacantes.includes(u)) e.atacantes.push(u);
        }
      },
    },
  },
  "Invasión": {
    claves: ["Exhumar", "NoAnulable"],
    soloPagando: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Un Oro oponente pierde su habilidad y es Desterrado",
            requiere: { de: ["rival:oros"], filtro: {}, para: "desterrar" },
            pasos: [sel(["rival:oros"], {}, "x", { para: "desterrar" }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("desterrar")],
          },
          {
            texto: "Hasta dos cartas que no sean Oro pierden su habilidad y son Desterradas",
            pasos: [
              sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { n: 2, hasta: true, para: "desterrar" }),
              efecto("x", { tipo: "pierdeHabilidad" }, "mientras"),
              mov("desterrar"),
            ],
          },
        ],
      },
      robar(2),
    ],
  },
  "Invocar Anfibios": {
    requiere: { de: FUERA, filtro: {} },
    talisman: [sel(FUERA, {}, "x"), efecto("x", { tipo: "pierdeHabilidad", fuera: true })],
  },
  "Invocar Ángeles": {
    soloPagando: true,
    talisman: [sel(["yo:cementerio"], { tipo: "Aliado", f: "angel" }, "a", { hasta: true }), { op: "fn", f: "jugar" }],
    fns: {
      angel: (e, ctx, u) => (N.carta(e, u).razas ?? []).includes("Ángel") && pagableReducido(e, ctx, u),
      jugar: (e, ctx, api) => (ctx.vars.a ?? []).flatMap((u) => jugarReducido(e, ctx, api, u)),
    },
  },
  Ira: {
    requiere: { de: ["todos:aliados"], filtro: {} },
    talisman: [
      sel(["todos:aliados"], {}, "a"),
      efecto("a", { tipo: "gana", clave: "Furia" }),
      efecto("a", { tipo: "gana", clave: "Imbloqueable" }),
      efecto("a", { tipo: "gana", clave: "DanoAlDestierro" }),
      efecto("a", { tipo: "fuerza", n: 3 }),
    ],
    activadas: [
      {
        texto: "Desterrarlo del Cementerio: un Aliado gana 1 de Fuerza y su ataque no puede ser cancelado por el turno",
        zona: "cementerio",
        requiere: { de: ["todos:aliados"], filtro: {} },
        coste: desterrarFuente,
        hacer: [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 1 }), efecto("a", { tipo: "gana", clave: "AtaqueNoCancelable" })],
      },
    ],
  },
  Jauria: {
    requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] } },
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Destruir una carta oponente que no sea Oro",
            requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] }, para: "destruir" },
            pasos: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { para: "destruir" }), { op: "fn", f: "medir" }, mov("destruir")],
          },
          {
            texto: "Desterrar una carta oponente que no sea Oro",
            requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] }, para: "desterrar" },
            pasos: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { para: "desterrar" }), { op: "fn", f: "medir" }, mov("desterrar")],
          },
        ],
      },
      { op: "si", f: "caro", entonces: [sel(["yo:mano"], {}, "m"), mov("barajar", "m")] },
    ],
    activadas: [
      {
        texto: "Desterrarlo del Cementerio y pagar un Oro: buscar un Arma o Tótem en tu Castillo y ponerlo en tu mano",
        zona: "cementerio",
        oros: 1,
        coste: desterrarFuente,
        hacer: buscar(["yo:castillo"], { tipo: ["Arma", "Tótem"] }),
      },
    ],
    fns: {
      medir: (e, ctx) => {
        ctx.vars.caro = (ctx.vars.x ?? []).some((u) => coste(e, u) >= 3);
      },
      caro: (e, ctx) => ctx.vars.caro === true,
    },
  },
  "Jugando con el Demonio": {
    talisman: [{ op: "fn", f: "ganar" }, sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 1 })],
    activadas: ["mano", "cementerio"].map((zona) => ({
      texto: "Pagar un Oro y Desterrarlo: no eres afectado por efectos oponentes este turno",
      zona,
      oros: 1,
      requiere: "atacoAntes",
      coste: desterrarFuente,
      hacer: [{ op: "fn", f: "inmune" }],
    })),
    fns: {
      ganar: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "gana", clave: "Imbloqueable", aliadosDe: ctx.ctrl }, ctx.ctrl);
        N.agregarEfecto(e, { tipo: "gana", clave: "AtaqueNoCancelable", aliadosDe: ctx.ctrl }, ctx.ctrl);
      },
      inmune: (e, ctx) => N.agregarEfecto(e, { tipo: "proteccion", de: ctx.ctrl, por: "todo" }, ctx.ctrl),
      atacoAntes: (e, ctx) => e.jugadores[ctx.ctrl].atacoTurnoAnterior,
    },
  },
  "Juicio de Metatron": {
    claves: ["NoAnulable"],
    requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] } },
    talisman: [
      sel(["todos:enJuego"], { noTipo: ["Oro"] }),
      { op: "fn", f: "medir" },
      { op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar")] }, { texto: "Desterrar", pasos: [mov("desterrar")] }] },
      {
        op: "modo",
        opciones: [
          { texto: "Tantas como su coste", pasos: [{ op: "desterrarTope", quien: "rival", nf: "porCoste" }] },
          { texto: "Tantas como su Fuerza", pasos: [{ op: "desterrarTope", quien: "rival", nf: "porFuerza" }] },
        ],
      },
      { op: "robar", nf: "porCoste" },
    ],
    activadas: [
      {
        texto: "Desterrarlo del Cementerio: los Aliados pierden 1 de Fuerza por el turno",
        zona: "cementerio",
        coste: desterrarFuente,
        hacer: [sel(["todos:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: -1 })],
      },
    ],
    fns: {
      medir: (e, ctx) => {
        const [u] = ctx.vars.x ?? [];
        ctx.vars.c = u ? coste(e, u) : 0;
        ctx.vars.f = u ? N.fuerza(e, u) : 0;
      },
      porCoste: (e, ctx) => ctx.vars.c ?? 0,
      porFuerza: (e, ctx) => ctx.vars.f ?? 0,
    },
  },
};
