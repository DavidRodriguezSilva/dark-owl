# Estado

La app funciona de punta a punta: grabar → pausar/reanudar → detener →
transcribir → copiar / limpiar / reprocesar.

La ventana es una franja al estilo del Winamp pequeño —contador, tres mandos y
medidor de nivel en la misma línea— sin marco del sistema, y crece para
desplegar el panel de texto sólo cuando hay algo que enseñar. Se redimensiona
con asideros propios: plegada sólo a lo ancho, desplegada libre.

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
- El medidor de nivel recibe barras reales del micrófono mientras graba.
- La puerta de voz descarta el silencio antes de llamar al motor y la UI dice
  «no se oyó nada».
- Tras el ciclo, la fase vuelve a `inicial` y limpiar / reprocesar quedan
  habilitados según corresponda.

Y el camino completo renderer → preload → IPC → motor → limpieza, con
`samples/jfk.wav` inyectado en lugar del micrófono, devuelve el texto correcto
en una sola línea: «And so my fellow Americans, ask not what your country can do
for you, ask what you can do for your country.» (5,6 s).

## Modo archivo

Un archivo de audio —con el mando de la tira o soltándolo encima— entra por el
mismo ciclo que una grabación: se decodifica en el renderer a 16 kHz mono y va
al motor como cualquier WAV. Límites de 20 minutos y 250 MB, comprobados antes
de leer y de decodificar. `pnpm run smoke:archivo` lo recorre con el renderer
real.

Medido con `pnpm run smoke:archivo -- --largo` (19:26 de voz, `small`, CPU):
**364 s** hasta el texto, 11.553 caracteres. Pasa de los 300 s en que el
`fetch` de Node habría abortado la petición; por eso `/inference` va por
`node:http`.

Formatos verificados aquí: mp3, wav, webm/opus y mp4/opus. Falta comprobar
con archivos reales ogg/opus (WhatsApp) y m4a con AAC: en este entorno no hay
con qué generarlos.

## Windows

El ejecutable se construye en Windows con MSVC (pasos en `docs/windows.md`) y
ya está hecho y probado. Desde WSL no sale: `vendor/` contiene binarios ELF,
así que un paquete armado aquí arrancaría y fallaría al transcribir.

## Pendiente

- Bajo Linux se desactiva la aceleración por hardware: con ella, WSLg no
  consigue crear los buffers de rasterización y llena la consola de
  «Creation of StagingBuffer's SharedImage failed». Esta UI son cuatro cajas y
  un canvas diminuto, así que por software va igual.
