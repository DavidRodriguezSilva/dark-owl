## Context

El ciclo de hoy es enteramente del renderer hasta el WAV: `Recorder` captura a
16 kHz, `codificarWav()` (en `src/renderer/recorder.js`) envuelve las muestras
y `window.api.transcribe(wav)` las manda al main, que llama a
`engine.transcribe()` y formatea con `text.formatear()` según los ajustes. Un
archivo sólo tiene que llegar a ese mismo `ArrayBuffer` WAV; desde ahí el
camino ya existe.

La CSP de `index.html` ya admite `media-src 'self' blob:`, y el renderer no
tiene `fs`.

## Goals / Non-Goals

**Goals:**

- Que un archivo entre por el mismo `window.api.transcribe(wav)` que una
  grabación, sin canales IPC nuevos.
- Rechazar lo que exceda los límites antes de gastar memoria o motor en ello.
- Que una transcripción de 20 minutos de audio termine, aunque tarde varios.

**Non-Goals:**

- Progreso real o cancelación (ver propuesta, Fuera de alcance).
- Tocar el pipeline de texto, el motor o los ajustes más allá de la petición
  HTTP de D4.

## Reparto main / renderer

| Dónde | Qué |
|---|---|
| renderer · `archivo.js` (nuevo) | Validar tamaño y duración, decodificar, mezclar a mono, codificar WAV |
| renderer · `app.js` | Mando, entrada de archivo, arrastrar y soltar, fases |
| IPC | `transcribe` existente, sin cambios de forma |
| main · `engine.js` | Petición a `/inference` sin caducidad de 5 min (D4) |

**API expuesta al renderer**: ninguna nueva. `window.api.transcribe(wav:
ArrayBuffer) → { text, language } | { error }` se reutiliza tal cual.

**Dependencias en runtime**: ninguna.

## Decisions

### D1 — Decodificar en el renderer con `decodeAudioData` a 16 kHz

`new AudioContext({ sampleRate: 16000 }).decodeAudioData(bytes)` devuelve el
audio **ya remuestreado** a la tasa del contexto: es lo que dice la
especificación de Web Audio, y es la misma tasa que ya pide `Recorder`. Queda
mezclar los canales a mono (media de canales) y pasar el `Float32Array` a
`codificarWav()`, que se expone desde `recorder.js` en vez de duplicarse.

El `File` llega igual de las dos entradas —`<input type="file">` y el evento
`drop`— y se lee con `file.arrayBuffer()`. El renderer no necesita `fs`.

*Alternativas descartadas*:
- **Diálogo y lectura en el main** (`dialog.showOpenDialog` + `fs`): añade un
  canal IPC y no resuelve nada, porque el main no tiene decodificador sin
  ffmpeg. Habría que mandar los bytes de vuelta al renderer igualmente.
- **`OfflineAudioContext` para remuestrear y mezclar**: hace lo mismo que
  `decodeAudioData` en un contexto a 16 kHz y una media de canales, con un
  paso más.
- **ffmpeg / `whisper-server --convert`**: dependencia externa, justo lo que
  el proyecto evita.

### D2 — Medir la duración antes de decodificar

Decodificar 20 minutos estéreo a 16 kHz ocupa ~154 MB en `Float32`; un archivo
de una hora, el triple, para acabar rechazado. Así que primero se pregunta la
duración a un `<audio preload="metadata">` con un `blob:` del archivo (la CSP
ya lo admite), que sólo lee la cabecera. Si la duración no es finita —ocurre
con algunos webm y ogg que no la declaran—, se decodifica y se comprueba
`AudioBuffer.duration` antes de seguir.

El tamaño (`file.size`) se comprueba antes que todo, sin leer el archivo.

### D3 — Límites: 20 minutos y 250 MB, constantes en `archivo.js`

- **20 minutos**: lo pidió el propietario; cubre notas de voz y audios
  recibidos con holgura.
- **250 MB**: el archivo más pesado razonable para 20 minutos es un WAV sin
  comprimir de calidad CD (44,1 kHz, estéreo, 16 bit), que ocupa ~212 MB. Por
  encima ya no es un audio de 20 minutos y no merece la pena leerlo.

El aviso dice cuál se superó y su valor: «⚠ el audio pasa de 20 minutos».

