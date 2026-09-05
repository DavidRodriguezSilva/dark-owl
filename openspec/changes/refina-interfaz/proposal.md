# Change: Iconografía Lucide y ajustes en una línea

## Why

La interfaz pesa más de lo que debería para una app cuyo norte es «súper
pequeña, súper minimalista»: los iconos van grandes para el tamaño de la tira,
y cada icono está dibujado a mano con su propio criterio de grosor y
proporción, así que el conjunto no se lee como un juego.

La ventana de ajustes tiene el mismo problema por otro lado: cada opción ocupa
tres líneas —título, control y una nota explicativa— cuando el control ya se
explica solo.

## What Changes

- **Iconografía de [Lucide](https://lucide.dev) (ISC)**, con los trazos
  oficiales copiados al sprite. No entra como dependencia ni se descarga en
  runtime; se incrustan los trazos con su atribución (D1).
- **Los iconos encogen**: 19 → 16 px en la fila de mandos, y las teclas de
  34 → 30 px. La tira baja de alto en consecuencia.
- **Grabar, pausar y detener siguen siendo punto, barras y cuadrado**, en
  relleno y no en trazo — el porqué está en D2. El resto de la interfaz pasa a
  trazo.
- **El engranaje pasa a los dos deslizadores de Lucide** (`settings-2`): la
  rueda dentada oficial es ilegible a 16 px, que es justo el problema que este
  change viene a arreglar (D3).
- **«Apariencia» cabe en una línea**: la etiqueta *Tema* y tres iconos —un
  monitor, un sol y una luna— en vez de tres botones con texto.
- **«Entrada» ocupa dos líneas**: la lista de micrófonos con el botón de
  recargar, y debajo el de probar con su medidor.
- **Se quitan las notas de ayuda** de tema y de micrófono. Lo que **no** se
  quita es el aviso de que el micrófono elegido no está: eso no es ayuda, es
  información que sólo aparece cuando hay algo que decir (D4).
- **El icono de la aplicación se rehace en trazo**: cabeza de búho en línea
  limpia, en vez de la silueta rellena de hoy, en todos los tamaños y por
  tanto en la app, el ejecutable, el instalador y la barra de tareas.

## Impact

- Affected specs: ninguna. Es presentación: ni añade ni cambia comportamiento.
  Los avisos que exige la capacidad `microfono` se siguen dando.
- Affected code: `src/renderer/index.html`, `src/renderer/ajustes.html`,
  `src/renderer/app.css`, `src/renderer/ajustes-ui.js`, `src/main/main.js`
  (alto de la tira), `scripts/iconos.js` (nuevo), `scripts/icono.js`,
  `assets/icon.png`, `assets/icon.ico`.

## Fuera de alcance

> El icono de la aplicación estaba fuera de alcance al proponer este change
> —«esto es la interfaz, no la marca»— y **se metió dentro a petición del
> propietario**. La razón que lo justifica es la misma que da sentido al resto:
> el objetivo es un único idioma visual, y dejar la marca en relleno mientras
> toda la interfaz pasa a trazo lo rompería justo en la pieza más visible.

- **La paleta de color.** Los dos esquemas quedaron cerrados en `add-ajustes`.
- **El tamaño del contador.** Es la lectura principal de la tira y encogerlo
  iría contra su función; si sigue pareciendo grande se mira aparte, con la
  tira delante.
- **Reordenar la fila de mandos.** Quedó como se pidió en `add-microfono`.
