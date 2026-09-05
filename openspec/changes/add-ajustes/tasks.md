## 1. Fichero de ajustes en el main

- [ ] 1.1 Crear `src/main/ajustes.js`: valores por defecto (`{ version: 1,
      tema: 'sistema' }`), ruta en `app.getPath('userData')`, y `leer()` que
      tolere fichero ausente, ilegible o que no parsea devolviendo los valores
      por defecto (D4).
- [ ] 1.2 Validación por campo en la carga: cada valor que no esté entre los
      admitidos se sustituye por su defecto, conservando el resto de campos
      válidos del fichero.
- [ ] 1.3 `guardar(parche)`: fusiona sobre lo vigente, valida, escribe a
      `ajustes.json.part` y renombra encima (D2). Devuelve el estado
      resultante.
- [ ] 1.4 Prueba en Node de `ajustes.js` sin Electron por medio, con los tres
      casos que importan: fichero ausente, fichero que no parsea y fichero con
      un valor no admitido. Es lógica pura y no necesita la app abierta.

## 2. Canales IPC y superficie del renderer

- [ ] 2.1 `src/main/main.js`: manejadores `ajustes:leer` y `ajustes:guardar`
      con la forma declarada en `design.md`.
- [ ] 2.2 Resolver el tema efectivo con `nativeTheme.shouldUseDarkColors` y
      emitir `ajustes:cambiado` desde `nativeTheme.on('updated')` cuando el
      ajuste vigente sea `sistema` (D6).
- [ ] 2.3 `backgroundColor` de la `BrowserWindow` derivado del tema efectivo,
      en vez del `#0d0e13` fijo de hoy, para que el tema claro no arranque con
      un destello oscuro (D7).
- [ ] 2.4 `src/preload/preload.js`: añadir `api.ajustes` con `leer`, `guardar`
      y `onCambio`, éste último devolviendo su función de baja como ya hace
      `onEngineStatus`.

## 3. Paleta en dos esquemas

- [ ] 3.1 `src/renderer/app.css`: dejar el juego oscuro en `:root` como base y
      añadir `[data-tema="claro"]` redefiniendo las mismas variables (D7).
      Revisar uno a uno los sitios donde hoy hay un color escrito fuera de las
      variables.
- [ ] 3.2 Comprobar el contraste de los botones sólidos, el punto de estado
      (ámbar/verde/rojo) y el `textarea` en esquema claro. Están calibrados
      contra fondo oscuro y son los candidatos a quedar ilegibles.
- [ ] 3.3 `src/renderer/viz.js`: quitar `#f0483c`, `#5c6480` y `#3b4256` del
      código y leerlos con `getComputedStyle` del elemento raíz, releyéndolos
      cuando cambie el tema.

## 4. Panel de ajustes

- [ ] 4.1 `src/renderer/index.html`: símbolo SVG del engranaje, botón en la
      barra de título junto a minimizar y cerrar, y la sección
      `<section id="ajustes" hidden>` con el selector de esquema.
- [ ] 4.2 CSS del panel. Ojo con el mismo tropiezo que ya tuvo el panel de
      texto: un selector de clase gana al `[hidden]` del navegador, así que
      hace falta apagarlo explícitamente.
- [ ] 4.3 `src/renderer/app.js`: estado de ajustes abiertos, exclusión mutua
      con el panel de texto, y cambiar la condición de `desplegar()` de "hay
      texto" a "hay algo que enseñar" (D5).
- [ ] 4.4 Leer los ajustes al arrancar y aplicar el tema antes de la primera
      pintada; suscribirse a `onCambio` para el caso `sistema`.

## 5. Verificación

- [ ] 5.1 `node --check` sobre los `.js` tocados y la prueba de 1.4 en verde.
- [ ] 5.2 `pnpm run smoke` y `pnpm run smoke:motor` sin regresiones: el ciclo
      de grabación no lo toca este change, pero `desplegar()` sí, y el smoke
      comprueba que el panel se despliega con el texto.
- [ ] 5.3 Con la app corriendo: cambiar de esquema y ver que la interfaz
      entera cambia, **incluido el medidor mientras graba**. Cerrar y reabrir
      para confirmar que el ajuste sobrevive.
- [ ] 5.4 Con la app corriendo: abrir los ajustes con texto a la vista,
      cerrarlos y confirmar que el texto sigue ahí; y que sin texto, cerrarlos
      vuelve a plegar la ventana a la tira.
- [ ] 5.5 Romper `ajustes.json` a mano —un valor no admitido y luego texto que
      no sea JSON— y confirmar que la app arranca igual en ambos casos.
- [ ] 5.6 Manual del propietario: verificar en Windows que *seguir al sistema*
      responde al esquema de Windows. Bajo WSLg `nativeTheme` puede no
      reportarlo, y eso no sería un fallo del código (D7, riesgos).
