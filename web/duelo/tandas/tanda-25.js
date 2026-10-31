import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });
const portadorAtaca = (e, ctx) => N.portadorDe(e, ctx.fuente) === ctx.datos.uid;
const cargarPortador = (e, ctx) => {
  const p = N.portadorDe(e, ctx.fuente);
  ctx.vars.p = p ? [p] : [];
};
const conMano = (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0;
const alCementerio = (e, ctx) => N.ubicar(e, ctx.fuente)?.zona === "cementerio";
const fuerzaCero = (v, fin) => efecto(v, { tipo: "fuerza", n: -99 }, fin);

let duplicando = false;

const espadaDivina = [
  {
    op: "modo",
    opciones: [
      {
        texto: "Destruir una carta en juego que no sea Oro",
        requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "destruir" },
        pasos: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "destruir" }), mov("destruir")],
      },
      {
        texto: "Destruir hasta dos Tótems cuyos costes sumen hasta 3",
        requiere: { de: ["todos:apoyo"], filtro: { tipo: "Tótem", costeMax: 3 }, para: "destruir" },
        pasos: [sel(["todos:apoyo"], { tipo: "Tótem", costeMax: 3 }, "t", { para: "destruir", hasta: true }), { op: "fn", f: "segundoTotem" }],
      },
    ],
  },
  robar(1),
  botar(3),
];

const espadaJuicio = [castilloElegido((quien) => [{ op: "desterrarTope", n: 3, quien }]), robar(1)];

const guadanaGigante = [{ op: "desterrarTope", n: 2, quien: "yo" }, robar(1, "rival")];

