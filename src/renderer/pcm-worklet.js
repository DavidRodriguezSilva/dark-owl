// Saca PCM crudo del grafo de audio y lo manda al hilo principal en trozos
// Float32Array. Es todo lo que hace: nada de análisis ni de buffering.
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const canal = inputs[0] && inputs[0][0];
    if (canal && canal.length) this.port.postMessage(canal.slice(0));
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
