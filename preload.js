const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("RBXHUB", {
  desktop: true,
  platform: process.platform
});
