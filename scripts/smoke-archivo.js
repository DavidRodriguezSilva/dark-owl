#!/usr/bin/env electron
'use strict';

/**
 * Prueba de humo del modo archivo con la app real: suelta archivos sobre la
 * ventana y los elige con el mando, como haría el usuario, y comprueba que el
 * texto llega, que los límites rechazan sin llamar al motor y que soltar un
 * archivo no saca a la app de la ventana.
 *
 *   pnpm run smoke:archivo            ciclo corto, con samples/jfk de whisper.cpp
 *   pnpm run smoke:archivo -- --largo además, un audio de ~19,5 minutos
 *
 * El largo tarda minutos: es el que demuestra que una transcripción larga no
 * caduca por el camino.
 */

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.resolve(__dirname, '..');
const engine = require(path.join(ROOT, 'src/main/engine.js'));
const text = require(path.join(ROOT, 'src/main/text.js'));
const ajustes = require(path.join(ROOT, 'src/main/ajustes.js'));

if (process.platform === 'linux') app.commandLine.appendSwitch('disable-gpu-sandbox');

const MUESTRAS = path.resolve(ROOT, '..', 'whisper.cpp', 'samples');
const LARGO = process.argv.includes('--largo');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;
let llamadasMotor = 0;

function comprobar(nombre, ok, detalle) {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallos++;
}

