(() => {
  const URL_BASE = "https://nzehvfrlbmltxfqkovtu.supabase.co/rest/v1/rpc/";
  const CLAVE_API = "sb_publishable_5v43J9mYq5wdC8hxRIduTA_yyzJBZ5n";
  const K_COLECCION = "coleccion-myl", K_SESION = "cuenta-myl", K_PENDIENTES = "coleccion-myl-pendientes";
  const ERRORES = {
    credenciales: "Usuario o datos incorrectos.",
    bloqueado: "Demasiados intentos. Espera un rato y vuelve a probar.",
    usuario_invalido: "El usuario debe tener entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.",
    usuario_ocupado: "Ese usuario ya existe.",
    clave_invalida: "La contraseña debe tener al menos 8 caracteres.",
    pregunta_invalida: "Cada pregunta debe tener entre 5 y 120 caracteres.",
    preguntas_iguales: "Las dos preguntas deben ser distintas.",
    respuesta_invalida: "Cada respuesta debe tener al menos 2 caracteres.",
    sesion_invalida: "Tu sesión venció. Entra de nuevo.",
    red: "No hay conexión con el servidor. Intenta de nuevo.",
  };
  const SUGERENCIAS = [
    "¿Cuál fue tu primera carta de MyL?",
    "¿Cómo se llamaba tu primera mascota?",
    "¿En qué ciudad naciste?",
    "¿Cómo se llamaba tu colegio?",
    "¿Cuál es tu raza favorita?",
    "¿Cuál fue tu primer mazo?",
  ];

  let opciones = { alCambiar: () => {}, alSesion: () => {} }, sesion = leer(K_SESION), temporizador = null, enviando = false;

  function leer(k, defecto = null) {
    try { return JSON.parse(localStorage.getItem(k)) ?? defecto; } catch (e) { return defecto; }
  }
  function escribir(k, v) {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  async function rpc(nombre, args) {
    let r;
    try {
      r = await fetch(URL_BASE + nombre, {
        method: "POST",
        headers: { apikey: CLAVE_API, Authorization: `Bearer ${CLAVE_API}`, "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      throw Object.assign(new Error(ERRORES.red), { codigo: "red" });
    }
    const texto = await r.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (!r.ok) {
      const codigo = datos?.message === "sesion_invalida" ? "sesion_invalida" : "servidor";
      if (codigo === "sesion_invalida") cerrarLocal();
      throw Object.assign(new Error(ERRORES[codigo] || datos?.message || "Error del servidor."), { codigo });
    }
    if (datos && datos.ok === false) {
      const extra = datos.espera ? ` (${Math.ceil(datos.espera / 60)} min)` : "";
      throw Object.assign(new Error((ERRORES[datos.error] || datos.error) + extra), { codigo: datos.error });
    }
    return datos;
  }

  function aEntrada(c) {
    return { id: c.id, nombre: c.nombre || c.id, edicion: c.edicion || "", tipo: c.tipo || "", raza: c.raza || "", coste: c.coste,
      cantidad: c.cantidad, foil: c.foil || 0, legal: c.legal || undefined, actualizado: c.actualizado };
  }

  function guardarLocal(obj) {
    escribir(K_COLECCION, obj);
    opciones.alCambiar();
  }

  function cerrarLocal() {
    sesion = null;
    escribir(K_SESION, null);
    escribir(K_PENDIENTES, null);
    pintarBoton();
    opciones.alSesion(null);
  }

  async function enviarPendientes() {
    if (!sesion || enviando) return;
    const ids = leer(K_PENDIENTES, []);
    if (!ids.length) return;
    enviando = true;
    pintarBoton("sincronizando");
    const local = leer(K_COLECCION, {}) || {};
    const lote = ids.slice(0, 500);
    try {
      await rpc("guardar_cartas", { p_token: sesion.token, p_cartas: lote.map(id => ({ id, cantidad: local[id]?.cantidad || 0, foil: local[id]?.foil || 0 })) });
      const resto = leer(K_PENDIENTES, []).filter(id => !lote.includes(id) || JSON.stringify(leer(K_COLECCION, {})?.[id]) !== JSON.stringify(local[id]));
      escribir(K_PENDIENTES, resto);
      pintarBoton();
      if (resto.length) programar();
    } catch (e) {
      pintarBoton(e.codigo === "sesion_invalida" ? null : "pendiente");
      if (e.codigo === "red") setTimeout(enviarPendientes, 30000);
    } finally {
      enviando = false;
    }
  }

  function programar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(enviarPendientes, 2500);
  }

  function marcar(...ids) {
    if (!sesion) return;
    const pendientes = new Set(leer(K_PENDIENTES, []));
    ids.forEach(id => pendientes.add(String(id)));
    escribir(K_PENDIENTES, [...pendientes]);
    pintarBoton("pendiente");
    programar();
  }

  async function traerNube() {
    const datos = await rpc("mi_coleccion", { p_token: sesion.token });
    sesion.enlace = datos.enlace;
    escribir(K_SESION, sesion);
    return datos.cartas;
  }

  async function refrescar() {
    if (!sesion) return;
    try {
      await enviarPendientes();
      if (leer(K_PENDIENTES, []).length) return;
      const nube = await traerNube();
      guardarLocal(Object.fromEntries(nube.map(c => [c.id, aEntrada(c)])));
      pintarBoton();
    } catch (e) {
      pintarBoton(e.codigo === "sesion_invalida" ? null : "pendiente");
    }
  }

  async function fusionarAlEntrar() {
    const nube = await traerNube();
    const local = leer(K_COLECCION, {}) || {};
    const fusion = Object.fromEntries(nube.map(c => [c.id, aEntrada(c)]));
    const subir = [];
    for (const x of Object.values(local)) {
      const n = fusion[x.id];
      if (!n || x.cantidad > n.cantidad || (x.foil || 0) > n.foil) {
        const cantidad = Math.max(x.cantidad, n?.cantidad || 0);
        fusion[x.id] = { ...(n || x), cantidad, foil: Math.min(cantidad, Math.max(x.foil || 0, n?.foil || 0)) };
        subir.push(x.id);
      }
    }
    guardarLocal(fusion);
    if (subir.length) marcar(...subir);
    return subir.length;
  }

  function iniciarSesion(datos) {
    sesion = { usuario: datos.usuario, token: datos.token, enlace: null };
    escribir(K_SESION, sesion);
    pintarBoton();
    opciones.alSesion(sesion);
  }

  async function salir() {
    if (leer(K_PENDIENTES, []).length) await enviarPendientes();
    const token = sesion?.token;
    cerrarLocal();
    guardarLocal({});
    if (token) rpc("salir", { p_token: token }).catch(() => {});
  }

  const estilos = `
  .cta-boton{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:600 .95rem inherit;font-family:inherit;cursor:pointer;min-height:40px}
  .cta-boton[data-estado="pendiente"]::after,.cta-boton[data-estado="sincronizando"]::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--gold, #a8740f)}
  .cta-boton[data-estado="sincronizando"]::after{animation:cta-pulso 1s infinite}
  @keyframes cta-pulso{50%{opacity:.3}}
  .cta-dialogo{border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);padding:0;width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 32px)}
  .cta-dialogo::backdrop{background:rgb(0 0 0 / .5)}
  .cta-dialogo form{display:grid;gap:12px;padding:20px}
  .cta-dialogo h2{margin:0;font-size:1.25rem}
  .cta-dialogo p{margin:0;color:var(--muted)}
  .cta-dialogo label{display:grid;gap:4px;font-weight:600;font-size:.92rem}
  .cta-dialogo input{font:inherit;padding:10px 12px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink);min-width:0}
  .cta-fila{display:flex;flex-wrap:wrap;gap:8px}
  .cta-fila>*{flex:1 1 auto}
  .cta-principal{background:var(--gold, #a8740f);border-color:var(--gold, #a8740f);color:var(--surface)}
  .cta-enlace{background:none;border:0;padding:0;color:var(--gold, #a8740f);font:inherit;text-decoration:underline;cursor:pointer;justify-self:start}
  .cta-error{color:var(--warn, #a6501c);font-weight:600}
  .cta-error:empty{display:none}
  .cta-codigo{font:700 1.3rem ui-monospace,Consolas,monospace;letter-spacing:.08em;text-align:center;padding:12px;border-radius:10px;background:var(--gold-soft, #f3e6c4);color:var(--ink);user-select:all}
  .cta-url{font:.85rem ui-monospace,Consolas,monospace;word-break:break-all;padding:8px 10px;border-radius:8px;background:var(--bg);border:1px solid var(--line)}
  .cta-peligro{color:var(--warn, #a6501c)}
  `;

  let dialogo, boton;

  function el(tag, props = {}, ...hijos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k in e && typeof v !== "string") e[k] = v;
      else e.setAttribute(k, v);
    }
    e.append(...hijos.filter(h => h != null));
    return e;
  }

  function campo(etiqueta, props) {
    return el("label", {}, etiqueta, el("input", props));
  }

  function pantalla(titulo, contenido, alEnviar) {
    const error = el("p", { class: "cta-error", role: "alert" });
    const form = el("form", { method: "dialog" }, el("h2", {}, titulo), ...contenido, error);
    form.addEventListener("submit", async ev => {
      if (!alEnviar) return;
      ev.preventDefault();
      error.textContent = "";
      const botones = form.querySelectorAll("button");
      botones.forEach(b => (b.disabled = true));
      try {
        await alEnviar(new FormData(form), form);
      } catch (e) {
        error.textContent = e.message;
      } finally {
        botones.forEach(b => (b.disabled = false));
      }
    });
    dialogo.replaceChildren(form);
    if (!dialogo.open) dialogo.showModal();
    form.querySelector("input")?.focus();
  }

  const cerrar = () => el("button", { type: "button", class: "cta-boton", on: { click: () => dialogo.close() } }, "Cerrar");

  function verEntrar() {
    pantalla("Entrar", [
      el("p", {}, "Guarda tu colección en la nube y compártela con un enlace."),
      campo("Usuario", { name: "usuario", autocomplete: "username", required: true, autocapitalize: "none", spellcheck: false }),
      campo("Contraseña", { name: "clave", type: "password", autocomplete: "current-password", required: true }),
      el("div", { class: "cta-fila" }, el("button", { class: "cta-boton cta-principal" }, "Entrar"), cerrar()),
      el("button", { type: "button", class: "cta-enlace", on: { click: verCrear } }, "Crear una cuenta"),
      el("button", { type: "button", class: "cta-enlace", on: { click: verRecuperar } }, "Olvidé mi contraseña"),
    ], async d => {
      iniciarSesion(await rpc("entrar", { p_usuario: d.get("usuario").trim(), p_clave: d.get("clave") }));
      const subidas = await fusionarAlEntrar();
      verCuenta(subidas ? `Sumé ${subidas} ${subidas === 1 ? "carta" : "cartas"} de este dispositivo a tu cuenta.` : "");
    });
  }

  function verCrear() {
    const lista = el("datalist", { id: "cta-sugerencias" }, ...SUGERENCIAS.map(s => el("option", { value: s })));
    pantalla("Crear cuenta", [
      el("p", {}, "No pedimos correo. Para recuperar la cuenta tendrás un código y dos preguntas secretas."),
      campo("Usuario", { name: "usuario", autocomplete: "username", required: true, minlength: "3", maxlength: "24", pattern: "[A-Za-z0-9_.\\-]{3,24}", autocapitalize: "none", spellcheck: false }),
      campo("Contraseña (mínimo 8)", { name: "clave", type: "password", autocomplete: "new-password", required: true, minlength: "8", maxlength: "72" }),
      campo("Repite la contraseña", { name: "clave2", type: "password", autocomplete: "new-password", required: true }),
      lista,
      campo("Pregunta secreta 1", { name: "p1", list: "cta-sugerencias", required: true, minlength: "5", maxlength: "120" }),
      campo("Respuesta 1", { name: "r1", required: true, autocomplete: "off" }),
      campo("Pregunta secreta 2", { name: "p2", list: "cta-sugerencias", required: true, minlength: "5", maxlength: "120" }),
      campo("Respuesta 2", { name: "r2", required: true, autocomplete: "off" }),
      el("p", {}, "Las respuestas no distinguen mayúsculas ni tildes. Evita respuestas que otra persona pueda adivinar."),
      el("div", { class: "cta-fila" }, el("button", { class: "cta-boton cta-principal" }, "Crear cuenta"), el("button", { type: "button", class: "cta-boton", on: { click: verEntrar } }, "Volver")),
    ], async d => {
      if (d.get("clave") !== d.get("clave2")) throw new Error("Las contraseñas no coinciden.");
      const datos = await rpc("registrar", { p_usuario: d.get("usuario").trim(), p_clave: d.get("clave"),
        p_pregunta1: d.get("p1"), p_respuesta1: d.get("r1"), p_pregunta2: d.get("p2"), p_respuesta2: d.get("r2") });
      iniciarSesion(datos);
      await fusionarAlEntrar();
      verCodigo(datos.codigo, "Cuenta creada.");
    });
  }

  function verCodigo(codigo, titulo) {
    pantalla(titulo, [
      el("p", {}, "Este es tu código de recuperación. Anótalo o guárdalo en un lugar seguro: no se vuelve a mostrar y sirve una sola vez."),
      el("div", { class: "cta-codigo" }, codigo),
      el("div", { class: "cta-fila" },
        el("button", { type: "button", class: "cta-boton", on: { click: ev => navigator.clipboard?.writeText(codigo).then(() => (ev.target.textContent = "Copiado")) } }, "Copiar"),
        el("button", { type: "button", class: "cta-boton cta-principal", on: { click: () => verCuenta() } }, "Ya lo guardé")),
    ]);
  }

  function verRecuperar() {
    pantalla("Recuperar la cuenta", [
      campo("Usuario", { name: "usuario", autocomplete: "username", required: true, autocapitalize: "none", spellcheck: false }),
      el("div", { class: "cta-fila" }, el("button", { class: "cta-boton cta-principal" }, "Continuar"), el("button", { type: "button", class: "cta-boton", on: { click: verEntrar } }, "Volver")),
    ], async d => {
      const usuario = d.get("usuario").trim();
      verRecuperarCon(usuario, await rpc("preguntas_recuperacion", { p_usuario: usuario }), "codigo");
    });
  }

  function verRecuperarCon(usuario, preguntas, modo) {
    const nueva = [
      campo("Contraseña nueva (mínimo 8)", { name: "clave", type: "password", autocomplete: "new-password", required: true, minlength: "8", maxlength: "72" }),
      campo("Repite la contraseña nueva", { name: "clave2", type: "password", autocomplete: "new-password", required: true }),
    ];
    const conCodigo = modo === "codigo";
    pantalla(`Recuperar «${usuario}»`, [
      ...(conCodigo
        ? [campo("Código de recuperación", { name: "codigo", required: true, autocomplete: "off", autocapitalize: "characters", placeholder: "XXXX-XXXX-XXXX-XXXX" })]
        : [campo(preguntas.pregunta1, { name: "r1", required: true, autocomplete: "off" }), campo(preguntas.pregunta2, { name: "r2", required: true, autocomplete: "off" })]),
      ...nueva,
      el("p", {}, "Tienes 3 intentos por hora."),
      el("div", { class: "cta-fila" }, el("button", { class: "cta-boton cta-principal" }, "Cambiar contraseña"), el("button", { type: "button", class: "cta-boton", on: { click: verEntrar } }, "Volver")),
      el("button", { type: "button", class: "cta-enlace", on: { click: () => verRecuperarCon(usuario, preguntas, conCodigo ? "preguntas" : "codigo") } },
        conCodigo ? "No tengo el código: usar mis preguntas secretas" : "Usar mi código de recuperación"),
    ], async d => {
      if (d.get("clave") !== d.get("clave2")) throw new Error("Las contraseñas no coinciden.");
      const datos = conCodigo
        ? await rpc("recuperar_con_codigo", { p_usuario: usuario, p_codigo: d.get("codigo"), p_clave_nueva: d.get("clave") })
        : await rpc("recuperar_con_preguntas", { p_usuario: usuario, p_respuesta1: d.get("r1"), p_respuesta2: d.get("r2"), p_clave_nueva: d.get("clave") });
      iniciarSesion(datos);
      await fusionarAlEntrar();
      verCodigo(datos.codigo, "Contraseña cambiada");
    });
  }

  function urlCompartida(enlace) {
    return new URL(`topdeck.html?c=${encodeURIComponent(enlace)}`, location.href).href;
  }

  function verCuenta(aviso = "") {
    const pendientes = leer(K_PENDIENTES, []).length;
    const compartir = sesion.enlace
      ? [
          el("p", {}, "Cualquiera con este enlace puede ver tu Top Deck, sin poder modificarlo:"),
          el("div", { class: "cta-url" }, urlCompartida(sesion.enlace)),
          el("div", { class: "cta-fila" },
            el("button", { type: "button", class: "cta-boton cta-principal", on: { click: ev => compartirEnlace(ev.target) } }, "Copiar o compartir"),
            el("button", { type: "button", class: "cta-boton", on: { click: () => accion(() => rpc("crear_enlace", { p_token: sesion.token }), "Enlace nuevo creado; el anterior ya no funciona.") } }, "Cambiar enlace"),
            el("button", { type: "button", class: "cta-boton", on: { click: () => accion(() => rpc("revocar_enlace", { p_token: sesion.token }), "Enlace desactivado.") } }, "Desactivar")),
        ]
      : [el("button", { type: "button", class: "cta-boton cta-principal", on: { click: () => accion(() => rpc("crear_enlace", { p_token: sesion.token }), "Enlace listo.") } }, "Crear enlace para compartir mi Top Deck")];
    pantalla(`Hola, ${sesion.usuario}`, [
      aviso ? el("p", { role: "status" }, aviso) : null,
      el("p", {}, pendientes ? `Hay ${pendientes} ${pendientes === 1 ? "cambio" : "cambios"} por subir; se envían solos cuando haya conexión.` : "Tu colección está guardada en la nube."),
      ...compartir,
      el("div", { class: "cta-fila" }, el("button", { type: "button", class: "cta-boton", on: { click: async () => { await salir(); dialogo.close(); } } }, "Salir"), cerrar()),
      el("button", { type: "button", class: "cta-enlace cta-peligro", on: { click: verBorrar } }, "Borrar mi cuenta"),
    ]);
  }

  async function accion(fn, aviso) {
    try {
      await fn();
      await traerNube();
      verCuenta(aviso);
    } catch (e) {
      verCuenta(e.message);
    }
  }

  async function compartirEnlace(b) {
    const url = urlCompartida(sesion.enlace);
    try {
      if (navigator.share) await navigator.share({ title: `Top Deck de ${sesion.usuario}`, url });
      else { await navigator.clipboard.writeText(url); b.textContent = "Copiado"; }
    } catch (e) {}
  }

  function verBorrar() {
    pantalla("Borrar la cuenta", [
      el("p", {}, "Se borran tu usuario, tu colección en la nube y el enlace compartido. No se puede deshacer. La colección de este dispositivo también se vacía."),
      campo("Contraseña", { name: "clave", type: "password", autocomplete: "current-password", required: true }),
      el("div", { class: "cta-fila" }, el("button", { class: "cta-boton cta-peligro" }, "Borrar para siempre"), el("button", { type: "button", class: "cta-boton", on: { click: () => verCuenta() } }, "Volver")),
    ], async d => {
      await rpc("borrar_cuenta", { p_token: sesion.token, p_clave: d.get("clave") });
      cerrarLocal();
      guardarLocal({});
      dialogo.close();
    });
  }

  function pintarBoton(estado) {
    if (!boton) return;
    boton.textContent = sesion ? sesion.usuario : "Entrar";
    boton.title = sesion ? "Tu cuenta" : "Entrar o crear una cuenta";
    const pendientes = sesion && leer(K_PENDIENTES, []).length;
    boton.dataset.estado = estado || (pendientes ? "pendiente" : "");
  }

  function iniciar(o = {}) {
    opciones = { ...opciones, ...o };
    document.head.append(el("style", {}, estilos));
    dialogo = el("dialog", { class: "cta-dialogo", "aria-label": "Cuenta" });
    document.body.append(dialogo);
    boton = el("button", { type: "button", class: "cta-boton", on: { click: () => (sesion ? verCuenta() : verEntrar()) } });
    (opciones.contenedor || document.body).append(boton);
    pintarBoton();
    opciones.alSesion(sesion);
    window.addEventListener("online", enviarPendientes);
    window.addEventListener("storage", e => {
      if (e.key === K_SESION) { sesion = leer(K_SESION); pintarBoton(); opciones.alSesion(sesion); }
    });
    return refrescar();
  }

  const abrir = modo => (sesion ? verCuenta() : modo === "crear" ? verCrear() : verEntrar());

  window.Cuenta = { iniciar, marcar, refrescar, abrir, get sesion() { return sesion; }, rpc };
})();
