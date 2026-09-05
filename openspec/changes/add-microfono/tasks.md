## 1. El ajuste

- [ ] 1.1 `src/main/ajustes.js`: admitir `valida(valor)` por campo además de
      la tabla `admitidos`, sin romper el campo `tema` que ya la usa.
- [ ] 1.2 Añadir el campo `microfono`, con defecto `{ id: '', etiqueta: '' }` y
      una validación que exija esa forma —dos cadenas— y rechace cualquier
      otra cosa.
- [ ] 1.3 Ampliar `scripts/prueba-ajustes.js`: forma inesperada (un número
      donde va un objeto), objeto con campos de más, id no textual. Es el
      escenario nuevo de la capacidad `configuracion`.

## 2. Listar y elegir

- [ ] 2.1 `src/renderer/ajustes-ui.js`: enumerar entradas de audio, pintarlas
      con el activo marcado y la opción «El que diga el sistema» primero.
      Etiqueta vacía → nombre de reserva, nunca una fila en blanco (D2).
- [ ] 2.2 Guardar `{ id, etiqueta }` al elegir (D4). No persistir `groupId`
      bajo ningún concepto: cambia entre ventanas (D3).
- [ ] 2.3 Botón de recargar, más `devicechange` para refrescar solo (D6).
- [ ] 2.4 Sección «Entrada» en `src/renderer/ajustes.html` y sus estilos.

## 3. Grabar con el dispositivo elegido

- [ ] 3.1 `src/renderer/recorder.js`: aceptar el dispositivo y pasarlo como
      `deviceId: { exact }`. `exact` y no `ideal`, a propósito: sólo `exact`
      falla de forma detectable cuando el dispositivo no está (D5).
- [ ] 3.2 Resolver el dispositivo antes de abrir: si el id guardado no está
      pero hay uno con la misma etiqueta, adoptarlo y actualizar el ajuste.
- [ ] 3.3 Capturar `OverconstrainedError`, reintentar con el del sistema y
      **devolver el aviso** para que la UI lo enseñe; nunca sustituir en
      silencio (D5).
- [ ] 3.4 `src/renderer/app.js`: enseñar ese aviso donde ya se avisa de que no
      se oyó nada.

## 4. Probar el micrófono

- [ ] 4.1 Botón de probar: abre el dispositivo elegido, mide nivel y lo cierra
      solo pasados unos segundos (D7).
- [ ] 4.2 Cerrar la ventana de ajustes con la prueba en curso libera el
      dispositivo. Es el escenario que más fácil se queda colgado.
- [ ] 4.3 Reutilizar el cálculo de nivel y el dibujo que ya existen; no
      introducir una segunda forma de medir el sonido.

## 5. Verificación

- [ ] 5.1 `node --check` de los `.js` tocados y `pnpm run prueba:ajustes` en
      verde con los casos nuevos.
- [ ] 5.2 `pnpm run smoke` y `pnpm run smoke:motor` sin regresiones —
      `recorder.js` cambia y es el corazón del smoke.
- [ ] 5.3 Ampliar `pnpm run smoke:ajustes`: que la lista se pinte con al menos
      una entrada, que elegir una la guarde en disco con id y etiqueta, y que
      un id inventado en `ajustes.json` acabe grabando con el del sistema y
      con aviso.
- [ ] 5.4 Comprobar que probar el micrófono con una grabación en curso no
      rompe ninguna de las dos capturas (D7, riesgos).
- [ ] 5.5 Manual del propietario, en Windows: cambiar entre dos micrófonos de
      verdad y confirmar que graba del elegido; desenchufar el elegido y
      confirmar que avisa en vez de grabar del otro en silencio. Aquí sólo hay
      un dispositivo real y ese camino no se puede ejercitar.
