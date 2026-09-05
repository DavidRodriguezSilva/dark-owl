## Context

La ventana es una tira de 420×96 que crece a ~376 de alto sólo cuando hay
texto que enseñar. El main gobierna ese alto (`ui:desplegar` en
`src/main/main.js`) y recuerda en `altoDesplegado` el que dejó el usuario. El
renderer decide cuándo desplegar con una única condición, hoy en
`src/renderer/app.js`:

```js
desplegar(Boolean(salida.value) || fase === 'transcribiendo');
```

El renderer no tiene acceso a disco: `contextIsolation: true`,
`nodeIntegration: false`, y todo lo que ve pasa por `window.api`. La paleta
vive entera en variables CSS de `:root` (`src/renderer/app.css`), en un único
juego oscuro. `src/renderer/viz.js` es la excepción: lleva `#f0483c`,
`#5c6480` y `#3b4256` escritos en el código porque pinta en canvas.

## Goals / Non-Goals

- **Goals**: un sitio donde guardar preferencias que sobreviva al reinicio y
  tolere un fichero roto; un sitio donde enseñarlas que no rompa la tira; y
  estrenar ambos con un ajuste real, no con un maniquí.
- **Non-Goals**: micrófono, transcripción y glosario (cada uno su change);
  migraciones; atajos de teclado; una segunda ventana.

## Decisions

- **D1 — El tema entra en este change, adelantándose desde el puesto 4 de la
  cola.** La regla de tareas del proyecto exige que el último paso de todo
  cambio sea verificarlo con la app corriendo. Un change de sólo
  infraestructura no puede cumplirla: un panel de ajustes sin ningún ajuste no
  guarda nada, no restaura nada y no hay nada que mirar.

  El tema es el candidato más barato de los tres pendientes: es un valor, un
  atributo en el elemento raíz y unas variables CSS que **ya existen**. No
  toca dispositivos, permisos ni el motor. Recorre el camino completo —leer al
  arrancar, escribir al cambiar, sobrevivir a un reinicio— con la menor
  superficie posible, que es justo lo que hay que probar.

  El micrófono habría sido mala elección para estrenar: arrastra
  `enumerateDevices()`, etiquetas que sólo aparecen tras conceder permiso,
  botón de recargar y el fallo cuando el dispositivo guardado desaparece.
  Mezclar eso con la infraestructura haría imposible saber cuál de las dos
  cosas falló.

- **D2 — El fichero es JSON con sobre versionado y se escribe atómicamente.**
  Forma: `{ "version": 1, "tema": "sistema" }`. La `version` no se usa hoy;
  está para que una migración futura tenga de dónde agarrarse en vez de
  adivinar por la forma del objeto.

  Se escribe a `ajustes.json.part` y se renombra encima, el mismo patrón que
  `scripts/setup-whisper.js` ya usa para el modelo. El motivo es idéntico: un
  corte a media escritura no puede dejar un fichero que existe, parece válido
  y no lo es. Y aquí el coste es aún menor, porque el fichero son dos líneas.

- **D3 — El main es el dueño del fichero; el renderer nunca lo toca.** No es
  sólo que el renderer no tenga `fs`: es que el main **también** necesita
  leerlo. El idioma y el glosario que vienen en los changes 5 y 6 se aplican
  en `src/main/engine.js`, al construir el `FormData` de `POST /inference`.
  Si la fuente de verdad viviera en el renderer, el main tendría que pedírsela
  al proceso que dibuja botones para poder transcribir, que es al revés.

- **D4 — Se valida al cargar, no al guardar.** `ajustes.json` es texto plano
  en el directorio del usuario y se va a editar a mano. Cargar es la frontera:
  cada campo que no esté entre los valores admitidos se descarta y se sustituye
  por su valor por defecto, y un fichero que ni siquiera parsea equivale a no
  tener fichero. **Un ajuste inválido nunca puede impedir que la app abra.**

  Guardar sí valida también, pero por otra razón: para no escribir en disco
  algo que la carga siguiente va a tirar.

