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
  _estado: null,
  _color: null,
  _ultimos: [],

  montar(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    // Redimensionar el canvas borra su contenido, así que hay que repintar: sin
    // esto, un medidor que no está en un bucle de animación se queda en blanco
    // tras el primer ajuste de tamaño.
    const ajustar = () => {
      this.medir();
      this.pintar(this._ultimos, this._estado || 'inicial');
    };
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
   * El color no está escrito aquí: se declara en app.css sobre `.viz` según el
   * estado y se lee ya resuelto, para que el medidor siga al tema sin que este
   * código sepa nada de esquemas de color. Se cachea porque `pintar` corre en
   * cada fotograma y `getComputedStyle` fuerza un recálculo de estilo.
   */
  color(estado) {
    this.cv.dataset.estado = estado;
    return getComputedStyle(this.cv).color;
  },

  /** El tema cambió: el color cacheado ya no vale. */
  refrescar() {
    this._color = null;
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

    this._ultimos = niveles;
    ctx.clearRect(0, 0, w, h);
    if (estado !== this._estado) {
      this._estado = estado;
      this._color = null;
    }
    ctx.fillStyle = this._color || (this._color = this.color(estado));

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
