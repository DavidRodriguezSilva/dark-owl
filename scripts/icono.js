#!/usr/bin/env electron
'use strict';

/**
 * Genera los iconos renderizándolos como HTML y capturándolos, sin librerías de
 * imagen ni herramientas de diseño.
 *
 *   pnpm run icono
 *
 * Deja assets/icon.png (512, para Linux) y assets/icon.ico multi-tamaño (para
 * Windows). El .ico lleva todas las medidas que Windows pide: usar una sola de
 * 256 obliga al sistema a reducirla y el icono sale borroso en la barra de
 * tareas y en el explorador.
 */

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, nativeImage } = require('electron');

const MEDIDAS_ICO = [16, 24, 32, 48, 64, 128, 256];
const ASSETS = path.resolve(__dirname, '..', 'assets');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.disableHardwareAcceleration();
}

/**
 * Las tres variantes se pintan en la MISMA página, una encima de otra, y se
 * capturan por regiones. Crear varias ventanas transparentes seguidas bajo WSLg falla: la
 * segunda `loadURL` devuelve ERR_FAILED.
 */
const BASE = 512;

// El búho se dibuja en SVG y no con divs: una cabeza con penachos y ojos no
// sale de componer rectángulos con border-radius.
//
// Cabeza sola y en trazo limpio, en el mismo idioma que la iconografía de la
// interfaz: grosor uniforme, extremos redondeados, sin rellenos salvo las
// pupilas, sólidas porque son lo que da mirada.
//
// Tres variantes, y la frontera está medida, no supuesta: a 32 px el trazo
// todavía se lee; a 24 y 16 los anillos y el pico se funden en una mancha, así
// que ahí sólo vale la masa.
function buho(modo) {
  const claro = '#f2f4f9';

  if (modo === 'macizo') {
    // Sin anillos ni pico: a 16 px un contorno de un píxel desaparece y el pico
    // sólo sirve para soldar los dos ojos en una mancha. Quedan los ojos, bien
    // separados, que es lo único que a ese tamaño sigue diciendo "búho".
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="27" cy="50" r="15" fill="${claro}"/>
      <circle cx="73" cy="50" r="15" fill="${claro}"/>
      <circle cx="27" cy="50" r="6" fill="#12141b"/>
      <circle cx="73" cy="50" r="6" fill="#12141b"/>
    </svg>`;
  }

  const completo = modo === 'completo';
  const trazo = completo ? 4 : 6;
  const ojo = completo ? 10 : 15;
  const pupila = completo ? 3.6 : 5.5;
  const cx = completo ? 33 : 31;
  const cy = completo ? 50 : 48;

  // Cabeza y penachos en un solo trazo cerrado.
  const cabeza = completo
    ? `<path d="M18 41 L22 15 L35 28 C40 24.5 45 23 50 23 C55 23 60 24.5 65 28
         L78 15 L82 41 C84 48 84 55 82 61 C77 77 65 86 50 86
         C35 86 23 77 18 61 C16 55 16 48 18 41 Z"/>`
    : '';

  // Pico en V: junto a los penachos es lo que da carácter de búho.
  const pico = completo ? 'M45 57 L50 68 L55 57' : 'M42 57 L50 71 L58 57';

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      fill="none" stroke="${claro}" stroke-width="${trazo}"
      stroke-linecap="round" stroke-linejoin="round">
    ${cabeza}
    <circle cx="${cx}" cy="${cy}" r="${ojo}"/>
    <circle cx="${100 - cx}" cy="${cy}" r="${ojo}"/>
    <circle cx="${cx}" cy="${cy}" r="${pupila}" fill="${claro}" stroke="none"/>
    <circle cx="${100 - cx}" cy="${cy}" r="${pupila}" fill="${claro}" stroke="none"/>
    <path d="${pico}"/>
  </svg>`;
}

function bloque(lado, modo) {
  return `<div class="placa" style="width:${lado}px;height:${lado}px;border-radius:${Math.round(lado * 0.22)}px">
    <span class="ave" style="width:${Math.round(lado * 0.74)}px;height:${Math.round(lado * 0.74)}px">${buho(modo)}</span>
  </div>`;
}

function pagina(lado) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
<style>
  html, body { margin: 0; background: transparent; }
  body { display: flex; }
  .placa { display: grid; place-items: center; background: linear-gradient(160deg, #232735, #0d0e13); }
  .ave { display: block; }
  .ave svg { display: block; width: 100%; height: 100%; }
</style>
${bloque(lado, 'completo')}
${bloque(lado, 'ojos')}
${bloque(lado, 'macizo')}
`)}`;
}

function reescalar(png, lado) {
  return nativeImage
    .createFromBuffer(png)
    .resize({ width: lado, height: lado, quality: 'best' })
    .toPNG();
}

/**
 * Contenedor ICO con varias imágenes. Windows Vista en adelante acepta las
 * entradas en PNG, así que basta la cabecera: 6 bytes de cabecera más 16 por
 * imagen, y detrás los PNG uno tras otro.
 */
function empaquetarIco(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // tipo: icono
  cabecera.writeUInt16LE(imagenes.length, 4);

  const entradas = [];
  let desplazamiento = 6 + imagenes.length * 16;
  for (const { lado, png } of imagenes) {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado >= 256 ? 0 : lado, 0); // 0 significa 256
    e.writeUInt8(lado >= 256 ? 0 : lado, 1);
    e.writeUInt8(0, 2); // sin paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    entradas.push(e);
    desplazamiento += png.length;
  }

  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.png)]);
}

app.whenReady().then(async () => {
  fs.mkdirSync(ASSETS, { recursive: true });

  const win = new BrowserWindow({
    width: BASE * 3,
    height: BASE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
  });
  // El gestor de ventanas puede recortar: si lo hace, las capturas saldrían
  // cortadas y el icono mal sin que nada lo dijera.
  const [ancho, alto] = win.getContentSize();
  if (ancho < BASE * 3 || alto < BASE) {
    throw new Error(`la ventana se quedó en ${ancho}x${alto}; hacen falta ${BASE * 3}x${BASE}`);
  }

  await win.loadURL(pagina(BASE));
  await new Promise((r) => setTimeout(r, 400));

  const region = (x) => win.webContents.capturePage({ x, y: 0, width: BASE, height: BASE });
  const completo = (await region(0)).toPNG();
  const ojos = (await region(BASE)).toPNG();
  const macizo = (await region(BASE * 2)).toPNG();
  win.destroy();

  fs.writeFileSync(path.join(ASSETS, 'icon.png'), completo);
  console.log(`icon.png  ${BASE}x${BASE}  ${completo.length} bytes`);

  const imagenes = MEDIDAS_ICO.map((lado) => ({
    lado,
    png: reescalar(lado >= 40 ? completo : lado >= 32 ? ojos : macizo, lado),
  }));

  const ico = empaquetarIco(imagenes);
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), ico);
  console.log(`icon.ico  ${MEDIDAS_ICO.join(', ')}  ${ico.length} bytes`);

  app.exit(0);
});
