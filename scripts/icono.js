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
 * A 16 o 24 píxeles las barras del medidor se convierten en papilla, así que
 * los tamaños pequeños se quedan sólo con el punto de grabar.
 *
 * Las dos variantes se pintan en la MISMA página, una encima de otra, y se
 * capturan por regiones. Crear varias ventanas transparentes seguidas bajo
 * WSLg falla: la segunda `loadURL` devuelve ERR_FAILED.
 */
const BASE = 512;

function bloque(lado, conBarras) {
  const radio = Math.round(lado * (conBarras ? 0.145 : 0.3));
  const hueco = Math.max(1, Math.round(lado * 0.055));
  const grueso = Math.max(1, Math.round(lado * 0.035));
  const separacion = Math.max(1, Math.round(lado * 0.027));
  const barras = [0.10, 0.23, 0.34, 0.17, 0.08]
    .map((alto, i) => {
      const color = ['#5d6480', '#828aa6', '#f2f4f9', '#828aa6', '#5d6480'][i];
      return `<i style="height:${Math.round(alto * lado)}px;background:${color};width:${grueso}px;border-radius:${grueso}px"></i>`;
    })
    .join('');

  return `<div class="placa" style="width:${lado}px;height:${lado}px;border-radius:${Math.round(lado * 0.22)}px">
    <div class="grupo" style="gap:${hueco}px">
      <span class="punto" style="width:${radio * 2}px;height:${radio * 2}px"></span>
      ${conBarras ? `<span class="barras" style="gap:${separacion}px">${barras}</span>` : ''}
    </div>
  </div>`;
}

function pagina(lado) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
<style>
  html, body { margin: 0; background: transparent; }
  .placa { display: grid; place-items: center; background: linear-gradient(160deg, #232735, #0d0e13); }
  .grupo { display: flex; align-items: center; }
  .punto { border-radius: 50%; background: #f0483c; }
  .barras { display: flex; align-items: center; }
  .barras i { display: block; }
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
  const conBarras = (await region(0)).toPNG();
  const sinBarras = (await region(BASE)).toPNG();
  win.destroy();

  fs.writeFileSync(path.join(ASSETS, 'icon.png'), conBarras);
  console.log(`icon.png  ${BASE}x${BASE}  ${conBarras.length} bytes`);

  const imagenes = MEDIDAS_ICO.map((lado) => ({
    lado,
    png: reescalar(lado >= 40 ? conBarras : sinBarras, lado),
  }));

  const ico = empaquetarIco(imagenes);
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), ico);
  console.log(`icon.ico  ${MEDIDAS_ICO.join(', ')}  ${ico.length} bytes`);

  app.exit(0);
});
