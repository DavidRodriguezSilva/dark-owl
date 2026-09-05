## MODIFIED Requirements

### Requirement: Tolerancia a un fichero de ajustes inválido

Un fichero de ajustes corrupto, truncado o editado a mano con valores no
admitidos MUST NOT impedir que la aplicación arranque ni degradar su
funcionamiento.

Al cargar, cada campo cuyo valor no esté entre los admitidos SHALL sustituirse
por su valor por defecto. Un fichero que no pueda interpretarse SHALL tratarse
como si no existiera.

La validación SHALL admitir tanto campos con un conjunto cerrado de valores
como campos de texto libre con una forma esperada, de modo que un campo de
texto libre inválido reciba el mismo trato que un valor fuera de conjunto.

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

#### Scenario: Campo de texto libre con forma inesperada

- **GIVEN** un campo de texto libre contiene algo que no tiene la forma
  esperada — un número donde se esperaba un objeto, por ejemplo
- **WHEN** el usuario abre la aplicación
- **THEN** ese campo toma su valor por defecto y la aplicación arranca con
  normalidad
