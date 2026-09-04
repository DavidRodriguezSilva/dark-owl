#!/usr/bin/env electron
'use strict';

/**
 * Prueba del ciclo de vida del motor.
 *
 *   pnpm run smoke:motor
 *
 * Cubre lo que la prueba de la UI no ve: que un whisper-server huérfano de una
 * ejecución anterior se recoge al arrancar, y que no se mata un PID ajeno.
 * Importa porque cada huérfano retiene el modelo entero en memoria.
 */
const path = require('node:path'); const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { app } = require('electron');
app.commandLine.appendSwitch('disable-gpu-sandbox'); app.disableHardwareAcceleration();
const RAIZ = path.resolve(__dirname, '..');
const paths = require(path.join(RAIZ, 'src/main/paths.js'));
const engine = require(path.join(RAIZ, 'src/main/engine.js'));

const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
let fallos = 0;
const ok = (n, c, d) => { console.log(`${c ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); if (!c) fallos++; };

app.whenReady().then(async () => {
  // Simula el huérfano: un whisper-server que sobrevivió a una app muerta.
  const suelto = spawn(paths.binary('whisper-server'),
    ['-m', paths.model(), '--host', '127.0.0.1', '--port', '18999'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  ok('el huérfano está vivo', vivo(suelto.pid), `pid ${suelto.pid}`);

  // Y su PID quedó anotado, como haría un arranque previo.
  const fichero = path.join(app.getPath('userData'), 'engine.pid');
  fs.mkdirSync(path.dirname(fichero), { recursive: true });
  fs.writeFileSync(fichero, String(suelto.pid));

  await engine.start();
  await new Promise(r => setTimeout(r, 800));
  ok('el arranque recoge al huérfano', !vivo(suelto.pid));
  ok('el motor nuevo está listo', engine.state === 'ready');
  ok('anota su propio PID', fs.readFileSync(fichero, 'utf8').trim() === String(engine.proc.pid));

  // Un PID ajeno no se toca: los números se reutilizan.
  fs.writeFileSync(fichero, String(process.pid));
  engine._recogerHuerfano();
  ok('no mata un PID que no es suyo', vivo(process.pid));

  const pidMotor = engine.proc.pid;
  engine.stop();
  await new Promise(r => setTimeout(r, 500));
  ok('stop() mata el motor', !vivo(pidMotor));
  ok('stop() borra el fichero de PID', !fs.existsSync(fichero));

  console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo en orden');
  app.exit(fallos ? 1 : 0);
});
