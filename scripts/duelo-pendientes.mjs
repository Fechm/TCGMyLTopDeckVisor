import { readFileSync, writeFileSync } from "node:fs";
import { traerImperio, ultimaEdicionPorNombre, cartaBase, normalizar } from "./duelo-supabase.mjs";
import { CATALOGO } from "../web/duelo/cartas.js";

const archivo = process.argv[2] ?? "datos/meta/coleccion-felipe.json";
const salida = process.argv[3];

const crudo = JSON.parse(readFileSync(archivo, "utf8"));
const coleccion = Array.isArray(crudo?.cartas) ? crudo.cartas : Object.values(crudo);
const escaneables = new Set(JSON.parse(readFileSync("web/catalogo.json", "utf8")).cartas.map((c) => normalizar(c.nombre)));
const prohibidas = new Set(JSON.parse(readFileSync("banlist.json", "utf8")).prohibidas.map(normalizar));
const conocidas = new Set(Object.values(CATALOGO).map((c) => normalizar(c.nombre)));

const nombres = new Map();
for (const c of coleccion) {
  const k = normalizar(c.nombre ?? "");
  if (!k || nombres.has(k)) continue;
  nombres.set(k, c.nombre);
}

const porNombre = ultimaEdicionPorNombre(await traerImperio());
const grupos = { conocidas: [], sinHabilidad: [], pendientes: [], noLegales: [], sinDatos: [] };
for (const [k, nombre] of nombres) {
  if (conocidas.has(k)) { grupos.conocidas.push(nombre); continue; }
  if (!escaneables.has(k) || prohibidas.has(k)) { grupos.noLegales.push(nombre); continue; }
  const f = porNombre.get(k);
  if (!f) { grupos.sinDatos.push(nombre); continue; }
  const base = cartaBase(f);
  (base.sinHabilidad ? grupos.sinHabilidad : grupos.pendientes).push(base);
}

console.log(`Colección: ${nombres.size} cartas distintas`);
console.log(`  ya en el motor: ${grupos.conocidas.length}`);
console.log(`  sin habilidad (entran directo): ${grupos.sinHabilidad.length}`);
console.log(`  por transcribir: ${grupos.pendientes.length}`);
console.log(`  no legales o prohibidas: ${grupos.noLegales.length}${grupos.noLegales.length ? ` (${grupos.noLegales.join(", ")})` : ""}`);
if (grupos.sinDatos.length) console.log(`  sin datos en Supabase: ${grupos.sinDatos.join(", ")}`);

if (salida) {
  const md = [
    `# Cartas por transcribir (${grupos.pendientes.length})`,
    "",
    ...grupos.pendientes.map((c) => `## ${c.nombre} [${c.tipo} coste ${c.coste} fuerza ${c.tipo === "Aliado" ? c.fuerza : "-"}${c.razas.length ? ` · ${c.razas.join("/")}` : ""}]\n${c.texto}\n`),
    `# Sin habilidad (${grupos.sinHabilidad.length})`,
    "",
    ...grupos.sinHabilidad.map((c) => `- ${c.nombre}`),
  ].join("\n");
  writeFileSync(salida, md);
  console.log(`Lista escrita en ${salida}`);
}
