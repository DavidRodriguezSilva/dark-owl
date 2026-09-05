#!/usr/bin/env electron
'use strict';

/**
 * Prueba de humo con la app real: carga el renderer, graba del micrófono, pausa,
 * reanuda, detiene y espera a que el ciclo cierre. Comprueba lo que ninguna
 * prueba unitaria ve — que el worklet carga bajo la CSP, que la pausa congela de
 * verdad la captura y que el WAV llega al motor por IPC.
 *
 *   npm run smoke
 *
 * Sin voz real de por medio, lo esperable es que la puerta de voz descarte la
 * grabación: eso también es un ciclo completo y correcto.
 */

const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.resolve(__dirname, '..');
const engine = require(path.join(ROOT, 'src/main/engine.js'));
const text = require(path.join(ROOT, 'src/main/text.js'));
const ajustes = require(path.join(ROOT, 'src/main/ajustes.js'));

if (process.platform === 'linux') app.commandLine.appendSwitch('disable-gpu-sandbox');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;

function comprobar(nombre, ok, detalle) {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallos++;
}

ipcMain.handle('engine:status', () => engine.status());
ipcMain.handle('copiar', () => {});

// Los ajustes usan el módulo de verdad, no un doble: así el arranque de la UI
// recorre el mismo camino que en la app.
ipcMain.handle('ajustes:leer', () => ({ ...ajustes.leer(), efectivo: 'oscuro' }));
ipcMain.handle('ajustes:guardar', (_e, parche) => ({ ...ajustes.guardar(parche), efectivo: 'oscuro' }));

// La ventana de ajustes no se abre en la prueba; sólo se anota que se pidió.
let pidioAjustes = false;
ipcMain.on('ui:ajustes', () => { pidioAjustes = true; });
// La ventana de la prueba es de tamaño fijo: los avisos de la UI se ignoran.
ipcMain.on('ui:desplegar', () => {});
ipcMain.on('ui:minimizar', () => {});
ipcMain.on('ui:cerrar', () => {});
ipcMain.handle('transcribe', async (_e, wav) => {
  try {
    const config = ajustes.leer();
    const r = await engine.transcribe(Buffer.from(wav), { idioma: config.idioma });
    return {
      text: text.formatear(r.text, r.palabras, {
        formato: config.formato,
        pausaParrafo: config.pausaParrafo,
      }),
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
  win.webContents.on('console-message', (e) => consola.push(`[${e.level}] ${e.message}`));
  // Sin esto Electron deniega el micrófono en silencio.
  win.webContents.session.setPermissionRequestHandler((_wc, _p, cb) => cb(true));
  engine.on('status', (s) => {
    if (!win.isDestroyed()) win.webContents.send('engine:status', s);
  });

  await win.loadFile(path.join(ROOT, 'src/renderer/index.html'));

  const t0 = Date.now();
  const arrancado = await engine.start();
  comprobar('el engine arranca', arrancado, arrancado ? `${Date.now() - t0} ms` : engine.status().detail || 'sin detalle');
  if (!arrancado) return terminar();

  // `stop` en el ámbito global de la página es window.stop(), no el botón.
  const js = (code) => win.webContents.executeJavaScript(code);
  const pulsar = (id) => js(`document.getElementById('${id}').click()`);
  const leer = (expr) => js(`(${expr})`);

  await espera(300);
  comprobar('la UI ve el engine listo', await leer(`engineListo`));

  await pulsar('record');
  await espera(1200);
  const grabando = await leer(`({fase, ms: Recorder.transcurrido(), trozos: Recorder.chunks.length, tasa: Recorder.ctx.sampleRate, barras: Recorder.niveles.length})`);
  comprobar('graba a 16 kHz', grabando.fase === 'grabando' && grabando.tasa === 16000, `${grabando.trozos} trozos`);
  comprobar('el medidor recibe nivel', grabando.barras > 0, `${grabando.barras} barras`);

  await pulsar('pause');
  const pausa0 = await leer(`({ms: Recorder.transcurrido(), trozos: Recorder.chunks.length})`);
  await espera(700);
  const pausa1 = await leer(`({ms: Recorder.transcurrido(), trozos: Recorder.chunks.length})`);
  comprobar(
    'la pausa congela contador y captura',
    pausa0.ms === pausa1.ms && pausa0.trozos === pausa1.trozos,
    `${pausa1.ms} ms · ${pausa1.trozos} trozos`,
  );

  await pulsar('pause');
  await espera(800);
  const tras = await leer(`({fase, trozos: Recorder.chunks.length})`);
  comprobar('reanuda', tras.fase === 'grabando' && tras.trozos > pausa1.trozos);

  await pulsar('stop');
  const cerrado = `fase === 'inicial' && document.getElementById('text').value !== ''`;
  for (let i = 0; i < 200 && !(await leer(cerrado)); i++) await espera(500);

  const fin = await leer(`({fase, texto: document.getElementById('text').value, bytes: ultimoWav && ultimoWav.byteLength, panel: !document.getElementById('panel').hidden})`);
  comprobar('el ciclo cierra', fin.fase === 'inicial', JSON.stringify(fin.texto));
  comprobar('el panel se despliega con el texto', fin.panel === Boolean(fin.texto));

  await pulsar('gear');
  await espera(200);
  comprobar('el engranaje pide abrir los ajustes', pidioAjustes);

  const tema = await leer(`document.documentElement.dataset.tema || 'sistema'`);
  comprobar('el tema se aplica al arrancar', tema === ajustes.leer().tema, tema);
  if (consola.length) console.log(`  consola del renderer: ${consola.join(' · ')}`);

  terminar();
});

function terminar() {
  engine.stop();
  console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\ntodo en orden');
  app.exit(fallos ? 1 : 0);
}
