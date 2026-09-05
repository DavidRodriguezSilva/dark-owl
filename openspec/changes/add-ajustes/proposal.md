# Change: Ajustes persistentes y tema claro/oscuro

## Why

Hoy no se puede configurar nada. Todo está fijado en el código: el tema es
oscuro y punto, el micrófono es el que el sistema dé por defecto y el idioma
de transcripción está escrito en `src/main/engine.js`. Los tres cambios
siguientes de la cola —micrófono, transcripción y glosario— necesitan lo
mismo antes de poder existir: **un sitio donde guardar una preferencia y un
sitio donde enseñarla**. Ninguno de los dos existe.

Este change monta esa base y la estrena con el ajuste más barato que hay.

## What Changes

- **Fichero de ajustes** `ajustes.json` en el directorio de datos de la
  aplicación (`~/.config/Dark Owl` en Linux, `%APPDATA%\Dark Owl` en Windows),
  con sobre versionado y escritura atómica. Lo gestiona el proceso main, que
  es quien tiene acceso al disco.
- **Nuevo `src/main/ajustes.js`**: valores por defecto, carga tolerante a un
  fichero corrupto o editado a mano, validación por campo y guardado.
- **Tres canales IPC nuevos** y una superficie nueva en `window.api`
  (`api.ajustes`), detallados en `design.md`.
- **Panel de ajustes en la ventana**, abierto desde un botón de engranaje en
  la barra de título. Ocupa el mismo espacio desplegado que el panel de texto
  y es excluyente con él: la tira sigue midiendo lo mismo en reposo.
- **Tema claro/oscuro/seguir al sistema**, con `oscuro` como base y el sistema
  como valor por defecto. Es el ajuste con el que se estrena la
  infraestructura — ver `design.md`, decisión D1, que explica por qué se
  adelanta desde su posición en la cola.
- **`src/renderer/viz.js` deja de llevar los colores escritos** y los lee de
  las variables CSS, o el medidor de nivel se quedaría con la paleta oscura
  sobre fondo claro.

## Impact

- Affected specs: `configuracion` (nueva), `apariencia` (nueva). Son las
  primeras capacidades documentadas del repositorio.
- Affected code: `src/main/ajustes.js` (nuevo), `src/main/main.js`,
  `src/preload/preload.js`, `src/renderer/index.html`,
  `src/renderer/app.js`, `src/renderer/app.css`, `src/renderer/viz.js`.
- Sin dependencias nuevas: el árbol de producción sigue a cero.

## Fuera de alcance

- **Selección de micrófono**, **ajustes de transcripción** (idioma,
  segmentación en frases y párrafos) y **glosario**. Cada uno es su propio
  change y todos se apoyan en lo que éste deja montado. Este change no añade
  sus campos al fichero ni sus controles al panel: añadirlos vacíos sería
  inventar una forma antes de saber si sirve.
- **Migración de ajustes entre versiones.** El sobre lleva `version` para que
  una migración futura tenga de dónde agarrarse, pero no se escribe código de
  migración para un fichero que hoy nace en la versión 1.
- **Sincronizar el tema con el acento del sistema** o cualquier otra
  personalización de color más allá de los dos esquemas.
- **Atajos de teclado** para abrir los ajustes.
