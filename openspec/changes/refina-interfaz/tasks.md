## 1. Generador de iconos

- [x] 1.1 `scripts/iconos.js`: baja `lucide-static` a un temporal con
      `npm pack` —sin instalarlo—, extrae los iconos declarados y compone el
      sprite (D1).
- [x] 1.2 Marcadores en `src/renderer/index.html` y `ajustes.html` para que el
      script reescriba sólo el bloque del sprite y nada más.
- [x] 1.3 Atribución a Lucide y su licencia ISC en el sprite generado y en el
      script.
- [x] 1.4 Entrada `iconos` en `package.json` y versión de Lucide fijada.

## 2. Iconografía

- [x] 2.1 Transporte con geometría de Lucide pero relleno: punto, `pause` y
      `square` (D2).
- [x] 2.2 Trazo para el resto: `copy`, `rotate-ccw`, `trash-2`, `minus`, `x`,
      `refresh-cw`, `settings-2`, `monitor`, `sun`, `moon`.
- [x] 2.3 Un solo grosor de trazo para todo el juego, en vez de los 2,2 / 2,3 /
      2,4 de hoy.

## 3. Tamaños

- [x] 3.1 Teclas 34 → 30 px, iconos 19 → 16, iconos de ventana 15 → 14 (D5).
- [x] 3.2 `ALTO_PLEGADO` de 96 a **82**, medido en la página y no estimado:
      1 + 30 de barra + 50 de fila + 1 de bordes. Ya antes sobraban 10 px de
      hueco muerto bajo los botones.
- [x] 3.3 Comprobar que la fila sigue entrando al ancho mínimo de 360 px.

## 4. Ventana de ajustes

- [x] 4.1 «Apariencia» en una línea: etiqueta *Tema* y tres iconos —monitor,
      sol, luna— con su etiqueta accesible, porque un icono sin texto necesita
      nombre para quien no lo ve.
- [x] 4.2 «Entrada» en dos líneas: lista y recargar arriba; probar y medidor
      abajo.
- [x] 4.3 Quitar las notas de ayuda; conservar el elemento de aviso, vacío y
      oculto hasta que haya algo que decir (D4).
- [x] 4.4 Estilos de la fila de opciones en los dos esquemas de color.
- [x] 4.5 Retirado el CSS que quedó muerto al reestructurar (`.grupo`,
      `.campo`, el segmentado de texto).
- [x] 4.6 **Fallo encontrado al mirarlo**: el medidor de la prueba salía vacío.
      `ResizeObserver` redimensiona el canvas, y eso lo borra, pero nadie
      repintaba: un medidor fuera de un bucle de animación se quedaba en
      blanco. `Viz` recuerda ahora lo último pintado y repinta al ajustar.

## 5. Icono de la aplicación

- [x] 5.1 Redibujar el búho en `scripts/icono.js` como **cabeza en trazo**, en
      el mismo idioma que la iconografía nueva: línea limpia, extremos
      redondeados, sin relleno salvo las pupilas.
- [x] 5.2 Hicieron falta **tres** variantes, no dos: a 32 px el trazo todavía
      se lee, a 24 y 16 no. Cabeza completa ≥40, ojos y pico a 32, sólo ojos
      por debajo. Y las tres se pintan **en fila**: apiladas ocupaban 1536 px,
      el gestor recortaba la ventana a los 1440 de la pantalla y la tercera se
      capturaba cortada sin que nada avisara. Añadida una comprobación del
      tamaño real para que no vuelva a pasar en silencio.
- [x] 5.3 Regenerar y verificar el `.ico`: 7 entradas, todas PNG, medidas
      declaradas iguales a las reales del IHDR.
- [x] 5.4 Mirarlo a 16, 32 y 512 px antes de darlo por bueno.

## 6. Verificación

- [x] 6.1 `node --check` y las tres pruebas en Node en verde.
- [x] 6.2 `smoke`, `smoke:motor` y `smoke:ajustes` sin regresiones — el smoke
      pulsa botones por id, así que renombrar o mover uno lo rompería.
- [x] 6.3 Capturas de la tira y de los ajustes en los dos esquemas, y de la
      tira al ancho mínimo, para juzgar el tamaño con el resultado delante.
- [x] 6.4 Regenerar con `pnpm run iconos` sobre un árbol limpio y comprobar
      que no produce ningún cambio: si lo produce, el sprite versionado y el
      generador no coinciden.
- [x] 6.5 `pnpm run pack` y confirmar que el icono nuevo va dentro del paquete.
