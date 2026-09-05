# configuracion Specification

## Purpose
TBD - created by archiving change add-ajustes. Update Purpose after archive.
## Requirements
### Requirement: Preferencias persistentes entre sesiones

La aplicación SHALL guardar las preferencias del usuario en el directorio de
datos de la aplicación y restaurarlas en el arranque siguiente. El proceso
principal SHALL ser el único dueño del fichero; el renderer MUST NOT acceder
a él directamente.

El fichero SHALL llevar un número de versión que permita distinguir su formato
en el futuro.

#### Scenario: Una preferencia sobrevive al reinicio

- **GIVEN** el usuario ha cambiado una preferencia desde el panel de ajustes
- **WHEN** cierra la aplicación y vuelve a abrirla
- **THEN** la preferencia sigue teniendo el valor que eligió

#### Scenario: Primer arranque sin fichero

- **WHEN** el usuario abre la aplicación por primera vez, sin fichero de
  ajustes en disco
- **THEN** la aplicación arranca con los valores por defecto y funciona con
  normalidad, sin pedir nada al usuario

### Requirement: Tolerancia a un fichero de ajustes inválido

Un fichero de ajustes corrupto, truncado o editado a mano con valores no
admitidos MUST NOT impedir que la aplicación arranque ni degradar su
funcionamiento.

Al cargar, cada campo cuyo valor no esté entre los admitidos SHALL sustituirse
por su valor por defecto. Un fichero que no pueda interpretarse SHALL tratarse
como si no existiera.

La escritura SHALL ser atómica: una interrupción a mitad de guardado MUST NOT
dejar en disco un fichero parcial que la carga siguiente acepte como válido.

#### Scenario: Fichero con un valor no admitido

- **GIVEN** el fichero de ajustes contiene un valor que no está entre los
  admitidos para su campo
- **WHEN** el usuario abre la aplicación
- **THEN** ese campo toma su valor por defecto, el resto de campos válidos se
  conservan, y la aplicación arranca con normalidad

#### Scenario: Fichero que no parsea

- **GIVEN** el fichero de ajustes contiene texto que no es JSON válido
- **WHEN** el usuario abre la aplicación
- **THEN** la aplicación arranca con todos los valores por defecto, como si no
  hubiera fichero

### Requirement: Ventana de ajustes independiente

La aplicación SHALL ofrecer los ajustes en una ventana propia, accesible desde
un control permanente en la fila de mandos de la ventana principal.

La ventana de ajustes SHALL ser única: accionar el control con la ventana ya
abierta la SHALL traer al frente en vez de abrir otra.

Abrir, usar o cerrar la ventana de ajustes MUST NOT alterar el estado de la
ventana principal: ni su tamaño, ni el texto transcrito a la vista, ni una
grabación en curso.

Cerrar la ventana de ajustes MUST NOT cerrar la aplicación.

#### Scenario: El texto y el tamaño no se alteran

- **GIVEN** hay un texto transcrito a la vista en la ventana principal
- **WHEN** el usuario abre la ventana de ajustes, cambia una preferencia y la
  cierra
- **THEN** la ventana principal conserva su tamaño y su texto íntegro

#### Scenario: Una sola ventana de ajustes

- **GIVEN** la ventana de ajustes ya está abierta
- **WHEN** el usuario acciona de nuevo el control de ajustes
- **THEN** la ventana existente pasa al frente y no se abre una segunda

#### Scenario: Grabar mientras los ajustes están abiertos

- **GIVEN** hay una grabación en curso
- **WHEN** el usuario abre la ventana de ajustes
- **THEN** la grabación continúa sin interrumpirse

