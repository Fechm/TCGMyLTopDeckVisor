import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { traerImperio, ultimaEdicionPorNombre, cartaBase, normalizar } from "./duelo-supabase.mjs";

const mazosFuente = {
  dragon: JSON.parse(readFileSync("datos/meta/mazo-felipe.json", "utf8")),
  caballero: JSON.parse(readFileSync("datos/meta/mazo-basico-caballero.json", "utf8")),
};
const transcritas = existsSync("web/duelo/transcritas.json") ? JSON.parse(readFileSync("web/duelo/transcritas.json", "utf8")) : [];

const porNombre = ultimaEdicionPorNombre(await traerImperio());

const cartas = {};
const mazos = {};
const faltan = [];
const agregar = (nombre) => {
  const f = porNombre.get(normalizar(nombre));
  if (!f) {
    faltan.push(nombre);
    return null;
  }
  cartas[f.id] = cartaBase(f);
  return f.id;
};

for (const [mazo, lista] of Object.entries(mazosFuente)) {
  mazos[mazo] = [];
  for (const [nombre, copias] of Object.entries(lista)) {
    const id = agregar(nombre);
    if (id) for (let i = 0; i < copias; i++) mazos[mazo].push(id);
  }
}
for (const nombre of transcritas) agregar(nombre);

if (faltan.length) {
  console.error("Sin datos:", faltan.join(", "));
  process.exit(1);
}

const salida = `export const CARTAS = ${JSON.stringify(cartas, null, 1)};\n\nexport const MAZOS = ${JSON.stringify(mazos)};\n`;
writeFileSync("web/duelo/cartas-base.js", salida);
console.log(`${Object.keys(cartas).length} cartas; dragon ${mazos.dragon.length}, caballero ${mazos.caballero.length}`);
