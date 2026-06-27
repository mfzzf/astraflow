const { contextBridge } = require("electron");

function markElectronPlatform() {
  document.documentElement.dataset.electron = "true";
  document.documentElement.dataset.electronPlatform = process.platform;
}

if (document.documentElement) {
  markElectronPlatform();
} else {
  window.addEventListener("DOMContentLoaded", markElectronPlatform, {
    once: true,
  });
}

contextBridge.exposeInMainWorld("betterAstraFlow", {
  platform: process.platform,
});
