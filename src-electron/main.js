const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let appDataPath;

function ensureAppDataPath() {
    if (!appDataPath) {
        appDataPath = path.join(app.getPath('userData'), 'joyflix');
        if (!fs.existsSync(appDataPath)) {
            fs.mkdirSync(appDataPath, { recursive: true });
        }
    }
    return appDataPath;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Joyflix',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
    createMenu();

    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    mainWindow.webContents.on('did-finish-load', () => {
        injectPopupBlocker();
    });

    mainWindow.webContents.on('did-navigate', () => {
        injectPopupBlocker();
    });

    // ESC 退出全屏
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
            mainWindow.setMenuBarVisibility(true);
        }
    });
}

function createMenu() {
    const template = [
        {
            label: '导航',
            submenu: [
                {
                    label: '🏠 返回首页',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => goHome()
                },
                {
                    label: '← 后退',
                    accelerator: 'Alt+Left',
                    click: () => mainWindow && mainWindow.webContents.goBack()
                },
                {
                    label: '→ 前进',
                    accelerator: 'Alt+Right',
                    click: () => mainWindow && mainWindow.webContents.goForward()
                },
                {
                    label: '🔄 刷新',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow && mainWindow.webContents.reload()
                },
                { type: 'separator' },
                {
                    label: '⛶ 全屏',
                    accelerator: 'F11',
                    click: () => toggleFullscreen()
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function goHome() {
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
    }
}

function toggleFullscreen() {
    if (mainWindow) {
        const isFullscreen = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFullscreen);
        mainWindow.setMenuBarVisibility(isFullscreen);
    }
}

function injectPopupBlocker() {
    if (!mainWindow) return;

    const script = `
        (function() {
            if (window._joyflixPopupBlockerInstalled) return;
            window._joyflixPopupBlockerInstalled = true;
            try {
                Object.defineProperty(window, 'open', {
                    value: function() { return null; },
                    writable: false,
                    configurable: false
                });
            } catch(e) {
                window.open = function() { return null; };
            }
            window.alert = function() {};
            window.confirm = function() { return false; };
            window.prompt = function() { return null; };
            
            function removeBlankTargets() {
                document.querySelectorAll('a[target="_blank"]').forEach(el => {
                    el.removeAttribute('target');
                });
            }
            removeBlankTargets();
            new MutationObserver(removeBlankTargets).observe(document.body, { childList: true, subtree: true });
            console.log('[Joyflix] 弹窗拦截器已激活');
        })();
    `;

    mainWindow.webContents.executeJavaScript(script).catch(() => { });
}

function setupIpcHandlers() {
    ipcMain.handle('load-history', () => {
        const historyPath = path.join(ensureAppDataPath(), 'history.json');
        if (fs.existsSync(historyPath)) {
            return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        }
        return [];
    });

    ipcMain.handle('save-history', (event, history) => {
        const historyPath = path.join(ensureAppDataPath(), 'history.json');
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    });

    ipcMain.handle('load-config', () => {
        const configPath = path.join(ensureAppDataPath(), 'config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        return { customSites: [] };
    });

    ipcMain.handle('save-config', (event, config) => {
        const configPath = path.join(ensureAppDataPath(), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    });

    ipcMain.handle('clear-history', () => {
        const historyPath = path.join(ensureAppDataPath(), 'history.json');
        if (fs.existsSync(historyPath)) {
            fs.unlinkSync(historyPath);
        }
    });

    ipcMain.handle('open-site', (event, url) => {
        if (mainWindow) {
            mainWindow.loadURL(url);
            setTimeout(() => injectPopupBlocker(), 500);
            setTimeout(() => injectPopupBlocker(), 1500);
            setTimeout(() => injectPopupBlocker(), 3000);
        }
    });

    ipcMain.handle('go-home', () => {
        goHome();
    });

    ipcMain.handle('toggle-fullscreen', (event, enter) => {
        if (mainWindow) {
            mainWindow.setFullScreen(enter);
            mainWindow.setMenuBarVisibility(!enter);
        }
    });
}

app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
