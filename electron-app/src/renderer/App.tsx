import { useState, useRef, useEffect } from 'react';
import './index.css';

declare global {
  interface Window {
    electronAPI: {
      captureScreenshot: () => Promise<{ success: boolean; data?: string; error?: string }>;
    };
  }
}

interface QAPair {
  id: number;
  question: string;
  answer: string;
  isStreaming: boolean;
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

        // Check if response is streaming (text/event-stream or similar)
        const contentType = response.headers.get('content-type') || '';
        const isStreaming = contentType.includes('text/event-stream') || contentType.includes('text/plain');
        
        let fullResponse = '';

        if (isStreaming && response.body) {
          // Handle streaming response from backend
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            
            // Update UI with current response
            setQAPairs(prev =>
              prev.map(qa =>
                qa.id === newQA.id
                  ? { ...qa, answer: fullResponse, isStreaming: true }
                  : qa
              )
            );
          }
        } else {
          // Parse JSON response
          const data = await response.json();
          
          // Extract response field
          if (data.response) {
            fullResponse = data.response;
          } else if (data.answer) {
            fullResponse = data.answer;
          } else {
            // If neither field exists, stringify the whole object for debugging
            fullResponse = JSON.stringify(data, null, 2);
          }
        }

        // Final update to mark streaming as complete
        setQAPairs(prev =>
          prev.map(qa =>
            qa.id === newQA.id ? { ...qa, answer: fullResponse, isStreaming: false } : qa
          )
        );
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
              <div className="answer">
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
