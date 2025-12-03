// Preload placeholder for future IPC bridging between the renderer and main processes.
// Context isolation is enabled in the BrowserWindow configuration; keep preload minimal until we add APIs.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  showOverlay: (bbox: number[], text: string) => ipcRenderer.invoke('show-overlay', bbox, text),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  closeOverlay: () => ipcRenderer.send('overlay-close'),
  onOverlayData: (callback: (data: { bbox: number[]; text: string }) => void) => {
    ipcRenderer.on('overlay-data', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('overlay-data');
  },
});