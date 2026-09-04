'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? '.exe' : '';

/** Raíz donde viven el engine compilado y los modelos. */
function rootDir() {
  // En desarrollo se ancla en este fichero, no en app.getAppPath(): esa ruta
  // depende de cómo se invoque a electron y apunta mal al lanzar un script
  // suelto. __dirname siempre es <repo>/src/main.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'vendor')
    : path.resolve(__dirname, '..', '..', 'vendor');
}

function binDir() {
  return path.join(rootDir(), 'bin');
}

function modelsDir() {
  return path.join(rootDir(), 'models');
}

/** Ruta al ejecutable de whisper.cpp (whisper-cli / whisper-server). */
function binary(name) {
  return path.join(binDir(), `${name}${EXE}`);
}

/** Ruta al modelo ggml (por defecto: small). */
function model(name = 'ggml-small.bin') {
  return path.join(modelsDir(), name);
}

/** Directorio de trabajo para WAVs temporales de la sesión. */
function scratchDir() {
  const dir = path.join(app.getPath('userData'), 'scratch');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** ¿Está el engine listo para transcribir? */
function engineStatus() {
  const cli = binary('whisper-cli');
  const mdl = model();
  return {
    cli,
    model: mdl,
    hasCli: fs.existsSync(cli),
    hasModel: fs.existsSync(mdl),
    get ready() {
      return this.hasCli && this.hasModel;
    },
  };
}

module.exports = { IS_WIN, rootDir, binDir, modelsDir, binary, model, scratchDir, engineStatus };