export const HABILIDADES = {
  "Daga Bebedora": {
    portador: { fuerza: 1, claves: ["Imbloqueable"] },
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [{ op: "desterrarTope", n: 2, quien: "yo" }, sel(["yo:castillo"], { tipo: "Arma", f: "copia" }, "b"), { op: "jugarGratis", var: "b" }, barajar()],
      },
    ],
    fns: { copia: (e, ctx, u) => N.carta(e, u).nombre === N.carta(e, ctx.fuente).nombre },
  },
  "Daga Ritual": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Furia", "DanoAlDestierro"] },
    disparadas: [
      {
        cuando: ["haceDano"],
        quien: "cualquiera",
        si: "portadorAtaca",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Poner un Oro del Destierro oponente en tu Oro Pagado",
                requiere: { de: ["rival:destierro"], filtro: { tipo: "Oro" } },
                pasos: [sel(["rival:destierro"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }],
              },
              {
                texto: "Buscar un Aliado y un Arma en tu Castillo",
                pasos: [sel(["yo:castillo"], { tipo: "Aliado" }, "a"), sel(["yo:castillo"], { tipo: "Arma" }, "b"), mov("mano", "a"), mov("mano", "b"), barajar()],
              },
            ],
          },
        ],
      },
    ],
    fns: { portadorAtaca },
  },
  "Daga del Bandido": {
    portador: { fuerza: 2 },
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "botarTodos" }, sel(["var:botadas"], { tipo: "Oro", zona: "cementerio" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }] }],
    fns: {
      botarTodos: (e, ctx) => {
        const botadas = [];
        for (const j of [ctx.ctrl, N.rival(ctx.ctrl)]) {
          const p = e.jugadores[j];
          const antes = p.cementerio.length;
          N.quitarDelCastillo(e, j, 4, "cementerio");
          botadas.push(...p.cementerio.slice(antes));
        }
        ctx.vars.botadas = botadas;
      },
    },
  },
  "Diabolista de Ébano": {
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["rival:aliados"], {}, "x", { quien: "rival" }),
          efecto("x", { tipo: "pierdeHabilidad" }, "mientras"),
          mov("destruir"),
          { op: "si", f: "turnoRival", entonces: [botar(4)] },
        ],
      },
    ],
    fns: { turnoRival: (e, ctx) => e.activo !== ctx.ctrl },
  },
  "El Huascar": {
    claves: ["Exhumar"],
    continuas: [
      { fuerzaPor: "duplica", a: "aliados" },
      { fuerzaPor: "porCoste", a: "tusAliados" },
    ],
    activadas: [
      {
        texto: "Desterrar hasta un Arma o Tótem en juego y Robar dos cartas",
        veces: "turno",
        hacer: [sel(["todos:enJuego"], { tipo: ["Arma", "Tótem"] }, "x", { para: "desterrar", hasta: true }), mov("desterrar"), robar(2)],
      },
    ],
    fns: {
      duplica: (e, ctx) => {
        if (duplicando || ctx.objetivo !== N.portadorDe(e, ctx.fuente)) return 0;
        duplicando = true;
        try {
          return N.fuerza(e, ctx.objetivo);
        } finally {
          duplicando = false;
        }
      },
      porCoste: (e, ctx) => (ctx.objetivo === N.portadorDe(e, ctx.fuente) ? 0 : coste(e, ctx.objetivo)),
    },
  },
  "Escudo de Energia": {
    portador: { fuerza: 1, claves: ["Indesterrable"] },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Dos cartas del tope de tu Castillo", pasos: [{ op: "tope", n: 2, como: "t" }, mov("mano", "t")] },
              { texto: "Dos cartas del fondo de tu Castillo", pasos: [{ op: "tope", n: 2, fondo: true, como: "t" }, mov("mano", "t")] },
            ],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Desterrar esta Arma: reducir a 0 el daño que fueras a recibir este turno",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "turno" }],
      },
    ],
  },
  "Espada Divina": {
    portador: { fuerza: 2, claves: ["Furia"] },
    disparadas: [
      { cuando: ["entra"], hacer: espadaDivina },
      { cuando: ["ataca"], quien: "cualquiera", si: "portadorAtaca", hacer: espadaDivina },
    ],
    fns: {
      portadorAtaca,
      segundoTotem: (e, ctx) => {
        const [t] = ctx.vars.t ?? [];
        if (!t) return [];
        return [sel(["todos:apoyo"], { tipo: "Tótem", costeMax: 3 - coste(e, t), excluir: [t] }, "t2", { para: "destruir", hasta: true }), mov("destruir", "t"), mov("destruir", "t2")];
      },
    },
  },
  "Espada Larga": {
    portador: { fuerza: 1 },
    disparadas: [{ cuando: ["entra"], hacer: [robar(2)] }],
  },
  "Espada Veyrazh": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Furia"] },
    activadas: [
      {
        texto: "Desterrar una carta en juego que no sea Oro",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "desterrar" },
        hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "desterrar" }), mov("desterrar")],
      },
    ],
    disparadas: [{ cuando: ["sale"], opcional: true, hacer: buscar(["yo:castillo"], {}) }],
  },
  "Espada de Akmallah": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["NoBarajable"] },
    activadas: [
      {
        texto: "Desterrar esta Arma: hasta dos Aliados tienen Fuerza 0 por el turno",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:aliados"], {}, "x", { n: 2, hasta: true }), fuerzaCero("x")],
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], hacer: [{ op: "fn", f: "agrupar" }] }],
    fns: {
      agrupar: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        p.defensa.push(...p.ataque.splice(0));
      },
    },
  },
  "Espada de Luz": {
    claves: ["Exhumar"],
    disparadas: [{ cuando: ["entra"], si: "puede", hacer: [{ op: "fn", f: "luz" }] }],
    fns: {
      puede: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        return !!p && coste(e, p) <= 2 && e.usos[`luz|${ctx.ctrl}`] !== e.turno;
      },
      luz: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (!p) return [];
        e.usos[`luz|${ctx.ctrl}`] = e.turno;
        ctx.vars.p = [p];
        ctx.vars.n = N.fuerza(e, p);
        return [efecto("p", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir", "p"), { op: "botar", nf: "cuantas", quien: "yo" }];
      },
      cuantas: (e, ctx) => ctx.vars.n ?? 0,
    },
  },
  "Espada de O'Higgins": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    activadas: [
      {
        texto: "Barajar una carta que no sea Oro o buscar un Oro en tu Castillo",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar una carta en juego que no sea Oro",
                requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] } },
                pasos: [sel(["todos:enJuego"], { noTipo: ["Oro"] }), mov("barajar")],
              },
              { texto: "Buscar un Oro en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Oro" }) },
            ],
          },
        ],
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], hacer: [sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }), mov("desterrar", "c"), robar(2)] }],
  },
  "Espada de San Jeronimo": {
    portador: { fuerza: 2 },
    activadas: [
      {
        texto: "Un Aliado de coste 2 o menos tiene Fuerza 0 hasta tu próximo turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 } },
        hacer: [sel(["todos:aliados"], { costeMax: 2 }), fuerzaCero("x", "proximoTurno")],
      },
    ],
  },
  "Espada del Guerrero Inmortal": {
    portador: { fuerza: 2, claves: ["Furia"] },
    continuas: [{ fuerza: 1, a: "tusAliados" }],
    activadas: [
      {
        texto: "Buscar un Aliado y un Arma en tu Castillo o Robar dos cartas",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Buscar un Aliado y un Arma",
                pasos: [sel(["yo:castillo"], { tipo: "Aliado" }, "a"), sel(["yo:castillo"], { tipo: "Arma" }, "b"), mov("mano", "a"), mov("mano", "b"), barajar()],
              },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
            ],
          },
        ],
      },
    ],
  },
  "Espada del Juicio": {
    portador: { fuerza: 2, claves: ["Imbloqueable"] },
    disparadas: [
      { cuando: ["entra"], hacer: espadaJuicio },
      { cuando: ["comienzoTurno"], hacer: espadaJuicio },
    ],
    activadas: [
      {
        texto: "Desterrarla de tu Cementerio: un Aliado gana o pierde 2 de Fuerza permanentemente",
        zona: "cementerio",
        requiere: { de: ["todos:aliados"], filtro: {} },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [
          sel(["todos:aliados"], {}, "a"),
          {
            op: "modo",
            opciones: [
              { texto: "Gana 2 de Fuerza", pasos: [efecto("a", { tipo: "fuerza", n: 2 }, "juego")] },
              { texto: "Pierde 2 de Fuerza", pasos: [efecto("a", { tipo: "fuerza", n: -2 }, "juego")] },
            ],
          },
        ],
      },
    ],
  },
  "Espada del Orden": {
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 2, azar: true }), mov("mano", "c"), sel(["rival:aliados"], { costeMax: 2 }, "a", { hasta: true }), mov("mano", "a")],
      },
      {
        cuando: ["sale"],
        si: "alCementerio",
        hacer: [
          {
            op: "opcional",
            texto: "Descartar una carta para subir Espada del Orden a tu mano",
            requiere: "conMano",
            pasos: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), sel(["fuente"], {}, "yo"), mov("mano", "yo")],
          },
        ],
      },
    ],
    fns: { alCementerio, conMano },
  },
  Estaca: {
    portador: { fuerza: 2, claves: ["Furia"] },
    activadas: [
      {
        texto: "Robar tres cartas, Barajar una carta oponente que no sea Oro y tantas cartas de tu mano como su coste",
        veces: "turno",
        hacer: [robar(3), sel(["rival:enJuego"], { noTipo: ["Oro"] }), mov("barajar"), sel(["yo:mano"], {}, "m", { nf: "costeX" }), mov("barajar", "m")],
      },
    ],
    fns: { costeX: (e, ctx) => (ctx.vars.x ?? []).reduce((s, u) => s + coste(e, u), 0) },
  },
  "Estaca y Martillo": {
    portador: { fuerza: 2 },
    activadas: [
      {
        texto: "Barajar un Aliado de coste 2 o menos o buscar una carta que no sea Talismán",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar un Aliado de coste 2 o menos",
                requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 } },
                pasos: [sel(["todos:aliados"], { costeMax: 2 }), mov("barajar")],
              },
              { texto: "Buscar una carta que no sea Talismán", pasos: buscar(["yo:castillo"], { noTipo: ["Talismán"] }) },
            ],
          },
        ],
      },
    ],
  },
  "Flechar Xoon": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    disparadas: [
      {
        cuando: ["sale"],
        hacer: [
          {
            op: "opcional",
            texto: "Desterrar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "desterrar" },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "desterrar" }), mov("desterrar")],
          },
        ],
      },
    ],
  },
  "Garfio Pirata": {
    portador: { fuerza: 2, claves: ["Furia"] },
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "cargarPortador" }, efecto("p", { tipo: "noSale" }, "proximoTurno")] },
      {
        cuando: ["ataca"],
        quien: "cualquiera",
        si: "atacaCaro",
        hacer: [{ op: "modo", opciones: [{ texto: "Generar un Oro", pasos: [{ op: "generar", n: 1 }] }, { texto: "Robar una carta", pasos: [robar(1)] }] }],
      },
    ],
    fns: { cargarPortador, atacaCaro: (e, ctx) => portadorAtaca(e, ctx) && coste(e, ctx.datos.uid) >= 1 },
  },
  "Garras de Demonio": {
    disparadas: [
      { cuando: ["entra"], hacer: buscar(["yo:castillo"], { noTipo: ["Talismán"] }) },
      { cuando: ["faseFinal"], opcional: true, hacer: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")] },
      { cuando: ["sale"], hacer: [botar(4)] },
    ],
  },
  "Garras de Dragón": {
    claves: ["Exhumar"],
    portador: { claves: ["NoBarajable"] },
    continuas: [{ fuerzaPor: "porCoste", a: "aliados" }],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [{ op: "fn", f: "botarCruzado" }, { op: "si", f: "hubo", entonces: [sel(["todos:cementerio"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }] }],
      },
    ],
    fns: {
      porCoste: (e, ctx) => (ctx.objetivo === N.portadorDe(e, ctx.fuente) ? coste(e, ctx.objetivo) : 0),
      botarCruzado: (e, ctx) => {
        const js = [ctx.ctrl, N.rival(ctx.ctrl)];
        const n = js.map((j) => N.orosDe(e, N.rival(j)).length);
        let hubo = false;
        js.forEach((j, i) => {
          const p = e.jugadores[j];
          const antes = p.cementerio.length;
          N.quitarDelCastillo(e, j, n[i], "cementerio");
          if (p.cementerio.slice(antes).some((u) => N.carta(e, u).tipo === "Oro")) hubo = true;
        });
        ctx.vars.hubo = hubo;
      },
      hubo: (e, ctx) => ctx.vars.hubo === true,
    },
  },
  Gatling: {
    portador: { fuerza: 3, claves: ["Imbloqueable"] },
    activadas: [
      {
        texto: "Una carta pierde su habilidad por el turno y Robas una carta",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: {} },
        hacer: [sel(["todos:enJuego"]), efecto("x", { tipo: "pierdeHabilidad" }), robar(1)],
      },
    ],
  },
  "Guadaña Gigante": {
    claves: ["Exhumar", "NoPierdeHabilidad"],
    portador: { fuerza: -4, claves: ["NoSale"] },
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "cargarPortador" }, efecto("p", { tipo: "pierdeHabilidad" }, "mientras"), ...guadanaGigante] },
      { cuando: ["comienzoVigilia"], quien: "rival", hacer: guadanaGigante },
    ],
    fns: { cargarPortador },
  },
  "Guadaña de Santa Muerte": {
    portador: { fuerza: 2, claves: ["Indestructible"] },
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: [sel(["todos:aliados"], {}, "x", { para: "destruir" }), mov("destruir")] },
      {
        cuando: ["faseFinal"],
        si: "sinFuriaNiImbloqueable",
        hacer: [sel(["yo:pagado"], {}, "o"), mov("reserva", "o"), { op: "mostrarHasta", tipos: ["Talismán"], como: "m" }, mov("mano", "m"), barajar()],
      },
    ],
    fns: {
      sinFuriaNiImbloqueable: (e, ctx) => !N.aliadosDe(e, ctx.ctrl).some((a) => N.tiene(e, a, "Furia") || N.tiene(e, a, "Imbloqueable")),
    },
  },
};
