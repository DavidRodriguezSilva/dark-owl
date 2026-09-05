## 1. Propagar los tiempos

- [ ] 1.1 `src/main/engine.js`: devolver también las palabras con sus tiempos,
      aplanadas de todos los segmentos, como `[{ palabra, inicio, fin }]`.
- [ ] 1.2 Mandar `language` y, cuando el idioma sea concreto,
      `no_language_probabilities=true` (D4). Todo por petición: no se reinicia
      el motor ni se recarga el modelo.
- [ ] 1.3 Quitar la constante `LANGUAGE` como fuente de verdad; el idioma llega
      del ajuste. Dejar la bandera de arranque coherente con él.

## 2. Formato del texto

- [ ] 2.1 `src/main/text.js`: separar en frases por puntuación de final de
      oración, contemplando comillas y cierres (`.»`, `?"`) y las aperturas del
      español (`¿`, `¡`).
- [ ] 2.2 Párrafos: cortar sólo cuando coincidan **final de oración y pausa**
      por encima del umbral (D2). Una pausa sin final de frase no corta.
- [ ] 2.3 Degradar a frases cuando no haya tiempos por palabra, sin fallar
      (D1).
- [ ] 2.4 `scripts/prueba-texto.js`: pruebas en Node del formateo. Casos que
      importan: pausa a mitad de frase que **no** debe cortar, pausa tras punto
      que **sí**, sin tiempos, sin puntuación en todo el texto, y el texto
      corrido de hoy sin regresión.

## 3. Los ajustes

- [ ] 3.1 `src/main/ajustes.js`: campos `idioma`, `formato` y `pausaParrafo`,
      este último validado como entero en un rango, no como texto libre.
- [ ] 3.2 Ampliar `scripts/prueba-ajustes.js` con el campo numérico: fuera de
      rango, no entero y no numérico caen al defecto.
- [ ] 3.3 `src/main/main.js`: leer los ajustes al transcribir y pasárselos al
      motor y al formateo.

## 4. Interfaz

- [ ] 4.1 Sección «Transcripción» en `src/renderer/ajustes.html`: idioma
      (desplegable), formato (segmentado, como el tema) y umbral de pausa.
- [ ] 4.2 El umbral sólo tiene sentido con formato de párrafos: deshabilitarlo
      —no esconderlo— cuando no lo esté, para que se vea que existe.
- [ ] 4.3 Estilos de los controles nuevos en ambos esquemas de color.

## 5. Verificación

- [ ] 5.1 `node --check`, `prueba:texto`, `prueba:ajustes` y `prueba:microfono`
      en verde.
- [ ] 5.2 `smoke`, `smoke:motor` y `smoke:ajustes` sin regresiones.
- [ ] 5.3 Transcribir `samples/jfk.wav` de whisper.cpp con los tres formatos y
      comparar la salida. Es la muestra con la que se midió el umbral, así que
      es la que puede confirmar que la regla combinada da **un** párrafo y no
      tres.
- [ ] 5.4 Comprobar que cambiar el idioma no reinicia el motor: el PID del
      `whisper-server` debe ser el mismo antes y después.
- [ ] 5.5 Con la app corriendo: dictar de verdad en español, con una pausa a
      mitad de frase y otra entre frases, y confirmar que sólo la segunda parte
      el párrafo. Es lo único que valida el umbral contra habla propia y no
      contra una muestra en inglés.
