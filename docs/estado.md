# Estado

## Verificado en este equipo (WSL2, CPU)

whisper.cpp v1.9.3 (`52a939a`), modelo `small`, clip de 11 s
(`samples/jfk.wav`):

| Ruta | Tiempo |
|---|---|
| `whisper-cli` en frío (recarga el modelo cada vez) | 6,7 s |
| `whisper-server` caliente, 1ª petición | 5,4 s |
| `whisper-server` caliente, 2ª petición | 3,7 s |
| arranque del servidor hasta aceptar conexiones | ~1,2 s |

Confirma la decisión de mantener el servidor caliente. `verbose_json` devuelve
segmentos y palabras con marcas de tiempo, y el `text` trae un `\n` por
segmento — hay que unirlos, tal como anticipaba la referencia.

## Listo
- Scaffold de Electron: ventana, `contextBridge`, UI con los cinco controles.
- `scripts/setup-whisper.js`: compila whisper.cpp desde fuente (CMake, con CUDA
  opcional) y descarga `ggml-small.bin`.
- `src/main/paths.js`: resolución de rutas de engine/modelo en desarrollo y
  empaquetado, y detección de si el engine está listo.
- Engine compilado e instalado en `vendor/` con RPATH `$ORIGIN/../lib`: es
  autocontenido y sobrevive a que se borre el árbol de fuentes.

## Pendiente — vía cambios de OpenSpec
1. **Captura de audio**: worklet PCM, grabar / pausar / reanudar / detener,
   temporizador, codificación a WAV.
2. **Motor caliente**: arrancar `whisper-server` al abrir la app, sondear hasta
   que responda, transcribir por `POST /inference`, reportar estado a la UI.
3. **Ciclo de texto**: limpieza del transcrito, limpiar, reprocesar el último
   audio.
4. **Empaquetado**: AppImage en Linux y portable en Windows con `vendor/` como
   recurso extra.
