## 1. El ajuste

- [x] 1.1 `src/main/ajustes.js`: admitir `valida(valor)` por campo además de
      la tabla `admitidos`, sin romper el campo `tema` que ya la usa.
- [x] 1.2 Añadir el campo `microfono`, con defecto `{ id: '', etiqueta: '' }` y
      una validación que exija esa forma —dos cadenas— y rechace cualquier
      otra cosa.
- [x] 1.3 Ampliar `scripts/prueba-ajustes.js`: forma inesperada (un número
      donde va un objeto), objeto con campos de más, id no textual. Es el
      escenario nuevo de la capacidad `configuracion`.

## 2. Listar y elegir

- [x] 2.1 `src/renderer/ajustes-ui.js`: enumerar entradas de audio, pintarlas
      con el activo marcado y la opción «El que diga el sistema» primero.
      Etiqueta vacía → nombre de reserva, nunca una fila en blanco (D2).
- [x] 2.2 Guardar `{ id, etiqueta }` al elegir (D4). No persistir `groupId`
      bajo ningún concepto: cambia entre ventanas (D3).
- [x] 2.3 Botón de recargar, más `devicechange` para refrescar solo (D6).
- [x] 2.4 Sección «Entrada» en `src/renderer/ajustes.html` y sus estilos.

## 3. Grabar con el dispositivo elegido

- [x] 3.1 `src/renderer/recorder.js`: aceptar el dispositivo y pasarlo como
      `deviceId: { exact }`. `exact` y no `ideal`, a propósito: sólo `exact`
      falla de forma detectable cuando el dispositivo no está (D5).
- [x] 3.2 Una única función de resolución, compartida por los ajustes y la
      grabación (D4): id guardado → misma etiqueta → primero de la lista. Al
      caer al primero **no** se borra la preferencia, para que el dispositivo
      readopte solo al volver.
- [x] 3.3 Capturar `OverconstrainedError` —cabe una desconexión entre resolver
      y abrir—, reintentar con el sustituto y **devolver el aviso** para que la
      UI lo enseñe; nunca sustituir en silencio (D5).
- [x] 3.4 `src/renderer/app.js`: enseñar ese aviso donde ya se avisa de que no
      se oyó nada.

## 4. Probar el micrófono

- [x] 4.1 Botón de probar: abre el dispositivo elegido, mide nivel y lo cierra
      solo pasados unos segundos (D7).
- [x] 4.2 `pagehide` libera el dispositivo al cerrar la ventana. Es cinturón y
      tirantes: destruir el renderer ya suelta el stream por sí solo, pero el
      manejador cubre también una recarga de la página.
- [x] 4.3 Reutilizar el cálculo de nivel y el dibujo que ya existen; no
      introducir una segunda forma de medir el sonido.

## 5. Verificación

- [x] 5.1 `node --check` de los `.js` tocados y `pnpm run prueba:ajustes` en
      verde con los casos nuevos.
- [x] 5.2 `pnpm run smoke` y `pnpm run smoke:motor` sin regresiones —
      `recorder.js` cambia y es el corazón del smoke.
- [x] 5.3 Ampliar `pnpm run smoke:ajustes`: que la lista se pinte con al menos
      una entrada, que elegir una la guarde en disco con id y etiqueta, que un
      id inventado acabe grabando con el primero de la lista **y con aviso**, y
      que ese caso **no borre** la preferencia guardada.
- [x] 5.4 Prueba en Node de la resolución (id → etiqueta → primero), que es
      lógica pura y donde están los cuatro caminos que importan.
- [x] 5.5 Probar el micrófono con una grabación en curso: comprobado en
      `smoke:ajustes`, las dos capturas conviven. Era una suposición y ahora
      es un hecho medido.
- [x] 5.6 **Omitida a petición del propietario.** Queda por tanto sin
      verificar contra hardware real: cambiar entre dos micrófonos y
      desenchufar el elegido sólo se ha ejercitado con un identificador
      inventado, no con dispositivos de verdad. Si alguna vez falla ahí, éste
      es el camino que nadie recorrió.
