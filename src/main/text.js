'use strict';

// Whisper marca los tramos sin voz con etiquetas propias: [BLANK_AUDIO],
// (music), (silence)… Son ruido para nosotros.
const MARCADOR = /[[(][^\])]{0,40}[\])]/g;
const CJK = /[　-鿿＀-￯]/;

// Final de oración, admitiendo el cierre que venga detrás: comillas, paréntesis
// o los signos de cierre del español.
const FIN_ORACION = /[.!?…]["'»）)\]]*$/;

/**
 * Whisper devuelve un salto de línea por segmento. Los unimos en texto corrido:
 * con espacio entre fragmentos latinos, pegados si el borde es CJK.
 */
function limpiar(texto) {
  const lineas = String(texto || '')
    .split('\n')
    .map((l) => l.replace(MARCADOR, '').trim())
    .filter(Boolean);

  let salida = '';
  for (const linea of lineas) {
    if (!salida) salida = linea;
    else if (CJK.test(salida.at(-1)) || CJK.test(linea[0])) salida += linea;
    else salida += ` ${linea}`;
  }
  return salida.replace(/[ \t]+/g, ' ').trim();
}

/**
 * Quita los marcadores de no-habla, **sin recortar los espacios**.
 *
 * Los `words` de whisper no son palabras: son sub-palabras que traen su propio
 * espacio inicial cuando empieza una — `" Puedes"` se emite como `" P"`,
 * `"ued"`, `"es"`. Ese espacio es la única señal de dónde empieza cada palabra,
 * así que recortarlo y volver a inventar separaciones produce «P ued es».
 */
function limpiarPalabra(p) {
  return String(p || '').replace(MARCADOR, '');
}

/**
 * Reparte las palabras en frases por puntuación de final de oración.
 *
 * Cada frase conserva el hueco de silencio que la precede, que es lo que luego
 * permite decidir si además empieza párrafo.
 *
 * @param {{palabra: string, inicio: number, fin: number}[]} palabras
 */
function enFrases(palabras) {
  const frases = [];
  let actual = [];
  let huecoPrevio = 0;
  let finAnterior = null;

  for (const p of palabras) {
    const texto = limpiarPalabra(p.palabra);
    if (!texto.trim()) continue;
    if (!actual.length) {
      // El silencio que precede a la frase se mide contra la última palabra
      // dicha, no contra el principio del audio.
      huecoPrevio = finAnterior === null ? 0 : Math.max(0, p.inicio - finAnterior);
    }
    actual.push(texto);
    finAnterior = p.fin;

    if (FIN_ORACION.test(texto.trim())) {
      frases.push({ texto: unir(actual), hueco: huecoPrevio });
      actual = [];
    }
  }
  if (actual.length) frases.push({ texto: unir(actual), hueco: huecoPrevio });
  return frases;
}

/**
 * Los trozos se concatenan tal cual: ya traen su propia separación. Añadir
 * espacios por nuestra cuenta es lo que rompía las palabras en pedazos.
 */
function unir(trozos) {
  return trozos.join('').replace(/[ \t]+/g, ' ').trim();
}

/**
 * Da forma al transcrito.
 *
 * El corte de párrafo exige **final de oración y pausa**, no sólo pausa: al
 * medir habla real, las pausas largas caen tanto entre oraciones como a mitad
 * de una —para pensar, o por énfasis—, y cortar por pausa sola parte una sola
 * frase en varios párrafos.
 *
 * Sin tiempos por palabra no se puede saber dónde hubo silencio, así que
 * `parrafos` degrada a `frases` en vez de fallar.
 *
 * @param {string} texto transcrito completo, ya limpio
 * @param {{palabra: string, inicio: number, fin: number}[]} palabras
 * @param {{formato?: string, pausaParrafo?: number}} [opciones]
 */
function formatear(texto, palabras, opciones = {}) {
  const formato = opciones.formato || 'corrido';
  const limpio = limpiar(texto);

  const frases = enFrases(Array.isArray(palabras) ? palabras : []);
  // Sin palabras con tiempos no hay nada que repartir; queda el texto corrido.
  if (!frases.length) return limpio;

  // El texto corrido también se recompone desde las palabras, y no desde el
  // texto del motor: whisper corta segmentos a mitad de palabra, y unir esas
  // líneas con un espacio parte la palabra —«me encant ó»—. Medido sobre seis
  // minutos de habla real: nueve palabras rotas.
  if (formato === 'corrido') return frases.map((f) => f.texto).join(' ');
  if (formato === 'frases') return frases.map((f) => f.texto).join('\n');

  const umbral = (opciones.pausaParrafo || 600) / 1000;
  const parrafos = [];
  for (const frase of frases) {
    if (!parrafos.length || frase.hueco >= umbral) parrafos.push([frase.texto]);
    else parrafos.at(-1).push(frase.texto);
  }
  return parrafos.map((p) => p.join(' ')).join('\n\n');
}

module.exports = { limpiar, formatear, enFrases };
