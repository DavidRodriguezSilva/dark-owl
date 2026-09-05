'use strict';

const path = require('node:path');
const { app, BrowserWindow, clipboard, ipcMain, shell } = require('electron');
const engine = require('./engine');
const text = require('./text');

// Bajo WSLg la rasterización por GPU no consigue crear sus buffers y llena la
// consola de "Creation of StagingBuffer's SharedImage failed". Esta UI son
// cuatro cajas y un canvas diminuto, así que no se pierde nada por software.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.disableHardwareAcceleration();
}

const ANCHO = 420;
const ANCHO_MINIMO = 360;
const ALTO_PLEGADO = 96; // barra de título + fila de mandos
const ALTO_DESPLEGADO = 376;
const ALTO_MINIMO_DESPLEGADO = 220;
const SIN_LIMITE = 10000;

let win = null;
// Se recuerda el alto que dejó el usuario, para que plegar y volver a desplegar
// no le deshaga el tamaño que había elegido.
let altoDesplegado = ALTO_DESPLEGADO;

function createWindow() {
  win = new BrowserWindow({
    width: ANCHO,
    height: ALTO_PLEGADO,
    title: 'Dark Owl',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    // Sin marco del sistema: la barra de título la pinta el renderer.
    // Sin transparencia a propósito: con ella las esquinas redondeadas se veían
    // en blanco, así que la ventana es cuadrada y opaca.
    frame: false,
    backgroundColor: '#0d0e13',
    minWidth: ANCHO_MINIMO,
    maxHeight: ALTO_PLEGADO, // arranca plegada: sólo se puede ensanchar
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

// La ventana crece sólo cuando hay texto que enseñar. El ancho es siempre del
// usuario; el alto lo gobierna la app mientras está plegada.
ipcMain.on('ui:desplegar', (_event, desplegado) => {
  if (!win || win.isDestroyed()) return;
  const [ancho, alto] = win.getContentSize();

  if (desplegado) {
    win.setMaximumSize(SIN_LIMITE, SIN_LIMITE);
    win.setMinimumSize(ANCHO_MINIMO, ALTO_MINIMO_DESPLEGADO);
    win.setContentSize(ancho, altoDesplegado, true);
  } else {
    if (alto > ALTO_PLEGADO) altoDesplegado = alto;
    // Primero el mínimo, o encoger por debajo de él no surtiría efecto.
    win.setMinimumSize(ANCHO_MINIMO, ALTO_PLEGADO);
    win.setContentSize(ancho, ALTO_PLEGADO, true);
    win.setMaximumSize(SIN_LIMITE, ALTO_PLEGADO);
  }
});

// Asideros de redimensionado propios: una ventana sin marco depende del gestor
// de ventanas para poder agarrarla por el borde, y bajo WSLg eso no está
// garantizado. Electron sigue aplicando los mínimos y máximos vigentes.
ipcMain.handle('ui:tam', () => (win && !win.isDestroyed() ? win.getContentSize() : [0, 0]));
ipcMain.on('ui:tam', (_event, ancho, alto) => {
  if (win && !win.isDestroyed()) win.setContentSize(Math.round(ancho), Math.round(alto));
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

// Cerrando la ventana basta con before-quit, pero si a la app la matan a señal
// —cerrar la terminal, un kill, el lanzador de WSLg— no se dispara y el motor
// queda huérfano reteniendo el modelo en memoria.
for (const senal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(senal, () => {
    engine.stop();
    app.quit();
  });
}
