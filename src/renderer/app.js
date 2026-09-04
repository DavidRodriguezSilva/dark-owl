'use strict';

const el = (id) => document.getElementById(id);
const dot = el('engine');

/** Refleja en la UI si el engine (binario + modelo) está disponible. */
async function refreshEngine() {
  const s = await window.api.engineStatus();

  if (s.ready) {
    dot.className = 'dot dot--ok';
    dot.title = 'engine listo · small';
  } else {
    const falta = [!s.hasCli && 'binario', !s.hasModel && 'modelo'].filter(Boolean).join(' + ');
    dot.className = 'dot dot--off';
    dot.title = `falta ${falta} — corre npm run setup`;
  }

  // El resto de controles se habilita cuando exista la capa de grabación.
  el('record').disabled = !s.ready;
}

refreshEngine();
