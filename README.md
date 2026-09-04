# Whisper App

Grabadora minimalista de **voz a texto, 100% offline**, sobre
[whisper.cpp](https://github.com/ggml-org/whisper.cpp).

Una ventana pequeña. Un solo ciclo:

```
grabar → pausar/reanudar → detener → esperar → texto
              ↑                                  │
              └────── limpiar / reprocesar ──────┘
```

Sin cuentas, sin nube, sin telemetría. El audio nunca sale de tu máquina.

## Por qué existe

Las apps de dictado offline que ya hay (p. ej. WhisperPress) distribuyen
ejecutables **sin firmar**. Windows SmartScreen y varios antivirus los marcan
como amenaza: es un falso positivo típico de Electron empaquetado, pero
igualmente bloquea el uso y obliga a confiar en un binario ajeno.

Aquí no se descarga ningún ejecutable de terceros: `npm run setup` **compila
whisper.cpp desde fuente** en tu máquina y baja el modelo desde Hugging Face.
Lo único que se versiona en este repo es código legible.

## Alcance

**Sí:** grabar, pausar, detener, transcribir, ver el texto, copiarlo, limpiar,
reprocesar el último audio.

**No** (al menos por ahora): hotkeys globales, inyección de texto en otras
apps, historial de notas, importar archivos de audio, capturar audio del
sistema, resúmenes con LLM, traducción. El norte es *súper pequeña, súper
minimalista*.

## Requisitos

| | |
|---|---|
| Node.js | 20+ (probado en 24) |
| Compilador | `git`, `cmake`, `build-essential` (Linux) · MSVC + CMake (Windows) |
| Disco | ~600 MB (modelo `small` + engine) |
| Opcional | GPU NVIDIA para compilar el engine con CUDA |

En Debian/Ubuntu:

```bash
sudo apt install -y git cmake build-essential
```

## Puesta en marcha

```bash
npm install
npm run setup        # compila whisper.cpp + descarga ggml-small.bin  (~5-10 min)
npm start
```

Con GPU NVIDIA:

```bash
npm run setup:cuda
```

Todo lo que `setup` produce queda en `vendor/` (git-ignored). A partir de ahí
la app funciona sin red.

## Arquitectura

```
src/main/       proceso principal — ventana, IPC, engine, rutas
src/preload/    puente contextBridge; única superficie visible del renderer
src/renderer/   UI — index.html, app.css, app.js
scripts/        setup-whisper.js — compila el engine y baja el modelo
vendor/         engine compilado + modelos (nunca versionado)
```

- **Electron** con `contextIsolation: true` y `nodeIntegration: false`. El
  renderer sólo accede a lo que `preload.js` expone en `window.api`.
- HTML + CSS + JS plano. Sin framework de UI, sin bundler, sin TypeScript.
- Cero dependencias en runtime.
- El audio se captura con **WebAudio a 16 kHz mono** y se codifica a WAV PCM
  16-bit — el formato que whisper.cpp consume sin conversión previa (por eso no
  hace falta ffmpeg).
- La transcripción corre en el proceso main invocando `whisper-cli`.

## Modelo

Por defecto **`small`** (~488 MB): buen equilibrio entre velocidad y precisión
para audios cortos, y multilingüe. Se puede cambiar:

```bash
node scripts/setup-whisper.js --model base
```

## Plataformas

Cross-platform Linux + Windows. El desarrollo y las pruebas se hacen en
Linux/WSL2 (WSLg, micrófono vía PulseAudio); el código no asume APIs
exclusivas de una plataforma.

## Cómo se trabaja este repo

Los cambios se planifican con [OpenSpec](https://github.com/Fission-AI/OpenSpec)
antes de escribirse. El contexto del proyecto y las reglas de cada artefacto
viven en [`openspec/config.yaml`](openspec/config.yaml).

## Licencia

[MIT](LICENSE). whisper.cpp y los modelos ggml tienen sus propias licencias.
