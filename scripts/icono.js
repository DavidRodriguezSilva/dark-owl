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
 * A 16 o 24 píxeles no cabe un ave, cabe una silueta: el cuerpo y los penachos
 * se convierten en papilla y sólo sobreviven los ojos. Por eso hay dos
 * variantes — la completa para 40 px en adelante y una de sólo ojos, más
 * grandes, para los tamaños pequeños.
 *
 * Las dos se pintan en la MISMA página, una encima de otra, y se capturan por
 * regiones. Crear varias ventanas transparentes seguidas bajo WSLg falla: la
 * segunda `loadURL` devuelve ERR_FAILED.
 */
const BASE = 512;

// El búho se dibuja en SVG y no con divs: una silueta con penachos no sale de
// componer rectángulos con border-radius.
function buho(conCuerpo) {
  const ojo = conCuerpo ? 12.5 : 17;
  const pupila = conCuerpo ? 6 : 8;
  const cy = conCuerpo ? 44 : 46;
  const cx = conCuerpo ? 35 : 32;

  // Cabeza y cuerpo en un solo trazo, con los dos penachos arriba.
  const cuerpo = conCuerpo
    ? `<path d="M20 9 L39 19 C43 17.5 46.5 17 50 17 C53.5 17 57 17.5 61 19 L80 9
         L78 31 C81.5 36.5 83 42.5 83 49 C83 72 68 89 50 89
         C32 89 17 72 17 49 C17 42.5 18.5 36.5 22 31 Z" fill="url(#plumas)"/>`
    : '';

  const pico = conCuerpo ? 'M45.5 50 L54.5 50 L50 64 Z' : 'M44.5 54 L55.5 54 L50 70 Z';

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="plumas" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a5370"/>
        <stop offset="1" stop-color="#252a39"/>
      </linearGradient>
    </defs>
    ${cuerpo}
    <circle cx="${cx}" cy="${cy}" r="${ojo}" fill="#f2f4f9"/>
    <circle cx="${100 - cx}" cy="${cy}" r="${ojo}" fill="#f2f4f9"/>
    <circle cx="${cx}" cy="${cy}" r="${pupila}" fill="#12141b"/>
    <circle cx="${100 - cx}" cy="${cy}" r="${pupila}" fill="#12141b"/>
    <path d="${pico}" fill="#f0b429"/>
  </svg>`;
}

function bloque(lado, conCuerpo) {
  return `<div class="placa" style="width:${lado}px;height:${lado}px;border-radius:${Math.round(lado * 0.22)}px">
    <span class="ave" style="width:${Math.round(lado * 0.74)}px;height:${Math.round(lado * 0.74)}px">${buho(conCuerpo)}</span>
  </div>`;
}

function pagina(lado) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
<style>
  html, body { margin: 0; background: transparent; }
  .placa { display: grid; place-items: center; background: linear-gradient(160deg, #232735, #0d0e13); }
  .ave { display: block; }
  .ave svg { display: block; width: 100%; height: 100%; }
</style>
${bloque(lado, true)}
${bloque(lado, false)}
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
    width: BASE,
    height: BASE * 2,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
  });
  await win.loadURL(pagina(BASE));
  await new Promise((r) => setTimeout(r, 400));

  const region = (y) => win.webContents.capturePage({ x: 0, y, width: BASE, height: BASE });
  const conCuerpo = (await region(0)).toPNG();
  const soloOjos = (await region(BASE)).toPNG();
  win.destroy();

  fs.writeFileSync(path.join(ASSETS, 'icon.png'), conCuerpo);
  console.log(`icon.png  ${BASE}x${BASE}  ${conCuerpo.length} bytes`);

  const imagenes = MEDIDAS_ICO.map((lado) => ({
    lado,
    png: reescalar(lado >= 40 ? conCuerpo : soloOjos, lado),
  }));

  const ico = empaquetarIco(imagenes);
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), ico);
  console.log(`icon.ico  ${MEDIDAS_ICO.join(', ')}  ${ico.length} bytes`);

  app.exit(0);
});
