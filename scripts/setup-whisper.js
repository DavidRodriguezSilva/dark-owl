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

/**
 * Sitios donde buscar una herramienta si no está en el PATH. En Windows es lo
 * habitual: winget instala CMake pero la sesión de terminal ya abierta captura
 * el PATH al arrancar, así que no lo ve hasta reabrirla. Y VS Build Tools trae
 * su propio cmake, visible sólo dentro de una Developer PowerShell.
 */
function candidatos(cmd) {
  if (!IS_WIN) return [];
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';

  if (cmd === 'cmake') {
    const deVisualStudio = [];
    for (const raiz of [pf, pf86]) {
      for (const anio of ['2022', '2019']) {
        for (const edicion of ['BuildTools', 'Community', 'Professional', 'Enterprise']) {
          deVisualStudio.push(
            path.join(raiz, 'Microsoft Visual Studio', anio, edicion,
              'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe'),
          );
        }
      }
    }
    return [
      path.join(pf, 'CMake', 'bin', 'cmake.exe'),
      path.join(pf86, 'CMake', 'bin', 'cmake.exe'),
      local && path.join(local, 'Microsoft', 'WinGet', 'Links', 'cmake.exe'),
      ...deVisualStudio,
    ].filter(Boolean);
  }

  if (cmd === 'git') {
    return [
      path.join(pf, 'Git', 'cmd', 'git.exe'),
      path.join(pf86, 'Git', 'cmd', 'git.exe'),
      local && path.join(local, 'Microsoft', 'WinGet', 'Links', 'git.exe'),
    ].filter(Boolean);
  }

  return [];
}

/** Ruta absoluta de una herramienta, o null. Primero el PATH, luego los sitios conocidos. */
function resolver(cmd) {
  const busca = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  if (busca.status === 0) {
    const primera = String(busca.stdout || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    if (primera) return primera;
  }
  return candidatos(cmd).find((ruta) => fs.existsSync(ruta)) || null;
}

function has(cmd) {
  return resolver(cmd) !== null;
}

// Rutas absolutas de las herramientas, resueltas una vez al arrancar.
const herramienta = {};

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
  const faltan = [];
  for (const cmd of ['git', 'cmake']) {
    const ruta = resolver(cmd);
    if (ruta) {
      herramienta[cmd] = ruta;
      log(`${cmd}: ${ruta}`);
    } else {
      faltan.push(cmd);
    }
  }
  if (!faltan.length) return;

  console.error(`\nNo encuentro: ${faltan.join(', ')}`);
  console.error('\nBuscado en el PATH y en:');
  for (const cmd of faltan) {
    for (const ruta of candidatos(cmd)) console.error(`  ${ruta}`);
  }
  if (IS_WIN) {
    console.error('\n  winget install Kitware.CMake Git.Git');
    console.error('  Y REABRE la terminal: el PATH se captura al arrancarla,');
    console.error('  así que una sesión ya abierta no ve lo recién instalado.');
  } else {
    console.error('\n  sudo apt install -y git cmake build-essential');
  }
  console.error('');
  process.exit(1);
}

function fetchSource() {
  if (fs.existsSync(path.join(SRC, 'CMakeLists.txt'))) {
    log(`fuente en ${SRC}`);
    return;
  }
  log(`clonando whisper.cpp en ${SRC}`);
  run(herramienta.git, ['clone', '--depth', '1', REPO, SRC], path.dirname(SRC));
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

  run(herramienta.cmake, cfg, SRC);
  run(herramienta.cmake, ['--build', buildDir, '--config', 'Release', '-j', String(os.cpus().length)], SRC);
  run(herramienta.cmake, ['--install', buildDir, '--config', 'Release'], SRC);

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
