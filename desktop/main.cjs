const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const isDevelopment = !app.isPackaged;
const backendUrl = process.env.TRON_BACKEND_URL || "http://127.0.0.1:938";
const releaseManifestUrl = "https://github.com/joeypat19/TRON/releases/latest/download/latest.yml";
const releaseDownloadBaseUrl = "https://github.com/joeypat19/TRON/releases/latest/download/";

let mainWindow;
let lastUpdateStatus = { state: "idle" };
let latestInstallPromise = null;

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

function parseLatestManifest(manifest) {
  const read = (key) => {
    const match = manifest.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
  };
  const version = read("version");
  const installerName = read("path");
  const sha512 = read("sha512");
  const size = Number(read("size"));
  if (!version || !/^TRON-[\w.-]+-Setup\.exe$/i.test(installerName) || !sha512 || !Number.isSafeInteger(size) || size < 1) {
    throw new Error("The latest TRON release metadata is incomplete or invalid.");
  }
  return { version, installerName, sha512, size };
}

async function downloadLatestInstaller() {
  if (latestInstallPromise) return latestInstallPromise;

  latestInstallPromise = (async () => {
    sendUpdateStatus({ state: "checking" });
    const manifestResponse = await fetch(releaseManifestUrl, {
      headers: { Accept: "text/plain", "User-Agent": "TRON-desktop-updater" },
    });
    if (!manifestResponse.ok) throw new Error(`Could not read the latest TRON release (${manifestResponse.status}).`);
    const manifest = parseLatestManifest(await manifestResponse.text());
    const installerUrl = new URL(encodeURI(manifest.installerName), releaseDownloadBaseUrl);
    const installerPath = path.join(app.getPath("temp"), `TRON-${manifest.version}-Setup-${process.pid}.exe`);
    await fs.promises.rm(installerPath, { force: true });

    const installerResponse = await fetch(installerUrl, {
      headers: { Accept: "application/octet-stream", "User-Agent": "TRON-desktop-updater" },
    });
    if (!installerResponse.ok || !installerResponse.body) {
      throw new Error(`Could not download the latest TRON installer (${installerResponse.status}).`);
    }

    let received = 0;
    const hash = createHash("sha512");
    const progress = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        hash.update(chunk);
        const percent = Math.min(100, Math.round((received / manifest.size) * 100));
        sendUpdateStatus({ state: "downloading", version: manifest.version, percent });
        callback(null, chunk);
      },
    });

    try {
      await pipeline(Readable.fromWeb(installerResponse.body), progress, fs.createWriteStream(installerPath));
      const actualSha512 = hash.digest("base64");
      if (received !== manifest.size || actualSha512 !== manifest.sha512) {
        throw new Error("The downloaded TRON installer failed its integrity check.");
      }

      sendUpdateStatus({ state: "installing", version: manifest.version });
      const child = spawn(installerPath, [], { detached: true, stdio: "ignore", windowsHide: false });
      child.unref();
      setTimeout(() => app.quit(), 250);
      return { state: "installing", version: manifest.version };
    } catch (error) {
      await fs.promises.rm(installerPath, { force: true });
      throw error;
    }
  })()
    .catch((error) => {
      const status = { state: "error", message: error.message };
      sendUpdateStatus(status);
      throw error;
    })
    .finally(() => {
      latestInstallPromise = null;
    });

  return latestInstallPromise;
}

function configureAutoUpdates() {
  if (isDevelopment) {
    sendUpdateStatus({ state: "idle" });
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
  ipcMain.handle("tron:install-latest", () => downloadLatestInstaller());
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
