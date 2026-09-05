#!/usr/bin/env node
'use strict';

/**
 * Pruebas del formateo del transcrito (src/main/text.js). Lógica pura: corren
 * en Node, sin motor ni audio.
 *
 *   pnpm run prueba:texto
 */

const assert = require('node:assert/strict');
const { limpiar, formatear } = require('../src/main/text');

let hechas = 0;
function prueba(nombre, fn) {
  fn();
  hechas++;
  console.log(`✓ ${nombre}`);
}

/**
 * Construye palabras con tiempos a partir de [texto, huecoAntesEnSegundos].
 *
 * Los textos van tal cual los emite whisper: con espacio inicial cuando empieza
 * palabra y sin él cuando es continuación o puntuación. Escribirlos «limpios»
 * fue lo que dejó pasar el fallo de las sub-palabras.
 */
function palabras(pares) {
  let t = 0;
  return pares.map(([palabra, hueco = 0]) => {
    t += hueco;
    const p = { palabra, inicio: t, fin: t + 0.2 };
    t += 0.2;
    return p;
  });
}

const DOS_FRASES = palabras([
  ['Hola'], [' qué', 0.05], [' tal.'], [' Vengo', 1.2], [' de', 0.05], [' la', 0.05], [' tienda.'],
]);

prueba('el texto corrido junta todo en una línea', () => {
  const r = formatear('Hola\nqué tal.', DOS_FRASES, { formato: 'corrido' });
  assert.equal(r, 'Hola qué tal. Vengo de la tienda.');
  assert.equal(r.includes('\n'), false);
});

prueba('el corrido tampoco parte palabras cortadas por el segmento', () => {
  // whisper corta segmentos a mitad de palabra: su `text` trae "encant\nó",
  // y unir esas líneas con un espacio daba «encant ó».
  const partida = palabras([['Me'], [' encant'], ['ó.']]);
  assert.equal(formatear('Me encant\nó.', partida, { formato: 'corrido' }), 'Me encantó.');
});

prueba('sigue quitando los marcadores de no-habla', () => {
  assert.equal(limpiar('[BLANK_AUDIO]\nHola.'), 'Hola.');
  assert.equal(formatear('(música)\nHola.', [], { formato: 'parrafos' }), 'Hola.');
});

prueba('parte en frases por la puntuación', () => {
  const r = formatear('Hola qué tal. Vengo de la tienda.', DOS_FRASES, { formato: 'frases' });
  assert.equal(r, 'Hola qué tal.\nVengo de la tienda.');
});

prueba('una pausa tras punto abre párrafo', () => {
  const r = formatear('x', DOS_FRASES, { formato: 'parrafos', pausaParrafo: 600 });
  assert.equal(r, 'Hola qué tal.\n\nVengo de la tienda.');
});

prueba('sin pausa suficiente, las frases van en el mismo párrafo', () => {
  const juntas = palabras([['Hola'], [' tal.'], [' Vengo', 0.2], [' ya.']]);
  const r = formatear('x', juntas, { formato: 'parrafos', pausaParrafo: 600 });
  assert.equal(r, 'Hola tal. Vengo ya.');
});

prueba('una pausa larga a mitad de frase NO abre párrafo', () => {
  // El caso que mató el diseño inicial: al medir habla real, las pausas largas
  // caen también dentro de una oración —para pensar o por énfasis—.
  const dudando = palabras([['Pues'], [' no', 0.05], [' sé', 1.5], [' qué', 0.05], [' decirte.']]);
  const r = formatear('x', dudando, { formato: 'parrafos', pausaParrafo: 600 });
  assert.equal(r, 'Pues no sé qué decirte.');
  assert.equal(r.includes('\n'), false);
});

prueba('el umbral manda: bajarlo parte donde antes no partía', () => {
  const corta = palabras([['Una.'], [' Dos.', 0.4]]);
  assert.equal(formatear('x', corta, { formato: 'parrafos', pausaParrafo: 600 }), 'Una. Dos.');
  assert.equal(formatear('x', corta, { formato: 'parrafos', pausaParrafo: 300 }), 'Una.\n\nDos.');
});

prueba('sin tiempos por palabra degrada en vez de fallar', () => {
  const r = formatear('Hola qué tal. Vengo ya.', [], { formato: 'parrafos' });
  assert.equal(r, 'Hola qué tal. Vengo ya.');
});

prueba('un texto sin puntuación queda de una pieza', () => {
  const sin = palabras([['hola'], [' qué', 0.05], [' tal', 2.0]]);
  assert.equal(formatear('x', sin, { formato: 'frases' }), 'hola qué tal');
  assert.equal(formatear('x', sin, { formato: 'parrafos' }), 'hola qué tal');
});

prueba('la puntuación suelta se pega a la palabra anterior', () => {
  const sueltos = palabras([['Hola'], [','], [' qué'], [' tal'], ['?']]);
  assert.equal(formatear('x', sueltos, { formato: 'frases' }), 'Hola, qué tal?');
});

prueba('las sub-palabras se recomponen sin partirse', () => {
  // Whisper no emite palabras enteras: " Puedes" llega como " P" + "ued" + "es".
  // Recortar el espacio inicial e inventar separaciones daba «P ued es».
  const trozos = palabras([[' P'], ['ued'], ['es'], [' ent'], ['end'], ['erlo.']]);
  assert.equal(formatear('x', trozos, { formato: 'frases' }), 'Puedes entenderlo.');
});

prueba('el cierre tras el punto cuenta como fin de frase', () => {
  const citado = palabras([['Dijo'], [' «sí.»'], [' Luego', 1.0], [' calló.']]);
  const r = formatear('x', citado, { formato: 'parrafos', pausaParrafo: 600 });
  assert.equal(r, 'Dijo «sí.»\n\nLuego calló.');
});

prueba('el silencio inicial no cuenta como pausa', () => {
  const tarde = palabras([['Hola.', 5.0], [' Adiós.']]);
  assert.equal(formatear('x', tarde, { formato: 'parrafos', pausaParrafo: 600 }), 'Hola. Adiós.');
});

prueba('aguanta entradas ausentes o mal formadas', () => {
  assert.equal(formatear('', null, { formato: 'parrafos' }), '');
  assert.equal(formatear(null, undefined, { formato: 'frases' }), '');
  assert.equal(formatear('Hola.', 'no es una lista', { formato: 'parrafos' }), 'Hola.');
});

console.log(`\n${hechas} pruebas, todo en orden`);
