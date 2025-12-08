import { useState, useRef, useEffect } from 'react';
import './index.css';
import '../shared/electronAPI';

interface QAPair {
  id: number;
  question: string;
  answer: string;
  isStreaming: boolean;
  bbox?: number[];
}

function App() {
  const [qaPairs, setQAPairs] = useState<QAPair[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new content is added
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [qaPairs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      const question = inputValue.trim();
      setInputValue('');
      setIsProcessing(true);

      const newQA: QAPair = {
        id: Date.now(),
        question,
        answer: '',
        isStreaming: true,
      };

      setQAPairs([...qaPairs, newQA]);

      try {
        let screenshotBase64: string | null = null;
        if (window.electronAPI) {
          const result = await window.electronAPI.captureScreenshot();
          if (result.success && result.data) {
            screenshotBase64 = result.data;
          }
        }

        const backendUrl = 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: question,
            screenshot: screenshotBase64,
          }),
        });

        if (!response.ok) {
          throw new Error(`Backend error: ${response.statusText}`);
        }

        // Handle streaming response (Server-Sent Events)
        const contentType = response.headers.get('content-type') || '';
        const isStreaming = contentType.includes('text/event-stream');
        
        let fullText = '';
        let finalBbox: number[] | undefined;

        if (isStreaming && response.body) {
          // Handle streaming response from backend
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            let readResult;
            try {
              readResult = await reader.read();
            } catch (readError) {
              console.error('Error reading stream:', readError);
              throw readError;
            }
            
            const { done, value } = readResult;
            if (done) {
              break;
            }
            
            if (!value) {
              continue;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete SSE messages (lines ending with \n\n)
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || ''; // Keep incomplete message in buffer

            for (const part of parts) {
              // Handle multiple data lines in one part
              const lines = part.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
                    
                    if (data.text !== undefined) {
                      fullText = data.text;
                      
                      // Update UI with current streaming text immediately
                      setQAPairs(prev =>
                        prev.map(qa =>
                          qa.id === newQA.id
                            ? { ...qa, answer: fullText, isStreaming: data.streaming !== false }
                            : qa
                        )
                      );
                    }
                    
                    // If this is the final message and has a bbox, store it
                    if (data.streaming === false && data.bbox && Array.isArray(data.bbox) && data.bbox.length === 4) {
                      finalBbox = data.bbox;

                      // Show overlay with bbox and text (only after streaming is complete)
                      if (window.electronAPI && window.electronAPI.showOverlay) {
                        await window.electronAPI.showOverlay(data.bbox, fullText);
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing SSE data:', e, 'Line:', line);
                  }
                }
              }
            }
          }
          
          // Process any remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.text !== undefined) {
                    fullText = data.text;
                  }
                  if (data.streaming === false && data.bbox && Array.isArray(data.bbox) && data.bbox.length === 4) {
                    finalBbox = data.bbox;
                    if (window.electronAPI && window.electronAPI.showOverlay) {
                      await window.electronAPI.showOverlay(data.bbox, fullText);
                    }
                  }
                } catch (e) {
                  console.error('Error parsing final SSE data:', e);
                }
              }
            }
          }

          // Final update to mark streaming as complete
          setQAPairs(prev =>
            prev.map(qa =>
              qa.id === newQA.id ? { ...qa, answer: fullText, isStreaming: false, bbox: finalBbox } : qa
            )
          );
        } else {
          // Fallback: Parse JSON response (non-streaming)
          const data = await response.json();
          
          let storedBbox: number[] | undefined;
          
          // Check if response has bbox (overlay data)
          if (data.bbox && Array.isArray(data.bbox) && data.bbox.length === 4 && data.text) {
            storedBbox = data.bbox;
            // Show overlay with bbox and text
            if (window.electronAPI && window.electronAPI.showOverlay) {
              await window.electronAPI.showOverlay(data.bbox, data.text);
            }
            fullText = data.text;
          } else if (data.text) {
            fullText = data.text;
          } else if (data.response) {
            fullText = data.response;
          } else if (data.answer) {
            fullText = data.answer;
          } else {
            fullText = JSON.stringify(data, null, 2);
          }

          // Final update
          setQAPairs(prev =>
            prev.map(qa =>
              qa.id === newQA.id ? { ...qa, answer: fullText, isStreaming: false, bbox: storedBbox } : qa
            )
          );
        }
      } catch (error) {
        console.error('[renderer] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setQAPairs(prev =>
          prev.map(qa =>
            qa.id === newQA.id
              ? { ...qa, answer: `Error: ${errorMessage}`, isStreaming: false }
              : qa
          )
        );
      } finally {
        setIsProcessing(false);
        console.log('Request processing complete');
      }
    }
  };

  return (
    <div className="app-root">
      <div className="search-container">
        <form onSubmit={handleSubmit} className="search-form">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Ask anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isProcessing}
          />
        </form>

        <div ref={containerRef} className="results-container">
          {qaPairs.map((qa) => (
            <div key={qa.id} className="qa-pair">
              <div className="question">{qa.question}</div>
              <div 
                className={`answer ${qa.bbox ? 'answer-clickable' : ''}`}
                onClick={() => {
                  if (qa.bbox && qa.bbox.length === 4 && window.electronAPI) {
                    window.electronAPI.showOverlay(qa.bbox, qa.answer);
                  }
                }}
              >
                {qa.answer}
                {qa.isStreaming && <span className="cursor">▊</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
