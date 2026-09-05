'use strict';

/**
 * Esquema de color, compartido por las dos ventanas.
 *
 * El CSS hace casi todo el trabajo: los colores se declaran con
 * `light-dark(claro, oscuro)` y `color-scheme: light dark`, así que sin ningún
 * atributo la interfaz ya sigue al esquema del sistema —que es el ajuste por
 * defecto— desde el primer pintado y sin destello. Aquí sólo se marca la
 * elección explícita del usuario.
 */
const Tema = {
  aplicar(tema) {
    const raiz = document.documentElement;
    if (tema === 'claro' || tema === 'oscuro') raiz.dataset.tema = tema;
    else delete raiz.dataset.tema;
  },

  /**
   * Lee los ajustes, aplica el tema y se queda escuchando los cambios que
   * lleguen desde la otra ventana.
   * @param {(config: object) => void} [alCambiar]
   */
  async iniciar(alCambiar) {
    const config = await window.api.ajustes.leer();
    this.aplicar(config.tema);
    window.api.ajustes.onCambio((nuevo) => {
      this.aplicar(nuevo.tema);
      if (alCambiar) alCambiar(nuevo);
    });
    return config;
  },
};
