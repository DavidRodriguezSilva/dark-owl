# Contexto del proyecto

## Propósito

`dark-owl` es una grabadora minimalista de **voz a texto, 100% offline**, sobre
[whisper.cpp](https://github.com/ggml-org/whisper.cpp). Una sola ventana
pequeña —nunca a pantalla completa— con un único ciclo:

```
grabar → pausar/reanudar → detener → esperar transcripción → texto a la vista
→ limpiar o reprocesar → volver a grabar
```

Pensada para audios cortos. Sin cuentas, sin nube, sin telemetría; el audio no
sale de la máquina.

Forma parte de la familia **DarkForest**, junto a
[`dark-echo`](https://github.com/DavidRodriguezSilva/dark-echo): nombres
asociados a la oscuridad o al bosque, de modo que varias aplicaciones juntas
formen un bosque. El búho es el que oye en la oscuridad y escribe lo que oyó.

**Fuera de alcance por ahora**: hotkeys globales, inyección de texto en otras
apps, historial de notas, importar archivos de audio, grabación de audio del
sistema, resúmenes con LLM, traducción, i18n. Si algo de eso se propone, debe
justificarse contra "súper pequeña, súper minimalista".

## Por qué se compila desde fuente

Los releases de whisper.cpp y de apps Electron similares (p. ej. WhisperPress)
vienen **sin firmar**, y SmartScreen y varios antivirus los marcan como
amenaza. Es un falso positivo típico de Electron empaquetado, pero bloquea el
uso y obliga a confiar en un binario ajeno.

Aquí el engine se compila localmente con `pnpm run setup` y **nunca se versiona
un binario de terceros**. Cualquier propuesta que sugiera "bajar el
precompilado de los releases para ir más rápido" contradice el motivo del
proyecto: hay que rechazarla o justificar muy bien la excepción.

## Stack tecnológico

- **Electron** (`main` / `preload` / `renderer`), HTML + CSS + JS plano. Sin
  framework de UI, sin bundler, sin TypeScript. CommonJS.
- `contextIsolation: true`, `nodeIntegration: false`. El renderer sólo ve la
  superficie que `src/preload/preload.js` expone en `window.api`.
- **whisper.cpp compilado desde fuente** vía CMake, instalado con
  `cmake --install` y `-DCMAKE_INSTALL_RPATH=$ORIGIN/../lib` para que el engine
  quede autocontenido en `vendor/`. Modelo por defecto: `small`
  (`ggml-small.bin`). CUDA opcional (`pnpm run setup:cuda`).
- **pnpm** como gestor de paquetes. Cero dependencias en runtime; sólo
  `electron` y `electron-builder` en desarrollo.
- Cross-platform **Linux + Windows**. Se desarrolla y prueba en Linux/WSL2
  (WSLg, micrófono vía PulseAudio); Windows no se puede probar desde el entorno
  de desarrollo, así que el código no asume APIs de una sola plataforma.

## Layout

```text
src/main/main.js       ventana y manejadores IPC
src/main/engine.js     ciclo de vida de whisper-server y POST /inference
src/main/text.js       limpieza del transcrito
src/main/paths.js      rutas de engine y modelo, en desarrollo y empaquetado
src/main/ajustes.js    preferencias: defectos, validación y guardado atómico
src/preload/           puente contextBridge; única superficie visible del renderer
src/renderer/          UI, captura de audio, worklet PCM y medidor de nivel
src/renderer/microfono.js  resolución del dispositivo de entrada (lógica pura)
src/renderer/ajustes.html  ventana de ajustes, aparte de la tira principal
scripts/               setup-whisper.js (compila el engine), icono.js, smokes
docs/                  notas de diseño y referencia
vendor/                engine compilado + modelos (git-ignored, nunca versionar)
```

## Decisiones técnicas ya tomadas

Salen de leer WhisperPress; el detalle y el porqué están en
[`docs/referencia-whisperpress.md`](../docs/referencia-whisperpress.md). **No
re-litigar sin motivo nuevo.**

- **Captura**: `AudioContext({ sampleRate: 16000 })` + `AudioWorklet` que
  postea `Float32Array`. Nada de `MediaRecorder`, nada de ffmpeg.
- **Codificación**: WAV escrito a mano — cabecera RIFF de 44 bytes + PCM
  `Int16` LE mono a 16 kHz. Es el formato que whisper.cpp consume directo.
- **Al detener**: esperar ~140 ms antes de cerrar el `AudioContext`, o se
  pierden los últimos mensajes del worklet (y las últimas sílabas). Después,
  parar las pistas del stream *y* cerrar el contexto.
- **Pausa**: bandera que deja de acumular chunks, sin cerrar el contexto —
  reanudar es instantáneo y no vuelve a pedir permiso de micrófono.
- **Motor**: `whisper-server` levantado al abrir la app y mantenido caliente; se
  transcribe con `POST /inference` (`FormData` + `response_format=verbose_json`).
  Con clips cortos el tiempo de carga del modelo domina, así que recargarlo por
  transcripción (`whisper-cli`) no es opción.
- **Arranque del servidor**: puerto libre vía `net.createServer().listen(0)`; el
  socket sólo abre tras cargar el modelo, así que se sondea con `fetch` cada
  300 ms hasta que responda.
- **Flags obligatorias**: `whisper-server` decodifica *greedy* por defecto
  (`-bs -1 -bo 2`) y pierde calidad frente al CLI. Pasar siempre `-bs 5 -bo 5`.
- **Hilos**: `max(2, min(8, cpus/2))`. Más no acelera y compite con la UI.
- **Parámetros por petición**: `language`, `prompt`, `beam_size`, `best_of`,
  `temperature` y `no_language_probabilities` se aceptan en el `FormData` de
  cada `POST /inference` (verificado en `examples/server/server.cpp` de
  whisper.cpp v1.9.3). Cambiarlos **no exige reiniciar el motor** ni recargar el
  modelo — es lo que hace baratos los ajustes de transcripción.
- **Post-proceso**: quitar marcadores de no-habla (`[BLANK_AUDIO]`, `(music)`,
  `♪`) y unir los saltos de línea por segmento. Descartar audios de menos de
  ~350 ms sin llamar al motor.
- **Descargas**: escribir a `<dest>.part` y renombrar al terminar, para que una
  descarga cortada no deje un modelo corrupto que parece válido.
- **Puerta de voz** (nuestra, WhisperPress no la tiene): whisper no se calla
  ante el silencio, devuelve texto inventado y a veces en otro alfabeto. Antes
  de llamar al motor, `src/renderer/nivel.js` mide qué proporción de los tramos
  de 100 ms supera un umbral de energía; por debajo de 0,10 no se transcribe. Ni
  el pico ni el RMS global sirven: un chasquido al abrir el micrófono ya alcanza
  un pico de 0,4, y el RMS global se diluye con las pausas del habla. Los dos
  umbrales (0,04 por tramo, 0,10 de proporción) salen de un barrido contra habla
  real, tabulado en `docs/referencia-whisperpress.md`. Si hay que reajustarlos,
  **repetir el barrido** — no moverlos a ojo.
- **Ventana sin marco** (`frame: false`): barra de título, botones y asideros de
  redimensionado los pinta el renderer. Los asideros son propios y no del gestor
  de ventanas porque bajo WSLg agarrar por el borde no está garantizado. Sin
  transparencia: con ella las esquinas redondeadas se veían en blanco, así que
  la ventana es cuadrada y opaca.
- **Ajustes**: `ajustes.json` en `app.getPath('userData')`, con sobre
  versionado y escritura atómica (`.part` + rename). El main es el único dueño
  del fichero — el renderer no tiene `fs`, y el main también lo necesita para
  aplicar idioma y glosario al construir el `FormData` de la transcripción. Se
  valida **al cargar**: un valor no admitido cae a su defecto y un fichero que
  no parsea equivale a no tener fichero. Un ajuste inválido nunca puede
  impedir que la app abra.
- **Micrófono**: se guarda `{ id, etiqueta }`. Una única regla de resolución,
  compartida por los ajustes y la grabación (`src/renderer/microfono.js`, puro
  y probado en Node): id guardado → misma etiqueta → primero de la lista. Caer
  al primero **no** borra la preferencia, para que el dispositivo se readopte
  al volver. Se abre con `deviceId: { exact }` y no `ideal`, a propósito: sólo
  `exact` falla de forma detectable, y una sustitución muda no se distingue de
  una mala transcripción. El `groupId` **no** se persiste ni sirve para
  emparejar: cambia entre ventanas, es por contexto de renderer.
- **Ventana de ajustes aparte**, no un panel dentro de la tira: su contenido va
  a crecer (micrófono, transcripción, glosario) y la tira no. Es única —el
  engranaje enfoca la existente— y no altera la ventana principal.
- **Color**: cada valor se declara una sola vez con `light-dark(claro, oscuro)`
  y el tema se elige cambiando `color-scheme`. Sin atributo se sigue al
  sistema, que es el ajuste por defecto, y el primer pintado ya sale bien — el
  CSP prohíbe un script en línea que lo aplicara antes. Corolario: el valor
  calculado de una propiedad personalizada **no** resuelve `light-dark()`, así
  que quien pinte en canvas debe leer una propiedad real (`.viz` declara su
  `color` por estado y `viz.js` lee `getComputedStyle(canvas).color`).
- **Aceleración por hardware desactivada en Linux**: bajo WSLg la rasterización
  por GPU llena la consola de `Creation of StagingBuffer's SharedImage failed`.

## Convenciones

- **Commits convencionales en español**, imperativo (`feat:`, `fix:`, `docs:`,
  `chore:`), sin firma manual además del `Co-Authored-By` que añade la
  herramienta.
- CommonJS (`require`) en main/preload; `'use strict'` al tope de cada archivo.
- Indentación de 2 espacios, comillas simples, punto y coma.
- Comentarios en español y sólo donde expliquen un *porqué*, no un *qué*.
- **"whisper" nombra al motor, no al producto.** `whisper.cpp`,
  `whisper-server`, `whisper-cli` y `setup-whisper.js` se llaman así porque eso
  son. El producto es `dark-owl`. Fundirlos haría que el código mintiera.
- Nada de dependencias en runtime salvo que haya una razón fuerte; hoy el árbol
  de producción es cero-dependencias.
- **Ninguna llamada de red en runtime.** La red sólo se toca en
  `pnpm run setup`. Excepción: `127.0.0.1` contra nuestro propio
  `whisper-server`.

## Verificación

Dos smokes con la app real, porque hay cosas que ninguna prueba unitaria ve:

- `pnpm run smoke` — el ciclo completo: que el worklet carga bajo la CSP, que la
  pausa congela de verdad la captura, que el WAV llega al motor por IPC y que el
  panel se despliega con texto.
- `pnpm run smoke:motor` — el ciclo de vida de `whisper-server`: que un huérfano
  de una ejecución anterior se recoge al arrancar y que **no** se mata un PID
  ajeno. Importa porque cada huérfano retiene el modelo entero en memoria.

- `pnpm run prueba:ajustes` — lógica del fichero de preferencias, en Node sin
  Electron por medio.
- `pnpm run prueba:microfono` — la resolución del dispositivo, en Node.
- `pnpm run smoke:ajustes` — con el proceso main real: que el engranaje abre
  una sola ventana, que el ajuste llega al disco y que el cambio de tema
  alcanza a la otra ventana y al medidor.

Al tocar audio, probar además con **voz real**: el silencio y los clips de menos
de un segundo son los que rompen.
