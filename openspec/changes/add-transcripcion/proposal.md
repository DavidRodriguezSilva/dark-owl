# Change: Frases, párrafos e idioma configurable

## Why

El texto sale de una pieza, como un listado corrido, y cuesta releerlo: hoy
`src/main/text.js` **une a propósito** todos los saltos de línea que devuelve
el motor. Y el idioma está escrito en el código (`LANGUAGE = 'auto'` en
`src/main/engine.js`), lo que con clips cortos es justo donde whisper se
equivoca de idioma y acaba traduciendo.

Las dos cosas se arreglan en el mismo sitio, porque las dos son «cómo se
decodifica y cómo sale el texto», y porque las dos son parámetros que
`whisper-server` acepta **por petición**: cambiarlas no reinicia el motor ni
recarga el modelo.

## What Changes

- **`src/main/engine.js` deja de tirar los segmentos.** Hoy sólo devuelve
  `json.text`; pasa a propagar también las palabras con sus tiempos, que es lo
  que permite saber dónde hubo una pausa de verdad.
- **`src/main/text.js` gana formato**: texto corrido (lo de hoy), una frase por
  línea, o párrafos. El corte de párrafo exige **puntuación final y pausa**, no
  sólo pausa — el porqué está en `design.md`, decisión D2, y sale de medir.
- **Ajustes nuevos**, en una sección «Transcripción» de la ventana de ajustes:
  - `idioma`: automático o un idioma concreto. Por defecto **español**, no
    automático — es un cambio deliberado respecto a hoy (D4).
  - `formato`: `corrido`, `frases` o `parrafos`. Por defecto `parrafos`.
  - `pausaParrafo`: el umbral en milisegundos, ajustable. Por defecto **600**,
    elegido con datos (D3).
- **Con un idioma concreto se manda `no_language_probabilities`**, que ahorra
  la detección de idioma que el propio servidor marca como cara.

## Impact

- Affected specs: `transcripcion` (nueva).
- Affected code: `src/main/engine.js`, `src/main/text.js`,
  `src/main/ajustes.js`, `src/main/main.js`, `src/renderer/ajustes.html`,
  `src/renderer/ajustes-ui.js`, `src/renderer/app.css`,
  `scripts/prueba-ajustes.js`, y un `scripts/prueba-texto.js` nuevo.
- Sin dependencias nuevas.

## Fuera de alcance

- **Muletillas.** Quitar «eh», «este», «o sea» es una sustitución de texto por
  vacío, y la maquinaria de sustituciones entra con el glosario, en el change
  siguiente. Hacerlo aquí significaría escribir esa maquinaria dos veces. Además
  «o sea» y «digamos» a veces sí significan algo, así que nace apagada y ahí se
  decidirá cómo.
- **Glosario y prompt inicial.** Mismo change siguiente.
- **Traducir.** `whisper-server` sabe, pero traducir no es transcribir y está
  fuera del alcance del producto desde el principio.
- **Reconocer hablantes** (`diarize`). El servidor lo ofrece; una grabadora
  personal de dictado no lo necesita.
- **Elegir modelo desde los ajustes.** Cambiar de modelo obliga a descargarlo y
  a reiniciar el motor, que es justo lo contrario de lo que hace barato este
  change. Sigue siendo cosa de `pnpm run setup`.
