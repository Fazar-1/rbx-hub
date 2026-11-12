const { app, BrowserWindow, shell, Menu, nativeTheme } = require("electron");
const path = require("path");

let win = null;
let zoom = 1;

const IS_MAC = process.platform === "darwin";
const ROBLOX_URL = /^https:\/\/([a-z0-9-]+\.)*roblox\.com(\/|$)/i;

function iconPath() {
  if (IS_MAC) return undefined;
  return path.join(__dirname, process.platform === "win32" ? "app.ico" : "app.png");
}

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
    autoHideMenuBar: !IS_MAC,
    title: "RBX Hub",
    icon: iconPath(),
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  });

  win.once("ready-to-show", () => win.show());

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

function resetZoom() {
  zoom = 1;
  if (win) win.webContents.setZoomFactor(1);
}

function toggleFullscreen() {
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
}

function bindKeys(target) {
  target.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = input.key;
    const mod = IS_MAC ? input.meta : input.control;

    if (key === "F11" || (IS_MAC && mod && (key === "f" || key === "F"))) {
      event.preventDefault();
      toggleFullscreen();
      return;
    }

    if (mod && (key === "+" || key === "=" || key === "Add")) {
      event.preventDefault();
      applyZoom(0.1);
      return;
    }

    if (mod && (key === "-" || key === "Subtract")) {
      event.preventDefault();
      applyZoom(-0.1);
      return;
    }

    if (mod && key === "0") {
      event.preventDefault();
      resetZoom();
    }
  });
}

function buildMenu() {
  if (!IS_MAC) {
    return Menu.buildFromTemplate([
      {
        label: "Вид",
        submenu: [
          { label: "Полный экран (F11)", accelerator: "F11", click: toggleFullscreen },
          { type: "separator" },
          { label: "Крупнее (Ctrl +)", accelerator: "CommandOrControl+Plus", click: () => applyZoom(0.1) },
          { label: "Мельче (Ctrl −)", accelerator: "CommandOrControl+-", click: () => applyZoom(-0.1) },
          { label: "Обычный масштаб (Ctrl 0)", accelerator: "CommandOrControl+0", click: resetZoom }
        ]
      }
    ]);
  }

  // На macOS без меню не работают стандартные сочетания (Cmd+Q, Cmd+C и т.д.)
  return Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: "about", label: "О RBX Hub" },
        { type: "separator" },
        { role: "hide", label: "Скрыть" },
        { role: "hideOthers", label: "Скрыть остальные" },
        { role: "unhide", label: "Показать все" },
        { type: "separator" },
        { role: "quit", label: "Выйти" }
      ]
    },
    {
      label: "Правка",
      submenu: [
        { role: "undo", label: "Отменить" },
        { role: "redo", label: "Повторить" },
        { type: "separator" },
        { role: "cut", label: "Вырезать" },
        { role: "copy", label: "Копировать" },
        { role: "paste", label: "Вставить" },
        { role: "selectAll", label: "Выделить всё" }
      ]
    },
    {
      label: "Вид",
      submenu: [
        { label: "Полный экран", accelerator: "Control+Command+F", click: toggleFullscreen },
        { type: "separator" },
        { label: "Крупнее", accelerator: "CommandOrControl+Plus", click: () => applyZoom(0.1) },
        { label: "Мельче", accelerator: "CommandOrControl+-", click: () => applyZoom(-0.1) },
        { label: "Обычный масштаб", accelerator: "CommandOrControl+0", click: resetZoom }
      ]
    },
    {
      label: "Окно",
      submenu: [
        { role: "minimize", label: "Свернуть" },
        { role: "zoom", label: "Масштаб окна" },
        { type: "separator" },
        { role: "front", label: "Все окна на передний план" }
      ]
    }
  ]);
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
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (!IS_MAC) app.quit();
  });
}
