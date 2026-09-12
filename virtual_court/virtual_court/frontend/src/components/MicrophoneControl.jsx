import './MicrophoneControl.css'

export default function MicrophoneControl({ enabled, isListening, error, onSetMute, isUserMuted }) {
  if (error) {
    return (
      <div className="mic-control error">
        <div className="mic-status">⚠️ {error}</div>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="mic-control disabled" title="Microphone disabled - Please wait for your turn">
        <div className="mic-indicator disabled">
          <div className="mic-icon">🔇</div>
        </div>
        <div className="mic-status">Microphone Disabled</div>
      </div>
    )
  }

  return (
    <div className="mic-control-group">
      {isUserMuted ? (
        <button
          className="mic-btn start-btn"
          onClick={() => onSetMute(false)}
          title="Click to Start Speaking"
        >
          <div className="mic-icon">🎤</div>
          Start Speaking
        </button>
      ) : (
        <button
          className="mic-btn stop-btn"
          onClick={() => onSetMute(true)}
          title="Click to Stop Speaking"
        >
          <div className="mic-icon">⏹️</div>
          Stop Speaking
          {isListening && <span className="pulse-dot"></span>}
        </button>
      )}
      <div className="mic-status-text">
        {isUserMuted ? 'Muted by User' : 'Microphone Active'}
      </div>
    </div>
  )
}

