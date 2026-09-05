#!/usr/bin/env node
'use strict';

/**
 * Pruebas de la resolución de dispositivo (src/renderer/microfono.js). Lógica
 * pura: corren en Node, sin navegador ni dispositivos de verdad.
 *
 *   pnpm run prueba:microfono
 */

const assert = require('node:assert/strict');
const { resolver, nombrar } = require('../src/renderer/microfono');

const dev = (deviceId, label) => ({ deviceId, label, kind: 'audioinput' });
let hechas = 0;

function prueba(nombre, fn) {
  fn();
  hechas++;
  console.log(`✓ ${nombre}`);
}

const lista = [dev('default', 'Default'), dev('aaa111', 'Yeti'), dev('bbb222', 'Webcam')];

prueba('sin nada guardado usa el que diga el sistema', () => {
  const r = resolver({ id: '', etiqueta: '' }, lista);
  assert.equal(r.id, '');
  assert.equal(r.sustituido, false);
});

prueba('el id guardado existe y se usa tal cual', () => {
  const r = resolver({ id: 'aaa111', etiqueta: 'Yeti' }, lista);
  assert.equal(r.id, 'aaa111');
  assert.equal(r.adoptado, false);
  assert.equal(r.sustituido, false);
});

prueba('la etiqueta manda cuando el id cambió', () => {
  const r = resolver({ id: 'viejo', etiqueta: 'Yeti' }, lista);
  assert.equal(r.id, 'aaa111');
  assert.equal(r.adoptado, true);
  assert.equal(r.sustituido, false);
});

prueba('sin id ni etiqueta que casen, cae al primero de la lista', () => {
  const r = resolver({ id: 'fantasma', etiqueta: 'Shure' }, lista);
  assert.equal(r.id, 'default');
  assert.equal(r.sustituido, true);
  assert.equal(r.falta, 'Shure', 'debe decir cuál falta para poder nombrarlo');
});

prueba('el id manda sobre la etiqueta cuando hay dos con el mismo nombre', () => {
  const dobles = [dev('uno', 'USB Mic'), dev('dos', 'USB Mic')];
  assert.equal(resolver({ id: 'dos', etiqueta: 'USB Mic' }, dobles).id, 'dos');
});

prueba('la etiqueta guardada se refresca con la real del dispositivo', () => {
  const r = resolver({ id: 'aaa111', etiqueta: 'nombre viejo' }, lista);
  assert.equal(r.etiqueta, 'Yeti');
});

prueba('una lista vacía no revienta y marca la sustitución', () => {
  const r = resolver({ id: 'aaa111', etiqueta: 'Yeti' }, []);
  assert.equal(r.id, '');
  assert.equal(r.sustituido, true);
});

prueba('aguanta entradas ausentes o mal formadas', () => {
  assert.equal(resolver(null, lista).id, '');
  assert.equal(resolver(undefined, undefined).id, '');
  assert.equal(resolver({ id: 'aaa111' }, null).sustituido, true);
});

prueba('un dispositivo sin etiqueta recibe un nombre de reserva', () => {
  assert.equal(nombrar(dev('x', ''), 0), 'Micrófono 1');
  assert.equal(nombrar(dev('x', 'Yeti'), 3), 'Yeti');
  assert.equal(resolver({ id: 'z', etiqueta: 'z' }, [dev('x', '')]).etiqueta, 'Micrófono 1');
});

console.log(`\n${hechas} pruebas, todo en orden`);
