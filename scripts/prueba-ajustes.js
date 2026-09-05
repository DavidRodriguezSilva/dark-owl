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
  assert.deepEqual(ajustes.leer(ruta), ajustes.porDefecto());
  assert.equal(ajustes.porDefecto().tema, 'sistema');
  assert.deepEqual(ajustes.porDefecto().microfono, { id: '', etiqueta: '' });
});

prueba('los defectos que son objeto no se comparten entre llamadas', () => {
  const a = ajustes.porDefecto();
  a.microfono.id = 'tocado';
  assert.equal(ajustes.porDefecto().microfono.id, '');
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

prueba('un microfono con la forma esperada se conserva', () => {
  const mic = { id: 'abc123', etiqueta: 'Yeti' };
  fs.writeFileSync(ruta, JSON.stringify({ version: 1, microfono: mic }));
  assert.deepEqual(ajustes.leer(ruta).microfono, mic);
});

prueba('un microfono con forma inesperada cae a su defecto', () => {
  for (const malo of [42, 'abc', null, [], { id: 7, etiqueta: 'x' }, { id: 'x' }]) {
    fs.writeFileSync(ruta, JSON.stringify({ version: 1, microfono: malo }));
    assert.deepEqual(
      ajustes.leer(ruta).microfono,
      { id: '', etiqueta: '' },
      `no cayó al defecto con ${JSON.stringify(malo)}`,
    );
  }
});

prueba('un microfono con claves de más las pierde', () => {
  fs.writeFileSync(
    ruta,
    JSON.stringify({ version: 1, microfono: { id: 'a', etiqueta: 'b', colado: 'c' } }),
  );
  assert.deepEqual(ajustes.leer(ruta).microfono, { id: 'a', etiqueta: 'b' });
});

prueba('un campo inválido no arrastra a los demás', () => {
  fs.writeFileSync(ruta, JSON.stringify({ version: 1, tema: 'claro', microfono: 42 }));
  const leido = ajustes.leer(ruta);
  assert.equal(leido.tema, 'claro');
  assert.deepEqual(leido.microfono, { id: '', etiqueta: '' });
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
