## Context

Los iconos de hoy están dibujados a mano, cada uno con su criterio: el
engranaje es una silueta rellena con dientes, la papelera y el copiar son
trazos de 2,3 px, los de ventana de 2,4. En la fila de mandos van a 19 px
dentro de teclas de 34.

La ventana de ajustes gasta tres líneas por opción: título de grupo, control y
nota. Con dos grupos ya ocupa media ventana para dos ajustes.

Restricciones que condicionan la solución, y que no son negociables:

- **Cero dependencias en runtime**, y **ninguna llamada de red en runtime**
  salvo `127.0.0.1`.
- **CSP `default-src 'self'`** sobre `file://`. Un sprite SVG externo
  referenciado con `<use href="iconos.svg#id">` exige una petición
  same-origin que bajo `file://` no está garantizada.

## Decisions

- **D1 — Los trazos de Lucide se incrustan; el paquete no se instala.** Lucide
  es ISC, así que copiar sus trazos con atribución es legítimo. Se descartan
  las dos alternativas por las restricciones de arriba: instalarlo como
  dependencia rompe el árbol cero-dependencias, y servirlo como sprite externo
  choca con el CSP bajo `file://`.

  Para que no sea mantenimiento a mano, `scripts/iconos.js` los regenera desde
  el paquete oficial —lo baja a un temporal con `npm pack`, no lo instala— y
  reescribe el bloque del sprite entre marcadores en los dos HTML. Actualizar
  la iconografía es volver a correrlo, no editar trazos a mano.

  Es el mismo patrón que `scripts/icono.js` ya usa para el icono de la app:
  una herramienta de desarrollo que produce un artefacto versionado, sin dejar
  nada en el árbol de producción.

- **D2 — El transporte se queda relleno; el resto pasa a trazo.** Grabar,
  pausar y detener son punto, barras y cuadrado macizos. No es una excepción
  caprichosa: son las tres formas que hay que reconocer de un vistazo y sin
  leer, a 16 px, y una silueta llena se lee antes que un contorno. Es además
  la convención de cualquier transporte de medios.

  Se toma la **geometría** de Lucide igualmente (`pause` con sus dos barras de
  radio 1, `square` con su radio 2), rellenándola en vez de trazándola, para
  que las proporciones sean las mismas que las del resto del juego.

- **D3 — El engranaje pasa a `settings-2`, los dos deslizadores.** La rueda
  dentada oficial de Lucide tiene doce vértices y un anillo interior: a 16 px
  con trazo de 2 se convierte en una mancha. Ya se vio al hacer el icono de la
  app, donde hubo que abandonar el engranaje de trazo por el mismo motivo.

  `settings-2` es la alternativa del propio Lucide para «ajustes», se lee
  entera a 16 px y no se confunde con nada más de la interfaz.

- **D4 — Se quitan las notas de ayuda, no los avisos.** Son cosas distintas:
  la nota explica lo que el control ya dice, y sobra; el aviso aparece sólo
  cuando el micrófono elegido no está, y la capacidad `microfono` lo exige.

  El elemento se conserva pero nace vacío y oculto: cuando hay algo que decir,
  aparece. Así los ajustes están en silencio salvo cuando pasa algo, que es lo
  contrario de tener un párrafo fijo bajo cada control.

- **D5 — Los tamaños bajan un escalón, no dos.** Teclas de 34 → 30 px, iconos
  de 19 → 16, iconos de ventana de 15 → 14. Es una reducción del 12-16 %:
  suficiente para que la tira respire, poca para que los botones sigan siendo
  cómodos de pulsar. El contador se queda en 17 px porque es la lectura
  principal, y está fuera de alcance.

## Risks / Trade-offs

- **`npm pack` necesita red**, así que `scripts/iconos.js` sólo funciona con
  conexión. Es una herramienta de desarrollo y el artefacto queda versionado,
  igual que el icono de la app: nadie necesita red para usar el programa.
- **Fijar la versión de Lucide** (`1.41.0`) evita que regenerar cambie el
  aspecto sin querer; actualizarla es un cambio deliberado.
- **Encoger puede pasarse.** Por eso el contador queda fuera y la reducción es
  de un escalón, con la tira delante para juzgar.
