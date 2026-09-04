'use strict';

const path = require('node:path');
const { app, BrowserWindow, clipboard, ipcMain, shell } = require('electron');
const engine = require('./engine');
const text = require('./text');

// WSLg / Linux sin GPU acelerada: evita cuelgues al crear la ventana.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

const ANCHO = 420;
const ALTO_PLEGADO = 96; // barra de título + fila de mandos
const ALTO_DESPLEGADO = 376;

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: ANCHO,
    height: ALTO_PLEGADO,
    title: 'Whisper App',
    // Sin marco del sistema: la barra de título la pinta el renderer, que es
    // lo que permite las esquinas redondeadas y el aspecto compacto.
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Los enlaces externos abren en el navegador del sistema, no en la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('engine:status', () => engine.status());

ipcMain.handle('copiar', (_event, texto) => {
  clipboard.writeText(String(texto || ''));
});

// La ventana crece sólo cuando hay texto que enseñar.
ipcMain.on('ui:desplegar', (_event, desplegado) => {
  if (win && !win.isDestroyed()) {
    win.setContentSize(ANCHO, desplegado ? ALTO_DESPLEGADO : ALTO_PLEGADO, true);
  }
});

ipcMain.on('ui:minimizar', () => win && win.minimize());
ipcMain.on('ui:cerrar', () => win && win.close());

ipcMain.handle('transcribe', async (_event, wav) => {
  try {
    const { text: crudo, language } = await engine.transcribe(Buffer.from(wav));
    return { text: text.limpiar(crudo), language };
  } catch (err) {
    return { error: String(err.message || err) };
  }
});

engine.on('status', (estado) => {
  if (win && !win.isDestroyed()) win.webContents.send('engine:status', estado);
});

app.whenReady().then(() => {
  createWindow();
  // Se calienta en segundo plano: para cuando el usuario termine de grabar, el
  // modelo ya está cargado.
  engine.start().catch((err) => console.error('el engine no arrancó', err));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Sin esto el proceso de whisper-server sobrevive a la app.
app.on('before-quit', () => engine.stop());
