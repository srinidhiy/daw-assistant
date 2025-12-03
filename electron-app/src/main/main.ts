import { app, BrowserWindow, screen, desktopCapturer, globalShortcut, nativeImage, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let isOpened = false;
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

function getPreloadPath() {
  // Preload path - compiled preload.js should be in the root directory
  // In dev: compiled by tsc in dev:electron script to electron-app/preload.js
  // In prod: compiled by build:main script to dist/main/preload.js
  if (isDev) {
    return path.resolve(__dirname, '../../preload.js');
  } else {
    return path.join(__dirname, 'preload.js');
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: getPreloadPath(),
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

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const { x, y } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: true,
    acceptFirstMouse: true,
    webPreferences: {
      contextIsolation: true,
      preload: getPreloadPath(),
      nodeIntegration: false,
    },
  });

  // Load overlay HTML
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    // In dev, overlay.html is served by Vite
    void overlayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/overlay.html`);
  } else {
    // In prod, overlay.html should be in dist/renderer
    const overlayPath = path.join(__dirname, '../renderer/overlay.html');
    void overlayWindow.loadFile(overlayPath);
  }

  // Handle window close
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function showOverlay(bbox: number[], text: string) {
  const window = createOverlayWindow();
  if (window) {
    const primaryDisplay = screen.getPrimaryDisplay();
    window.setBounds(primaryDisplay.bounds);
    window.show();
    window.focus();
    // Send data to overlay renderer after a brief delay to ensure window is ready
    setTimeout(() => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('overlay-data', { bbox, text });
      }
    }, 100);
  }
}

function hideOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
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

ipcMain.handle('show-overlay', async (_, bbox: number[], text: string) => {
  showOverlay(bbox, text);
});

ipcMain.handle('hide-overlay', async () => {
  hideOverlay();
});

ipcMain.on('overlay-close', () => {
  hideOverlay();
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