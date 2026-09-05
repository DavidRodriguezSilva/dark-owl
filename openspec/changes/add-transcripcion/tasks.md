## 1. Propagar los tiempos

- [x] 1.1 `src/main/engine.js`: devolver también las palabras con sus tiempos,
      aplanadas de todos los segmentos, como `[{ palabra, inicio, fin }]`.
- [x] 1.2 Mandar `language` y, cuando el idioma sea concreto,
      `no_language_probabilities=true` (D4). Todo por petición: no se reinicia
      el motor ni se recarga el modelo.
- [x] 1.3 Quitar la constante `LANGUAGE` como fuente de verdad; el idioma llega
      del ajuste. Dejar la bandera de arranque coherente con él.

## 2. Formato del texto

- [x] 2.1 `src/main/text.js`: separar en frases por puntuación de final de
      oración, contemplando comillas y cierres (`.»`, `?"`) y las aperturas del
      español (`¿`, `¡`).
- [x] 2.2 Párrafos: cortar sólo cuando coincidan **final de oración y pausa**
      por encima del umbral (D2). Una pausa sin final de frase no corta.
- [x] 2.3 Degradar a frases cuando no haya tiempos por palabra, sin fallar
      (D1).
- [x] 2.4 `scripts/prueba-texto.js`: pruebas en Node del formateo. Casos que
      importan: pausa a mitad de frase que **no** debe cortar, pausa tras punto
      que **sí**, sin tiempos, sin puntuación en todo el texto, y el texto
      corrido de hoy sin regresión.

## 3. Los ajustes

- [x] 3.1 `src/main/ajustes.js`: campos `idioma`, `formato` y `pausaParrafo`,
      este último validado como entero en un rango, no como texto libre.
- [x] 3.2 Ampliar `scripts/prueba-ajustes.js` con el campo numérico: fuera de
      rango, no entero y no numérico caen al defecto.
- [x] 3.3 `src/main/main.js`: leer los ajustes al transcribir y pasárselos al
      motor y al formateo.

## 4. Interfaz

- [x] 4.1 Sección «Transcripción» en `src/renderer/ajustes.html`: idioma
      (desplegable), formato (segmentado, como el tema) y umbral de pausa.
- [x] 4.2 El umbral sólo tiene sentido con formato de párrafos: deshabilitarlo
      —no esconderlo— cuando no lo esté, para que se vea que existe.
- [x] 4.3 Estilos de los controles nuevos en ambos esquemas de color.

## 5. Verificación

- [x] 5.1 `node --check`, `prueba:texto`, `prueba:ajustes` y `prueba:microfono`
      en verde.
- [x] 5.2 `smoke`, `smoke:motor` y `smoke:ajustes` sin regresiones.
- [x] 5.3 Hecho con algo mejor que jfk.wav: **seis minutos de mensajes de voz
      en español de nativos**, aportados por el propietario. Dan 78 frases y 6
      párrafos con el umbral por defecto.

      Ahí salieron **dos fallos que las pruebas sintéticas no podían ver**:

      - Los `words` de whisper son **sub-palabras**, no palabras, y traen su
        propio espacio inicial. Recortarlo e inventar separaciones producía
        «P ued es entender». Las pruebas usaban palabras limpias, así que
        pasaban; ahora usan tokens realistas.
      - El texto corrido, que es código **anterior a este change**, partía
        palabras: whisper corta segmentos a mitad de palabra y `limpiar()` unía
        esas líneas con un espacio —«me encant ó»—. Nueve palabras rotas en seis
        minutos. El corrido pasa también a recomponerse desde las palabras, y
        ahora los tres formatos dicen exactamente lo mismo.
- [x] 5.4 Cambiar el idioma no reinicia el motor: comprobado en
      `smoke:ajustes`, mismo PID antes y después y el motor sigue en `ready`.
- [ ] 5.5 Manual del propietario: dictar de verdad, con una pausa a mitad de
      frase y otra entre frases, y confirmar que sólo la segunda parte el
      párrafo. El audio aportado valida el umbral contra español real, pero sus
      pausas largas son saltos entre mensajes distintos; falta comprobarlo
      contra un dictado propio y continuado.
