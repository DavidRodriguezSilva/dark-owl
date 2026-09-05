'use strict';

// Por debajo de este umbral no vale la pena molestar al engine: es un clic, no voz.
const MIN_MS = 350;

// Proporción mínima del audio que tiene que sonar a voz para mandarlo al motor.
// Medido con nivel.js: habla real 0,65 · ruido de fondo 0,00 · ruido con un
// chasquido 0,05. Ver src/renderer/nivel.js para por qué hace falta este filtro.
const VOZ_MINIMA = 0.1;

const el = (id) => document.getElementById(id);
const dot = el('engine');
const timer = el('timer');
const salida = el('text');
const panel = el('panel');
const btn = {
  grabar: el('record'),
  pausar: el('pause'),
  detener: el('stop'),
  copiar: el('copy'),
  reprocesar: el('reprocess'),
  limpiar: el('clear'),
};

// Las fases 'abriendo' y 'cerrando' cubren los tramos asíncronos de abrir y
// cerrar el micrófono: sin ellas, un doble clic entra dos veces en el mismo
// manejador y deja un AudioContext huérfano o pisa una transcripción en curso.
// inicial | abriendo | grabando | pausado | cerrando | transcribiendo
let fase = 'inicial';
let engineListo = false;
let ultimoWav = null; // se conserva para poder reprocesar
let tick = 0;
let cuadro = 0;
// Copia local de los ajustes, refrescada cuando cambian desde la otra ventana.
let config = { microfono: { id: '', etiqueta: '' } };

