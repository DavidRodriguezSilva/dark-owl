'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Única superficie que el renderer ve del proceso main.
contextBridge.exposeInMainWorld('api', {
  engineStatus: () => ipcRenderer.invoke('engine:status'),
});
