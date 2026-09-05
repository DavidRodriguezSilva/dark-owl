'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const VERSION = 1;

// Un ajuste inválido nunca puede impedir que la app abra, así que cada campo
// declara sus valores admitidos y su defecto aquí. La validación de la carga
// se deriva de esta tabla y no de una lista repetida en otro sitio.
const CAMPOS = {
  tema: { admitidos: ['sistema', 'claro', 'oscuro'], defecto: 'sistema' },
};

function porDefecto() {
  const salida = { version: VERSION };
  for (const [clave, campo] of Object.entries(CAMPOS)) salida[clave] = campo.defecto;
  return salida;
}

function fichero() {
  return path.join(app.getPath('userData'), 'ajustes.json');
}

/**
 * Deja sólo campos conocidos con valores admitidos; el resto toma su defecto.
 * Los campos que no conocemos se descartan en vez de arrastrarse: si un día
 * hubo un ajuste y se retiró, su valor no debe sobrevivir en disco.
 */
function validar(crudo) {
  const salida = porDefecto();
  if (!crudo || typeof crudo !== 'object') return salida;
  for (const [clave, campo] of Object.entries(CAMPOS)) {
    if (campo.admitidos.includes(crudo[clave])) salida[clave] = crudo[clave];
  }
  return salida;
}

/**
 * Un fichero ausente, ilegible o que no parsea equivale a no tener fichero.
 *
 * La ruta es un parámetro con defecto y no una constante para que la lógica se
 * pueda probar en Node sin Electron por medio: `app.getPath` sólo existe con la
 * aplicación arrancada.
 */
function leer(ruta = fichero()) {
  try {
    return validar(JSON.parse(fs.readFileSync(ruta, 'utf8')));
  } catch {
    return porDefecto();
  }
}

/**
 * Fusiona el parche sobre lo vigente y escribe. Se escribe a `.part` y se
 * renombra encima: un corte a media escritura no puede dejar en disco un
 * fichero truncado que la carga siguiente acepte como válido.
 */
function guardar(parche, ruta = fichero()) {
  const siguiente = validar({ ...leer(ruta), ...(parche || {}) });
  const destino = ruta;
  const temporal = `${destino}.part`;
  try {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(temporal, `${JSON.stringify(siguiente, null, 2)}\n`);
    fs.renameSync(temporal, destino);
  } catch (err) {
    // Si no se puede escribir, la sesión en curso sigue con el valor nuevo;
    // sólo se pierde la persistencia.
    console.error('no se pudieron guardar los ajustes', err);
  }
  return siguiente;
}

module.exports = { leer, guardar, porDefecto, validar, VERSION, CAMPOS };
