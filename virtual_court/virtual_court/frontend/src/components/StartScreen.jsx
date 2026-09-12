import './StartScreen.css'

export default function StartScreen({ onStart, connected }) {
  return (
    <div className="start-screen">
      <div className="start-content">
        <div className="logo">
          <div className="gavel-icon">⚖️</div>
          <h1>Virtual Courtroom</h1>
          <p className="tagline">Voice-First Legal Practice Simulation</p>
        </div>

        <div className="info-card">
          <h2>About This Simulation</h2>
          <p>Practice your courtroom skills in a safe, educational environment. This voice-first simulation allows you to:</p>
          <ul>
            <li>Present opening and closing arguments</li>
            <li>Submit and defend evidence</li>
            <li>Handle objections in real-time</li>
            <li>Receive educational feedback</li>
          </ul>
          <div className="warning-box">
            <strong>⚠️ Important:</strong> This is an educational tool only. It does not provide legal advice and does not create an attorney-client relationship. For actual legal matters, consult a licensed attorney.
          </div>
        </div>

        <div className="voice-check">
          <h3>🎤 Voice Requirements</h3>
          <p>This simulation requires microphone access for voice interaction. Please ensure:</p>
          <ul>
            <li>Your microphone is connected and working</li>
            <li>You grant microphone permissions when prompted</li>
            <li>You're in a quiet environment</li>
          </ul>
          <p className="note">Text input is available as a fallback option.</p>
        </div>

        <button 
          className="start-btn" 
          onClick={() => onStart('CONTRACT_DISPUTE')}
          disabled={!connected}
        >
          <span>{connected ? 'Begin Courtroom Session' : 'Connecting...'}</span>
          <span className="arrow">→</span>
        </button>
      </div>
    </div>
  )
}

