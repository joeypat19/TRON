const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tronDesktop", {
  search: (query, page = 1, limit = 10) => ipcRenderer.invoke("tron:search", { query, page, limit }),
  startChat: (request) => ipcRenderer.invoke("tron:chat-start", request),
  cancelChat: (requestId) => ipcRenderer.send("tron:chat-cancel", requestId),
  pickAttachments: () => ipcRenderer.invoke("tron:pick-attachments"),
  onChatEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("tron:chat-event", listener);
    return () => ipcRenderer.removeListener("tron:chat-event", listener);
  },
  getBuildInfo: () => ipcRenderer.invoke("tron:get-build-info"),
  installLatest: () => ipcRenderer.invoke("tron:install-latest"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("tron:update-status", listener);
    return () => ipcRenderer.removeListener("tron:update-status", listener);
  },
  minimize: () => ipcRenderer.send("tron:window-minimize"),
  toggleMaximize: () => ipcRenderer.send("tron:window-toggle-maximize"),
  close: () => ipcRenderer.send("tron:window-close"),
});
