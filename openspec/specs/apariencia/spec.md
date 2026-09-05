# apariencia Specification

## Purpose
TBD - created by archiving change add-ajustes. Update Purpose after archive.
## Requirements
### Requirement: Esquema de color configurable

La aplicación SHALL ofrecer tres opciones de esquema de color —claro, oscuro y
seguir al sistema— configurables desde el panel de ajustes, y SHALL usar
*seguir al sistema* como valor por defecto.

El esquema elegido SHALL persistirse según la capacidad `configuracion`.

Con *seguir al sistema* activo, un cambio de esquema en el sistema operativo
SHALL reflejarse en la aplicación sin necesidad de reiniciarla.

#### Scenario: Cambio manual de esquema

- **WHEN** el usuario elige el esquema claro en el panel de ajustes
- **THEN** la interfaz pasa al esquema claro de inmediato, sin reiniciar

#### Scenario: Seguir al sistema

- **GIVEN** el ajuste de esquema es *seguir al sistema*
- **WHEN** el sistema operativo cambia de esquema claro a oscuro
- **THEN** la aplicación pasa al esquema oscuro sin intervención del usuario

### Requirement: Legibilidad en ambos esquemas

Todos los elementos de la interfaz SHALL ser legibles y distinguibles en los
dos esquemas, incluido el medidor de nivel, que se dibuja en un canvas y no
recibe estilos en cascada.

Ningún color de la interfaz SHALL estar escrito en el código de dibujo: los
colores SHALL derivarse de la definición única de la paleta, de modo que
cambiar de esquema no pueda dejar un elemento con los colores del otro.

El esquema oscuro SHALL ser la base: si la aplicación no consigue determinar
el esquema a aplicar, SHALL presentarse en oscuro y no en un estado
intermedio.

#### Scenario: El medidor de nivel sigue al esquema

- **GIVEN** la aplicación está en esquema claro
- **WHEN** el usuario graba y el medidor se mueve
- **THEN** las barras del medidor se distinguen del fondo claro, con los
  colores del esquema claro

