import { useState, useEffect, useRef } from 'react';
import './overlay.css';
import '../shared/electronAPI';

function OverlayApp() {
  const [bbox, setBbox] = useState<number[] | null>(null);
  const [text, setText] = useState<string>('');
  const bboxRef = useRef<number[] | null>(null);

  useEffect(() => {
    bboxRef.current = bbox;
  }, [bbox]);

  useEffect(() => {
    // Listen for overlay data from main process
    const cleanup = window.electronAPI.onOverlayData((data) => {
      setBbox(data.bbox);
      setText(data.text);
    });

    // Handle ESC key to close overlay
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI.closeOverlay();
      }
    };

    // Handle click anywhere to close overlay, except inside the rectangle
    const handleClick = (e: MouseEvent) => {
      const currentBbox = bboxRef.current;
      if (!currentBbox || currentBbox.length !== 4) {
        window.electronAPI.closeOverlay();
        return;
      }

      const [x1, y1, x2, y2] = currentBbox;
      const clickX = e.clientX;
      const clickY = e.clientY;

      // Check if click is inside the rectangle
      const isInsideBox = clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2;
      
      // Only close if click is outside the rectangle
      if (!isInsideBox) {
        window.electronAPI.closeOverlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);

    return () => {
      cleanup();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  if (!bbox || bbox.length !== 4) {
    return null;
  }

  const [x1, y1, x2, y2] = bbox;
  const width = x2 - x1;
  const height = y2 - y1;

  // Position text bubble above the rectangle, or below if near top of screen
  const textBubbleY = y1 - 60 < 0 ? y2 + 10 : y1 - 50;
  const textBubbleX = x1;

  return (
    <div className="overlay-container">
      {/* Semi-transparent backdrop */}
      <div className="overlay-backdrop" />
      
      {/* Highlighted rectangle */}
      <div
        className="overlay-rectangle"
        style={{
          left: `${x1}px`,
          top: `${y1}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      />
      
      {/* Text bubble */}
      <div
        className="overlay-text-bubble"
        style={{
          left: `${textBubbleX}px`,
          top: `${textBubbleY}px`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export default OverlayApp;

