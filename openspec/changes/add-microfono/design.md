## Context

`src/renderer/recorder.js` abre el micrófono así, sin decir cuál:

```js
this.stream = await navigator.mediaDevices.getUserMedia({
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
});
```

Los ajustes ya existen (`src/main/ajustes.js`, capacidad `configuracion`) y la
ventana de ajustes también, con el esquema de color como único campo. La
validación de `ajustes.js` es hoy una tabla de `admitidos` por campo, que
sirve para un enum y no para texto libre.

Se comprobó empíricamente en este entorno, con las dos ventanas abiertas:

| Hecho | Resultado |
|---|---|
| ¿Se ven las etiquetas sin haber pedido el micrófono? | **Sí** — `RDP Source` aparece antes de tocarlo |
| ¿El `deviceId` coincide entre las dos ventanas? | **Sí** — `edf3b3b40aac` en ambas |
| ¿El `groupId` coincide entre las dos ventanas? | **No** — `e6eb4c49` frente a `e5697a02` |
| ¿Cuántas entradas hay en el entorno de desarrollo? | Dos: la pseudo-entrada `default` y `RDP Source` |

## Goals / Non-Goals

- **Goals**: ver qué dispositivos hay, elegir uno, confirmar que capta, y que
  un dispositivo desaparecido no deje grabando del equivocado en silencio.
- **Non-Goals**: dispositivo de salida, parámetros de procesado de audio,
  perfiles, recalibrar la puerta de voz.

## Decisions

- **D1 — La lista se hace en el renderer; el ajuste vive en el main.**
  `navigator.mediaDevices` sólo existe en el renderer, así que enumerar es
  cosa suya. El valor elegido pasa por `ajustes:guardar` como cualquier otro,
  porque el dueño del fichero es el main (capacidad `configuracion`).

- **D2 — Las etiquetas se leen tal cual, pero no se dan por hechas.** Se
  verificó que aquí aparecen sin haber pedido el micrófono, así que la ventana
  de ajustes **no** necesita abrirlo sólo para poder nombrarlos —hacerlo
  encendería el indicador del sistema por nada—. Aun así, la especificación
  del navegador permite devolver la etiqueta vacía mientras no haya permiso
  concedido, así que un dispositivo sin etiqueta se enseña con un nombre de
  reserva en vez de como una fila en blanco.

- **D3 — El `groupId` no se persiste ni se usa para emparejar.** Se midió que
  cambia entre ventanas: el mismo micrófono tenía `e6eb4c49` en la principal y
  `e5697a02` en la de ajustes. Es un identificador por contexto de renderer,
  no del dispositivo. Guardarlo, o usarlo para reconocer un dispositivo
  guardado, habría fallado justo entre las dos ventanas que este change
  necesita coordinar.

- **D4 — Se guarda `{ id, etiqueta }`, no sólo el identificador.** El
  `deviceId` basta para abrir el dispositivo, pero no para hablar de él. Con
  la etiqueta guardada se puede:

  - **Decir qué falta.** «El micrófono *Yeti* ya no está» es accionable;
    «el dispositivo guardado no está disponible» no lo es.
  - **Reencontrarlo.** Chromium rota los `deviceId` cuando se borran los datos
    del sitio. Si el identificador guardado no aparece pero sí hay un
    dispositivo con la misma etiqueta, es el mismo micrófono y se readopta.

  La etiqueta sola no serviría: hay equipos con dos dispositivos de idéntico
  nombre. El identificador manda; la etiqueta es el desempate y el respaldo.

- **D5 — Un dispositivo que no está se avisa; no se cae al de por defecto en
  silencio.** Con `deviceId: { exact }`, `getUserMedia` lanza
  `OverconstrainedError` si el dispositivo no existe. La tentación es capturar
  el error y reintentar sin restricción, pero eso graba del micrófono
  equivocado mientras el usuario cree que graba del suyo — y en una app de
  dictado eso no se detecta hasta leer la transcripción.

  Se cae al de por defecto **y se dice**, en el mismo sitio donde ya se avisa
  de que no se oyó nada. `exact` y no `ideal` precisamente para provocar el
  error: con `ideal` el navegador sustituye el dispositivo sin avisar a nadie.

- **D6 — Recargar a mano y también solo.** El botón es el que se pidió y es la
  vía fiable. Además se escucha `devicechange`, que Chromium emite al enchufar
  o quitar un dispositivo, para que la lista no mienta mientras está a la
  vista. El botón no sobra: bajo WSLg la entrada es una fuente RDP y no hay
  garantía de que los cambios del hardware de Windows lleguen como evento.

- **D7 — Probar el micrófono a demanda y con final automático.** Un medidor
  siempre vivo mientras los ajustes están abiertos encendería el indicador de
  micrófono del sistema cada vez que alguien mira los ajustes. El botón de
  probar abre el dispositivo, enseña el nivel unos segundos y lo cierra solo,
  también si se cierra la ventana antes de tiempo.

  Reutiliza lo que ya hay: el cálculo de nivel de `recorder.js` y el dibujo de
  `viz.js`. No se añade una segunda forma de medir el sonido.

## Superficie nueva

Ningún canal IPC nuevo: el ajuste viaja por `ajustes:leer` y `ajustes:guardar`,
que ya existen. El campo añadido es:

```js
microfono: { id: '', etiqueta: '' }   // vacío = el que diga el sistema
```

`src/main/ajustes.js` pasa a admitir, además de `admitidos`, una función
`valida(valor)` por campo, porque un identificador de dispositivo es texto
libre.

## Risks / Trade-offs

- **En el entorno de desarrollo sólo hay un dispositivo real.** No se puede
  probar aquí el cambio entre dos micrófonos ni la desaparición de uno
  enchufado; queda como verificación manual en Windows.
- **`devicechange` puede no llegar bajo WSLg.** Por eso el botón de recargar
  es la vía principal y el evento un extra (D6).
- **Probar el micrófono con una grabación en curso** abre el dispositivo dos
  veces. Chromium lo permite, pero conviene comprobarlo en vez de suponerlo.
