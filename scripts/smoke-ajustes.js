#!/usr/bin/env electron
'use strict';

/**
 * Ajustes, con el proceso main de verdad: la ventana propia, la persistencia en
 * disco y la difusión del tema entre ventanas.
 *
 *   pnpm run smoke:ajustes
 *
 * Comprueba lo que las pruebas de `ajustes.js` no ven, porque ahí no hay
 * ventanas: que el engranaje abre una sola ventana, que guardar llega al disco y
 * que el cambio alcanza a la otra ventana y al medidor, que pinta en canvas.
 */

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');

const ROOT = path.resolve(__dirname, '..');
// El main real: crea la ventana, registra los IPC y arranca el engine.
require(path.join(ROOT, 'src/main/main.js'));

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0;

function comprobar(nombre, ok, detalle) {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallos++;
}

function terminar() {
  console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo en orden');
  app.exit(fallos ? 1 : 0);
}

app.whenReady().then(async () => {
  try {
    await espera(2500);
    const principal = BrowserWindow.getAllWindows()[0];
    const js = (c) => principal.webContents.executeJavaScript(c);
    const ruta = path.join(app.getPath('userData'), 'ajustes.json');
    const habia = fs.existsSync(ruta) ? fs.readFileSync(ruta) : null;
    fs.rmSync(ruta, { force: true });

    comprobar('arranca con una sola ventana', BrowserWindow.getAllWindows().length === 1);

    await js(`document.getElementById('gear').click()`);
    await espera(1200);
    comprobar('el engranaje abre la ventana de ajustes', BrowserWindow.getAllWindows().length === 2);

    await js(`document.getElementById('gear').click()`);
    await espera(800);
    comprobar('pulsarlo otra vez no abre una segunda', BrowserWindow.getAllWindows().length === 2);

    // No se busca por índice: el orden de getAllWindows no está garantizado.
    const ajustes = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('ajustes.html'),
    );
    comprobar('la ventana nueva es la de ajustes', Boolean(ajustes));
    if (!ajustes) return terminar();
    const jsA = (c) => ajustes.webContents.executeJavaScript(c);

    // Se elige 'oscuro' y no 'claro' a propósito: sin fichero el tema es
    // 'sistema', y si el sistema ya resuelve a claro no habría cambio que medir.
    const colorAntes = await js(`Viz.color('inicial')`);
    await jsA(`document.querySelector('[data-valor="oscuro"]').click()`);
    await espera(900);

    comprobar(
      'guarda el tema en disco',
      fs.existsSync(ruta) && JSON.parse(fs.readFileSync(ruta, 'utf8')).tema === 'oscuro',
    );
    comprobar('la ventana de ajustes aplica el tema', (await jsA(`document.documentElement.dataset.tema`)) === 'oscuro');
    comprobar('la ventana principal recibe el cambio', (await js(`document.documentElement.dataset.tema`)) === 'oscuro');

    const colorDespues = await js(`Viz._color`);
    comprobar(
      'el medidor repinta con el color del tema nuevo',
      Boolean(colorDespues) && colorDespues !== colorAntes,
      `${colorAntes} → ${colorDespues}`,
    );

    // --- micrófono ---
    const opciones = await jsA(`Array.from(document.getElementById('mic').options).map(o => o.text)`);
    comprobar('la lista de micrófonos se pinta', opciones.length >= 1, opciones.join(' · '));
    comprobar('la primera opción es el del sistema', opciones[0] === 'El que diga el sistema');

    const reales = await jsA(`Array.from(document.getElementById('mic').options).slice(1).map(o => ({id: o.value, txt: o.text}))`);
    if (reales.length) {
      await jsA(`(() => { const s = document.getElementById('mic'); s.selectedIndex = 1; s.dispatchEvent(new Event('change')); })()`);
      await espera(700);
      const guardado = JSON.parse(fs.readFileSync(ruta, 'utf8')).microfono;
      comprobar(
        'elegir un micrófono lo guarda con id y etiqueta',
        guardado.id === reales[0].id && guardado.etiqueta === reales[0].txt,
        JSON.stringify(guardado),
      );
      comprobar('no se persiste el groupId', !('grupo' in guardado) && !('groupId' in guardado));
    } else {
      comprobar('hay al menos un micrófono para elegir', false, 'ninguno en este entorno');
    }

    // Un dispositivo que no existe: debe grabar igual, avisar, y NO borrar la
    // preferencia guardada — si el micrófono vuelve, se readopta.
    const inventado = { id: 'no-existe-jamas', etiqueta: 'Micrófono Fantasma' };
    fs.writeFileSync(ruta, JSON.stringify({ version: 1, tema: 'oscuro', microfono: inventado }, null, 2));
    const r = await js(`(async () => {
      await Recorder.iniciar({ id: 'no-existe-jamas', etiqueta: 'Micrófono Fantasma' });
      const aviso = Recorder.aviso;
      await Recorder.cancelar();
      return aviso;
    })()`);
    comprobar('un micrófono ausente avisa en vez de sustituir en silencio', Boolean(r), r || 'sin aviso');
    comprobar('el aviso nombra el dispositivo que falta', String(r).includes('Micrófono Fantasma'));
    comprobar(
      'caer al primero de la lista no borra la preferencia',
      JSON.parse(fs.readFileSync(ruta, 'utf8')).microfono.id === inventado.id,
    );

    // --- probar el micrófono ---
    fs.rmSync(ruta, { force: true });
    await jsA(`document.getElementById('probar').click()`);
    await espera(1200);
    comprobar('probar abre el micrófono', await jsA(`Recorder.activo`));
    comprobar('la prueba recoge nivel', (await jsA(`Recorder.niveles.length`)) > 0);

    // Dos capturas del mismo dispositivo a la vez: la de la tira y la de la
    // prueba. Chromium lo permite, pero conviene verlo y no suponerlo.
    await js(`document.getElementById('record').click()`);
    await espera(1200);
    comprobar(
      'grabar con la prueba abierta no rompe ninguna de las dos',
      (await js(`fase === 'grabando' && Recorder.chunks.length > 0`)) && (await jsA(`Recorder.activo`)),
    );
    await js(`Recorder.cancelar().then(() => { fase = 'inicial'; })`);

    await jsA(`document.getElementById('probar').click()`);
    await espera(600);
    comprobar('pulsar de nuevo cierra el micrófono de la prueba', !(await jsA(`Recorder.activo`)));

    ajustes.close();
    await espera(800);
    comprobar(
      'cerrar los ajustes no cierra la app',
      BrowserWindow.getAllWindows().length === 1 && !principal.isDestroyed(),
    );

    // Se deja el fichero como estaba: la prueba no debe cambiarle los ajustes
    // a quien la corre.
    if (habia) fs.writeFileSync(ruta, habia);
    else fs.rmSync(ruta, { force: true });

    terminar();
  } catch (err) {
    console.error('la prueba explotó:', err);
    app.exit(1);
  }
});
