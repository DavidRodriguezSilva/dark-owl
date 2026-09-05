# Change: Elegir el micrófono de entrada

## Why

La app graba con el que el sistema tenga por defecto y no hay forma ni de
verlo ni de cambiarlo. Cuando ese dispositivo es el equivocado —unos cascos
que ya no están, la cámara web en vez del micro— la app **parece rota**: la
puerta de voz responde «no se oyó nada» y no hay manera de distinguir si el
micrófono está mal elegido o si simplemente se habló bajo.

Hace falta poder ver qué dispositivos hay, elegir uno, y comprobar que ese
capta sonido antes de fiarse de él.

## What Changes

- **Ajuste nuevo `microfono`**, guardado como `{ id, etiqueta }` y no sólo
  como identificador — el porqué está en `design.md`, decisión D4. Su valor
  por defecto es vacío: el que diga el sistema.
- **Sección «Entrada» en la ventana de ajustes**: lista de dispositivos con el
  que está activo marcado, un botón de **recargar** que vuelve a explorar, y
  un botón de **probar** que abre el micrófono unos segundos y enseña el nivel
  real para confirmar que capta.
- **`src/renderer/recorder.js` pasa el dispositivo elegido** a
  `getUserMedia`. Si ya no existe, cae al de por defecto **avisando**, nunca
  en silencio (D5).
- **La lista se refresca sola** al enchufar o quitar un dispositivo
  (`devicechange`), además del botón (D6).
- **`src/main/ajustes.js` gana validación por función** además de por lista de
  valores admitidos: un identificador de dispositivo es texto libre y no cabe
  en la tabla de `admitidos` actual.

## Impact

- Affected specs: `microfono` (nueva), `configuracion` (un campo más).
- Affected code: `src/main/ajustes.js`, `src/renderer/ajustes.html`,
  `src/renderer/ajustes-ui.js`, `src/renderer/recorder.js`,
  `src/renderer/app.js`, `src/renderer/app.css`, `scripts/prueba-ajustes.js`.
- Sin dependencias nuevas.

## Fuera de alcance

- **Elegir dispositivo de salida.** La app no reproduce nada.
- **Ganancia, supresión de ruido o cancelación de eco configurables.** Hoy van
  fijas en `recorder.js` y funcionan; abrirlas sería invitar a desajustarlas
  sin forma de medir el efecto.
- **Recordar un dispositivo distinto por perfil o por sesión.** Un ajuste, uno.
- **Reajustar los umbrales de la puerta de voz** al cambiar de micrófono.
  Están calibrados contra habla real y moverlos exige repetir el barrido; si
  un micrófono concreto los deja cortos, es otro change con su medición.
