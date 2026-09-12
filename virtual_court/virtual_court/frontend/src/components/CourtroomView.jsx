import { useState, useEffect, useRef } from 'react'
import TranscriptPanel from './TranscriptPanel'
import MicrophoneControl from './MicrophoneControl'
import ControlsPanel from './ControlsPanel'
import './CourtroomView.css'

export default function CourtroomView({
  messages,
  currentStage,
  canUserSpeak,
  microphoneEnabled,
  isListening,
  transcript,
  onStageComplete,
  error,
  onSetMute,
  isUserMuted
}) {
  const [caseTitle, setCaseTitle] = useState("Smith v. Johnson - Contract Dispute")
  const [progress, setProgress] = useState(0)

  // Update progress based on stage
  useEffect(() => {
    const stageOrder = [
      'COURT_OPENING',
      'OPENING_ARGUMENT',
      'EVIDENCE_SUBMISSION',
      'COUNTER_ARGUMENT',
      'CLOSING_ARGUMENT',
      'EDUCATIONAL_JUDGMENT'
    ]
    const currentIndex = stageOrder.indexOf(currentStage || 'COURT_OPENING')
    const progressPercent = ((currentIndex + 1) / stageOrder.length) * 100
    setProgress(progressPercent)
  }, [currentStage])

  // Filter messages for transcript
  const transcriptMessages = messages.filter(m =>
    ['ai_speech', 'user_input_accepted', 'objection_ruling'].includes(m.type)
  )

  const formatStageName = (stage) => {
    if (!stage) return 'Not Started'
    return stage.replace(/_/g, ' ')
  }

  return (
    <div className="courtroom">
      <header className="courtroom-header">
        <div className="case-info">
          <h2>{caseTitle}</h2>
          <div className="stage-indicator">
            <span className="label">Current Stage:</span>
            <span className="stage-name">{formatStageName(currentStage)}</span>
          </div>
        </div>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      </header>

      <main className="courtroom-main">
        <TranscriptPanel messages={transcriptMessages} interimTranscript={transcript} />

        <section className="courtroom-center">
          <div className="judge-bench">
            <div className="judge-avatar">
              <div className="avatar-icon">👨‍⚖️</div>
              <div className="nameplate">Judge</div>
            </div>
          </div>

          <div className="participants">
            <div className="participant user-lawyer">
              <div className="avatar-icon">👤</div>
              <div className="nameplate">You (Plaintiff's Counsel)</div>
            </div>
            <div className="participant opposing-lawyer">
              <div className="avatar-icon">👔</div>
              <div className="nameplate">Opposing Counsel</div>
            </div>
          </div>

          <MicrophoneControl
            enabled={microphoneEnabled}
            isListening={isListening}
            error={error}
            onSetMute={onSetMute}
            isUserMuted={isUserMuted}
          />
        </section>

        <ControlsPanel
          currentStage={currentStage}
          onStageComplete={onStageComplete}
          messages={messages}
        />
      </main>
    </div>
  )
}

