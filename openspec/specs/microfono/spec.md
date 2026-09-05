# microfono Specification

## Purpose
TBD - created by archiving change add-microfono. Update Purpose after archive.
## Requirements
### Requirement: Elegir el dispositivo de entrada

La aplicación SHALL presentar los dispositivos de entrada de audio disponibles
y permitir elegir cuál usar para grabar, además de una opción explícita de
usar el que determine el sistema, que SHALL ser el valor por defecto.

El dispositivo elegido SHALL persistirse según la capacidad `configuracion` y
SHALL usarse en todas las grabaciones siguientes.

Un dispositivo cuya etiqueta no esté disponible SHALL presentarse con un
nombre de reserva, nunca como una entrada en blanco.

#### Scenario: Elegir un dispositivo concreto

- **GIVEN** hay más de un dispositivo de entrada disponible
- **WHEN** el usuario elige uno distinto del que estaba activo
- **THEN** la siguiente grabación se captura de ese dispositivo, y la elección
  sigue vigente tras cerrar y reabrir la aplicación

### Requirement: Refrescar la lista de dispositivos

La aplicación SHALL ofrecer un control explícito para volver a explorar los
dispositivos disponibles, y SHALL actualizar además la lista por su cuenta
cuando el sistema informe de que se ha conectado o retirado un dispositivo.

#### Scenario: Un dispositivo conectado después de abrir los ajustes

- **GIVEN** la lista de dispositivos está a la vista
- **WHEN** el usuario conecta un micrófono nuevo y acciona el control de
  refrescar
- **THEN** el micrófono nuevo aparece en la lista y puede elegirse

### Requirement: El dispositivo elegido se resuelve contra los disponibles

Antes de usar el dispositivo elegido, la aplicación SHALL comprobar que sigue
existiendo entre los disponibles, tanto al presentar los ajustes como al
empezar a grabar.

La resolución SHALL seguir este orden: el dispositivo cuyo identificador
coincida con el guardado; en su defecto, uno cuya etiqueta coincida con la
guardada, adoptando su identificador; y en su defecto, el primero de la lista
de dispositivos disponibles.

Recurrir al primero de la lista MUST NOT borrar la preferencia guardada: si el
dispositivo elegido vuelve a estar disponible, la aplicación SHALL volver a
usarlo sin que el usuario tenga que elegirlo de nuevo.

#### Scenario: El dispositivo vuelve con otro identificador

- **GIVEN** el identificador guardado ya no corresponde a ningún dispositivo,
  pero hay uno disponible con la misma etiqueta que la guardada
- **WHEN** la aplicación resuelve qué dispositivo usar
- **THEN** adopta ese dispositivo como el elegido, sin pedir nada al usuario

#### Scenario: El dispositivo elegido vuelve tras desconectarlo

- **GIVEN** el dispositivo elegido no estaba disponible y la aplicación está
  usando el primero de la lista
- **WHEN** el dispositivo elegido vuelve a estar disponible
- **THEN** la aplicación vuelve a usarlo, sin que el usuario lo elija de nuevo

### Requirement: Una sustitución de dispositivo siempre se avisa

Si la aplicación acaba grabando con un dispositivo distinto del elegido, SHALL
grabar de todos modos —nunca dejar al usuario sin poder grabar— y SHALL
avisar de que lo ha hecho, nombrando el dispositivo que falta.

La aplicación MUST NOT sustituir el dispositivo elegido por otro sin que el
usuario se entere: una transcripción capturada de un micrófono distinto del
que el usuario cree no es distinguible de una mala transcripción.

#### Scenario: El micrófono guardado ya no está conectado

- **GIVEN** el usuario eligió un micrófono y después lo desconectó
- **WHEN** pulsa grabar
- **THEN** la grabación se realiza con otro dispositivo disponible y la
  aplicación avisa de que el micrófono elegido no estaba disponible

### Requirement: Comprobar que un dispositivo capta sonido

La aplicación SHALL ofrecer una forma de comprobar el dispositivo elegido que
muestre el nivel de entrada real, para poder distinguir un micrófono mal
elegido de una voz demasiado baja.

La comprobación SHALL abrirse a petición del usuario y cerrarse por sí sola;
MUST NOT mantener el dispositivo abierto mientras la ventana de ajustes esté
a la vista.

#### Scenario: Comprobar un micrófono que funciona

- **GIVEN** el usuario ha elegido un dispositivo
- **WHEN** acciona la comprobación y habla
- **THEN** el nivel mostrado responde a su voz, y la captura se detiene sola
  al terminar

#### Scenario: La comprobación no queda abierta

- **GIVEN** la comprobación está en curso
- **WHEN** el usuario cierra la ventana de ajustes
- **THEN** el dispositivo se libera

