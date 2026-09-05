# dark-owl

Grabadora minimalista de **voz a texto, 100% offline**, sobre
[whisper.cpp](https://github.com/ggml-org/whisper.cpp).

Una ventana pequeña. Un solo ciclo:

```
grabar → pausar/reanudar → detener → esperar → texto
              ↑                                  │
              └────── limpiar / reprocesar ──────┘
```

Sin cuentas, sin nube, sin telemetría. El audio nunca sale de tu máquina.

El búho oye en la oscuridad y escribe lo que oyó. Forma parte de
**DarkForest**, la familia a la que también pertenece
[dark-echo](https://github.com/DavidRodriguezSilva/dark-echo).

## Por qué existe

Las apps de dictado offline que ya hay (p. ej. WhisperPress) distribuyen
ejecutables **sin firmar**. Windows SmartScreen y varios antivirus los marcan
como amenaza: es un falso positivo típico de Electron empaquetado, pero
igualmente bloquea el uso y obliga a confiar en un binario ajeno.

Aquí no se descarga ningún ejecutable de terceros: `npm run setup` **compila
whisper.cpp desde fuente** en tu máquina y baja el modelo desde Hugging Face.
Lo único que se versiona en este repo es código legible.

## Alcance

**Sí:** grabar, pausar, detener, transcribir, ver el texto, limpiar,
reprocesar el último audio. Controles sólo con iconos; el nombre de la app vive
en la barra de título de la ventana, no dentro de la UI.

**No** (al menos por ahora): hotkeys globales, inyección de texto en otras
apps, historial de notas, importar archivos de audio, capturar audio del
sistema, resúmenes con LLM, traducción. El norte es *súper pequeña, súper
minimalista*.

## Requisitos

| | |
|---|---|
| Node.js | 20+ (probado en 24) · pnpm |
| Compilador | `git`, `cmake`, `build-essential` (Linux) · MSVC + CMake (Windows) |
| Disco | ~600 MB (modelo `small` + engine) |
| Opcional | GPU NVIDIA para compilar el engine con CUDA |

En Debian/Ubuntu:

```bash
sudo apt install -y git cmake build-essential
```

## Puesta en marcha

```bash
pnpm install
pnpm run setup       # compila whisper.cpp + descarga ggml-small.bin  (~5-10 min)
pnpm start
```

Al abrir, la app levanta `whisper-server` en segundo plano y carga el modelo. El
punto de la esquina lo indica: **ámbar** cargando, **verde** listo, **rojo** algo
falta o falló — el detalle está en el tooltip.

## Uso

En reposo la ventana es una sola franja, al estilo del Winamp pequeño: contador,
los tres mandos y el medidor de nivel, todo en la misma línea.

```
● DARK OWL                                         –  ✕
 00:00   ( ● ) ( ⏸ ) ( ■ )   ▁▃▅▂▆▃▁▅▂▄▇▃▁▅▂
```

| | |
|---|---|
| ● | grabar |
| ⏸ / ▶ | pausar y reanudar (sin cerrar el micrófono: reanudar es instantáneo) |
| ■ | detener → transcribe |

El medidor no es decorativo: son los niveles reales del micrófono, agrupados a
70 ms. Mientras grabas se mueve en rojo; en pausa se congela en gris.

Al llegar el texto, la ventana **crece** y despliega el panel con tres
herramientas — copiar, reprocesar el último audio sin volver a grabar, y
limpiar. Al limpiar vuelve a plegarse a la franja.

Se redimensiona arrastrando el borde derecho, el inferior o la esquina.
Plegada sólo se ensancha —no tendría sentido alargar una franja vacía—; con el
texto desplegado es libre, y recuerda el alto que le dejaste para la próxima vez
que se despliegue.

Descarta por su cuenta lo que no vale la pena mandar al motor: menos de 350 ms, o
audio por debajo del nivel de voz. Sin esa segunda comprobación whisper no se
calla ante el silencio — **inventa** texto, a veces en otro alfabeto.

Con GPU NVIDIA:

```bash
pnpm run setup:cuda
```

Todo lo que `setup` produce queda en `vendor/` (git-ignored). A partir de ahí
la app funciona sin red.

## Verificar que sigue funcionando

```bash
pnpm run smoke         # el ciclo completo, con la app abierta de verdad
pnpm run smoke:motor   # el ciclo de vida de whisper-server
```

`smoke` abre la app, graba del micrófono, pausa, reanuda y detiene, y comprueba
lo que ninguna prueba unitaria ve: que el worklet carga bajo la CSP, que la
pausa congela de verdad la captura y que el WAV llega al motor por IPC. Sin voz
real de por medio, lo esperable es que la puerta de voz descarte la grabación —
eso también es un ciclo completo.

`smoke:motor` comprueba que un `whisper-server` huérfano de una ejecución
anterior se recoge al arrancar, y que no se mata un PID ajeno. Importa porque
cada huérfano retiene el modelo entero en memoria.

## Arquitectura

```
src/main/main.js       ventana y manejadores IPC
src/main/engine.js     ciclo de vida de whisper-server y POST /inference
src/main/text.js       limpieza del transcrito
src/main/paths.js      rutas de engine y modelo, en desarrollo y empaquetado
src/preload/           puente contextBridge; única superficie visible del renderer
src/renderer/          UI, captura de audio, worklet PCM y medidor de nivel
scripts/               setup-whisper.js — compila el engine y baja el modelo
vendor/                engine compilado + modelos (nunca versionado)
```

- **Electron** con `contextIsolation: true` y `nodeIntegration: false`. El
  renderer sólo accede a lo que `preload.js` expone en `window.api`.
- Ventana **sin marco del sistema** (`frame: false`): la barra de título, los
  botones de minimizar/cerrar y los asideros de redimensionado los pinta el
  renderer. El alto lo gobierna el main entre plegado y desplegado.
- Los asideros son propios y no del gestor de ventanas: una ventana sin marco
  depende de él para poder agarrarse por el borde, y bajo WSLg eso no está
  garantizado.
- HTML + CSS + JS plano. Sin framework de UI, sin bundler, sin TypeScript.
- Cero dependencias en runtime.
- El audio se captura con **WebAudio a 16 kHz mono** (`AudioContext` +
  `AudioWorklet`, sin `MediaRecorder`) y se codifica a WAV PCM 16-bit escribiendo
  la cabecera RIFF a mano — es el formato que whisper.cpp consume sin conversión
  previa, así que **no hace falta ffmpeg**.
- La transcripción corre en el proceso main contra un **`whisper-server` que se
  mantiene caliente**: el modelo queda cargado en RAM y "detener → texto" es casi
  inmediato. Con clips cortos, recargar el modelo en cada transcripción costaría
  más que transcribir.

Las decisiones de fondo — y las trampas que ya conocemos, como que
`whisper-server` decodifica *greedy* por defecto y hay que forzarle `-bs 5 -bo 5`
— están documentadas en
[`docs/referencia-whisperpress.md`](docs/referencia-whisperpress.md), las notas
de lectura del repo que usamos de guía.

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

## Empaquetar

```bash
pnpm run pack      # carpeta sin comprimir en release/, para probar
pnpm run dist      # AppImage en Linux
```

El paquete lleva dentro el motor y el modelo, así que pesa unos 780 MB y
funciona sin red desde el primer arranque.

Los iconos (`assets/icon.png` y `assets/icon.ico` con siete medidas) están
versionados. Para rehacerlos tras un cambio de diseño: `pnpm run icono`, que los
pinta como HTML y los captura, sin librerías de imagen.

Para el ejecutable de Windows hay que construir **en Windows**: aquí `vendor/`
contiene binarios ELF y un paquete armado desde WSL arrancaría y fallaría al
transcribir. Los pasos están en [`docs/windows.md`](docs/windows.md), incluido
qué esperar de SmartScreen con un `.exe` sin firmar.

## Cómo se trabaja este repo

Los cambios se planifican con [OpenSpec](https://github.com/Fission-AI/OpenSpec)
antes de escribirse. El contexto largo del proyecto está en
[`openspec/project.md`](openspec/project.md); el resumen que se inyecta en
cada artefacto y las reglas de propuesta, diseño y tareas, en
[`openspec/config.yaml`](openspec/config.yaml).

## Licencia

[MIT](LICENSE). whisper.cpp y los modelos ggml tienen sus propias licencias.
