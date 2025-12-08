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

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate space available above, below, left, and right of the box
  const spaceAbove = y1;
  const spaceBelow = viewportHeight - y2;
  const spaceLeft = x1;
  const spaceRight = viewportWidth - x2;

  // Position text bubble to avoid covering the box
  // Prefer above, then below, then to the right, then to the left
  let textBubbleX: number;
  let textBubbleY: number;
  let position: 'above' | 'below' | 'right' | 'left' = 'above';

  if (spaceAbove >= 80) {
    // Position above the box
    textBubbleY = y1 - 70;
    textBubbleX = x1;
    position = 'above';
  } else if (spaceBelow >= 80) {
    // Position below the box
    textBubbleY = y2 + 10;
    textBubbleX = x1;
    position = 'below';
  } else if (spaceRight >= 250) {
    // Position to the right of the box
    textBubbleY = y1;
    textBubbleX = x2 + 10;
    position = 'right';
  } else if (spaceLeft >= 250) {
    // Position to the left of the box
    textBubbleY = y1;
    textBubbleX = x1 - 250; // Assuming max width of 250px for text bubble
    position = 'left';
  } else {
    // Fallback: position above even if it's tight
    textBubbleY = Math.max(10, y1 - 70);
    textBubbleX = x1;
    position = 'above';
  }

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
        className={`overlay-text-bubble overlay-text-bubble-${position}`}
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

