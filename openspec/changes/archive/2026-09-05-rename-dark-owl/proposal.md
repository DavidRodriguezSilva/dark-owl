# Change: Renombrar la aplicación a dark-owl

## Why

La aplicación nació como `whisper-app`, un nombre descriptivo del motor que
usa por debajo, no del producto. Pasa a integrarse en la familia
**DarkForest**, junto a [`dark-echo`](https://github.com/davidrodriguezsilva/dark-echo):
varias aplicaciones cuyos nombres se asocian a la oscuridad o al bosque, de
modo que juntas formen un bosque. `dark-echo` se quedó con el sonido que
vuelve; ésta es la que **oye en la oscuridad y escribe lo que oyó** — de ahí
el búho.

Se hace **ahora y no después** por un motivo concreto, no estético. El
renombrado mueve el directorio de `userData` de Electron, que se deriva del
nombre del producto. Hoy ahí sólo vive `engine.pid`, un fichero desechable
por diseño. En cuanto entren los cambios de ajustes y glosario —los
siguientes en la cola— ese directorio pasará a guardar la configuración y el
vocabulario del usuario, y renombrar exigirá una migración con código de
compatibilidad. Ahora cuesta cero.

## What Changes

- **Identidad del producto**: `package.json` (`name`, `productName` en la
  raíz y en `build`, `appId`), título de la ventana (`src/main/main.js`),
  `<title>` y marca de la barra (`src/renderer/index.html`), encabezado y
  diagrama del `README.md`, rutas y nombre del instalador en
  `docs/windows.md`, y el bloque `context` de `openspec/config.yaml`.
- **`appId` pasa a `forest.dark.owl`**, reverse-DNS coherente con la familia,
  en lugar del actual `app.whisper.mini`. Consecuencia deliberada y
  documentada en `design.md`: Windows lo tratará como una aplicación
  distinta.
- **Icono nuevo**: un búho, reemplazando la marca de onda actual.
  `scripts/icono.js` conserva toda su maquinaria (render en HTML, captura,
  reescalado, empaquetado del `.ico` multi-tamaño); sólo cambia el dibujo.
- **Nuevo `openspec/project.md`** con el contexto completo del proyecto,
  siguiendo la separación que ya usa `dark-echo`: `config.yaml` lleva el
  contexto condensado y las reglas, `project.md` el documento largo. Entra
  en este change y no en uno propio porque tiene que nombrar al producto —
  crearlo antes obligaría a escribirlo dos veces.
- **No cambia nada que nombre al motor.** `whisper.cpp`, `whisper-server`,
  `whisper-cli`, `scripts/setup-whisper.js` y todos los comentarios que
  explican el comportamiento de whisper se quedan como están: el producto es
  Dark Owl, el motor es whisper. Fundirlos haría que el código mintiera.

## Impact

- Affected specs: ninguna. Es un cambio de identidad; no añade, quita ni
  modifica ninguna capacidad del producto. El ciclo grabar → pausar →
  detener → transcribir → limpiar/reprocesar es idéntico antes y después.
- Affected code: `package.json`, `src/main/main.js`, `src/renderer/index.html`,
  `scripts/icono.js`, `assets/icon.png`, `assets/icon.ico`, `README.md`,
  `docs/windows.md`, `openspec/config.yaml`, `openspec/project.md` (nuevo).

## Fuera de alcance

- **Renombrar el repositorio en GitHub y el directorio local**
  (`~/projects/whisper-app`). Son acciones manuales del propietario, fuera
  del alcance de un cambio de código; quedan anotadas como tarea para que no
  se pierdan, y `docs/windows.md` se actualiza asumiendo el nombre final.
- **Desinstalar la versión anterior** en las máquinas donde ya esté puesta.
  Ver `design.md`, decisión D1.
- **Publicar en GitHub Pages o Releases** bajo el nombre nuevo — es el último
  cambio de la cola y depende de decidir antes si el instalador lleva el
  modelo dentro.
- **Subir la versión.** Sigue en `0.1.0`; renombrar no es una funcionalidad.
