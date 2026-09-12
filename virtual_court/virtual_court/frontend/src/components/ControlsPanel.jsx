import './ControlsPanel.css'

export default function ControlsPanel({ currentStage, onStageComplete, messages }) {
  const canCompleteStage = currentStage && 
    ['OPENING_ARGUMENT', 'EVIDENCE_SUBMISSION', 'CLOSING_ARGUMENT'].includes(currentStage)

  // Extract performance metrics from messages (simplified)
  const performance = {
    opening: 0,
    evidence: 0,
    closing: 0,
  }

  return (
    <aside className="controls-panel">
      <div className="info-box">
        <h4>Voice Commands</h4>
        <ul>
          <li><strong>"Objection"</strong> - Raise an objection</li>
          <li><strong>"Your Honor"</strong> - Address the judge</li>
          <li><strong>"I submit evidence"</strong> - Present evidence</li>
        </ul>
      </div>

      <div className="info-box">
        <h4>Current Instructions</h4>
        <p>
          {currentStage === 'COURT_OPENING' && 'Wait for the judge to open the court session.'}
          {currentStage === 'OPENING_ARGUMENT' && 'Present your opening argument clearly and concisely.'}
          {currentStage === 'EVIDENCE_SUBMISSION' && 'Submit evidence and supporting arguments.'}
          {currentStage === 'COUNTER_ARGUMENT' && 'Listen to the opposing counsel. You may object if needed.'}
          {currentStage === 'CLOSING_ARGUMENT' && 'Present your closing statement.'}
          {currentStage === 'EDUCATIONAL_JUDGMENT' && 'The judge is delivering the educational judgment.'}
          {!currentStage && 'Waiting to begin...'}
        </p>
      </div>

      <div className="controls">
        {canCompleteStage && (
          <button className="control-btn" onClick={onStageComplete}>
            Complete Current Stage
          </button>
        )}
      </div>

      <div className="performance-tracker">
        <h4>Performance Metrics</h4>
        <div className="metric">
          <span className="metric-label">Opening Argument:</span>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${performance.opening * 100}%` }}></div>
          </div>
        </div>
        <div className="metric">
          <span className="metric-label">Evidence Quality:</span>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${performance.evidence * 100}%` }}></div>
          </div>
        </div>
        <div className="metric">
          <span className="metric-label">Closing Argument:</span>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${performance.closing * 100}%` }}></div>
          </div>
        </div>
      </div>
    </aside>
  )
}

