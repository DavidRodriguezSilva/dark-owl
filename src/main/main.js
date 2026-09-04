'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const engine = require('./engine');
const text = require('./text');

// WSLg / Linux sin GPU acelerada: evita cuelgues al crear la ventana.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 340,
    height: 460,
    minWidth: 300,
    minHeight: 380,
    title: 'Whisper App',
    backgroundColor: '#12131a',
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
