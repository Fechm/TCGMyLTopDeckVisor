# Rediseño «grimorio» y cuenta obligatoria

Aprobado por Felipe el 2026-10-27.

## Decisiones

- Estilo grimorio oscuro: azul tinta, oro antiguo, filigranas, Cinzel para títulos y Source Sans 3 para texto.
- Navegación tipo app: barra fija abajo (Escanear · Top Deck · Cuenta), cabecera con logo y estado, transición nativa entre páginas.
- Cuenta obligatoria para escanear y para ver el Top Deck propio. Sin sesión se muestra una portada con el logo, los tres pasos y los botones Crear cuenta / Entrar.
- El enlace compartido (`topdeck.html?c=…`) no pide sesión.
- El teléfono solo guarda una memoria temporal y la cola de escaneos sin señal; nunca se presenta como colección local. Al salir de la cuenta se borra.

## Mejoras de uso

1. Botón de escanear abajo, al alcance del pulgar.
2. Ajustes avanzados (umbrales, foil automático, modo foto) en un panel plegable.
3. Ficha de confirmación al registrar una carta: nombre, legalidad y copias.
4. Insignias de legalidad con colores bien separados del oro y siempre con texto.
5. Guía de tres pasos la primera vez.
6. Nada tapado por la barra inferior, objetivos táctiles de 44 px o más, sin animaciones con «reducir movimiento».

## Fuera de alcance

La lógica del escáner, el reconocimiento, las cuentas, la sincronización y el foil del visor 3D no cambian.
