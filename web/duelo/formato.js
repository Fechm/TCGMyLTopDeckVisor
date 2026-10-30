import * as N from "./nucleo.js";

export const sel = (de, filtro = {}, como = "x", extra = {}) => ({ op: "sel", de: [].concat(de), filtro, como, ...extra });
export const mov = (a, v = "x") => ({ op: "mover", var: v, a });
export const barajar = (quien = "yo") => ({ op: "barajarCastillo", quien });
export const robar = (n, quien = "yo") => ({ op: "robar", n, quien });
export const efecto = (v, ef, fin) => ({ op: "efecto", var: v, efecto: ef, fin });
export const buscar = (de, filtro, a = "mano") => [sel(de, filtro, "b"), mov(a, "b"), barajar(), ...(de.includes("todos:castillo") ? [barajar("rival")] : [])];
export const mirar = (n, ...destinos) => [
  { op: "tope", n, como: "m" },
  ...destinos.flatMap((a, i) => [sel(["var:m"], { zona: "castillo" }, `m${i}`), mov(a, `m${i}`)]),
];
export const castilloElegido = (pasosPara) => ({
  op: "modo",
  opciones: [
    { texto: "tu Castillo", pasos: pasosPara("yo") },
    { texto: "Castillo oponente", pasos: pasosPara("rival") },
  ],
});
export const aliadoDeCastillo = (quien) => [{ op: "tope", quien, n: 1, como: "t" }, { op: "convertir", var: "t", en: "Aliado", fuerza: 2, a: "defensa" }];
export const coste = (e, u) => N.carta(e, u).coste ?? 0;
