'use strict';

// Whisper marca los tramos sin voz con etiquetas propias: [BLANK_AUDIO],
// (music), (silence)… Son ruido para nosotros.
const MARCADOR = /[[(][^\])]{0,40}[\])]/g;
const CJK = /[　-鿿＀-￯]/;

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

module.exports = { limpiar };
