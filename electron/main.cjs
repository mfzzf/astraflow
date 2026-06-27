const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let nextServer = null;
let nextServerUrl = null;
let isQuitting = false;

function getAppIconPath() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.icns")
    : path.join(__dirname, "..", "build", "icon.icns");

  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function getBundledServerDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "next")
    : path.join(__dirname, "..", ".next", "standalone");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }

        reject(new Error("Unable to allocate a local port."));
      });
    });
  });
}

function waitForUrl(url, timeoutMs = 45000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.once("error", (error) => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(error);
          return;
        }

        setTimeout(check, 300);
      });

      request.setTimeout(2000, () => {
        request.destroy(new Error("Timed out waiting for local server."));
      });
    };

    check();
  });
}

async function startNextServer() {
  if (process.env.ELECTRON_START_URL) {
    return process.env.ELECTRON_START_URL;
  }

  if (nextServer && nextServerUrl) {
    return nextServerUrl;
  }

  const serverDir = getBundledServerDir();
  const serverPath = path.join(serverDir, "server.js");

  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Missing Next standalone server at ${serverPath}. Run bun run electron:pack or bun run electron:mac first.`,
    );
  }

  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;

  nextServer = spawn(process.execPath, [serverPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      ASTRAFLOW_DESKTOP: "1",
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: app.isPackaged ? "ignore" : "inherit",
  });

  nextServer.once("exit", (code, signal) => {
    nextServer = null;
    nextServerUrl = null;

    if (!isQuitting) {
      console.error(`Next server exited with code ${code ?? "null"} and signal ${signal ?? "null"}.`);
    }
  });

  await waitForUrl(url);
  nextServerUrl = url;

  return url;
}

function isLocalAppUrl(targetUrl, appUrl) {
  try {
    const target = new URL(targetUrl);
    const local = new URL(appUrl);

    return target.origin === local.origin;
  } catch {
    return false;
  }
}

function openExternalUrl(targetUrl) {
  shell.openExternal(targetUrl).catch((error) => {
    console.error("Failed to open external URL:", error);
  });
}

function configureNavigation(window, appUrl) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalAppUrl(url, appUrl)) {
      openExternalUrl(url);
      return { action: "deny" };
    }

    return { action: "allow" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isLocalAppUrl(url, appUrl)) {
      return;
    }

    event.preventDefault();
    openExternalUrl(url);
  });
}

async function createMainWindow() {
  const appUrl = await startNextServer();

  mainWindow = new BrowserWindow({
    backgroundColor: "#f7f7f4",
    height: 900,
    icon: getAppIconPath(),
    minHeight: 720,
    minWidth: 1080,
    show: false,
    title: "Better AstraFlow",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    width: 1440,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  configureNavigation(mainWindow, appUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(appUrl);
}

function stopNextServer() {
  if (!nextServer) {
    return;
  }

  nextServer.kill();
  nextServer = null;
}

app.setName("Better AstraFlow");

app.whenReady().then(() => {
  createMainWindow().catch((error) => {
    console.error(error);
    dialog.showErrorBox("Better AstraFlow failed to start", error.message);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error) => {
        console.error(error);
      });
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  stopNextServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
