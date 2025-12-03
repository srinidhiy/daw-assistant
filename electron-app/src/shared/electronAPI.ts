export interface ElectronAPI {
  captureScreenshot: () => Promise<{ success: boolean; data?: string; error?: string }>;
  showOverlay: (bbox: number[], text: string) => Promise<void>;
  hideOverlay: () => Promise<void>;
  closeOverlay: () => void;
  onOverlayData: (callback: (data: { bbox: number[]; text: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

