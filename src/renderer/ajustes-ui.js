'use strict';

const seg = document.getElementById('tema');

function marcar(valor) {
  for (const b of seg.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.valor === valor));
  }
}

seg.addEventListener('click', async (e) => {
  const boton = e.target.closest('button[data-valor]');
  if (!boton) return;
  // Se marca antes de que el guardado responda: el CSS ya aplicó el tema y
  // esperar al disco dejaría el botón sin marcar durante ese rato.
  marcar(boton.dataset.valor);
  Tema.aplicar(boton.dataset.valor);
  const config = await window.api.ajustes.guardar({ tema: boton.dataset.valor });
  marcar(config.tema);
});

// El tema puede cambiar desde la otra ventana; el segmentado tiene que seguirlo.
Tema.iniciar((config) => marcar(config.tema)).then((config) => marcar(config.tema));

document.getElementById('min').addEventListener('click', () => window.api.ventana.minimizar());
document.getElementById('close').addEventListener('click', () => window.api.ventana.cerrar());
