import { app, BrowserWindow, globalShortcut } from 'electron';
import path from 'path';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let isOpened = false;

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    console.log('[main] Loading renderer from dev server:', process.env.VITE_DEV_SERVER_URL);
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log('[main] Loading renderer from file:', indexPath);
    void mainWindow.loadFile(indexPath);
  }
}

const toggleMainWindow = () => {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    if (isOpened) {
      mainWindow.hide();
      isOpened = false;
    } else {
      mainWindow.show();
      mainWindow.focus();
      isOpened = true;
    }
  }
};

app.whenReady().then(() => {
  console.log('[main] App ready');
  createMainWindow();
  
  const ret = globalShortcut.register('CommandOrControl+Shift+A', () => {
    toggleMainWindow();
    console.log('CommandOrControl+Shift+A is pressed');
  });
  if (!ret) {
    console.log('Failed to register global shortcut');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        isOpened = true;
      }
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[main] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  console.log('[main] Will quit');
  globalShortcut.unregisterAll();
});