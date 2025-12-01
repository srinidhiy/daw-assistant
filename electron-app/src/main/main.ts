import { app, BrowserWindow, screen, desktopCapturer, globalShortcut, nativeImage, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let isOpened = false;
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  // Preload path - compiled preload.js should be in the root directory
  // In dev: compiled by tsc in dev:electron script to electron-app/preload.js
  // In prod: compiled by build:main script to dist/main/preload.js
  let preloadPath: string;
  if (isDev) {
    // In dev mode with ts-node, __dirname is src/main, so go up to project root
    preloadPath = path.resolve(__dirname, '../../preload.js');
  } else {
    // In prod, __dirname is dist/main, so preload.js is in dist/main
    preloadPath = path.join(__dirname, 'preload.js');
  }
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    void mainWindow.loadFile(indexPath);
  }
  
  return mainWindow;
}

const toggleMainWindow = () => {
  const window = mainWindow || BrowserWindow.getAllWindows()[0];
  if (window) {
    if (isOpened) {
      window.hide();
      isOpened = false;
    } else {
      window.show();
      window.focus();
      isOpened = true;
    }
  }
};

async function captureScreenshot(): Promise<string> {
  // Get all browser windows and hide them before capturing
  const windows = BrowserWindow.getAllWindows();
  const wasVisible = windows.map(win => win.isVisible());
  
  try {
    // Hide all windows
    windows.forEach(win => {
      if (win.isVisible()) {
        win.hide();
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    });

    const primarySource = sources.find(source => 
      source.display_id === primaryDisplay.id.toString()
    ) || sources[0];

    if (!primarySource) {
      throw new Error('Could not find primary display source');
    }

    // Convert thumbnail to native image
    const image = nativeImage.createFromDataURL(primarySource.thumbnail.toDataURL());
    
    // Convert to PNG and then to base64
    const pngBuffer = image.toPNG();
    const base64 = pngBuffer.toString('base64');
    
    return base64;
  } catch (error) {
    console.error('[main] Error capturing screenshot:', error);
    throw error;
  } finally {
    // Restore window visibility
    windows.forEach((win, index) => {
      if (wasVisible[index]) {
        win.show();
      }
    });
  }
}

ipcMain.handle('capture-screenshot', async () => {
  try {
    const base64Screenshot = await captureScreenshot();
    return { success: true, data: base64Screenshot };
  } catch (error) {
    console.error('[main] Error capturing screenshot:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  } 
});

app.whenReady().then(() => {
  createMainWindow();
  
  const ret = globalShortcut.register('CommandOrControl+Shift+A', () => {
    toggleMainWindow();
  });
  if (!ret) {
    console.warn('Failed to register global shortcut');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      const window = mainWindow || BrowserWindow.getAllWindows()[0];
      if (window) {
        window.show();
        window.focus();
        isOpened = true;
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});