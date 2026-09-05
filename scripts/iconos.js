#!/usr/bin/env node
'use strict';

/**
 * Regenera el sprite de iconos de la interfaz desde Lucide.
 *
 *   pnpm run iconos
 *
 * Los trazos se **incrustan** en los HTML, no se instala el paquete: el árbol
 * de producción es cero-dependencias y un sprite externo chocaría con el CSP
 * bajo file://. Aquí sólo se baja el paquete a un temporal para leerlo.
 *
 * Lucide — https://lucide.dev — licencia ISC.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Fijada a propósito: regenerar no debe cambiar el aspecto sin querer.
const VERSION = '1.41.0';
const RAIZ = path.resolve(__dirname, '..');

// El transporte va relleno y el resto en trazo: son las tres formas que hay que
// reconocer de un vistazo a 16 px, y una silueta llena se lee antes que un
// contorno. Se toma igualmente la geometría de Lucide para que las
// proporciones sean las del resto del juego.
const RELLENOS = new Set(['i-pause', 'i-play', 'i-stop']);

const ICONOS = [
  { id: 'i-rec', propio: '<circle cx="12" cy="12" r="6.5" />' },
  { id: 'i-pause', lucide: 'pause' },
  { id: 'i-play', lucide: 'play' },
  { id: 'i-stop', lucide: 'square' },
  { id: 'i-copy', lucide: 'copy' },
  { id: 'i-again', lucide: 'rotate-ccw' },
  { id: 'i-clear', lucide: 'trash-2' },
  { id: 'i-gear', lucide: 'settings-2' },
  { id: 'i-reload', lucide: 'refresh-cw' },
  { id: 'i-min', lucide: 'minus' },
  { id: 'i-close', lucide: 'x' },
  { id: 'i-system', lucide: 'monitor' },
  { id: 'i-light', lucide: 'sun' },
  { id: 'i-dark', lucide: 'moon' },
];

function descargar() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lucide-'));
  console.log(`bajando lucide-static@${VERSION}…`);
  const tgz = execFileSync('npm', ['pack', `lucide-static@${VERSION}`, '--silent'], {
    cwd: tmp,
    encoding: 'utf8',
  }).trim();
  execFileSync('tar', ['xzf', tgz], { cwd: tmp });
  return path.join(tmp, 'package', 'icons');
}

/** Se queda con el interior del <svg>, que es lo único que va al <symbol>. */
function cuerpo(dir, nombre) {
  const svg = fs.readFileSync(path.join(dir, `${nombre}.svg`), 'utf8');
  return svg
    .replace(/[\s\S]*?<svg[^>]*>/, '')
    .replace('</svg>', '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sprite(dir) {
  const lineas = [
    '    <!-- iconos:inicio — generado por scripts/iconos.js, no editar a mano -->',
    `    <!-- Lucide ${VERSION} (https://lucide.dev), licencia ISC. -->`,
    '    <svg class="sprite" aria-hidden="true">',
  ];
  for (const icono of ICONOS) {
    const trazo = icono.propio || cuerpo(dir, icono.lucide);
    // Los rellenos heredan el color del botón; los de trazo declaran su grosor
    // una sola vez, igual para todo el juego.
    const attrs = (icono.propio || RELLENOS.has(icono.id))
      ? ''
      : ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    lineas.push(`      <symbol id="${icono.id}" viewBox="0 0 24 24"${attrs}>${trazo}</symbol>`);
  }
  lineas.push('    </svg>');
  lineas.push('    <!-- iconos:fin -->');
  return `${lineas.join('\n')}\n`;
}

function escribir(fichero, bloque) {
  const ruta = path.join(RAIZ, 'src/renderer', fichero);
  const texto = fs.readFileSync(ruta, 'utf8');
  const patron = /[ \t]*<!-- iconos:inicio[\s\S]*?<!-- iconos:fin -->\n/;
  if (!patron.test(texto)) throw new Error(`${fichero}: faltan los marcadores iconos:inicio/fin`);
  const nuevo = texto.replace(patron, bloque);
  if (nuevo === texto) {
    console.log(`  ${fichero} — sin cambios`);
    return false;
  }
  fs.writeFileSync(ruta, nuevo);
  console.log(`  ${fichero} — actualizado`);
  return true;
}

const dir = descargar();
const bloque = sprite(dir);
console.log(`${ICONOS.length} iconos`);
for (const f of ['index.html', 'ajustes.html']) escribir(f, bloque);
