## 1. Identidad en el código

- [x] 1.1 `package.json`: `name` → `dark-owl`, `productName` → `Dark Owl`
      (raíz y `build`), `build.appId` → `forest.dark.owl`. Revisar que
      `build.win.artifactName` siga derivando el nombre del instalador de
      `${productName}` y no lo lleve escrito.
- [x] 1.2 `src/main/main.js`: `title` de la `BrowserWindow` → `Dark Owl`.
- [x] 1.3 `src/renderer/index.html`: `<title>` → `Dark Owl` y
      `<span class="marca">` → la marca nueva. Comprobar que el ancho de la
      barra sigue cuadrando con `ANCHO_MINIMO` (360 px) sin desbordar los
      botones de minimizar y cerrar.

## 2. Icono

- [x] 2.1 Redibujar el búho en `scripts/icono.js`, sin tocar la maquinaria de
      captura, reescalado ni empaquetado del `.ico`. Se dibuja en **SVG
      inline** y no con divs: una silueta con penachos no sale de componer
      rectángulos con `border-radius`. Sigue siendo HTML, sin librerías.
- [x] 2.2 Regenerar con `pnpm run icono` y verificar el `.ico` parseándolo:
      7 entradas, todas PNG, y que las medidas declaradas en cada entrada
      coincidan con las dimensiones reales del IHDR. → 7/7 correctas,
      80 068 bytes.
- [x] 2.3 Mirar el resultado a 16 y 32 px y confirmar el criterio de D3 —dos
      ojos redondos sobre una silueta oscura, distinguibles—. Cumple. Se
      corrigió el pico, que apuntaba hacia arriba.

## 3. Documentación y contexto

- [x] 3.1 `README.md`: encabezado, el `● WHISPER` del diagrama de la tira, y
      una nota nueva sobre la familia DarkForest.
- [x] 3.2 `docs/windows.md`: rutas de clonado y nombre del instalador,
      asumiendo ya el repositorio renombrado. Se añade además el aviso de
      desinstalar «Whisper App» antes de instalar (D1).
- [x] 3.3 Crear `openspec/project.md` con el contexto completo del proyecto.
- [x] 3.4 Condensar `openspec/config.yaml`: resumen del producto y
      `rules`/`operations`, remitiendo a `project.md` para el detalle.
- [x] 3.5 Barrido final del nombre viejo. Sólo quedan, a propósito: la nota
      histórica de `docs/windows.md` y las referencias al **motor**. Se
      corrigieron de paso el `User-Agent` de `setup-whisper.js`
      (`whisper-app-setup` → `dark-owl-setup`) y una mención en
      `docs/referencia-whisperpress.md`.

## 4. Verificación

- [x] 4.1 `node --check` sobre los `.js` modificados. En verde.
- [x] 4.2 `pnpm start`: la ventana abre con el título y la marca nuevos y el
      log de arranque sale limpio, sin errores de GPU.
- [x] 4.3 `pnpm run smoke` (8/8) y `pnpm run smoke:motor` (7/7) en verde.

      **Corrección**: la nota original decía que `smoke:motor` ejercitaba el
      `userData` nuevo. Es falso. Al invocar `electron <script>` en vez de
      `electron .`, Electron no adopta el nombre del `package.json` y usa
      `~/.config/Electron`, así que los smokes nunca han tocado el `userData`
      de la app. El cambio de carpeta se verificó con la app de verdad, en 4.5.
- [x] 4.4 `pnpm run pack`: ejecutable `dark-owl`, `assets/icon.png` e
      `icon.ico` dentro del `app.asar`, y el engine y el modelo en
      `resources/vendor/`. 783 MB, como declara el README.
- [x] 4.5 Confirmar el cambio de `userData` (D2) con la app real: `electron .`
      crea `~/.config/Dark Owl`. La carpeta vieja queda con un `engine.pid`
      obsoleto, que es exactamente el peor caso previsto y es inofensivo.

## 5. Manual del propietario (fuera del código)

- [x] 5.1 Renombrar el repositorio en GitHub y reapuntar el remoto local.
      Hecho: `origin` → `https://github.com/DavidRodriguezSilva/dark-owl.git`.
- [ ] 5.2 Renombrar el directorio local `~/projects/whisper-app` →
      `~/projects/dark-owl`. Queda al propietario: renombrarlo desde dentro
      rompería el directorio de trabajo de la sesión en curso.
- [ ] 5.3 Desinstalar "Whisper App" en Windows antes de instalar Dark Owl —
      el `appId` nuevo no actualiza la instalación vieja, la pone al lado
      (D1). Requiere Windows, no comprobable desde el entorno de desarrollo.
- [ ] 5.4 Verificar el ciclo completo con **voz real** en la aplicación
      renombrada. Requiere hablarle a un micrófono; el smoke sólo confirma
      que la puerta de voz descarta el silencio.
