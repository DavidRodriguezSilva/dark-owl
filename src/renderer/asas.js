'use strict';

/**
 * Asideros de redimensionado propios, compartidos por las dos ventanas. Una
 * ventana sin marco depende del gestor de ventanas para poder agarrarse por el
 * borde, y bajo WSLg eso no está garantizado.
 *
 * Se engancha solo a todo `.asa` que haya en la página al cargar.
 */
(() => {
  const asa = (elemento, ejes) => {
    elemento.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      const [ancho0, alto0] = await window.api.ventana.tam();
      const x0 = e.screenX;
      const y0 = e.screenY;
      // Capturar el puntero: si no, al salirse de la ventana se pierde el arrastre.
      elemento.setPointerCapture(e.pointerId);

      const mover = (ev) => {
        window.api.ventana.redimensionar(
          ejes.includes('x') ? ancho0 + (ev.screenX - x0) : ancho0,
          ejes.includes('y') ? alto0 + (ev.screenY - y0) : alto0,
        );
      };
      const soltar = () => {
        elemento.removeEventListener('pointermove', mover);
        elemento.removeEventListener('pointerup', soltar);
      };
      elemento.addEventListener('pointermove', mover);
      elemento.addEventListener('pointerup', soltar);
    });
  };

  for (const e of document.querySelectorAll('.asa')) asa(e, e.dataset.ejes);
})();
