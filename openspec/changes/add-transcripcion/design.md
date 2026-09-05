## Context

`src/main/engine.js` pide `response_format=verbose_json` y se queda sólo con
el texto:

```js
return { text: String(json.text || ''), language: json.language || LANGUAGE };
```

`src/main/text.js` hace lo contrario de lo que este change quiere: une los
saltos de línea por segmento en un texto corrido.

Se midió la respuesta real del servidor contra `samples/jfk.wav` de
whisper.cpp —habla de verdad, 11 s— con el modelo `small` ya en uso:

**Un segmento no es una frase, y entre segmentos no hay pausa.**

```
[0s → 6.83s] " And so my fellow Americans, ask not what your country can"
[6.83s → 11s] " do for you, ask what you can do for your country."
```

El primero corta a mitad de frase, y `end` del uno es exactamente `start` del
otro: los segmentos son trozos del decodificador, no unidades de habla.

**Pero cada segmento trae `words` con tiempos, y ahí sí están las pausas.** El
campo viene poblado por defecto, sin pedir `token_timestamps`. Huecos medidos
entre palabra y palabra en toda la muestra:

| Hueco | Dónde |
|---|---|
| 0,00 s | la gran mayoría |
| 0,04 – 0,20 s | separaciones normales |
| **0,73 s** | «ask **not** / what your country…» |
| **1,18 s** | «my fellow Americans**,** / ask not…» |

Entre 0,20 s y 0,73 s no hay ni un solo valor: la banda está vacía, y es donde
cabe el umbral.

## Goals / Non-Goals

- **Goals**: que el texto se lea en frases y párrafos; que el idioma sea un
  ajuste y no una constante; no reiniciar el motor por ninguna de las dos.
- **Non-Goals**: muletillas, glosario, traducción, hablantes, elegir modelo.

## Decisions

- **D1 — El corte se calcula sobre palabras, no sobre segmentos.** Es la
  consecuencia directa de la medición: los límites de segmento no son ni
  frases ni pausas. `engine.js` propaga las palabras con sus tiempos y
  `text.js` decide sobre ellas.

  Si un motor o un modelo futuro no devolviera `words`, el formato de párrafos
  degrada a frases —que sólo necesitan puntuación— en vez de fallar.

- **D2 — Un párrafo exige puntuación final Y pausa; la pausa sola no basta.**
  Era lo que iba a hacer, y los datos lo desmienten. Las dos pausas largas de
  la muestra caen en sitios donde **no** hay final de frase:

  - 1,18 s después de «Americans**,**» — una coma.
  - 0,73 s después de «**not**» — mitad de oración, una pausa retórica.

  Cortar por pausa sola habría partido una sola frase en tres párrafos. Con la
  regla combinada, la muestra da un párrafo, que es lo correcto.

  El dictado real está lleno de pausas para pensar a mitad de frase; son
  exactamente las que no deben crear párrafo.

- **D3 — Umbral por defecto de 600 ms, y ajustable.** Cae en el centro de la
  banda vacía medida (0,20 s – 0,73 s), así que ni parte por separaciones
  normales ni se pierde las pausas de verdad.

  Se declara la limitación: **una muestra, en inglés, de un orador entrenado**.
  El dictado propio en español puede repartirse distinto. Por eso el umbral es
  un ajuste y no una constante — que es además lo que se pidió: un valor por
  defecto que se pueda mover.

- **D4 — El idioma por defecto pasa de `auto` a español.** Es un cambio de
  comportamiento deliberado, no un efecto colateral. Con clips cortos la
  detección automática falla y whisper acaba traduciendo o inventando; el
  comentario que ya hay en `engine.js` lo dice desde el principio. `auto` sigue
  disponible en la lista para quien dicte en varios idiomas.

  Con un idioma concreto se manda además `no_language_probabilities=true`: el
  servidor calcula si no la probabilidad de cada idioma en cada petición, y su
  propio código lo marca como operación cara. Si el idioma está fijado, ese
  cálculo no lo usa nadie.

- **D5 — Formatear en el main y no en el renderer.** `text.js` ya vive ahí y ya
  limpia el transcrito; el renderer recibe texto listo para enseñar. Mantiene
  al renderer sin lógica de dominio y deja el formateo donde se puede probar en
  Node.

- **D6 — El formato se aplica al transcribir, no se guarda el original.**
  Cambiar el ajuste no reformatea el texto que ya está a la vista: haría falta
  conservar las palabras con tiempos de la última transcripción y volver a
  formatear, y para eso ya está el botón de reprocesar. Menos estado.

## Superficie nueva

Ningún canal IPC nuevo. Campos de ajustes:

```js
idioma: 'es'            // 'auto' | 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it'
formato: 'parrafos'     // 'corrido' | 'frases' | 'parrafos'
pausaParrafo: 600       // ms, entero entre 200 y 3000
```

`engine.transcribe()` pasa a devolver `{ text, language, palabras }`, donde
`palabras` es `[{ palabra, inicio, fin }]` en segundos, aplanado de todos los
segmentos.

## Risks / Trade-offs

- **El umbral se calibró con una sola muestra en inglés.** Mitigado porque es
  ajustable; anotado para que nadie lo tome por medido en español.
- **Fijar el idioma a español empeora el dictado en otro idioma** hasta que se
  cambie el ajuste. Es el precio de acertar en el caso normal, y el aviso está
  en la propia etiqueta del ajuste.
- **`words` engorda la respuesta JSON.** Es tráfico a `127.0.0.1` y se
  descarta tras formatear; a cambio evita una segunda pasada al audio.
