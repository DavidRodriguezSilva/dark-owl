# archivo-audio Specification

## Purpose
Transcribir un archivo de audio ya grabado —una nota de voz, un audio
recibido— con el mismo motor, ajustes y panel que una grabación del micrófono.
## Requirements
### Requirement: Abrir un archivo de audio

La aplicación SHALL permitir elegir un archivo de audio desde un mando visible
en la ventana principal, y SHALL aceptar además un archivo arrastrado sobre la
ventana.

Soltar un archivo sobre la ventana MUST NOT navegar fuera de la aplicación ni
abrir el archivo en ella.

Si se sueltan varios archivos a la vez, la aplicación SHALL transcribir sólo
el primero.

#### Scenario: Elegir un archivo con el mando

- **GIVEN** el motor está listo y no hay una grabación ni una transcripción en
  curso
- **WHEN** el usuario pulsa el mando de abrir archivo y elige una nota de voz
- **THEN** la aplicación la transcribe y el texto aparece en el panel

#### Scenario: Arrastrar un archivo

- **GIVEN** el motor está listo y no hay una grabación ni una transcripción en
  curso
- **WHEN** el usuario arrastra un archivo de audio y lo suelta sobre la ventana
- **THEN** la aplicación lo transcribe, y la ventana sigue mostrando la
  aplicación

### Requirement: Formatos admitidos

La aplicación SHALL transcribir archivos mp3, m4a/aac, ogg/opus, wav, flac y
webm sin herramientas externas ni conexión a red.

Un archivo que no se pueda decodificar SHALL producir un aviso de formato no
admitido en el panel, sin llamar al motor.

#### Scenario: Nota de voz de WhatsApp

- **WHEN** el usuario abre un archivo `.opus` exportado de WhatsApp
- **THEN** la aplicación lo transcribe

#### Scenario: Archivo que no es audio

- **WHEN** el usuario abre un documento de texto o una imagen
- **THEN** el panel avisa de que el formato no se admite y el motor no recibe
  nada

### Requirement: Límites de duración y tamaño

La aplicación MUST rechazar un archivo de más de 20 minutos de duración o de
más de 250 MB, con un aviso que diga cuál de los dos límites se superó y cuál
es, y MUST NOT llamar al motor con él.

El límite de tamaño SHALL comprobarse antes de leer el archivo.

#### Scenario: Audio demasiado largo

- **WHEN** el usuario abre un audio de 35 minutos
- **THEN** el panel avisa de que pasa de 20 minutos y no se transcribe

#### Scenario: Archivo demasiado grande

- **WHEN** el usuario abre un archivo de 400 MB
- **THEN** el panel avisa de que pasa de 250 MB, sin que la aplicación lo haya
  leído entero

#### Scenario: Audio de 20 minutos justos

- **WHEN** el usuario abre un audio de 19 minutos y 50 segundos
- **THEN** la aplicación lo transcribe completo

### Requirement: Mismo resultado que una grabación

El texto de un archivo SHALL pasar por el mismo idioma, formato y limpieza que
el de una grabación, y SHALL mostrarse en el mismo panel con copiar,
reprocesar y limpiar disponibles.

Reprocesar SHALL volver a transcribir el último archivo sin pedirlo de nuevo.

El contador SHALL mostrar la duración del archivo.

La espera SHALL indicarse igual que la de una grabación, y una transcripción
larga MUST completarse sin que la aplicación la dé por fallida por tiempo
mientras el motor siga trabajando.

#### Scenario: Reprocesar tras cambiar el idioma

- **GIVEN** se transcribió un archivo con el idioma equivocado
- **WHEN** el usuario cambia el idioma en los ajustes y pulsa reprocesar
- **THEN** el mismo archivo se transcribe de nuevo con el idioma nuevo

#### Scenario: Transcripción larga

- **GIVEN** un audio de 18 minutos cuya transcripción tarda más de cinco
  minutos en este equipo
- **WHEN** el usuario lo abre
- **THEN** el texto aparece al terminar el motor, sin un error de tiempo agotado

### Requirement: Convivencia con la grabación

Mientras haya una grabación activa —grabando o en pausa—, abriendo el
micrófono o con una transcripción en curso, la aplicación MUST NOT aceptar un
archivo, ni por el mando ni arrastrándolo. Mientras se transcribe un archivo,
la aplicación MUST NOT permitir empezar a grabar.

Sin el motor listo, el mando de abrir archivo SHALL estar deshabilitado.

#### Scenario: Soltar un archivo mientras se graba

- **GIVEN** el usuario está grabando
- **WHEN** suelta un archivo de audio sobre la ventana
- **THEN** la grabación sigue sin cambios y el archivo se ignora

