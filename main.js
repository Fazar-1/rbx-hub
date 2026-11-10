const { app, BrowserWindow, shell, Menu, nativeTheme } = require("electron");
const path = require("path");

let win = null;
let zoom = 1;

const ROBLOX_URL = /^https:\/\/([a-z0-9-]+\.)*roblox\.com(\/|$)/i;

function createWindow() {
  nativeTheme.themeSource = "dark";

  win = new BrowserWindow({
    width: 1680,
    height: 1000,
    minWidth: 640,
    minHeight: 560,
    backgroundColor: "#0f0f1a",
    show: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    title: "RBX Hub",
    icon: path.join(__dirname, "app.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  });

  win.once("ready-to-show", () => {
    if (win.isMaximized()) { /* already */ }
    win.show();
  });

  win.loadFile(path.join(__dirname, "ui", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (ROBLOX_URL.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) {
      event.preventDefault();
      if (ROBLOX_URL.test(url)) shell.openExternal(url);
    }
  });

  bindKeys(win);

  win.on("closed", () => { win = null; });
}

function applyZoom(step) {
  zoom = Math.min(2.5, Math.max(0.6, Math.round((zoom + step) * 100) / 100));
  if (win) win.webContents.setZoomFactor(zoom);
}

function toggleFullscreen() {
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
}

function bindKeys(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = input.key;

    if (key === "F11") {
      event.preventDefault();
      toggleFullscreen();
      return;
    }

    if (input.control && (key === "+" || key === "=" || key === "Add")) {
      event.preventDefault();
      applyZoom(0.1);
      return;
    }

    if (input.control && (key === "-" || key === "Subtract")) {
      event.preventDefault();
      applyZoom(-0.1);
      return;
    }

    if (input.control && key === "0") {
      event.preventDefault();
      zoom = 1;
      if (win) win.webContents.setZoomFactor(1);
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: "Вид",
        submenu: [
          { label: "Полный экран (F11)", accelerator: "F11", click: toggleFullscreen },
          { type: "separator" },
          { label: "Крупнее (Ctrl +)", accelerator: "CommandOrControl+Plus", click: () => applyZoom(0.1) },
          { label: "Мельче (Ctrl −)", accelerator: "CommandOrControl+-", click: () => applyZoom(-0.1) },
          { label: "Обычный масштаб (Ctrl 0)", accelerator: "CommandOrControl+0", click: () => { zoom = 1; if (win) win.webContents.setZoomFactor(1); } }
        ]
      }
    ]));
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
