const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("RBXHUB", {
  desktop: true,
  platform: process.platform,
  getZoom: () => ipcRenderer.sendSync("zoom:get"),
  setZoom: (z) => ipcRenderer.sendSync("zoom:set", z)
});
