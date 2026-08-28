import React, { useState, useEffect, useRef } from 'react';
import useLiveAPI from './hooks/useLiveAPI';
import CorrectionBubble from './components/CorrectionBubble';
import { Mic, MicOff } from 'lucide-react';
import { CURRICULUM } from './curriculum';

function App() {
  const { 
    isConnected, 
    isRecording, 
    isSpeaking, 
    connect, 
    disconnect, 
    correctionData, 
    clearCorrection,
    newWords,
    needsReview
  } = useLiveAPI();
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      setLastError(args.join(' '));
      originalError.apply(console, args);
    };
    
    window.addEventListener('error', (e) => setLastError(e.message));
    window.addEventListener('unhandledrejection', (e) => setLastError(e.reason?.message || "Unhandled Promise Rejection"));
    
    return () => {
      console.error = originalError;
    };
  }, []);

  return (
    <div className="app-container split-dashboard">
      {lastError && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'red', color: 'white', padding: '10px', zIndex: 1000 }}>
          Error: {lastError} <button onClick={() => setLastError(null)}>X</button>
        </div>
      )}

      {/* LEFT COLUMN: The Conversation */}
      <div className="conversation-panel">
        <div className="tutor-header">
          <h1 className="title">Language Tutor</h1>
        </div>
        
        {/* Speaking visualizer with Avatar and clustered knick-knacks */}
        <div className="orb-container">
          <div className={`orb ${isSpeaking ? 'speaking' : ''} ${isConnected ? 'connected' : ''}`}>
            <img src="/avatar.jpg" alt="Tutor Avatar" className="avatar-image" />
          </div>
        </div>
        
        {/* Connection & Recording Controls */}
        <div className="controls">
          {!isConnected ? (
            <button className="btn primary" onClick={connect}>
              Connect to Tutor
            </button>
          ) : (
            <button className="btn danger" onClick={disconnect}>
              Disconnect
            </button>
          )}
        </div>

        {/* Minimalist instruction */}
        {isConnected && (
          <p className="status-text">
            {isRecording ? "Listening..." : (isSpeaking ? "Tutor is speaking..." : "Speak to your tutor")}
          </p>
        )}


      </div>

      {/* RIGHT COLUMN: The Study Board */}
      <div className="study-board-panel">
        
        <div className="study-card new-words">
          <div className="card-header">
            <h2>Vocabulary Covered in Lesson</h2>
          </div>
          <ul className="vocab-list">
            {newWords.length === 0 && <li className="vocab-item"><div className="vocab-translation">Start speaking to learn new words!</div></li>}
            {newWords.map((item, idx) => (
              <li key={idx} className="vocab-item">
                <div className="vocab-word">{item.word}</div>
                <div className="vocab-translation">{item.translation}</div>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Correction Modal */}
      {correctionData && (
        <CorrectionBubble 
          data={correctionData} 
          onClose={clearCorrection} 
        />
      )}
    </div>
  );
}

export default App;
