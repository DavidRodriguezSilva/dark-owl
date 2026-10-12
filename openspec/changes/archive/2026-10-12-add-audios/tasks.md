## 1. Motor: petición sin caducidad

- [x] 1.1 Cambiar el `POST /inference` de `engine.transcribe()` a `node:http`
      sin timeout, serializando el `FormData` con `new Request(...)` (D4); el
      sondeo de arranque sigue con `fetch`
- [x] 1.2 Comprobar con `samples/jfk.wav` que la respuesta y las palabras con
      tiempos no cambian, y que un error HTTP del servidor sigue llegando como
      `{ error }`

## 2. Decodificar y validar (renderer)

- [x] 2.1 Exponer `codificarWav()` de `recorder.js` para reutilizarlo
- [x] 2.2 Crear `src/renderer/archivo.js`: límites (20 min, 250 MB), tamaño
      antes de leer, duración por `<audio preload="metadata">` con respaldo a
      `AudioBuffer.duration` (D2), `decodeAudioData` a 16 kHz y mezcla a mono
      (D1); devuelve `{ wav, ms }` o un aviso tipado (tamaño, duración,
      formato)
- [x] 2.3 Exportar la parte pura (validación de límites, mezcla a mono) para
      Node, como `nivel.js`, y cubrirla con un `scripts/prueba-archivo.js`
      nuevo (`pnpm run prueba:archivo`)

## 3. Interfaz

- [x] 3.1 Añadir `file-audio` a `scripts/iconos.js` y regenerar con
      `pnpm run iconos` (D7)
- [x] 3.2 Mando secundario y `<input type="file" hidden>` en `index.html`,
      con `accept` para los formatos de la propuesta; estilo en `app.css`
- [x] 3.3 En `app.js`: fase `leyendo` (D6), habilitado del mando según fase y
      motor, flujo archivo → `transcribir()`, contador con la duración y
      `ultimoWav` para reprocesar
- [x] 3.4 Arrastrar y soltar: `preventDefault()` en `dragover`/`drop` a nivel
      de `document`, aceptar sólo en fase `inicial` y sólo el primer archivo
- [x] 3.5 Avisos en el panel: tamaño, duración, formato no admitido,
      demasiado corto

## 4. Documentación

- [x] 4.1 `openspec/project.md`: quitar «importar archivos de audio» de fuera
      de alcance, añadir la decisión de decodificar en el renderer y la de
      `node:http` para `/inference`, y la nueva prueba a Verificación
- [x] 4.2 Lo mismo en el `context` de `openspec/config.yaml`, y arreglar de
      paso el YAML que no parsea (una regla de `design` con `: ` en un escalar
      multilínea hace que openspec ignore todo el fichero)
- [x] 4.3 `docs/estado.md`: el modo archivo y lo medido en la tarea 5.3

## 5. Verificación con la app corriendo (`pnpm start`)

- [x] 5.1 `pnpm run prueba:archivo`, `prueba:texto`, `prueba:ajustes` y
      `pnpm run smoke` en verde (el ciclo de grabación no se rompió)
- [x] 5.2 Abrir con el mando y arrastrar: un mp3, un m4a, un wav y un `.opus`;
      un `.txt` da aviso de formato; soltar un archivo grabando no hace nada.
      Verificados mp3, wav, webm/opus y mp4/opus (`pnpm run smoke:archivo` y
      una prueba suelta con MediaRecorder). ogg/opus y m4a con AAC no se
      pudieron generar aquí —ni ffmpeg ni Docker en el entorno— y pasan a 5.5
- [x] 5.3 Un audio de ~18–20 minutos de voz real: termina sin error de tiempo
      agotado; anotar cuánto tardó en `docs/estado.md`
- [x] 5.4 Un audio de más de 20 minutos y un archivo de más de 250 MB: aviso
      inmediato y sin transcripción
- [ ] 5.5 **Manual del propietario**: una nota de voz real exportada de
      WhatsApp (ogg/opus), un m4a del móvil (AAC), y el flujo completo en
      Windows (mando, arrastrar, formatos)
