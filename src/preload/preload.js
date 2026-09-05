'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Única superficie que el renderer ve del proceso main. La comparten las dos
// ventanas —la principal y la de ajustes—, así que los canales de ventana
// actúan sobre la que los envía y no sobre una fija.
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

  ajustes: {
    leer: () => ipcRenderer.invoke('ajustes:leer'),
    /** @param {object} parche cambios parciales; se fusionan sobre lo vigente */
    guardar: (parche) => ipcRenderer.invoke('ajustes:guardar', parche),
    onCambio: (cb) => {
      const handler = (_event, config) => cb(config);
      ipcRenderer.on('ajustes:cambiado', handler);
      return () => ipcRenderer.off('ajustes:cambiado', handler);
    },
  },

  ventana: {
    desplegar: (si) => ipcRenderer.send('ui:desplegar', si),
    tam: () => ipcRenderer.invoke('ui:tam'),
    redimensionar: (ancho, alto) => ipcRenderer.send('ui:tam', ancho, alto),
    minimizar: () => ipcRenderer.send('ui:minimizar'),
    cerrar: () => ipcRenderer.send('ui:cerrar'),
    ajustes: () => ipcRenderer.send('ui:ajustes'),
  },
});
