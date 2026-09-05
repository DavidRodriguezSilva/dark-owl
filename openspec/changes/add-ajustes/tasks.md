## 1. Fichero de ajustes en el main

- [x] 1.1 Crear `src/main/ajustes.js`: valores por defecto (`{ version: 1,
      tema: 'sistema' }`), ruta en `app.getPath('userData')`, y `leer()` que
      tolere fichero ausente, ilegible o que no parsea devolviendo los valores
      por defecto (D4).
- [x] 1.2 Validación por campo en la carga: cada valor que no esté entre los
      admitidos se sustituye por su defecto, conservando el resto de campos
      válidos del fichero.
- [x] 1.3 `guardar(parche)`: fusiona sobre lo vigente, valida, escribe a
      `ajustes.json.part` y renombra encima (D2). Devuelve el estado
      resultante.
- [x] 1.4 Prueba en Node de `ajustes.js` sin Electron por medio, con los tres
      casos que importan: fichero ausente, fichero que no parsea y fichero con
      un valor no admitido. Es lógica pura y no necesita la app abierta.

## 2. Canales IPC y superficie del renderer

- [x] 2.1 `src/main/main.js`: manejadores `ajustes:leer` y `ajustes:guardar`
      con la forma declarada en `design.md`.
- [x] 2.2 Resolver el tema efectivo con `nativeTheme.shouldUseDarkColors` y
      emitir `ajustes:cambiado` desde `nativeTheme.on('updated')` cuando el
      ajuste vigente sea `sistema` (D6).
- [x] 2.3 `backgroundColor` de la `BrowserWindow` derivado del tema efectivo,
      en vez del `#0d0e13` fijo de hoy, para que el tema claro no arranque con
      un destello oscuro (D7).
- [x] 2.4 `src/preload/preload.js`: añadir `api.ajustes` con `leer`, `guardar`
      y `onCambio`, éste último devolviendo su función de baja como ya hace
      `onEngineStatus`.

## 3. Paleta en dos esquemas

- [x] 3.1 `src/renderer/app.css`: paleta única con `light-dark(claro, oscuro)`
      y el tema por `color-scheme` (D7, reescrito durante la implementación:
      el patrón de sobreescritura producía destello al arrancar y duplicaba la
      paleta clara). Los dos `#fff` sueltos pasan a `--sobre-rec`.
- [x] 3.2 Comprobar el contraste de los botones sólidos, el punto de estado
      (ámbar/verde/rojo) y el `textarea` en esquema claro. Están calibrados
      contra fondo oscuro y son los candidatos a quedar ilegibles.
- [x] 3.3 `src/renderer/viz.js`: quitar `#f0483c`, `#5c6480` y `#3b4256`. No
      valía leer la variable CSS —el valor calculado de una propiedad
      personalizada no resuelve `light-dark()`—, así que `.viz` declara su
      `color` por `data-estado` y el canvas lee `getComputedStyle(cv).color`.
      Cacheado, porque `pintar` corre en cada fotograma.

## 4. Ventana de ajustes

- [x] 4.1 `src/renderer/index.html`: símbolo SVG del engranaje y reordenar la
      fila de mandos a `contador · medidor · grabar · pausar · detener ·
      engranaje` (D8).
- [x] 4.2 Comprobar la fila reordenada al ancho mínimo (360 px): que el
      medidor encoja y no desborde ni empuje los botones fuera.
- [x] 4.3 `src/renderer/ajustes.html` + `src/renderer/ajustes-ui.js`: ventana
      sin marco con su barra de título y su botón de cerrar, reutilizando la
      hoja de estilos y la paleta de la principal.
- [x] 4.4 `src/main/main.js`: `ui:ajustes` abre la ventana de ajustes o enfoca
      la existente si ya está abierta (D5). Cerrarla no puede cerrar la app —
      revisar que `window-all-closed` sigue haciendo lo correcto.
- [x] 4.5 Aplicar el tema en ambas ventanas antes de la primera pintada y
      difundir `ajustes:cambiado` a todas.

## 5. Verificación

- [x] 5.1 `node --check` sobre los `.js` tocados y la prueba de 1.4 en verde.
- [x] 5.2 `pnpm run smoke` y `pnpm run smoke:motor` sin regresiones: el ciclo
      de grabación no lo toca este change, pero `desplegar()` sí, y el smoke
      comprueba que el panel se despliega con el texto.
- [x] 5.3 Cubierto por `pnpm run smoke:ajustes` (nuevo, 9/9), que corre contra
      el proceso main real. Verificado además a ojo con capturas de las dos
      ventanas en los dos esquemas, y de la tira al ancho mínimo.
- [x] 5.4 Ventana única, cerrar los ajustes no cierra la app: en
      `smoke:ajustes`. Que no se altere una grabación en curso queda para 5.6:
      necesita voz real.
- [x] 5.5 Roto a mano en tres formas —texto que no es JSON, valor no admitido
      y JSON truncado— y `pnpm start` arrancó limpio en los tres casos.
- [ ] 5.6 Manual del propietario: en Windows, que *seguir al sistema* responda
      al esquema del sistema, y que abrir los ajustes con una grabación en
      curso no la interrumpa. Bajo WSLg el esquema del sistema resuelve a
      claro, así que el camino de *seguir al sistema* sí quedó ejercitado
      aquí, pero no contra Windows.
