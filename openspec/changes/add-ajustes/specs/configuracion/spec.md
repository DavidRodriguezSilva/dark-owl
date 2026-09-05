## ADDED Requirements

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

### Requirement: Panel de ajustes dentro de la ventana

La aplicación SHALL ofrecer un panel de ajustes accesible desde un control
permanente en la barra de título, sin abrir una ventana adicional.

El panel de ajustes y el panel de texto SHALL ser excluyentes: MUST NOT
mostrarse ambos a la vez. Abrir los ajustes MUST NOT descartar el texto
transcrito; al cerrarlos, el texto SHALL volver a mostrarse si lo había.

En reposo, sin texto y sin ajustes abiertos, la ventana SHALL conservar su
altura de tira.

#### Scenario: Abrir y cerrar los ajustes sin perder el texto

- **GIVEN** hay un texto transcrito a la vista
- **WHEN** el usuario abre el panel de ajustes y después lo cierra
- **THEN** el texto vuelve a mostrarse íntegro, sin haberse perdido

#### Scenario: Cerrar los ajustes sin texto pliega la ventana

- **GIVEN** no hay texto transcrito y el panel de ajustes está abierto
- **WHEN** el usuario cierra el panel de ajustes
- **THEN** la ventana vuelve a su altura de tira
