'use strict';

/**
 * Convierte un archivo de audio en el mismo WAV que produce una grabación.
 *
 * Lo decodifica el propio Chromium (mp3, m4a/aac, ogg/opus, wav, flac, webm):
 * sin ffmpeg y sin pasar por el main, que no tiene decodificador. Antes de
 * gastar memoria se comprueban los límites — un archivo de una hora
 * decodificado ocupa cientos de MB para acabar rechazado.
 *
 * Este fichero se carga con <script> en el renderer y además exporta su parte
 * pura para probarla desde Node.
 */

const ARCHIVO_TASA = 16000;
const MAX_MS_ARCHIVO = 20 * 60 * 1000;
// 20 minutos de WAV sin comprimir a calidad CD (44,1 kHz, estéreo, 16 bit)
// ocupan ~212 MB. Más que esto ya no es un audio de 20 minutos.
const MAX_BYTES_ARCHIVO = 250 * 1024 * 1024;

/** Aviso para la UI si el archivo excede algún límite, o '' si cabe. */
function excesoArchivo({ bytes, ms }) {
  if (bytes != null && bytes > MAX_BYTES_ARCHIVO) return 'el archivo pasa de 250 MB';
  if (ms != null && Number.isFinite(ms) && ms > MAX_MS_ARCHIVO) return 'el audio pasa de 20 minutos';
  return '';
}

/** Media de canales: whisper trabaja en mono. */
function mezclarMono(canales) {
  if (canales.length === 1) return canales[0];
  const n = canales[0].length;
  const mono = new Float32Array(n);
  for (const c of canales) {
    for (let i = 0; i < n; i++) mono[i] += c[i];
  }
  for (let i = 0; i < n; i++) mono[i] /= canales.length;
  return mono;
}

/**
 * Duración leyendo sólo la cabecera, sin decodificar. NaN si el contenedor no
 * la declara (pasa con algunos webm y ogg) o si el navegador no lo reconoce.
 */
function duracionMs(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const fin = (ms) => {
      URL.revokeObjectURL(url);
      audio.removeAttribute('src');
      resolve(ms);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => fin(audio.duration * 1000);
    audio.onerror = () => fin(NaN);
    audio.src = url;
  });
}

/**
 * @param {File} file
 * @returns {Promise<{wav: ArrayBuffer, ms: number} | {aviso: string}>}
 */
async function leerArchivo(file) {
  let aviso = excesoArchivo({ bytes: file.size });
  if (aviso) return { aviso };

  aviso = excesoArchivo({ ms: await duracionMs(file) });
  if (aviso) return { aviso };

  // decodeAudioData remuestrea a la tasa del contexto: pedirlo a 16 kHz deja
  // el audio ya como lo quiere whisper.
  const ctx = new AudioContext({ sampleRate: ARCHIVO_TASA });
  let buffer;
  try {
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    return { aviso: 'formato de audio no admitido' };
  } finally {
    ctx.close().catch(() => { /* da igual */ });
  }

  // Respaldo para los contenedores que no declaran la duración.
  const ms = buffer.duration * 1000;
  aviso = excesoArchivo({ ms });
  if (aviso) return { aviso };

  const canales = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) canales.push(buffer.getChannelData(i));
  return { wav: codificarWav(mezclarMono(canales), ARCHIVO_TASA), ms };
}

if (typeof module !== 'undefined') {
  module.exports = { excesoArchivo, mezclarMono, MAX_MS_ARCHIVO, MAX_BYTES_ARCHIVO };
}
