# Change: Transcribir un archivo de audio

## Why

Hoy sólo se transcribe lo que se dicta en el momento. Pero buena parte de la
voz que uno necesita pasar a texto ya está grabada: notas de voz de WhatsApp o
Telegram, un audio que mandó alguien, una grabación del móvil. Para eso hoy no
hay camino, salvo reproducirlo en voz alta delante del micrófono.

`openspec/project.md` lista «importar archivos de audio» como fuera de
alcance. Este change pide esa excepción, y la justifica así: es el mismo ciclo
—audio entra, texto sale, copiar o reprocesar— con otra fuente. Reutiliza el
motor caliente, los ajustes de idioma y formato, la limpieza del texto y el
panel tal cual. No añade una ventana, ni un historial, ni un modo aparte:
añade una forma más de meter audio en la misma tira.

## What Changes

- **Abrir un archivo de audio** con un mando nuevo en la tira, o
  **arrastrándolo** sobre la ventana. El texto sale en el mismo panel que una
  grabación, con el mismo idioma y formato configurados, y se puede copiar,
  reprocesar y limpiar igual.
- **Formatos**: los que decodifica el propio Chromium de Electron —mp3,
  m4a/aac, ogg/opus (las notas de voz de WhatsApp), wav, flac y webm—. Sin
  ffmpeg ni dependencias nuevas.
- **Límites, con mensaje claro si se exceden**: **20 minutos** de duración y
  **250 MB** de tamaño. Lo que se pase no se intenta.
- **Sin troceo ni progreso fino**: el audio se transcribe entero, con el mismo
  «transcribiendo…» de siempre.
- **`openspec/project.md` se actualiza**: «importar archivos de audio» sale de
  la lista de fuera de alcance y se anota la decisión.

### Superficie de UI

Un botón más en la fila de mandos, secundario como el de ajustes. Cabe porque
la fila tiene sitio —la tira es ancha y los mandos encogieron a 30 px en
`refina-interfaz`— y porque arrastrar sin un botón visible no se descubre. No
se saca nada.

## Capabilities

### New Capabilities

- `archivo-audio`: transcribir un archivo de audio existente —cómo se abre,
  qué formatos y límites admite, cómo convive con la grabación y qué pasa
  cuando falla.

### Modified Capabilities

Ninguna. El idioma y el formato del texto (capacidad `transcripcion`, aún en
el change `add-transcripcion`) se aplican igual a un archivo, sin cambiar sus
requisitos.

## Fuera de alcance

- Varios archivos a la vez o una cola de archivos.
- Audios de más de 20 minutos, partirlos en tramos o barra de progreso real.
- Cancelar una transcripción en curso.
- Transcribir el audio de un vídeo como función anunciada (si Chromium lo
  decodifica, funcionará, pero no se promete).
- Guardar el texto en un fichero o llevar un historial de archivos
  transcritos.
- Asociar tipos de archivo en el sistema («Abrir con Dark Owl»).

## Impact

- Affected specs: `archivo-audio` (nueva).
- Affected code: `src/renderer/index.html` (mando y entrada de archivo),
  `src/renderer/app.js` (flujo de archivo y arrastrar), un
  `src/renderer/archivo.js` nuevo (decodificar y validar),
  `src/renderer/recorder.js` (exponer el codificador WAV),
  `src/main/engine.js` (la petición al motor no puede caducar a los 5
  minutos; ver `design.md`, D4), `scripts/iconos.js` y `src/renderer/app.css`.
- `openspec/project.md`: sale «importar archivos de audio» de fuera de alcance.
- Sin dependencias nuevas. Sin canales IPC nuevos.
