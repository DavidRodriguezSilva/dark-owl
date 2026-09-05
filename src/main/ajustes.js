'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const VERSION = 1;

// Un ajuste inválido nunca puede impedir que la app abra, así que cada campo
// declara aquí su defecto y cómo se valida. La validación de la carga se deriva
// de esta tabla y no de una lista repetida en otro sitio.
//
// Un campo se valida por `admitidos` cuando su conjunto de valores es cerrado,
// o por `valida()` cuando es texto libre con una forma esperada — un
// identificador de dispositivo no cabe en una lista.
const CAMPOS = {
  tema: { admitidos: ['sistema', 'claro', 'oscuro'], defecto: 'sistema' },
  microfono: {
    defecto: { id: '', etiqueta: '' },
    // Se guarda la etiqueta además del id: el id sirve para abrir el
    // dispositivo, la etiqueta para nombrarlo cuando falta y para reconocerlo
    // si Chromium le cambia el número.
    valida: (v) => Boolean(v) && typeof v.id === 'string' && typeof v.etiqueta === 'string',
  },
  // 'auto' detecta el idioma en cada clip. Con audios cortos la detección falla
  // y whisper acaba traduciendo o inventando, así que el defecto es concreto.
  idioma: { admitidos: ['auto', 'es', 'en', 'pt', 'fr', 'de', 'it'], defecto: 'es' },
  formato: { admitidos: ['corrido', 'frases', 'parrafos'], defecto: 'parrafos' },
  pausaParrafo: {
    defecto: 600,
    // Entero en milisegundos. El rango acota lo que tiene sentido: por debajo
    // de 200 ms se parte por separaciones normales entre palabras, y por encima
    // de 3 s no queda pausa que detectar.
    valida: (v) => Number.isInteger(v) && v >= 200 && v <= 3000,
  },
};

function esValido(campo, valor) {
  if (campo.admitidos) return campo.admitidos.includes(valor);
  return campo.valida(valor);
}

function porDefecto() {
  const salida = { version: VERSION };
  // Copia por campo: los defectos que son objeto se compartirían entre
  // llamadas, y quien mutara uno se lo cambiaría a todos.
  for (const [clave, campo] of Object.entries(CAMPOS)) {
    salida[clave] = typeof campo.defecto === 'object' ? { ...campo.defecto } : campo.defecto;
  }
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
    if (esValido(campo, crudo[clave])) {
      // Sólo los campos declarados, y de los objetos sólo sus claves conocidas:
      // un fichero editado a mano no debe poder colar propiedades de más.
      salida[clave] =
        typeof campo.defecto === 'object'
          ? Object.fromEntries(Object.keys(campo.defecto).map((k) => [k, crudo[clave][k]]))
          : crudo[clave];
    }
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
