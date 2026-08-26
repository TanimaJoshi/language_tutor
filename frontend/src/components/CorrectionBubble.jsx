import React, { useEffect } from 'react';

function CorrectionBubble({ data, onClose }) {
  // Auto-close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!data) return null;

  return (
    <div className="correction-bubble-overlay">
      <div className="correction-bubble">
        <button className="close-btn" onClick={onClose}>&times;</button>
        {data.explanation && (
          <div className="correction-badge">{data.explanation}</div>
        )}
        <div className="correction-words">{data.correct_words}</div>
        <div className="correction-phonetic">{data.phonetic_spelling}</div>
      </div>
    </div>
  );
}

export default CorrectionBubble;
