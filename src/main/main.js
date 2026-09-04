'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const paths = require('./paths');

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

ipcMain.handle('engine:status', () => {
  const s = paths.engineStatus();
  return { hasCli: s.hasCli, hasModel: s.hasModel, ready: s.ready, cli: s.cli, model: s.model };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
