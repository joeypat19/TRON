const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tronDesktop", {
  search: (query, page = 1, limit = 10) => ipcRenderer.invoke("tron:search", { query, page, limit }),
  getBuildInfo: () => ipcRenderer.invoke("tron:get-build-info"),
  openUpdate: () => ipcRenderer.invoke("tron:open-update"),
  checkForUpdates: () => ipcRenderer.invoke("tron:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("tron:install-update"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("tron:update-status", listener);
    return () => ipcRenderer.removeListener("tron:update-status", listener);
  },
  minimize: () => ipcRenderer.send("tron:window-minimize"),
  toggleMaximize: () => ipcRenderer.send("tron:window-toggle-maximize"),
  close: () => ipcRenderer.send("tron:window-close"),
});
