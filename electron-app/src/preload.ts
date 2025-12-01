// Preload placeholder for future IPC bridging between the renderer and main processes.
// Context isolation is enabled in the BrowserWindow configuration; keep preload minimal until we add APIs.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
});