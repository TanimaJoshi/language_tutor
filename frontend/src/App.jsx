import React, { useState, useEffect } from 'react';
import useLiveAPI from './hooks/useLiveAPI';
import CorrectionBubble from './components/CorrectionBubble';
import { Mic, MicOff } from 'lucide-react';

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
    needsReview,
    transcript
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
    <div className="app-container">
      {lastError && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'red', color: 'white', padding: '10px', zIndex: 1000 }}>
          Error: {lastError} <button onClick={() => setLastError(null)}>X</button>
        </div>
      )}
      {/* Left Sidebar: New Vocabulary */}
      <div className="sidebar left">
        <h2>New Words</h2>
        <ul className="vocab-list">
          {newWords.length === 0 && <li className="vocab-item"><div className="vocab-translation">Start speaking to learn!</div></li>}
          {newWords.map((item, idx) => (
            <li key={idx} className="vocab-item">
              <div className="vocab-word">{item.word}</div>
              <div className="vocab-translation">{item.translation}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="main-content">
        <h1 className="title">Language Tutor</h1>
        
        {/* Speaking visualizer with Avatar */}
        <div className={`orb ${isSpeaking ? 'speaking' : ''} ${isConnected ? 'connected' : ''}`}>
          <img src="/avatar.jpg" alt="Tutor Avatar" className="avatar-image" />
        </div>
        
        {/* Connection & Recording Controls */}
        <div className="controls">
          {!isConnected ? (
            <button className="btn primary" onClick={connect}>
              Connect
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

      {/* Right Sidebar: Needs Review */}
      <div className="sidebar right">
        <h2>Needs Review</h2>
        <ul className="vocab-list">
          {needsReview.length === 0 && <li className="vocab-item"><div className="vocab-translation">Great job so far!</div></li>}
          {needsReview.map((item, idx) => (
            <li key={idx} className="vocab-item">
              <div className="vocab-word">{item.phrase}</div>
              <div className="vocab-translation">{item.reason}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Transcript Subtitles */}
      <div className="transcript-container">
        {transcript && <div className="transcript-text" key={transcript}>{transcript}</div>}
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
