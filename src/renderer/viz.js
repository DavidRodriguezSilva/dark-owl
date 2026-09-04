'use strict';

/**
 * Medidor de nivel de la fila de mandos. Dibuja barras simétricas alimentadas
 * por el nivel real del micrófono — el worklet ya entrega las muestras, así que
 * fingir la animación costaría lo mismo y diría menos.
 */
const Viz = {
  cv: null,
  ctx: null,
  ancho: 0,
  alto: 0,

  montar(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const ajustar = () => this.medir();
    new ResizeObserver(ajustar).observe(canvas);
    ajustar();
  },

  // El canvas se escala al ratio de pantalla o las barras salen borrosas.
  medir() {
    const r = this.cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.ancho = Math.max(1, Math.round(r.width));
    this.alto = Math.max(1, Math.round(r.height));
    this.cv.width = this.ancho * dpr;
    this.cv.height = this.alto * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  /**
   * @param {number[]} niveles 0..1, el más reciente al final
   * @param {'inicial'|'grabando'|'pausado'} estado
   */
  pintar(niveles, estado) {
    const { ctx, ancho: w, alto: h } = this;
    if (!ctx) return;

    const grueso = 3;
    const hueco = 2;
    const paso = grueso + hueco;
    const n = Math.max(1, Math.floor((w + hueco) / paso));
    const medio = h / 2;
    const tope = h / 2 - 1;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle =
      estado === 'grabando' ? '#f0483c' : estado === 'pausado' ? '#5c6480' : '#2b3040';

    // Las barras entran por la derecha: la más reciente queda pegada al borde.
    for (let i = 0; i < n; i++) {
      const v = niveles[niveles.length - n + i];
      // En reposo queda una línea base viva, no un canvas vacío.
      const alto = Math.max(2, (v || 0) * tope * 2);
      const x = i * paso;
      ctx.beginPath();
      ctx.roundRect(x, medio - alto / 2, grueso, alto, grueso / 2);
      ctx.fill();
    }
  },
};
