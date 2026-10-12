#!/usr/bin/env node
'use strict';

/**
 * Pruebas de la parte pura de src/renderer/archivo.js: límites y mezcla a
 * mono. Decodificar necesita Chromium y se cubre con la app corriendo.
 *
 *   pnpm run prueba:archivo
 */

const assert = require('node:assert/strict');
const { excesoArchivo, mezclarMono, MAX_MS_ARCHIVO, MAX_BYTES_ARCHIVO } = require('../src/renderer/archivo');

let hechas = 0;
function prueba(nombre, fn) {
  fn();
  hechas++;
  console.log(`✓ ${nombre}`);
}

const MIN = 60 * 1000;
const MB = 1024 * 1024;

prueba('los límites son 20 minutos y 250 MB', () => {
  assert.equal(MAX_MS_ARCHIVO, 20 * MIN);
  assert.equal(MAX_BYTES_ARCHIVO, 250 * MB);
});

prueba('un audio de 19:50 cabe', () => {
  assert.equal(excesoArchivo({ bytes: 30 * MB, ms: 19 * MIN + 50000 }), '');
});

prueba('20 minutos justos caben', () => {
  assert.equal(excesoArchivo({ ms: 20 * MIN }), '');
});

prueba('35 minutos se rechazan diciendo el límite', () => {
  assert.match(excesoArchivo({ ms: 35 * MIN }), /20 minutos/);
});

prueba('400 MB se rechazan diciendo el límite', () => {
  assert.match(excesoArchivo({ bytes: 400 * MB }), /250 MB/);
});

prueba('el tamaño se juzga sin conocer aún la duración', () => {
  assert.match(excesoArchivo({ bytes: 400 * MB }), /250 MB/);
  assert.equal(excesoArchivo({ bytes: 10 * MB }), '');
});

prueba('una duración desconocida no rechaza: decide la decodificación', () => {
  assert.equal(excesoArchivo({ ms: NaN }), '');
  assert.equal(excesoArchivo({ ms: Infinity }), '');
});

prueba('mono queda tal cual', () => {
  const c = Float32Array.from([0.1, -0.2]);
  assert.equal(mezclarMono([c]), c);
});

prueba('estéreo se mezcla con la media de canales', () => {
  const mono = mezclarMono([Float32Array.from([1, 0, -0.5]), Float32Array.from([0, 0, -0.5])]);
  assert.deepEqual(Array.from(mono), [0.5, 0, -0.5]);
});

console.log(`\n${hechas} pruebas en verde`);
