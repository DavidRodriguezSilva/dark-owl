## ADDED Requirements

### Requirement: Idioma de transcripción configurable

La aplicación SHALL permitir elegir el idioma de transcripción entre detección
automática y un conjunto de idiomas concretos, y SHALL usar un idioma concreto
como valor por defecto en vez de la detección automática.

Cambiar el idioma MUST NOT requerir reiniciar el motor ni recargar el modelo, y
SHALL surtir efecto en la transcripción siguiente.

Con un idioma concreto elegido, la aplicación MUST NOT pedir al motor el
cálculo de probabilidades de idioma, que nadie usa en ese caso.

#### Scenario: Cambiar de idioma sin reiniciar

- **GIVEN** el motor está cargado y listo
- **WHEN** el usuario cambia el idioma de transcripción
- **THEN** la siguiente transcripción usa el idioma nuevo, sin que el motor se
  reinicie ni el modelo vuelva a cargarse

### Requirement: Formato del texto transcrito

La aplicación SHALL ofrecer tres formatos para el texto transcrito —texto
corrido, una frase por línea, y párrafos— configurables por el usuario, con
párrafos como valor por defecto.

El corte de frase SHALL basarse en la puntuación de final de oración.

El corte de párrafo SHALL exigir a la vez final de oración y una pausa en el
habla superior a un umbral; una pausa sin final de oración MUST NOT iniciar un
párrafo nuevo.

Si la información de tiempos no está disponible, el formato de párrafos SHALL
degradar a una frase por línea en vez de fallar.

#### Scenario: Una pausa a mitad de frase no parte el párrafo

- **GIVEN** el usuario dicta una oración y se detiene a pensar en mitad de
  ella durante más de un segundo antes de continuar
- **WHEN** la transcripción se formatea en párrafos
- **THEN** la oración aparece completa en un solo párrafo

#### Scenario: Pausa entre oraciones

- **GIVEN** el usuario termina una oración, calla, y empieza otra
- **WHEN** la transcripción se formatea en párrafos
- **THEN** las dos oraciones quedan en párrafos distintos

#### Scenario: Sin información de tiempos

- **GIVEN** el motor no devuelve tiempos por palabra
- **WHEN** el formato configurado es párrafos
- **THEN** el texto se presenta con una frase por línea, sin error

### Requirement: Umbral de pausa ajustable

El umbral de pausa que separa párrafos SHALL ser configurable por el usuario,
dentro de un rango razonable, y SHALL tener un valor por defecto utilizable sin
tocarlo.

#### Scenario: Ajustar el umbral

- **WHEN** el usuario reduce el umbral de pausa
- **THEN** la siguiente transcripción parte en párrafos con pausas más cortas
  de las que antes bastaban
