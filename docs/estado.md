# Estado

La app funciona de punta a punta: grabar → pausar/reanudar → detener →
transcribir → limpiar / reprocesar.

## Medido en este equipo (WSL2, CPU)

whisper.cpp v1.9.3 (`52a939a`), modelo `small`, clip de 11 s
(`samples/jfk.wav`):

| Ruta | Tiempo |
|---|---|
| `whisper-cli` en frío (recarga el modelo cada vez) | 6,7 s |
| `whisper-server` caliente, 1ª petición | 5,4 s |
| `whisper-server` caliente, 2ª petición | 3,7 s |
| arranque del servidor hasta aceptar conexiones | ~1,2 s |

Por eso el servidor se levanta al abrir la app y se mantiene caliente.

## Verificado con la app corriendo

`npm run smoke` carga el renderer real, graba del micrófono, pausa, reanuda y
detiene. Última pasada, todo en verde:

- El engine arranca en 643 ms y la UI lo ve listo.
- `AudioContext` a 16 kHz y el worklet PCM cargando bajo CSP `script-src 'self'`.
- Durante la pausa el contador y los trozos capturados quedan **congelados**
  (879 ms / 113 trozos en dos muestras separadas) y avanzan al reanudar.
- El WAV resultante mide lo que debe: 53.804 bytes ≈ 1,68 s a 16 kHz mono.
- La puerta de voz descarta el silencio antes de llamar al motor
  (`voz=0.056`, por debajo del umbral 0,10) y la UI dice «no se oyó nada».
- Tras el ciclo, la fase vuelve a `inicial` y limpiar / reprocesar quedan
  habilitados según corresponda.

Y el camino completo renderer → preload → IPC → motor → limpieza, con
`samples/jfk.wav` inyectado en lugar del micrófono, devuelve el texto correcto
en una sola línea: «And so my fellow Americans, ask not what your country can do
for you, ask what you can do for your country.» (5,6 s).

## Pendiente

- **Empaquetado**: AppImage en Linux y portable en Windows, con `vendor/` como
  recurso extra. Sin probar todavía.
- **Windows**: el código no asume APIs de una sola plataforma, pero no se ha
  ejecutado allí.
- El idioma está fijado en `auto` (`LANGUAGE` en `src/main/engine.js`). Si sólo
  se dicta en español, ponerlo en `'es'` es más rápido y más fiable en clips
  cortos.