- **D5 — El panel de ajustes reutiliza el despliegue existente; no se abre una
  segunda ventana.** En la tira de 420×96 no cabe un panel de ajustes, así que
  hace falta espacio. Una ventana aparte lo daría, pero traería posicionamiento
  propio, su propio CSP, su propio preload y una segunda superficie que
  mantener — mucho para enseñar dos botones.

  El panel de ajustes ocupa el mismo hueco desplegado que el de texto y es
  **excluyente** con él. Consecuencias que hay que implementar, no sólo
  declarar:

  - La condición de desplegar deja de ser "hay texto" y pasa a ser "hay algo
    que enseñar": texto, transcripción en curso **o** ajustes abiertos.
  - `altoDesplegado` es compartido. Es aceptable: es la misma ventana y el
    usuario eligió un alto para ella, no para cada panel.
  - Abrir ajustes con texto a la vista **no descarta el texto**. Al cerrarlos
    vuelve a verse. El texto sólo se pierde al limpiar, como hoy.

- **D6 — Tres estados de tema, no dos.** `claro`, `oscuro` y `sistema`, con
  `sistema` por defecto. El estado `sistema` se resuelve con
  `nativeTheme.shouldUseDarkColors` y se sigue con `nativeTheme.on('updated')`,
  que es lo que permite que la app cambie sola si el usuario cambia el esquema
  de Windows sin reiniciarla. De ahí sale el tercer canal IPC.

- **D7 — `oscuro` es la base en `:root`, `claro` es la sobreescritura.** Al
  revés de lo habitual, y a propósito: la identidad del producto es oscura
  —es un búho en un bosque de noche— y si algo falla al aplicar el tema, la
  app debe quedarse oscura, no en un estado a medias. `[data-tema="claro"]`
  redefine el mismo juego de variables.

  Esto obliga a dos cosas que no son obvias:

  - **`viz.js` deja de llevar colores escritos.** Los lee con
    `getComputedStyle` sobre el elemento raíz al montar y cuando cambia el
    tema. Es un canvas: nadie le aplica CSS por él.
  - **`backgroundColor` de la `BrowserWindow`** está hoy fijado a `#0d0e13` en
    `src/main/main.js`. Es el color que Electron pinta antes de que el
    renderer dibuje; en tema claro produciría un destello oscuro en cada
    arranque. Pasa a derivarse del tema efectivo.

## Superficie IPC nueva

Toda API nueva expuesta al renderer, con su forma:

| Canal | Tipo | Forma |
|---|---|---|
| `ajustes:leer` | `invoke` | `() → { version, tema }` |
| `ajustes:guardar` | `invoke` | `(parche) → { version, tema }` — parche parcial, se fusiona, valida y escribe; devuelve el estado resultante |
| `ajustes:cambiado` | `main → renderer` | `{ version, tema }` — se emite cuando el tema efectivo cambia por debajo, es decir cuando el sistema cambia de esquema y el ajuste es `sistema` |

En `window.api`:

```js
ajustes: {
  leer: () => Promise<Ajustes>,
  guardar: (parche) => Promise<Ajustes>,
  onCambio: (cb) => () => void,   // devuelve la baja, como onEngineStatus
}
```

`onCambio` devuelve su función de baja por coherencia con `onEngineStatus`,
que ya sigue ese patrón.

## Risks / Trade-offs

- **El panel excluyente esconde el texto mientras se configura.** Es
  deliberado (D5) y el texto no se pierde. La alternativa —ensanchar la
  ventana para poner ambos— contradice "súper pequeña".
- **Un tema claro mal contrastado es peor que no tenerlo.** El medidor y los
  botones sólidos están calibrados contra fondo oscuro. Por eso la
  verificación exige mirar el ciclo completo en tema claro, no sólo que las
  variables cambien.
- **`nativeTheme` bajo WSLg puede no reportar el esquema de Windows.** Si
  `sistema` se comporta como oscuro fijo en el entorno de desarrollo, no es un
  fallo del código: se anota y se verifica en Windows.