function reloj(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function icono(boton, id) {
  boton.querySelector('use').setAttribute('href', `#${id}`);
}

function pintar() {
  const grabando = fase === 'grabando';
  const activo = grabando || fase === 'pausado';
  const ocupado = fase === 'transcribiendo' || fase === 'abriendo' || fase === 'cerrando';

  btn.grabar.disabled = !engineListo || activo || ocupado;
  btn.pausar.disabled = !activo;
  btn.detener.disabled = !activo;
  btn.copiar.disabled = !salida.value || ocupado;
  btn.reprocesar.disabled = !ultimoWav || activo || ocupado;
  btn.limpiar.disabled = ocupado;

  timer.classList.toggle('timer--live', activo);
  document.body.classList.toggle('is-busy', ocupado);

  icono(btn.pausar, fase === 'pausado' ? 'i-play' : 'i-pause');
  btn.pausar.title = btn.pausar.ariaLabel = fase === 'pausado' ? 'Reanudar' : 'Pausar';

  // Sólo el texto —o la espera de la transcripción, que enseña su aviso— abre el
  // panel. 'abriendo' y 'cerrando' también son fases ocupadas, pero no tienen
  // nada que enseñar: incluirlas hacía parpadear la ventana al pulsar grabar.
  desplegar(Boolean(salida.value) || fase === 'transcribiendo');
}

/** El panel de texto y la ventana crecen juntos: sin texto, sólo la fila. */
function desplegar(si) {
  if (panel.hidden === !si) return;
  panel.hidden = !si;
  window.api.ventana.desplegar(si);
}

function arrancarReloj() {
  clearInterval(tick);
  tick = setInterval(() => {
    timer.textContent = reloj(Recorder.transcurrido());
  }, 200);
}

function pararReloj() {
  clearInterval(tick);
  tick = 0;
}

// El medidor se repinta siempre: en reposo deja una línea base, y así no hay que
// arrancar y parar el bucle en cada transición.
function animar() {
  const estado = fase === 'grabando' || fase === 'pausado' ? fase : 'inicial';
  Viz.pintar(estado === 'inicial' ? [] : Recorder.niveles, estado);
  cuadro = requestAnimationFrame(animar);
}

async function transcribir(wav) {
  fase = 'transcribiendo';
  salida.value = '';
  salida.placeholder = 'transcribiendo…';
  pintar();

  const res = await window.api.transcribe(wav);

  fase = 'inicial';
  salida.placeholder = '…';
  if (res.error) salida.value = `⚠ ${res.error}`;
  else if (!res.text) salida.value = '⚠ no se entendió nada';
  else salida.value = res.text;
  pintar();
}

btn.grabar.addEventListener('click', async () => {
  if (fase !== 'inicial') return;
  fase = 'abriendo';
  pintar();

  try {
    await Recorder.iniciar(config.microfono);
  } catch (err) {
    fase = 'inicial';
    salida.value = `⚠ sin micrófono: ${err.message}`;
    await Recorder.cancelar();
    pintar();
    return;
  }
  // Si se acabó grabando de otro micrófono hay que decirlo ya, no al final: una
  // sustitución muda no se distingue de una mala transcripción.
  salida.value = Recorder.aviso ? `⚠ ${Recorder.aviso}` : '';
  ultimoWav = null;
  salida.value = '';
  timer.textContent = '00:00'; // el primer tick tarda 200 ms; sin esto se ve el tiempo anterior
  fase = 'grabando';
  arrancarReloj();
  pintar();
});

btn.pausar.addEventListener('click', () => {
  if (fase === 'grabando') {
    Recorder.pausar();
    fase = 'pausado';
  } else if (fase === 'pausado') {
    Recorder.reanudar();
    fase = 'grabando';
  }
  pintar();
});

btn.detener.addEventListener('click', async () => {
  if (fase !== 'grabando' && fase !== 'pausado') return;
  fase = 'cerrando';
  pararReloj();
  pintar();

  const captura = await Recorder.detener();
  timer.textContent = reloj(captura ? captura.ms : 0);

  if (!captura || captura.ms < MIN_MS) {
    fase = 'inicial';
    salida.value = captura ? '⚠ demasiado corto' : '';
    pintar();
    return;
  }
  // Se registra siempre, no sólo al descartar: es el dato con el que se ajusta
  // VOZ_MINIMA si alguna vez filtra de más o de menos.
  console.info(`nivel: voz=${captura.voz.toFixed(3)} rms=${captura.rms.toFixed(4)} pico=${captura.pico.toFixed(3)}`);
  if (captura.voz < VOZ_MINIMA) {
    fase = 'inicial';
    salida.value = '⚠ no se oyó nada';
    pintar();
    return;
  }
  ultimoWav = captura.wav;
  await transcribir(ultimoWav);
});

btn.copiar.addEventListener('click', async () => {
  await window.api.copiar(salida.value);
  // Confirmación sin texto: el icono se pone verde un instante.
  btn.copiar.classList.add('hecho');
  setTimeout(() => btn.copiar.classList.remove('hecho'), 900);
});

btn.reprocesar.addEventListener('click', () => {
  if (ultimoWav && fase === 'inicial') transcribir(ultimoWav);
});

btn.limpiar.addEventListener('click', () => {
  ultimoWav = null;
  salida.value = '';
  timer.textContent = '00:00';
  pintar();
});

el('min').addEventListener('click', () => window.api.ventana.minimizar());
el('close').addEventListener('click', () => window.api.ventana.cerrar());
el('gear').addEventListener('click', () => window.api.ventana.ajustes());

function estadoEngine(s) {
  engineListo = s.ready;
  if (s.ready) {
    dot.className = 'dot dot--ok';
    dot.title = 'engine listo · small';
  } else if (!s.installed) {
    dot.className = 'dot dot--off';
    const falta = [!s.hasCli && 'binario', !s.hasModel && 'modelo'].filter(Boolean).join(' + ');
    dot.title = `falta ${falta} — corre npm run setup`;
  } else if (s.state === 'error') {
    dot.className = 'dot dot--off';
    dot.title = s.detail || 'el engine falló';
  } else {
    dot.className = 'dot';
    dot.title = 'cargando el modelo…';
  }
  pintar();
}

Viz.montar(el('viz'));
// El medidor cachea su color: al cambiar el tema hay que invalidarlo.
Tema.iniciar((nuevo) => {
  config = nuevo;
  Viz.refrescar();
}).then((inicial) => {
  config = inicial;
});
cuadro = requestAnimationFrame(animar);
window.api.onEngineStatus(estadoEngine);
window.api.engineStatus().then(estadoEngine);
