'use strict';

const el = (id) => document.getElementById(id);
const seg = el('tema');
const selector = el('mic');
const nota = el('micNota');
const btnProbar = el('probar');

// La prueba se cierra sola: tener el micrófono abierto mientras los ajustes
// están a la vista encendería el indicador del sistema por nada.
const PRUEBA_MS = 8000;

let config = { tema: 'sistema', microfono: { id: '', etiqueta: '' } };
let cuadro = 0;
let reloj = 0;

/* ---- tema ---- */

function marcarTema(valor) {
  for (const b of seg.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.valor === valor));
  }
}

seg.addEventListener('click', async (e) => {
  const boton = e.target.closest('button[data-valor]');
  if (!boton) return;
  // Se marca antes de que el guardado responda: el CSS ya aplicó el tema y
  // esperar al disco dejaría el botón sin marcar durante ese rato.
  marcarTema(boton.dataset.valor);
  Tema.aplicar(boton.dataset.valor);
  config = await window.api.ajustes.guardar({ tema: boton.dataset.valor });
  marcarTema(config.tema);
});

/* ---- micrófono ---- */

async function listar() {
  const dispositivos = await Recorder.dispositivos();
  const elegido = resolver(config.microfono, dispositivos);

  selector.textContent = '';
  const sistema = new Option('El que diga el sistema', '');
  selector.append(sistema);
  dispositivos.forEach((d, i) => selector.append(new Option(nombrar(d, i), d.deviceId)));

  selector.value = elegido.id;
  // Si el guardado ya no está, el navegador dejaría el select sin selección.
  if (selector.selectedIndex < 0) selector.selectedIndex = 0;

  if (!dispositivos.length) {
    nota.textContent = '⚠ no se detectó ningún micrófono.';
  } else if (elegido.sustituido && elegido.falta) {
    // La preferencia guardada no se toca: si el dispositivo vuelve, se readopta.
    nota.textContent = `⚠ «${elegido.falta}» no está conectado; se usará ${selector.options[selector.selectedIndex].text}.`;
  } else if (elegido.adoptado) {
    // El identificador cambió pero es el mismo aparato: se reancla en silencio.
    config = await window.api.ajustes.guardar({ microfono: { id: elegido.id, etiqueta: elegido.etiqueta } });
    nota.textContent = 'Prueba el micrófono para ver si capta antes de fiarte de él.';
  } else {
    nota.textContent = 'Prueba el micrófono para ver si capta antes de fiarte de él.';
  }
}

selector.addEventListener('change', async () => {
  const opcion = selector.options[selector.selectedIndex];
  const microfono = opcion.value ? { id: opcion.value, etiqueta: opcion.text } : { id: '', etiqueta: '' };
  config = await window.api.ajustes.guardar({ microfono });
  await listar();
});

el('recargar').addEventListener('click', listar);

// El botón es la vía fiable; esto es el extra: bajo WSLg la entrada es una
// fuente RDP y no hay garantía de que los cambios de hardware lleguen.
navigator.mediaDevices.addEventListener('devicechange', listar);

/* ---- probar ---- */

function pintarNivel() {
  Viz.pintar(Recorder.niveles, Recorder.activo ? 'grabando' : 'inicial');
  cuadro = requestAnimationFrame(pintarNivel);
}

async function pararPrueba() {
  clearTimeout(reloj);
  cancelAnimationFrame(cuadro);
  cuadro = 0;
  await Recorder.cancelar();
  btnProbar.setAttribute('aria-pressed', 'false');
  btnProbar.textContent = 'Probar';
  Viz.pintar([], 'inicial');
}

btnProbar.addEventListener('click', async () => {
  if (Recorder.activo) return pararPrueba();

  try {
    await Recorder.iniciar(config.microfono);
  } catch (err) {
    nota.textContent = `⚠ no se pudo abrir el micrófono: ${err.message}`;
    return;
  }
  if (Recorder.aviso) nota.textContent = `⚠ ${Recorder.aviso}`;

  btnProbar.setAttribute('aria-pressed', 'true');
  btnProbar.textContent = 'Parar';
  cuadro = requestAnimationFrame(pintarNivel);
  reloj = setTimeout(pararPrueba, PRUEBA_MS);
});

// Cerrar la ventana con la prueba en curso dejaría el micrófono abierto.
window.addEventListener('pagehide', () => Recorder.cancelar());

/* ---- arranque ---- */

Viz.montar(el('nivel'));
// Línea base desde el principio: un canvas vacío parece un hueco roto.
Viz.pintar([], 'inicial');
Tema.iniciar((nuevo) => {
  config = nuevo;
  marcarTema(nuevo.tema);
  Viz.refrescar();
}).then(async (inicial) => {
  config = inicial;
  marcarTema(inicial.tema);
  await listar();
});

el('min').addEventListener('click', () => window.api.ventana.minimizar());
el('close').addEventListener('click', () => window.api.ventana.cerrar());
