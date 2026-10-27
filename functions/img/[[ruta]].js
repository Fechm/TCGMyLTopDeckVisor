const VALIDA = /^(220|400)\/[\w-]{1,40}\.webp$/;

export async function onRequestGet({ request, env, params, waitUntil }) {
  const ruta = (params.ruta || []).join("/");
  if (!VALIDA.test(ruta)) return new Response("No encontrada", { status: 404 });
  const cache = caches.default;
  const guardada = await cache.match(request);
  if (guardada) return guardada;
  const objeto = await env.CARTAS.get(ruta);
  if (!objeto) return new Response("No encontrada", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  const respuesta = new Response(objeto.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=2592000, immutable",
      ETag: objeto.httpEtag,
    },
  });
  waitUntil(cache.put(request, respuesta.clone()));
  return respuesta;
}
