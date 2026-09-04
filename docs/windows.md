# Construir el ejecutable de Windows

El binario se compila **en Windows**, no desde WSL. Aquí `vendor/` contiene
ejecutables ELF de Linux: un paquete de Windows armado desde esta sesión
arrancaría y fallaría al transcribir.

## Antes de empezar: sácalo del recurso compartido de WSL

No construyas desde `\\wsl.localhost\Ubuntu\...`. Compilar C++ sobre el
recurso 9p es lento y CMake y MSVC tropiezan con rutas UNC — `cmd` ni siquiera
admite una UNC como directorio de trabajo. Copia o clona el repositorio a una
ruta nativa:

```powershell
git clone \\wsl.localhost\Ubuntu\home\drack\projects\whisper-app C:\dev\whisper-app
cd C:\dev\whisper-app
```

## Requisitos

```powershell
winget install OpenJS.NodeJS.LTS
winget install Kitware.CMake
winget install Microsoft.VisualStudio.2022.BuildTools
npm install -g pnpm
```

En el instalador de Build Tools hay que marcar **«Desarrollo para el
escritorio con C++»**. Sin eso CMake no encuentra compilador.

> **Reabre la terminal después de instalar.** El `PATH` se captura cuando
> arranca el proceso, así que una PowerShell que ya estuviera abierta no ve lo
> que acabas de instalar. Es la causa número uno de que `pnpm run setup` diga
> que falta CMake.

Abre una **«Developer PowerShell for VS 2022»**: además del PATH de MSVC, trae
el CMake que viene con Build Tools, así que sirve aunque no instales el de
Kitware.

Para comprobar qué ve la terminal:

```powershell
where.exe cmake
where.exe git
cl.exe          # debe responder con la versión del compilador de Microsoft
```

`pnpm run setup` imprime la ruta de cada herramienta que encuentra, y si falla
te dice exactamente dónde ha buscado. Busca en el `PATH` y, si no, en las
ubicaciones habituales: `C:\Program Files\CMake\bin`, los enlaces de winget y
el CMake que trae Visual Studio.

## Construir

```powershell
pnpm install
pnpm run setup      # clona y compila whisper.cpp con MSVC, baja ggml-small.bin
pnpm start          # comprobar que funciona ANTES de empaquetar
pnpm run dist       # → release\Whisper App-Setup-0.1.0.exe
```

Con GPU NVIDIA, y sólo si tienes el CUDA Toolkit instalado:

```powershell
pnpm run setup:cuda
```

El icono va incluido: `assets/icon.ico` está versionado, con las siete medidas
que Windows pide (16 a 256). Si alguna vez cambia el diseño, se regenera con
`pnpm run icono`, que lo pinta como HTML y lo captura — sin librerías de imagen
ni herramientas de diseño.

El instalador pesa unos **700 MB**: lleva el modelo `small` dentro para que la
app funcione sin red desde el primer arranque. Es un instalador NSIS y no un
portable a propósito — un portable se re-extraería en el directorio temporal en
cada ejecución, con esos 700 MB.

## Qué esperar al ejecutarlo

El `.exe` **no está firmado**, así que:

- **SmartScreen** mostrará «Windows protegió tu PC». Hay que pulsar *Más
  información* → *Ejecutar de todas formas*. Sólo la primera vez, en cada
  equipo.
- **Algún antivirus puede ponerlo en cuarentena.** Es el falso positivo típico
  de Electron empaquetado, y es exactamente el motivo por el que este proyecto
  compila desde fuente en vez de descargar binarios ajenos. Si pasa, hay que
  añadir una exclusión para la carpeta de instalación.

Firmarlo cuesta unos 300–400 €/año, y con un certificado OV SmartScreen sigue
avisando hasta acumular reputación; sólo un EV da confianza desde el primer
día. Tiene sentido si se va a repartir a más gente, no para uso propio.

## Alternativa sin ejecutable

La app corre bajo WSLg dibujando su ventana en el escritorio de Windows, y el
portapapeles cruza — lo que copia se pega en cualquier programa de Windows.
Lanzándola así no hay `.exe` que firmar ni SmartScreen que esquivar.
