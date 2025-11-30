import { useState, useRef, useEffect } from 'react';
import './index.css';

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

  const streamResponse = (qaId: number, fullText: string) => {
    let currentIndex = 0;
    const streamInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setQAPairs(prev =>
          prev.map(qa =>
            qa.id === qaId
              ? { ...qa, answer: fullText.slice(0, currentIndex + 1), isStreaming: true }
              : qa
          )
        );
        currentIndex++;
      } else {
        clearInterval(streamInterval);
        setQAPairs(prev =>
          prev.map(qa =>
            qa.id === qaId ? { ...qa, isStreaming: false } : qa
          )
        );
        setIsProcessing(false);
      }
    }, 20); // Adjust speed here (lower = faster)
  };

  const handleSubmit = (e: React.FormEvent) => {
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

      // Simulate streaming response
      const sampleResponse = `This is a sample response to your question: "${question}". The response is being streamed character by character to demonstrate the streaming effect. You can replace this with actual API calls to your backend service.`;
      
      // Small delay before starting to stream
      setTimeout(() => {
        streamResponse(newQA.id, sampleResponse);
      }, 300);
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
