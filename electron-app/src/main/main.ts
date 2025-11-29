import { app, BrowserWindow } from 'electron';
import path from 'path';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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

app.whenReady().then(() => {
  console.log('[main] App ready');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[main] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
