#!/usr/bin/env node
'use strict';

/**
 * Prepara el engine offline: compila whisper.cpp desde fuente y descarga el modelo.
 *
 * Compilamos nosotros a propósito — los binarios sueltos de whisper.cpp/Electron
 * no vienen firmados y SmartScreen/antivirus los marcan como amenaza.
 *
 *   node scripts/setup-whisper.js [--cuda] [--model small] [--src <ruta>]
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { spawnSync } = require('node:child_process');

const REPO = 'https://github.com/ggml-org/whisper.cpp.git';
const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

const ROOT = path.resolve(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');
const BIN = path.join(VENDOR, 'bin');
const MODELS = path.join(VENDOR, 'models');
const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? '.exe' : '';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const MODEL = opt('model', 'small');
const CUDA = flag('cuda');
// Por defecto reutilizamos un clon hermano en ../whisper.cpp; si no existe, lo creamos.
const SRC = path.resolve(opt('src', path.join(ROOT, '..', 'whisper.cpp')));

const log = (...a) => console.log('›', ...a);

function run(cmd, args, cwd = ROOT) {
  log(cmd, args.join(' '));
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} falló con código ${r.status}`);
}

function has(cmd) {
  const probe = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return probe.status === 0;
}

/** Descarga siguiendo redirects, a un .part que se renombra al terminar. */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const part = `${dest}.part`;
    const file = fs.createWriteStream(part);

    https
      .get(url, { headers: { 'User-Agent': 'whisper-app-setup' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.rmSync(part, { force: true });
          return resolve(download(res.headers.location, dest));
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.rmSync(part, { force: true });
          return reject(new Error(`HTTP ${res.statusCode} en ${url}`));
        }

        const total = Number(res.headers['content-length'] || 0);
        let seen = 0;
        res.on('data', (chunk) => {
          seen += chunk.length;
          if (total) {
            process.stdout.write(`\r  ${((seen / total) * 100).toFixed(1)}%   `);
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            process.stdout.write('\r');
            fs.renameSync(part, dest);
            resolve();
          });
        });
      })
      .on('error', (err) => {
        file.close();
        fs.rmSync(part, { force: true });
        reject(err);
      });
  });
}

function checkPrereqs() {
  const missing = ['git', 'cmake'].filter((c) => !has(c));
  if (missing.length) {
    console.error(`\nFaltan herramientas: ${missing.join(', ')}`);
    console.error('  Debian/Ubuntu: sudo apt install -y git cmake build-essential');
    console.error('  Windows:       winget install Kitware.CMake Git.Git\n');
    process.exit(1);
  }
}

function fetchSource() {
  if (fs.existsSync(path.join(SRC, 'CMakeLists.txt'))) {
    log(`fuente en ${SRC}`);
    return;
  }
  log(`clonando whisper.cpp en ${SRC}`);
  run('git', ['clone', '--depth', '1', REPO, SRC], path.dirname(SRC));
}

function build() {
  const buildDir = path.join(SRC, 'build');
  const cfg = [
    '-B', buildDir,
    '-S', SRC,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DWHISPER_BUILD_TESTS=OFF',
    '-DWHISPER_BUILD_EXAMPLES=ON',
    `-DCMAKE_INSTALL_PREFIX=${VENDOR}`,
    // Sin esto los ejecutables instalados resuelven sus .so por RPATH absoluto
    // al directorio de build: se rompen si ese directorio se mueve o se borra,
    // y quedan inservibles al empaquetar.
    '-DCMAKE_INSTALL_RPATH=$ORIGIN/../lib',
    '-DCMAKE_SKIP_INSTALL_RPATH=OFF',
  ];
  if (CUDA) cfg.push('-DGGML_CUDA=ON');

  run('cmake', cfg, SRC);
  run('cmake', ['--build', buildDir, '--config', 'Release', '-j', String(os.cpus().length)], SRC);
  run('cmake', ['--install', buildDir, '--config', 'Release'], SRC);

  if (!fs.existsSync(path.join(BIN, `whisper-cli${EXE}`))) {
    throw new Error(`cmake --install no dejó whisper-cli en ${BIN}`);
  }

  // El install trae de paso cabeceras y ficheros de packaging que la app no usa.
  for (const junk of ['include', path.join('lib', 'cmake'), path.join('lib', 'pkgconfig'), 'share']) {
    fs.rmSync(path.join(VENDOR, junk), { recursive: true, force: true });
  }
  log('engine instalado en vendor/bin + vendor/lib');
}

async function fetchModel() {
  fs.mkdirSync(MODELS, { recursive: true });
  const name = `ggml-${MODEL}.bin`;
  const dest = path.join(MODELS, name);

  if (fs.existsSync(dest)) {
    log(`modelo ya presente: ${name}`);
    return;
  }
  log(`descargando ${name} (~488 MB para small)`);
  await download(`${HF}/${name}`, dest);
}

function smoke() {
  const cli = path.join(BIN, `whisper-cli${EXE}`);
  const r = spawnSync(cli, ['--help'], { encoding: 'utf8' });
  if (r.status !== 0 && r.status !== 1) throw new Error('whisper-cli no arranca');

  // El engine tiene que ser autocontenido: si alguna .so sigue apuntando al
  // árbol de fuentes, la app se rompe en cuanto ese directorio desaparezca.
  if (process.platform === 'linux' && has('ldd')) {
    const out = spawnSync('ldd', [cli], { encoding: 'utf8' }).stdout || '';
    const fugas = out
      .split('\n')
      .filter((l) => /libggml|libwhisper/.test(l) && !l.includes(VENDOR));
    if (fugas.length) {
      throw new Error(`librerías fuera de vendor/:\n${fugas.join('\n')}`);
    }
  }
  log('whisper-cli responde y es autocontenido');
}

(async () => {
  checkPrereqs();
  fetchSource();
  build();
  await fetchModel();
  smoke();
  log(`listo — engine en vendor/bin, modelo ${MODEL} en vendor/models`);
})().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
