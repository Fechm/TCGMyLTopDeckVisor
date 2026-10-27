(() => {
  const ANCHO = 240;

  function suave(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function arcoiris(h) {
    const k = n => (n + h / 60) % 6;
    const f = n => 1 - Math.max(0, Math.min(k(n), 4 - k(n), 1));
    return [f(5), f(3), f(1)];
  }

  function crear(lienzo, imagen, aspecto) {
    const w = ANCHO, h = Math.round(imagen.naturalHeight * ANCHO / imagen.naturalWidth);
    lienzo.width = w; lienzo.height = h;
    const ctx = lienzo.getContext("2d", { willReadFrequently: false });
    const aux = document.createElement("canvas");
    aux.width = w; aux.height = h;
    const actx = aux.getContext("2d", { willReadFrequently: true });
    actx.drawImage(imagen, 0, 0, w, h);
    const px = actx.getImageData(0, 0, w, h).data;
    const n = w * h;
    const lum = new Float32Array(n), tinte = new Float32Array(n), oro = new Float32Array(n), grano = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max > 0 ? (max - min) / max : 0;
      let hue = 0;
      if (max > min) {
        if (max === r) hue = 60 * (((g - b) / (max - min)) % 6);
        else if (max === g) hue = 60 * ((b - r) / (max - min) + 2);
        else hue = 60 * ((r - g) / (max - min) + 4);
        if (hue < 0) hue += 360;
      }
      lum[i] = l;
      tinte[i] = Math.pow(1 - l, 1.3) * (1 - 0.75 * sat);
      oro[i] = (hue > 28 && hue < 62 ? 1 : 0) * suave(0.3, 0.55, sat) * suave(0.28, 0.5, l) * (1 - suave(0.85, 0.97, l));
    }
    let semilla = 0;
    for (const ch of aspecto.id) semilla = (semilla * 31 + ch.charCodeAt(0)) >>> 0;
    const azar = () => { semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0; return semilla / 4294967296; };
    const columna = new Float32Array(w);
    for (let x = 0; x < w; x++) columna[x] = azar();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grano[y * w + x] = 0.65 + 0.7 * (0.6 * columna[x] + 0.4 * azar());
    const desenfoque = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += lum[(y + dy) * w + x + dx];
      desenfoque[y * w + x] = s / 9;
    }
    const nx = new Float32Array(n), ny = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      nx[i] = (desenfoque[i + 1] - desenfoque[i - 1]) * 6;
      ny[i] = (desenfoque[i + w] - desenfoque[i - w]) * 6;
    }
    const salida = ctx.createImageData(w, h), o = salida.data;
    const paleta = new Float32Array(360 * 3);
    for (let k = 0; k < 360; k++) paleta.set(arcoiris(k), k * 3);
    const diag = Math.hypot(w, h);
    const ang = (aspecto.ang * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    const proy = new Float32Array(n), base = new Float32Array(n);
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
      proy[i] = (x * ca + y * sa) / diag + 0.5;
      base[i] = tinte[i] * grano[i];
    }
    const campana = new Float32Array(256);
    for (let k = 0; k < 256; k++) { const d = k / 64; campana[k] = Math.exp(-d * d); }
    for (let i = 0; i < n * 4; i += 4) o[i + 3] = 255;

    function dibujar(rx, ry) {
      const fuerza = Math.min(1, Math.hypot(rx, ry) / 18);
      const lx = ry / 25, ly = -rx / 25;
      const centro = 0.5 + (ry * 0.9 - rx * 0.5) / 40;
      const inv = 64 / (0.12 + aspecto.tam * 0.25);
      const desfase = aspecto.h + ry * 9 + rx * 6 + 3600;
      const kColor = fuerza * aspecto.sat * 0.38 * 255, kBlanco = fuerza * aspecto.blanco * 0.34 * 255;
      for (let i = 0, k = 0; i < n; i++, k += 4) {
        const p = proy[i];
        const d = Math.abs(p - centro) * inv;
        const barrido = d < 255 ? campana[d | 0] : 0;
        const e = oro[i] > 0 ? nx[i] * lx + ny[i] * ly : 0;
        const brillo = e > 0 ? oro[i] * e * Math.sqrt(e) * 561 : 0;
        if (barrido < 0.01 && brillo === 0) { o[k] = o[k + 1] = o[k + 2] = 0; continue; }
        const c = (((desfase + p * 90) | 0) % 360) * 3;
        const color = base[i] * barrido * kColor, blanco = barrido * kBlanco;
        o[k] = paleta[c] * color + blanco + brillo;
        o[k + 1] = paleta[c + 1] * color + blanco + brillo * 0.92;
        o[k + 2] = paleta[c + 2] * color + blanco + brillo * 0.7;
      }
      ctx.putImageData(salida, 0, 0);
    }
    return { dibujar };
  }

  window.Foil = { crear };
})();
