const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assoc', {
  load: () => ipcRenderer.invoke('assoc-state'),
  save: (exts) => ipcRenderer.invoke('assoc-save', exts),
  close: () => ipcRenderer.send('assoc-close')
});
