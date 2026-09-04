'use strict';

const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { app } = require('electron');
const paths = require('./paths');

// 'auto' detecta el idioma en cada clip. Con audios muy cortos la detección
// puede fallar y whisper acaba traduciendo o alucinando; fijarlo a 'es' es más
// fiable si sólo se dicta en español.
const LANGUAGE = 'auto';

// Arrancar el servidor puede tardar lo que tarde en cargar el modelo desde disco.
const START_TIMEOUT_MS = 120000;

/**
 * whisper-server mantenido caliente: el modelo queda cargado en RAM y cada
 * transcripción es una petición HTTP local. Con clips cortos el tiempo de carga
 * del modelo domina, así que recargarlo por transcripción no es opción.
 */
class Engine extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.port = 0;
    this.state = 'stopped'; // stopped | starting | ready | error
    this.detail = '';
    this.startSeq = 0;
  }

  status() {
    const s = paths.engineStatus();
    return {
      hasCli: s.hasCli,
      hasModel: s.hasModel,
      installed: s.ready,
      state: this.state,
      detail: this.detail,
      ready: this.state === 'ready',
    };
  }

  _set(state, detail = '') {
    this.state = state;
    this.detail = detail;
    this.emit('status', this.status());
  }

  // Más hilos no acelera y compite con la UI.
  _threads() {
    return Math.max(2, Math.min(8, Math.floor(os.cpus().length / 2)));
  }

  // Si a la app la matan a señal en vez de cerrarla, whisper-server sobrevive
  // con el modelo entero en memoria. Se anota su PID para poder recogerlo en el
  // siguiente arranque.
  _ficheroPid() {
    return path.join(app.getPath('userData'), 'engine.pid');
  }

  _anotarPid(pid) {
    try {
      fs.mkdirSync(path.dirname(this._ficheroPid()), { recursive: true });
      fs.writeFileSync(this._ficheroPid(), String(pid));
    } catch {
      /* si no se puede anotar, sólo se pierde la recogida */
    }
  }

  _olvidarPid() {
    try {
      fs.rmSync(this._ficheroPid(), { force: true });
    } catch {
      /* da igual */
    }
  }

  /**
   * Mata un servidor huérfano de una ejecución anterior. Sólo si se puede
   * confirmar por su línea de órdenes que es nuestro: los PID se reutilizan, y
   * matar a ciegas por número sería matar a un tercero.
   */
  _recogerHuerfano() {
    let pid;
    try {
      pid = Number(fs.readFileSync(this._ficheroPid(), 'utf8').trim());
    } catch {
      return;
    }
    this._olvidarPid();
    if (!pid || pid === process.pid) return;

    try {
      const linea = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      if (!linea.includes(paths.binary('whisper-server'))) return;
      process.kill(pid);
      console.log(`recogido un whisper-server huérfano (pid ${pid})`);
    } catch {
      /* ya no existe, o no es Linux y no se puede comprobar */
    }
  }

  _freePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const { port } = srv.address();
        srv.close(() => resolve(port));
      });
      srv.on('error', reject);
    });
  }

  async start() {
    const seq = ++this.startSeq;
    this.stop();

    const exe = paths.binary('whisper-server');
    const model = paths.model();
    if (!fs.existsSync(exe)) {
      this._set('stopped', 'sin-engine');
      return false;
    }
    if (!fs.existsSync(model)) {
      this._set('stopped', 'sin-modelo');
      return false;
    }

    this._set('starting');
    this.port = await this._freePort();
    if (seq !== this.startSeq) return false;

    const args = [
      '-m', model,
      '--host', '127.0.0.1',
      '--port', String(this.port),
      '-t', String(this._threads()),
      '-l', LANGUAGE,
      // whisper-server decodifica greedy por defecto (-bs -1 -bo 2) y transcribe
      // peor que whisper-cli. Igualamos su beam search.
      '-bs', '5', '-bo', '5',
    ];

    this._recogerHuerfano();
    const proc = spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true });
    this.proc = proc;
    this._anotarPid(proc.pid);

    let stderrTail = '';
    proc.stderr.on('data', (d) => { stderrTail = (stderrTail + d).slice(-2000); });
    proc.stdout.on('data', () => { /* drenar para que no se llene el buffer */ });
    proc.on('exit', (code) => {
      if (this.proc !== proc) return;
      this.proc = null;
      if (this.state !== 'stopped') this._set('error', `el servidor salió (${code})\n${stderrTail.slice(-300)}`);
    });
    proc.on('error', (e) => {
      if (this.proc !== proc) return;
      this.proc = null;
      this._set('error', String(e.message));
    });

    // El socket sólo abre después de cargar el modelo, así que sondeamos hasta
    // que acepte conexiones.
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (seq !== this.startSeq || this.proc !== proc) return false;
      try {
        await fetch(`http://127.0.0.1:${this.port}/`);
        this._set('ready');
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    this._set('error', 'el servidor no arrancó a tiempo');
    this.stop();
    return false;
  }

  stop() {
    if (this.proc) {
      const p = this.proc;
      this.proc = null;
      try { p.kill(); } catch { /* ya estaba muerto */ }
      // Sólo se olvida el PID si el proceso era nuestro y lo acabamos de matar.
      // start() llama a stop() antes de arrancar, y borrarlo siempre dejaría a
      // _recogerHuerfano() sin nada que leer.
      this._olvidarPid();
    }
    if (this.state !== 'stopped') this._set('stopped');
  }

  /** @param {Buffer|Uint8Array} wav WAV PCM 16 kHz mono. */
  async transcribe(wav) {
    if (this.state !== 'ready' && !(await this.start())) {
      throw new Error('el engine no está listo');
    }

    const body = new FormData();
    body.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
    body.append('response_format', 'verbose_json');
    body.append('temperature', '0.0');
    body.append('temperature_inc', '0.2');

    const res = await fetch(`http://127.0.0.1:${this.port}/inference`, { method: 'POST', body });
    if (!res.ok) throw new Error(`inferencia HTTP ${res.status}`);

    const json = await res.json();
    if (json.error) throw new Error(String(json.error));
    return { text: String(json.text || ''), language: json.language || LANGUAGE };
  }
}

module.exports = new Engine();
