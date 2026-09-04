'use strict';

/**
 * Detección de voz por energía, sin dependencias ni modelo.
 *
 * Hace falta porque whisper no se calla ante el silencio: si le mandas audio
 * mudo devuelve texto inventado, a veces en otro alfabeto. Ni el pico ni el RMS
 * global sirven para filtrarlo — un chasquido al abrir el micrófono ya alcanza
 * un pico de 0,2, y el RMS global se diluye con las pausas naturales del habla.
 *
 * Lo que sí distingue: la voz mantiene energía a lo largo de muchos tramos,
 * mientras que el ruido de fondo con algún golpe suelto sólo enciende uno.
 *
 * Este fichero se carga con <script> en el renderer y además se exporta para
 * poder probarlo desde Node contra grabaciones reales.
 */

const MS_TRAMO = 100;

function nivelVoz(f32, tasa = 16000) {
  const tam = Math.max(1, Math.round((tasa * MS_TRAMO) / 1000));
  const tramos = [];
  let pico = 0;

  for (let i = 0; i < f32.length; i += tam) {
    const fin = Math.min(i + tam, f32.length);
    let suma = 0;
    for (let j = i; j < fin; j++) {
      const a = Math.abs(f32[j]);
      if (a > pico) pico = a;
      suma += f32[j] * f32[j];
    }
    tramos.push(Math.sqrt(suma / (fin - i)));
  }

  // Energía mínima para dar un tramo de 100 ms por hablado, con control
  // automático de ganancia activo. Calibrado con un barrido: a 0,02 el ruido
  // ambiente puntuaba 1,000 (todos los tramos contaban como voz) y las
  // alucinaciones de whisper se colaban. Desde 0,03 el ambiente cae a 0,05.
  const UMBRAL = 0.04;
  const conVoz = tramos.filter((r) => r >= UMBRAL).length;

  return {
    pico,
    rms: Math.sqrt(tramos.reduce((a, r) => a + r * r, 0) / (tramos.length || 1)),
    // Proporción del audio que suena a voz. Es la cifra que decide.
    voz: tramos.length ? conVoz / tramos.length : 0,
  };
}

if (typeof module !== 'undefined') module.exports = { nivelVoz };
