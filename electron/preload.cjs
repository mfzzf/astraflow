const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("betterAstraFlow", {
  platform: process.platform,
});
