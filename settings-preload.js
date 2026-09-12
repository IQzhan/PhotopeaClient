const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assoc', {
  load: () => ipcRenderer.invoke('assoc-state'),
  save: (exts) => ipcRenderer.invoke('assoc-save', exts),
  close: () => ipcRenderer.send('assoc-close'),
  onLang: (cb) => {
    ipcRenderer.on('lang-changed', (_e, bundle) => {
      try { cb(bundle); } catch (err) {}
    });
  }
});
