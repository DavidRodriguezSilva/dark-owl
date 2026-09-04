'use strict';

const TASA = 16000; // whisper.cpp trabaja a 16 kHz mono; pedirlo aquí evita remuestrear.

/**
 * Captura de micrófono a PCM. No usa MediaRecorder: pide el AudioContext ya a
 * 16 kHz y saca las muestras crudas con un AudioWorklet, que es exactamente lo
 * que whisper.cpp consume una vez envuelto en una cabecera WAV.
 */
// Cuántas barras de nivel se conservan para el medidor.
const BARRAS = 64;
// Los mensajes del worklet llegan cada ~8 ms; agrupados a 70 ms el medidor se
// lee cómodo en vez de vibrar.
const MS_BARRA = 70;

const Recorder = {
  stream: null,
  ctx: null,
  chunks: [],
  niveles: [], // últimos valores para el medidor de la UI
  capturando: false, // false mientras está en pausa: los trozos se descartan
  msPrevios: 0, // tiempo acumulado en tramos anteriores a la última pausa
  inicioTramo: 0,

  get activo() {
    return this.ctx !== null;
  },

  get enPausa() {
    return this.activo && !this.capturando;
  },

  /** Milisegundos grabados, sin contar las pausas. */
  transcurrido() {
    return this.msPrevios + (this.capturando ? Date.now() - this.inicioTramo : 0);
  },

  async iniciar() {
    this.chunks = [];
    this.niveles = [];
    this.msPrevios = 0;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.ctx = new AudioContext({ sampleRate: TASA });
    await this.ctx.audioWorklet.addModule('pcm-worklet.js');

    const nodo = new AudioWorkletNode(this.ctx, 'pcm-capture');
    const acc = { suma: 0, n: 0, t: performance.now() };
    nodo.port.onmessage = (e) => {
      if (!this.capturando) return;
      const f32 = e.data;
      this.chunks.push(f32);

      for (let i = 0; i < f32.length; i++) acc.suma += f32[i] * f32[i];
      acc.n += f32.length;
      const ahora = performance.now();
      if (ahora - acc.t >= MS_BARRA && acc.n) {
        // x4.5 lleva el rango de voz normal a casi todo el alto de la barra.
        this.niveles.push(Math.min(1, Math.sqrt(acc.suma / acc.n) * 4.5));
        if (this.niveles.length > BARRAS) this.niveles.shift();
        acc.suma = 0;
        acc.n = 0;
        acc.t = ahora;
      }
    };
    // La salida del worklet no se conecta a destination: capturar sin monitorear,
    // o el usuario se oye a sí mismo con eco.
    this.ctx.createMediaStreamSource(this.stream).connect(nodo);

    this.capturando = true;
    this.inicioTramo = Date.now();
  },

  /** Pausa sin cerrar el contexto: reanudar es instantáneo y no repide permiso. */
  pausar() {
    if (!this.capturando) return;
    this.msPrevios = this.transcurrido();
    this.capturando = false;
  },

  reanudar() {
    if (!this.activo || this.capturando) return;
    this.inicioTramo = Date.now();
    this.capturando = true;
  },

  /** Cierra la captura y devuelve `{ wav, ms }`, o `null` si no hubo audio. */
  async detener() {
    if (!this.activo) return null;

    this.msPrevios = this.transcurrido();
    this.capturando = false;
    // Los mensajes del worklet en vuelo aún no han llegado; sin esta espera se
    // pierden las últimas sílabas.
    await new Promise((r) => setTimeout(r, 140));

    for (const pista of this.stream.getTracks()) pista.stop();
    try { await this.ctx.close(); } catch { /* ya estaba cerrado */ }
    this.stream = null;
    this.ctx = null;

    const total = this.chunks.reduce((a, c) => a + c.length, 0);
    const pcm = new Float32Array(total);
    let off = 0;
    for (const c of this.chunks) {
      pcm.set(c, off);
      off += c.length;
    }
    this.chunks = [];

    if (!total) return null;
    return { wav: codificarWav(pcm), ms: this.msPrevios, ...nivelVoz(pcm, TASA) };
  },

  /** Aborta sin producir audio (p. ej. si falla el permiso a mitad). */
  async cancelar() {
    if (!this.activo) return;
    this.capturando = false;
    if (this.stream) for (const pista of this.stream.getTracks()) pista.stop();
    try { await this.ctx.close(); } catch { /* da igual */ }
    this.stream = null;
    this.ctx = null;
    this.chunks = [];
  },
};

/** Envuelve las muestras en un WAV PCM 16-bit mono: cabecera RIFF de 44 bytes. */
function codificarWav(f32, tasa = TASA) {
  const buf = new ArrayBuffer(44 + f32.length * 2);
  const v = new DataView(buf);
  const txt = (off, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  txt(0, 'RIFF');
  v.setUint32(4, 36 + f32.length * 2, true);
  txt(8, 'WAVE');
  txt(12, 'fmt ');
  v.setUint32(16, 16, true); // tamaño del bloque fmt
  v.setUint16(20, 1, true); // PCM sin comprimir
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, tasa, true);
  v.setUint32(28, tasa * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // alineación de bloque
  v.setUint16(34, 16, true); // bits por muestra
  txt(36, 'data');
  v.setUint32(40, f32.length * 2, true);

  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}
