## 1. Identidad en el código

- [ ] 1.1 `package.json`: `name` → `dark-owl`, `productName` → `Dark Owl`
      (raíz y `build`), `build.appId` → `forest.dark.owl`. Revisar que
      `build.win.artifactName` siga derivando el nombre del instalador de
      `${productName}` y no lo lleve escrito.
- [ ] 1.2 `src/main/main.js`: `title` de la `BrowserWindow` → `Dark Owl`.
- [ ] 1.3 `src/renderer/index.html`: `<title>` → `Dark Owl` y
      `<span class="marca">` → la marca nueva. Comprobar que el ancho de la
      barra sigue cuadrando con `ANCHO_MINIMO` (360 px) sin desbordar los
      botones de minimizar y cerrar.

## 2. Icono

- [ ] 2.1 Redibujar el búho en `scripts/icono.js`, sin tocar la maquinaria de
      captura, reescalado ni empaquetado del `.ico`.
- [ ] 2.2 Regenerar con `pnpm run icono` y verificar el `.ico` parseándolo:
      7 entradas, todas PNG, y que las medidas declaradas en cada entrada
      coincidan con las dimensiones reales del IHDR.
- [ ] 2.3 Mirar el resultado a 16 y 32 px y confirmar el criterio de D3 —dos
      ojos redondos sobre una silueta oscura, distinguibles—. Si no
      sobrevive a la reducción, simplificar la silueta y repetir.

## 3. Documentación y contexto

- [ ] 3.1 `README.md`: encabezado y el `● WHISPER` del diagrama de la tira.
- [ ] 3.2 `docs/windows.md`: rutas de clonado (líneas 15-16) y nombre del
      instalador en la línea 59, asumiendo ya el repositorio renombrado.
- [ ] 3.3 Crear `openspec/project.md` con el contexto completo del proyecto
      (propósito, stack, decisiones técnicas ya tomadas, layout,
      convenciones), siguiendo la estructura del de `dark-echo`.
- [ ] 3.4 Condensar `openspec/config.yaml`: dejar el resumen del producto y
      las `rules`/`operations`, y remitir a `project.md` para el detalle.
- [ ] 3.5 Barrido final: `grep -ri` del nombre viejo en el repositorio
      —excluyendo `node_modules/`— y confirmar que lo único que queda son
      las referencias al **motor**, que no se tocan.

## 4. Verificación

- [ ] 4.1 `node --check` sobre los `.js` modificados.
- [ ] 4.2 `pnpm start`: la ventana abre con el título y la marca nuevos, y el
      ciclo completo (grabar → detener → texto) sigue funcionando con voz
      real.
- [ ] 4.3 `pnpm run smoke` y `pnpm run smoke:motor` en verde. El segundo
      importa especialmente: escribe y lee `engine.pid` en el `userData`
      nuevo, que es la ruta que cambia con el renombrado (D2).
- [ ] 4.4 `pnpm run pack` y confirmar que el empaquetado sale con el nombre y
      el icono nuevos.

## 5. Manual del propietario (fuera del código)

- [ ] 5.1 Renombrar el repositorio en GitHub y reapuntar el remoto local
      (`git remote set-url`).
- [ ] 5.2 Renombrar el directorio local `~/projects/whisper-app` →
      `~/projects/dark-owl`.
- [ ] 5.3 Desinstalar "Whisper App" en Windows antes de instalar Dark Owl —
      el `appId` nuevo no actualiza la instalación vieja, la pone al lado
      (D1).
