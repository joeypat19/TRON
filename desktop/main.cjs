const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");

const isDevelopment = !app.isPackaged;
const backendUrl = process.env.TRON_BACKEND_URL || "http://127.0.0.1:938";
const updateUrl = process.env.TRON_UPDATE_URL || "https://github.com/joeypat19/TRON/releases/latest";

let mainWindow;
let lastUpdateStatus = { state: "idle" };

function readBuildInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "build-info.json"), "utf8"));
  } catch (_) {
    return {};
  }
}

function getBuildInfo() {
  const buildInfo = readBuildInfo();
  return {
    version: app.getVersion(),
    channel: isDevelopment ? "development" : "stable",
    commit: buildInfo.commit || "local",
    builtAt: buildInfo.builtAt || null,
    releaseTag: buildInfo.releaseTag || `v${app.getVersion()}`,
    dirty: buildInfo.dirty === true,
  };
}

async function purgeLocalBrowserStorage() {
  const sessions = [session.defaultSession, session.fromPartition("persist:tron")];
  await Promise.all(sessions.map(async (browserSession) => {
    await browserSession.clearStorageData({
      storages: ["localstorage", "indexdb", "websql", "filesystem", "serviceworkers", "cachestorage"],
    });
    await browserSession.clearCache();
  }));
}

function sendUpdateStatus(status) {
  lastUpdateStatus = status;
  mainWindow?.webContents.send("tron:update-status", status);
}

function configureAutoUpdates() {
  if (isDevelopment) {
    sendUpdateStatus({ state: "development" });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ state: "checking" }));
  autoUpdater.on("update-available", (info) => sendUpdateStatus({ state: "downloading", version: info.version }));
  autoUpdater.on("update-not-available", () => sendUpdateStatus({ state: "current" }));
  autoUpdater.on("download-progress", (progress) => sendUpdateStatus({ state: "downloading", percent: Math.round(progress.percent) }));
  autoUpdater.on("update-downloaded", (info) => sendUpdateStatus({ state: "ready", version: info.version }));
  autoUpdater.on("error", (error) => sendUpdateStatus({ state: "error", message: error.message }));

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => sendUpdateStatus({ state: "error", message: error.message }));
  }, 3000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    icon: path.join(__dirname, "assets", "tron-logo.ico"),
    backgroundColor: "#0a0b12",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.on("did-finish-load", () => sendUpdateStatus(lastUpdateStatus));
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await purgeLocalBrowserStorage();
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media" || permission === "notifications");
  });

  ipcMain.handle("tron:search", async (_event, { query, page = 1, limit = 10 }) => {
    const url = new URL("/api/search", backendUrl);
    url.searchParams.set("q", String(query || ""));
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TRON search failed with status ${response.status}`);
    }
    return response.json();
  });
  ipcMain.handle("tron:get-build-info", () => getBuildInfo());
  ipcMain.handle("tron:open-update", () => shell.openExternal(updateUrl));
  ipcMain.handle("tron:check-for-updates", async () => {
    if (isDevelopment) return { state: "development" };
    try {
      await autoUpdater.checkForUpdates();
      return lastUpdateStatus;
    } catch (error) {
      const status = { state: "error", message: error.message };
      sendUpdateStatus(status);
      return status;
    }
  });
  ipcMain.handle("tron:install-update", () => autoUpdater.quitAndInstall(false, true));
  ipcMain.on("tron:window-minimize", () => mainWindow?.minimize());
  ipcMain.on("tron:window-toggle-maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on("tron:window-close", () => mainWindow?.close());

  createWindow();
  configureAutoUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
