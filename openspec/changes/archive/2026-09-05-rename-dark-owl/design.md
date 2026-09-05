## Context

El nombre aparece en pocos sitios y bien delimitados — se verificó con un
barrido sobre todo el repositorio, excluyendo `node_modules/` y las
referencias al motor:

```
package.json:2,3,28,29   name, productName, appId, build.productName
src/main/main.js:32      title de la BrowserWindow
src/renderer/index.html  <title> (9) y <span class="marca"> (28)
README.md:1,71           encabezado y el "● WHISPER" del diagrama
docs/windows.md:15,16,59 rutas de clonado y nombre del instalador
openspec/config.yaml:4   encabezado del bloque context
```

El resto de apariciones de "whisper" en el código nombran al **motor**
(`setup-whisper.js`, `-DWHISPER_BUILD_TESTS`, los comentarios de
`src/main/text.js`, `src/main/engine.js` y `src/renderer/nivel.js` que
explican cómo se comporta whisper ante el silencio). No se tocan.

La distinción importa porque el proyecto existe precisamente para envolver a
whisper.cpp compilado desde fuente. El motor seguirá llamándose whisper en el
código, en los logs y en la documentación de compilación; sólo el producto
cambia de nombre.

## Goals / Non-Goals

- **Goals**: identidad de producto coherente con la familia DarkForest;
  hacerlo mientras el coste de mover `userData` es cero; dejar el contexto
  del proyecto en `project.md` como hace `dark-echo`.
- **Non-Goals**: renombrar el repositorio o el directorio local (manual);
  migrar datos de usuario (no hay); cambiar comportamiento del producto;
  tocar la nomenclatura del motor.

## Decisions

- **D1 — `appId: forest.dark.owl`, aun sabiendo que rompe la actualización
  in-place.** electron-builder deriva la clave de desinstalación de NSIS en
  el registro de Windows a partir del `appId`. Al cambiarlo, el instalador
  nuevo **no actualiza** la instalación existente de "Whisper App": la pone
  al lado, y quedan dos entradas en Programas y características.

  Se acepta a conciencia. La alternativa —conservar `app.whisper.mini` para
  no romper la actualización— dejaría el identificador del producto anclado
  a un nombre retirado para siempre, y hoy el parque instalado es **una sola
  máquina, la del propietario**. Desinstalar a mano una vez es más barato que
  arrastrar el identificador viejo indefinidamente. La tarea de desinstalar
  queda explícita en `tasks.md`.

  El `appId` se elige con el prefijo `forest.` en vez de `app.` para que la
  familia sea legible en el propio identificador; `dark-echo` no tiene
  `appId` con el que alinearse porque es una PWA, no una app empaquetada.

- **D2 — El directorio de `userData` cambia y no se migra.** Electron deriva
  `app.getPath('userData')` del nombre del producto, así que pasa de
  `%APPDATA%\Whisper App` (o `~/.config/Whisper App`) a `…\Dark Owl`. Lo
  único que vive ahí es `engine.pid`, y ese fichero es **desechable por
  diseño**: sólo sirve para recoger un `whisper-server` huérfano en el
  arranque siguiente, y `Engine._recogerHuerfano()` no mata nada que no pueda
  confirmar como suyo leyendo `/proc/<pid>/cmdline`.

  El peor caso es dejar un `engine.pid` obsoleto en la carpeta vieja, que ya
  nadie lee. No merece código de migración. Y es justamente la ventana que
  este change aprovecha: en cuanto `ajustes.json` y el glosario vivan ahí,
  esta decisión dejaría de ser gratis.

- **D3 — El icono se rehace dentro de `scripts/icono.js`, sin herramientas
  nuevas.** El script ya resuelve las dos partes difíciles: Chromium no crea
  ventanas de 16 o 24 px, así que se renderiza grande y se reduce con
  `nativeImage.resize`; y el `.ico` multi-tamaño se empaqueta a mano
  (ICONDIR + entradas de 16 bytes + PNG embebidos). Sólo cambia el dibujo.

  Riesgo reconocido: **un búho reconocible a 16 px es difícil**. A ese tamaño
  no cabe un ave, cabe una silueta. El criterio de aceptación es que a 16 y
  32 px se distingan dos ojos redondos sobre una silueta oscura — no que se
  vea un búho completo. Si el dibujo detallado no sobrevive a la reducción,
  la salida es simplificar la silueta, no añadir una librería de imagen.

- **D4 — `project.md` toma el contenido largo; `config.yaml` se condensa.**
  Es la separación que ya funciona en `dark-echo`. Hoy `config.yaml` de este
  repo lleva el documento entero inline, lo que lo hace pesado de inyectar en
  cada artefacto. Se mueve el detalle a `project.md` y se deja en
  `config.yaml` el resumen y las `rules`/`operations`, que es lo que la
  herramienta necesita en cada invocación.

## Risks / Trade-offs

- **Dos instalaciones conviviendo en Windows** hasta desinstalar la vieja
  (D1). Mitigación: tarea explícita, y ninguna de las dos se estorba —
  `Engine` busca un puerto libre en cada arranque (`net.createServer().listen(0)`),
  así que ni siquiera colisionan si se abren las dos a la vez.
- **El icono puede quedar peor que el actual en tamaños pequeños** (D3).
  Mitigación: el criterio de aceptación es explícito y la verificación exige
  mirarlo a 16 y 32 px, no sólo a 512.
- **Enlaces rotos** si el repositorio se renombra en GitHub. GitHub redirige
  automáticamente del nombre viejo al nuevo, así que el riesgo real es bajo;
  el remoto local sí hay que reapuntarlo a mano.
