'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Única superficie que el renderer ve del proceso main.
contextBridge.exposeInMainWorld('api', {
  engineStatus: () => ipcRenderer.invoke('engine:status'),
  onEngineStatus: (cb) => {
    const handler = (_event, estado) => cb(estado);
    ipcRenderer.on('engine:status', handler);
    return () => ipcRenderer.off('engine:status', handler);
  },
  /** @param {ArrayBuffer} wav */
  transcribe: (wav) => ipcRenderer.invoke('transcribe', wav),
  copiar: (texto) => ipcRenderer.invoke('copiar', texto),

  ventana: {
    desplegar: (si) => ipcRenderer.send('ui:desplegar', si),
    tam: () => ipcRenderer.invoke('ui:tam'),
    redimensionar: (ancho, alto) => ipcRenderer.send('ui:tam', ancho, alto),
    minimizar: () => ipcRenderer.send('ui:minimizar'),
    cerrar: () => ipcRenderer.send('ui:cerrar'),
  },
});