ipcMain.handle('engine:status', () => engine.status());
ipcMain.handle('copiar', () => {});
ipcMain.handle('ajustes:leer', () => ({ ...ajustes.leer(), efectivo: 'oscuro' }));
ipcMain.handle('ajustes:guardar', (_e, parche) => ({ ...ajustes.guardar(parche), efectivo: 'oscuro' }));
ipcMain.on('ui:ajustes', () => {});
ipcMain.on('ui:desplegar', () => {});
ipcMain.on('ui:minimizar', () => {});
ipcMain.on('ui:cerrar', () => {});
ipcMain.handle('transcribe', async (_e, wav) => {
  llamadasMotor++;
  try {
    const config = ajustes.leer();
    // El idioma se fija a inglés: las muestras de whisper.cpp lo son, y el
    // ajuste del usuario puede ser español.
    const r = await engine.transcribe(Buffer.from(wav), { idioma: 'en' });
    return {
      text: text.formatear(r.text, r.palabras, { formato: config.formato, pausaParrafo: config.pausaParrafo }),
      language: r.language,
    };
  } catch (err) {
    return { error: String(err.message || err) };
  }
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(ROOT, 'src/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const consola = [];
  win.webContents.on('console-message', (e) => { if (e.level === 'error') consola.push(e.message); });
  win.webContents.session.setPermissionRequestHandler((_wc, _p, cb) => cb(true));
  engine.on('status', (s) => { if (!win.isDestroyed()) win.webContents.send('engine:status', s); });

  await win.loadFile(path.join(ROOT, 'src/renderer/index.html'));
  const urlInicial = win.webContents.getURL();

  if (!(await engine.start())) {
    comprobar('el engine arranca', false, engine.status().detail);
    return terminar();
  }
  const js = (code) => win.webContents.executeJavaScript(code);
  await espera(300);
  comprobar('el mando de abrir está habilitado con el motor listo', await js(`!document.getElementById('open').disabled`));

  // Se pasa el archivo como base64 y se reconstruye en la página como File.
  await js(`window.__archivo = (b64, nombre, tipo) => new File(
    [Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], nombre, { type: tipo }); 0`);
  const archivo = (ruta, tipo) =>
    `window.__archivo('${fs.readFileSync(ruta).toString('base64')}', '${path.basename(ruta)}', '${tipo}')`;
  const soltar = (expr) => js(`(() => {
    const dt = new DataTransfer();
    dt.items.add(${expr});
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  })()`);
  const elegir = (expr) => js(`(() => {
    const dt = new DataTransfer();
    dt.items.add(${expr});
    const input = document.getElementById('file');
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  })()`);
  const estado = () => js(`({ fase, texto: document.getElementById('text').value, reloj: document.getElementById('timer').textContent, wav: ultimoWav && ultimoWav.byteLength })`);
  async function hastaInicial(maxMs = 120000) {
    const t0 = Date.now();
    await espera(100);
    while (Date.now() - t0 < maxMs && (await js('fase')) !== 'inicial') await espera(300);
    return { ...(await estado()), ms: Date.now() - t0 };
  }

  // 1. mp3 soltado sobre la ventana.
  await soltar(archivo(path.join(MUESTRAS, 'jfk.mp3'), 'audio/mpeg'));
  let r = await hastaInicial();
  comprobar('un mp3 soltado se transcribe', /ask not what your country/i.test(r.texto), `${r.ms} ms · ${JSON.stringify(r.texto.slice(0, 60))}`);
  comprobar('el contador muestra la duración del archivo', r.reloj === '00:11', r.reloj);
  comprobar('soltar no navega fuera de la app', win.webContents.getURL() === urlInicial);

  // 2. Reprocesar el mismo archivo.
  const antes = llamadasMotor;
  await js(`document.getElementById('reprocess').click()`);
  r = await hastaInicial();
  comprobar('reprocesar repite el archivo sin pedirlo', llamadasMotor === antes + 1 && /country/i.test(r.texto));

  // 3. wav elegido con el mando.
  await elegir(archivo(path.join(MUESTRAS, 'jfk.wav'), 'audio/wav'));
  r = await hastaInicial();
  comprobar('un wav elegido con el mando se transcribe', /country/i.test(r.texto), `${r.ms} ms`);

  // 4. Algo que no es audio.
  let llamadas = llamadasMotor;
  await soltar(`new File(['hola, no soy audio'], 'nota.txt', { type: 'text/plain' })`);
  r = await hastaInicial();
  comprobar('un .txt avisa de formato y no llega al motor', /formato/.test(r.texto) && llamadasMotor === llamadas, r.texto);

  // 5. Demasiado grande: se rechaza sin leerlo.
  llamadas = llamadasMotor;
  await soltar(`new File([new Uint8Array(260 * 1024 * 1024)], 'enorme.wav', { type: 'audio/wav' })`);
  r = await hastaInicial();
  comprobar('260 MB se rechazan por tamaño', /250 MB/.test(r.texto) && llamadasMotor === llamadas, `${r.texto} · ${r.ms} ms`);

  // 6. Demasiado largo: 21 minutos de silencio a 8 kHz (~20 MB), rechazado
  // por la cabecera antes de decodificar.
  llamadas = llamadasMotor;
  await soltar(`new File([codificarWav(new Float32Array(21 * 60 * 8000), 8000)], 'largo.wav', { type: 'audio/wav' })`);
  r = await hastaInicial();
  comprobar('21 minutos se rechazan por duración', /20 minutos/.test(r.texto) && llamadasMotor === llamadas, `${r.texto} · ${r.ms} ms`);

  // 7. Soltar mientras se graba no hace nada.
  await js(`document.getElementById('record').click()`);
  await espera(1000);
  llamadas = llamadasMotor;
  await soltar(archivo(path.join(MUESTRAS, 'jfk.mp3'), 'audio/mpeg'));
  await espera(800);
  const grabando = await js('fase');
  comprobar('soltar un archivo grabando no interrumpe', grabando === 'grabando' && llamadasMotor === llamadas, grabando);
  comprobar('el mando de abrir se deshabilita grabando', await js(`document.getElementById('open').disabled`));
  await js(`document.getElementById('stop').click()`);
  await hastaInicial();

  // 8. Opcional: ~19,5 minutos de voz (jfk repetido) para la espera larga.
  if (LARGO) {
    await js(`(async () => {
      const ctx = new AudioContext({ sampleRate: 16000 });
      const b = await ctx.decodeAudioData(await ${archivo(path.join(MUESTRAS, 'jfk.mp3'), 'audio/mpeg')}.arrayBuffer());
      const uno = b.getChannelData(0);
      const veces = Math.floor((19.5 * 60 * 16000) / uno.length);
      const todo = new Float32Array(uno.length * veces);
      for (let i = 0; i < veces; i++) todo.set(uno, i * uno.length);
      window.__largo = new File([codificarWav(todo, 16000)], 'largo.wav', { type: 'audio/wav' });
    })()`);
    await soltar('window.__largo');
    r = await hastaInicial(30 * 60 * 1000);
    comprobar('un audio de ~19,5 min termina sin caducar', /country/i.test(r.texto) && !r.texto.startsWith('⚠'),
      `${(r.ms / 1000).toFixed(0)} s · ${r.reloj} · ${r.texto.length} caracteres · ${r.texto.startsWith('⚠') ? r.texto : 'ok'}`);
  }

  if (consola.length) console.log(`  errores en la consola del renderer: ${consola.join(' · ')}`);
  terminar();
});

function terminar() {
  engine.stop();
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\ntodo en orden');
  app.exit(fallos ? 1 : 0);
}