### D4 — La petición al motor no puede caducar a los 5 minutos

El `fetch` global de Node (undici 7.28 en Node 24) aborta una petición si las
cabeceras de respuesta tardan más de **300 s** (`headersTimeout`).
`whisper-server` no responde nada hasta terminar de transcribir. Con lo medido
en `docs/estado.md` —11 s de audio en 3,7–5,4 s con `small` en CPU, un factor
de ~0,35–0,5—, 20 minutos de audio tardarían **7–10 minutos**: el `fetch`
fallaría a mitad con un `fetch failed` sin explicación.

Se cambia el `POST /inference` de `engine.transcribe()` a `node:http` sin
timeout. El cuerpo multipart se sigue construyendo con `FormData`, y se
serializa con `new Request(url, { method: 'POST', body })`, cuyo
`arrayBuffer()` y cabecera `content-type` dan los bytes y el *boundary*. Así
no se escribe un codificador multipart a mano. El sondeo de arranque sigue con
`fetch`, que ahí no tiene ese problema.

Del lado del servidor no hay tope que estorbe: en `examples/server/server.cpp`
de v1.9.3, los `read_timeout`/`write_timeout` de 600 s son de inactividad del
socket al leer la petición o escribir la respuesta, no del tiempo de
inferencia, y `CPPHTTPLIB_PAYLOAD_MAX_LENGTH` no tiene límite. Un WAV de 20
minutos a 16 kHz mono son ~38 MB. Esto sale de leer el código, no de medirlo:
la tarea 5.3 lo comprueba con un audio largo de verdad.

*Alternativa descartada*: `fetch` con un `dispatcher` de undici sin timeout.
Node no expone `undici` como módulo, así que exigiría instalarlo, y el árbol
de producción es cero-dependencias.

### D5 — Sin puerta de voz para archivos

Los umbrales de `nivel.js` (0,04 por tramo, 0,10 de proporción) se calibraron
contra el micrófono con control automático de ganancia. Una nota de voz
grabada bajita podría quedar por debajo y ser rechazada sin motivo, y quien
abre un archivo ya sabe que tiene voz. Se mantiene sólo el mínimo de 350 ms.
Si un archivo es silencio, whisper puede inventar texto; se acepta.

### D6 — Fase nueva `leyendo`

Mientras se valida y decodifica, la app está en una fase `leyendo`: ocupada
como `abriendo` (deshabilita grabar, abrir archivo y reprocesar) y sin
desplegar el panel, para que no parpadee si el archivo se rechaza al momento.
De ahí pasa a `transcribiendo` vía el `transcribir()` existente. `ultimoWav` se
queda con el WAV del archivo para que reprocesar funcione, y el contador
muestra la duración.

Arrastrar y soltar: `dragover` y `drop` llevan siempre `preventDefault()` a
nivel de `document`. Sin eso Electron navega al archivo soltado y la app
desaparece. El archivo sólo se acepta en fase `inicial`.

### D7 — Mando con el icono `file-audio` de Lucide

Secundario (`key--sec`), junto al de ajustes, añadido a `scripts/iconos.js` y
regenerado con `pnpm run iconos`. Si en Lucide 1.41.0 el nombre fuera otro
(`file-music`), se usa ese: lo importante es que sea del mismo juego.

## Risks / Trade-offs

- [Chromium no decodifica algún formato que el usuario espera (p. ej. `.amr`
  de grabadoras antiguas)] → aviso claro de formato no admitido. Los formatos
  prometidos son los de la propuesta.
- [Esperas de varios minutos sin poder cancelar] → aceptado en el alcance.
  Cerrar la app mata el motor (`before-quit`), y el «transcribiendo…» deja
  claro que no está colgada.
- [Pico de memoria al decodificar: archivo leído (≤250 MB) + PCM estéreo
  (~154 MB) a la vez] → D2 evita decodificar lo que no se va a usar, y el
  `ArrayBuffer` del archivo se suelta en cuanto hay PCM.
- [Un archivo silencioso produce texto inventado] → D5, aceptado.
- [`decodeAudioData` remuestrea con un filtro distinto al del micrófono] → no
  afecta a whisper a 16 kHz. Se comprueba con voz real en la tarea 5.
