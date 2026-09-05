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

- **D5 — Los ajustes viven en una ventana propia, no dentro de la tira.** Se
  consideraron tres formas y las dos primeras se descartan por lo mismo: el
  contenido que viene.

  1. *Panel excluyente con el texto, en el mismo despliegue.* Es lo más barato
     hoy, pero condena los ajustes a 420 px de ancho para siempre y obliga a
     que el panel de texto y el de ajustes se turnen, compartan
     `altoDesplegado` y cambien la condición de `desplegar()`.
  2. *A la derecha del texto.* En una ventana de 420 px deja ~200 px por lado,
     inservible; y ensancharla a ~700 px al configurar contradice "súper
     pequeña, súper minimalista".
  3. *Ventana propia.* La elegida.

  Lo que decide es el **glosario** del change 6: un editor de filas
  —«se transcribe como» → «es»— con añadir y quitar. No cabe a la derecha del
  texto, y dentro de la tira quedaría permanentemente estrecho. Los ajustes
  van a crecer con micrófono, transcripción y glosario; la tira no.

  Y el efecto en la ventana principal es de **quitar**, no de añadir: no hay
  exclusión que gestionar, ni alto compartido, ni cambio en la condición de
  `desplegar()`. La tira se queda exactamente como está.

  Coste que se acepta: un HTML más, una `BrowserWindow` más y su propia barra
  de título sin marco. Se reutilizan el mismo `preload.js`, la misma hoja de
  estilos y la misma paleta, así que no aparece una segunda superficie de API
  ni un segundo CSP que mantener.

  La ventana de ajustes SHALL ser única: pulsar el engranaje con la ventana ya
  abierta la trae al frente en vez de abrir otra.

- **D6 — Tres estados de tema, no dos.** `claro`, `oscuro` y `sistema`, con
  `sistema` por defecto. El estado `sistema` se resuelve con
  `nativeTheme.shouldUseDarkColors` y se sigue con `nativeTheme.on('updated')`,
  que es lo que permite que la app cambie sola si el usuario cambia el esquema
  de Windows sin reiniciarla. De ahí sale el tercer canal IPC.

- **D7 — Cada color se declara una vez con `light-dark()`; el tema se elige
  cambiando `color-scheme`.**

  La propuesta original era el patrón habitual: juego oscuro en `:root` y
  `[data-tema="claro"]` redefiniendo las mismas variables. Se descartó al
  implementarlo por dos motivos concretos:

  1. **Destello al arrancar.** El CSP es `script-src 'self'`, así que no se
     puede meter un script en línea en el `<head>` que aplique el tema antes
     del primer pintado. Con el patrón de sobreescritura, la página se pinta
     oscura y salta a claro cuando el JS termina su ida y vuelta por IPC.
     Con `light-dark()` el CSS resuelve solo: sin ningún atributo sigue a
     `prefers-color-scheme`, que es exactamente el ajuste por defecto
     (`sistema`), y el primer pintado ya sale bien.
  2. **Duplicación.** El patrón de sobreescritura obliga a escribir la paleta
     clara dos veces —una bajo `@media (prefers-color-scheme: light)` para el
     caso `sistema` y otra bajo `[data-tema="claro"]`— y a mantenerlas en
     sincronía a mano.

  Queda: `:root { color-scheme: light dark; --bg: light-dark(#f4f5f8, #0d0e13); … }`
  y sólo dos reglas de anulación, `[data-tema='claro'] { color-scheme: light }`
  y `[data-tema='oscuro'] { color-scheme: dark }`.

  El objetivo original de "si algo falla, que no quede a medias" se cumple
  mejor así, no peor: con `light-dark()` no existe el estado intermedio que se
  temía, porque todas las variables se resuelven a la vez desde un único
  `color-scheme`. Lo que se pierde es el sesgo a oscuro ante un fallo; lo que
  se gana es que el fallo no puede ocurrir.

  Esto obliga a dos cosas que no son obvias:

  - **`viz.js` deja de llevar colores escritos.** No basta con leer la variable
    CSS: el valor calculado de una propiedad personalizada es la secuencia de
    componentes sin resolver, así que `getComputedStyle` devolvería el texto
    literal `light-dark(…)`. La solución es declarar el color del medidor como
    `color` sobre `.viz` según un `data-estado`, y que `viz.js` lea
    `getComputedStyle(canvas).color`, que sí llega resuelto. El canvas acaba
    preguntando "de qué color soy" en vez de decidirlo. Se cachea, porque
    `pintar` corre en cada fotograma y `getComputedStyle` fuerza un recálculo
    de estilo.
  - **`backgroundColor` de la `BrowserWindow`** está hoy fijado a `#0d0e13` en
    `src/main/main.js`. Es el color que Electron pinta antes de que el
    renderer dibuje; en tema claro produciría un destello oscuro en cada
    arranque. Pasa a derivarse del tema efectivo, y se refresca con
    `setBackgroundColor` al guardar y cuando cambia el esquema del sistema.

- **D8 — El engranaje va en la fila de mandos, no en la barra de título, y la
  fila se reordena.** La barra de título es cromo de ventana —arrastrar,
  minimizar, cerrar—; los ajustes son un control de la aplicación, así que su
  sitio es la fila donde ya viven los demás controles.

  Orden nuevo: `contador · medidor · grabar · pausar · detener · engranaje`.
  Hoy el medidor cierra la fila; pasa a ir junto al contador, de modo que los
  cuatro botones queden agrupados a la derecha en vez de partidos por el
  canvas.

  Cabe, comprobado contra el CSS vigente: la fila tiene `padding: 10px 11px` y
  `gap: 8px`, el contador ocupa 54 px fijos y cada botón 34 px. Con cuatro
  botones y cinco huecos, al ancho mínimo de ventana (360 px) le quedan
  ~108 px al medidor, y ~168 px al ancho por defecto (420 px). El medidor es
  `flex: 1` con `min-width: 0`, así que absorbe la diferencia sin desbordar.

## Superficie IPC nueva

Toda API nueva expuesta al renderer, con su forma:

| Canal | Tipo | Forma |
|---|---|---|
| `ajustes:leer` | `invoke` | `() → { version, tema }` |
| `ajustes:guardar` | `invoke` | `(parche) → { version, tema }` — parche parcial, se fusiona, valida y escribe; devuelve el estado resultante |
| `ajustes:cambiado` | `main → renderer` | `{ version, tema }` — se emite **a todas las ventanas** cuando cambian los ajustes: al guardarlos desde la ventana de ajustes, y cuando el sistema cambia de esquema con el ajuste en `sistema` |
| `ui:ajustes` | `send` | `()` — abre la ventana de ajustes, o la enfoca si ya está abierta |

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

- **Dos ventanas a la vez en pantalla.** Es el coste de D5. Se mitiga con
  ventana única (el engranaje enfoca la existente) y con que la de ajustes se
  cierre sin afectar a la principal.
- **Un tema claro mal contrastado es peor que no tenerlo.** El medidor y los
  botones sólidos están calibrados contra fondo oscuro. Por eso la
  verificación exige mirar el ciclo completo en tema claro, no sólo que las
  variables cambien.
- **`nativeTheme` bajo WSLg puede no reportar el esquema de Windows.** Si
  `sistema` se comporta como oscuro fijo en el entorno de desarrollo, no es un
  fallo del código: se anota y se verifica en Windows.
