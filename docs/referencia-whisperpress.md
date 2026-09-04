# Referencia técnica: qué tomamos de WhisperPress

Notas de lectura de [`whisperpress`](https://github.com/b84330808/whisperpress)
(~2.700 líneas, Electron + whisper.cpp, Windows-only). Sirve de guía, no de base:
su producto es dictado global con inyección de texto; el nuestro es una
grabadora minimalista. Aquí queda lo que sí aplica y lo que no.

## Captura de audio — se adopta tal cual

`src/renderer/overlay/overlay.js` + `src/renderer/common/pcm-worklet.js`.

No usa `MediaRecorder` ni ffmpeg. Pide el `AudioContext` directamente a 16 kHz y
saca PCM crudo con un `AudioWorklet`:

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
});
const ctx = new AudioContext({ sampleRate: 16000 });
await ctx.audioWorklet.addModule('pcm-worklet.js');
const node = new AudioWorkletNode(ctx, 'pcm-capture');
ctx.createMediaStreamSource(stream).connect(node);
// La salida del worklet NO se conecta a destination: capturar sin monitorear.
node.port.onmessage = (e) => chunks.push(e.data); // Float32Array
```

El worklet entero son 8 líneas: `process(inputs)` hace
`this.port.postMessage(ch.slice(0))` y devuelve `true`.

Al detener: concatena los `Float32Array` y escribe un WAV a mano — cabecera RIFF
de 44 bytes + PCM `Int16` little-endian. **Ese es exactamente el formato que
whisper.cpp consume**, así que no hace falta ninguna conversión ni ffmpeg.

Detalles que valen oro:

- **Esperar ~140 ms tras dejar de grabar** antes de cerrar el contexto: los
  mensajes del worklet en vuelo aún no han llegado y se perderían las últimas
  sílabas.
- Los mensajes llegan cada ~8 ms. Para un medidor de nivel hay que **agregar a
  ~70 ms**, si no la onda se mueve demasiado rápido para leerse.
- Cerrar siempre `stream.getTracks().forEach(t => t.stop())` **y** `ctx.close()`,
  o el indicador de micrófono se queda encendido.

WhisperPress **no tiene pausa** — es push-to-talk. Nuestra pausa se resuelve con
una bandera que deja de acumular chunks (el contexto sigue vivo, así que
reanudar es instantáneo y no vuelve a pedir permiso de micrófono).

## Motor de transcripción — dos caminos, elegimos uno

`src/main/engine.js` mantiene dos rutas:

| | `whisper-server` | `whisper-cli` |
|---|---|---|
| Uso | clips cortos | archivos largos |
| Forma | HTTP `POST /inference`, `FormData` con el WAV, `response_format=verbose_json` | proceso por transcripción, `-oj -of <base>` + parseo de stdout |
| Coste | proceso **caliente**: el modelo queda cargado en RAM | recarga el modelo en cada invocación |
| Salida | JSON al final | segmentos en streaming (regex sobre `[hh:mm:ss.mmm --> …]`) |

**Decisión para Whisper App: `whisper-server` caliente.** Con audios cortos el
tiempo de carga del modelo domina — cargar `small` puede costar más que
transcribir 10 segundos de voz. Arrancar el servidor al abrir la app y dejarlo
vivo convierte "detener → texto" en algo casi inmediato.

Cómo lo levanta:

- Puerto libre con `net.createServer().listen(0)` y leer `address().port`.
- `whisper-server` **abre el socket sólo después de cargar el modelo**, así que
  el arranque se detecta haciendo `fetch` en bucle cada 300 ms hasta que
  responda (timeout de 120 s).
- Hilos: `max(2, min(8, cpus/2))`. Más hilos no ayuda y compite con la UI.

### Trampa importante: el servidor decodifica peor que el CLI

`whisper-server` usa por defecto decodificación *greedy* (`-bs -1 -bo 2`),
mientras `whisper-cli` usa *beam search*. La calidad baja de forma notoria
(WhisperPress lo detectó por la puntuación en chino, pero afecta a todo).
Hay que pasar explícitamente:

```
-bs 5 -bo 5
```

## Limpieza del texto

`cleanTranscript()` en `src/main/dictation.js`:

- Whisper emite marcadores de no-habla para silencio o ruido: `[BLANK_AUDIO]`,
  `(music)`, `♪`. Se filtran los `[...]` / `(...)` cortos.
- Whisper devuelve **un salto de línea por segmento**. Para un texto corrido hay
  que unirlos: con espacio entre fragmentos latinos, sin espacio si el borde es
  CJK.
- Guarda de duración: por debajo de ~350 ms ni se manda a transcribir.

## Descarga de modelos

`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-<id>.bin`,
siguiendo redirects. Escribe a `<dest>.part` y hace `rename` al terminar, para
que una descarga cortada no deje un modelo corrupto que *parece* válido.
Ya está implementado así en `scripts/setup-whisper.js`.

## Lo que NO adoptamos

| Suyo | Por qué no |
|---|---|
| Binarios `.zip` de los releases de whisper.cpp | Sin firmar → antivirus. Compilamos desde fuente. |
| `injector.js` (Win32 `SendInput` vía PowerShell) | Fuera de alcance: no inyectamos texto en otras apps. |
| `uiohook-napi`, `hotkeys.js` | Sin hotkeys globales. Cero dependencias nativas. |
| `notes.js`, historial en JSON | Sin historial: un audio, un texto, limpiar. |
| `opencc-js`, post-proceso de chino | Específico de CJK. Cero dependencias en runtime. |
| `ai.js` (endpoint OpenAI-compatible) | Rompería el "todo offline". |
| Ventana overlay, bandeja, i18n | Superficie de UI que no cabe en "súper minimalista". |
| `transcribeFile` con streaming | Es para audios largos; los nuestros son cortos. |

## Riesgo conocido a verificar

Nuestro `index.html` declara CSP `script-src 'self'`. `audioWorklet.addModule()`
se rige por `script-src`, y bajo el protocolo `file://` el origen `'self'` puede
comportarse de forma inconsistente. WhisperPress no declara CSP, así que no nos
sirve de referencia. Si el worklet no carga: cargarlo desde un `blob:` o servir
el renderer con un protocolo propio registrado en el main.
