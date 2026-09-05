'use strict';

/**
 * Resolución del dispositivo de entrada.
 *
 * Se separa del código que abre el micrófono porque es la parte con reglas y
 * sin efectos: así se puede probar en Node, sin navegador ni dispositivos.
 */

/** Nombre de reserva: la especificación permite devolver la etiqueta vacía. */
function nombrar(dispositivo, indice) {
  return dispositivo.label || `Micrófono ${indice + 1}`;
}

/**
 * Decide qué dispositivo usar, con una única regla compartida por los ajustes y
 * la grabación:
 *
 *   1. sin nada guardado          → el que diga el sistema
 *   2. el id guardado existe      → ése
 *   3. coincide la etiqueta       → ése, adoptando su id (Chromium rota los
 *                                    identificadores al borrar datos del sitio)
 *   4. ninguna de las anteriores  → el primero de la lista, avisando
 *
 * En el caso 4 **no** se toca la preferencia guardada: el dispositivo efectivo
 * cambia, la elección no. Así, volver a enchufar el micrófono lo readopta por
 * el caso 2 sin reconfigurar nada.
 *
 * @param {{id: string, etiqueta: string}} guardado
 * @param {MediaDeviceInfo[]} dispositivos sólo entradas de audio
 * @returns {{id: string, etiqueta: string, adoptado: boolean, sustituido: boolean, falta: string}}
 */
function resolver(guardado, dispositivos) {
  const nada = { id: '', etiqueta: '', adoptado: false, sustituido: false, falta: '' };
  const lista = Array.isArray(dispositivos) ? dispositivos : [];
  const id = (guardado && guardado.id) || '';
  const etiqueta = (guardado && guardado.etiqueta) || '';

  if (!id) return nada;

  const porId = lista.find((d) => d.deviceId === id);
  if (porId) return { id, etiqueta: porId.label || etiqueta, adoptado: false, sustituido: false, falta: '' };

  const porEtiqueta = etiqueta && lista.find((d) => d.label === etiqueta);
  if (porEtiqueta) {
    return { id: porEtiqueta.deviceId, etiqueta, adoptado: true, sustituido: false, falta: '' };
  }

  if (!lista.length) return { ...nada, sustituido: true, falta: etiqueta };
  return {
    id: lista[0].deviceId,
    etiqueta: nombrar(lista[0], 0),
    adoptado: false,
    sustituido: true,
    falta: etiqueta,
  };
}

// Doble exportación: el renderer lo carga como script y las pruebas como módulo.
if (typeof module !== 'undefined') module.exports = { resolver, nombrar };
