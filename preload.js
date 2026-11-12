const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cue', {
  list: () => ipcRenderer.invoke('items:list'),
  upsert: (item) => ipcRenderer.invoke('items:upsert', item),
  remove: (id) => ipcRenderer.invoke('items:remove', id),
  launch: (id) => ipcRenderer.invoke('items:launch', id),
  launchPack: (pack) => ipcRenderer.invoke('items:launch-pack', pack),
  clipboard: () => ipcRenderer.invoke('app:clipboard'),
  exportData: () => ipcRenderer.invoke('app:export'),
  importData: () => ipcRenderer.invoke('app:import'),
  hide: () => ipcRenderer.send('app:hide'),
  minimize: () => ipcRenderer.send('app:minimize'),
  getPreferences: () => ipcRenderer.invoke('app:preferences:get'),
  setPreferences: (preferences) => ipcRenderer.invoke('app:preferences:set', preferences),
  getShortcut: () => ipcRenderer.invoke('app:shortcut'),
  onPreferencesChanged: (callback) => { const f = (_ev, prefs) => callback(prefs); ipcRenderer.on('app:preferences-changed', f); return () => ipcRenderer.removeListener('app:preferences-changed', f); },
  onQuickAdd: (callback) => { const f = (_ev, text) => callback(text); ipcRenderer.on('app:quick-add', f); return () => ipcRenderer.removeListener('app:quick-add', f); },
  onWarning: (callback) => { const f = (_ev, text) => callback(text); ipcRenderer.on('app:warning', f); return () => ipcRenderer.removeListener('app:warning', f); }
});
