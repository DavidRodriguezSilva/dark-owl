#!/usr/bin/env node
'use strict';

/**
 * Pruebas de src/main/ajustes.js. Lógica pura: corren en Node, sin Electron y
 * sin la app abierta.
 *
 *   pnpm run prueba:ajustes
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const ajustes = require('../src/main/ajustes');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dark-owl-'));
const ruta = path.join(dir, 'ajustes.json');
let hechas = 0;

function prueba(nombre, fn) {
  fs.rmSync(ruta, { force: true });
  fn();
  hechas++;
  console.log(`✓ ${nombre}`);
}

prueba('sin fichero devuelve los valores por defecto', () => {
  assert.deepEqual(ajustes.leer(ruta), { version: 1, tema: 'sistema' });
});

prueba('un fichero que no parsea equivale a no tener fichero', () => {
  fs.writeFileSync(ruta, 'esto no es json {{{');
  assert.deepEqual(ajustes.leer(ruta), ajustes.porDefecto());
});

prueba('un valor no admitido cae a su defecto', () => {
  fs.writeFileSync(ruta, JSON.stringify({ version: 1, tema: 'fucsia' }));
  assert.equal(ajustes.leer(ruta).tema, 'sistema');
});

prueba('un valor admitido se conserva', () => {
  fs.writeFileSync(ruta, JSON.stringify({ version: 1, tema: 'claro' }));
  assert.equal(ajustes.leer(ruta).tema, 'claro');
});

prueba('los campos desconocidos se descartan, no se arrastran', () => {
  fs.writeFileSync(ruta, JSON.stringify({ version: 1, tema: 'oscuro', retirado: 42 }));
  const leido = ajustes.leer(ruta);
  assert.equal(leido.tema, 'oscuro');
  assert.equal('retirado' in leido, false);
});

prueba('guardar escribe y leer lo recupera', () => {
  assert.equal(ajustes.guardar({ tema: 'claro' }, ruta).tema, 'claro');
  assert.equal(ajustes.leer(ruta).tema, 'claro');
});

prueba('guardar fusiona sobre lo vigente en vez de reemplazarlo', () => {
  ajustes.guardar({ tema: 'oscuro' }, ruta);
  assert.equal(ajustes.guardar({}, ruta).tema, 'oscuro');
});

prueba('guardar un valor no admitido no lo escribe', () => {
  ajustes.guardar({ tema: 'claro' }, ruta);
  assert.equal(ajustes.guardar({ tema: 'fucsia' }, ruta).tema, 'sistema');
});

prueba('no queda ningún .part tras guardar', () => {
  ajustes.guardar({ tema: 'claro' }, ruta);
  assert.equal(fs.existsSync(`${ruta}.part`), false);
});

prueba('el fichero escrito siempre lleva versión', () => {
  ajustes.guardar({ tema: 'claro' }, ruta);
  assert.equal(JSON.parse(fs.readFileSync(ruta, 'utf8')).version, ajustes.VERSION);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${hechas} pruebas, todo en orden`);
