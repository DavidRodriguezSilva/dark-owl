'use strict';

const path = require('node:path');
const { app, BrowserWindow, clipboard, ipcMain, nativeTheme, shell } = require('electron');
const engine = require('./engine');
const text = require('./text');
const ajustes = require('./ajustes');

// Bajo WSLg la rasterización por GPU no consigue crear sus buffers y llena la
// consola de "Creation of StagingBuffer's SharedImage failed". Esta UI son
// cuatro cajas y un canvas diminuto, así que no se pierde nada por software.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.disableHardwareAcceleration();
}

const ANCHO = 420;
const ANCHO_MINIMO = 360;
// 1 + 30 (barra) + 50 (fila de mandos) + 1 de bordes. Medido, no estimado:
// antes sobraban 10 px de hueco muerto bajo los botones.
const ALTO_PLEGADO = 82;
const ALTO_DESPLEGADO = 376;
const ALTO_MINIMO_DESPLEGADO = 220;
const SIN_LIMITE = 10000;

// La ventana de ajustes es aparte porque su contenido crece —micrófono,
// transcripción, glosario— y la tira no.
const AJUSTES_ANCHO = 440;
const AJUSTES_ALTO = 360;

// Fondo que Electron pinta antes de que el renderer dibuje. Con el tema claro,
// dejarlo oscuro produce un destello en cada arranque.
const FONDO = { oscuro: '#0d0e13', claro: '#f4f5f8' };

let win = null;
let winAjustes = null;

/** El tema efectivo: 'sistema' se resuelve contra el esquema del SO. */
function temaEfectivo(config = ajustes.leer()) {
  if (config.tema !== 'sistema') return config.tema;
  return nativeTheme.shouldUseDarkColors ? 'oscuro' : 'claro';
}

/**
 * El renderer resuelve el esquema por su cuenta —el CSS usa `light-dark()` y
 * sigue a `prefers-color-scheme` cuando el ajuste es 'sistema'—, pero el fondo
 * que Electron pinta antes de que el renderer dibuje lo fija el main y hay que
 * mantenerlo al día.
 */
function aplicarFondo() {
  const fondo = FONDO[temaEfectivo()];
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.setBackgroundColor(fondo);
  }
}

function difundirAjustes() {
  const config = ajustes.leer();
  const mensaje = { ...config, efectivo: temaEfectivo(config) };
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('ajustes:cambiado', mensaje);
  }
}
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
    backgroundColor: FONDO[temaEfectivo()],
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

/**
 * Ventana única: con los ajustes ya abiertos, el engranaje la trae al frente en
 * vez de abrir una segunda.
 */
function abrirAjustes() {
  if (winAjustes && !winAjustes.isDestroyed()) {
    if (winAjustes.isMinimized()) winAjustes.restore();
    winAjustes.focus();
    return;
  }

  winAjustes = new BrowserWindow({
    width: AJUSTES_ANCHO,
    height: AJUSTES_ALTO,
    minWidth: 380,
    minHeight: 200,
    title: 'Ajustes — Dark Owl',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    frame: false,
    backgroundColor: FONDO[temaEfectivo()],
    show: false,
    autoHideMenuBar: true,
    // No es modal: se puede seguir grabando con los ajustes abiertos.
    parent: win || undefined,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  winAjustes.once('ready-to-show', () => winAjustes.show());
  winAjustes.on('closed', () => { winAjustes = null; });
  winAjustes.loadFile(path.join(__dirname, '..', 'renderer', 'ajustes.html'));
}

ipcMain.on('ui:ajustes', abrirAjustes);

ipcMain.handle('ajustes:leer', () => {
  const config = ajustes.leer();
  return { ...config, efectivo: temaEfectivo(config) };
});

ipcMain.handle('ajustes:guardar', (_event, parche) => {
  const config = ajustes.guardar(parche);
  aplicarFondo();
  difundirAjustes();
  return { ...config, efectivo: temaEfectivo(config) };
});

// Con el ajuste en 'sistema' el esquema del SO puede cambiar con la app abierta.
// La interfaz se adapta sola —el CSS sigue a prefers-color-scheme—, pero el
// fondo de la ventana lo fija el main y hay que refrescarlo.
nativeTheme.on('updated', () => {
  if (ajustes.leer().tema === 'sistema') aplicarFondo();
});

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
// Actúan sobre la ventana que envía el mensaje: los ajustes también son una
// ventana sin marco y necesitan los mismos asideros.
ipcMain.handle('ui:tam', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  return w && !w.isDestroyed() ? w.getContentSize() : [0, 0];
});
ipcMain.on('ui:tam', (event, ancho, alto) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (w && !w.isDestroyed()) w.setContentSize(Math.round(ancho), Math.round(alto));
});

// Las dos ventanas comparten preload, así que minimizar y cerrar actúan sobre
// la que envía el mensaje y no sobre la principal por defecto.
ipcMain.on('ui:minimizar', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.on('ui:cerrar', (event) => BrowserWindow.fromWebContents(event.sender)?.close());

ipcMain.handle('transcribe', async (_event, wav) => {
  try {
    const config = ajustes.leer();
    const { text: crudo, language, palabras } = await engine.transcribe(Buffer.from(wav), {
      idioma: config.idioma,
    });
    return {
      text: text.formatear(crudo, palabras, {
        formato: config.formato,
        pausaParrafo: config.pausaParrafo,
      }),
      language,
    };
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
