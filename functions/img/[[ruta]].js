const VALIDA = /^(220|400|hd)\/([\w-]{1,40})\.webp$/;
const SUPABASE = "https://nzehvfrlbmltxfqkovtu.supabase.co/rest/v1/cartas";
const CLAVE = "sb_publishable_5v43J9mYq5wdC8hxRIduTA_yyzJBZ5n";
const ORIGEN = "https://codicetcg.b-cdn.net/";
const CACHE = "public, max-age=2592000, immutable";

async function traerOriginal(env, ruta, id) {
  const r = await fetch(`${SUPABASE}?select=imagen&id=eq.${encodeURIComponent(id)}`, { headers: { apikey: CLAVE } });
  const url = r.ok ? (await r.json())[0]?.imagen : null;
  if (!url || !url.startsWith(ORIGEN)) return null;
  const imagen = await fetch(encodeURI(url), { headers: { "User-Agent": "TCGMyLTopDeckVisor (una descarga por carta)" } });
  if (!imagen.ok || !(imagen.headers.get("content-type") || "").startsWith("image/")) return null;
  const datos = await imagen.arrayBuffer();
  await env.CARTAS.put(ruta, datos, { httpMetadata: { contentType: "image/webp", cacheControl: CACHE } });
  return datos;
}

export async function onRequestGet({ request, env, params, waitUntil }) {
  const ruta = (params.ruta || []).join("/");
  const m = VALIDA.exec(ruta);
  if (!m) return new Response("No encontrada", { status: 404 });
  const cache = caches.default;
  const guardada = await cache.match(request);
  if (guardada) return guardada;
  const objeto = await env.CARTAS.get(ruta);
  const cuerpo = objeto ? objeto.body : m[1] === "hd" ? await traerOriginal(env, ruta, m[2]) : null;
  if (!cuerpo) return new Response("No encontrada", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  const respuesta = new Response(cuerpo, { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE } });
  waitUntil(cache.put(request, respuesta.clone()));
  return respuesta;
}
