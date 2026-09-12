import { useEffect, useRef } from 'react'
import './TranscriptPanel.css'

export default function TranscriptPanel({ messages, interimTranscript }) {
  const transcriptRef = useRef(null)

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [messages])

  const getRoleClass = (role) => {
    if (!role) return 'system'
    const roleLower = role.toLowerCase()
    if (roleLower.includes('judge')) return 'judge'
    if (roleLower.includes('user') || roleLower.includes('plaintiff')) return 'user_lawyer'
    if (roleLower.includes('opposing')) return 'opposing_lawyer'
    return 'system'
  }

  const getRoleLabel = (role) => {
    if (!role) return 'SYSTEM'
    if (role.includes('JUDGE')) return 'JUDGE'
    if (role.includes('USER_LAWYER')) return 'YOU'
    if (role.includes('OPPOSING_LAWYER')) return 'OPPOSING COUNSEL'
    return 'SYSTEM'
  }

  return (
    <aside className="transcript-panel">
      <h3>Session Transcript</h3>
      <div ref={transcriptRef} className="transcript-display">
        {messages.map((message, index) => {
          let text = ''
          let role = 'SYSTEM'

          if (message.type === 'ai_speech') {
            text = message.data.text
            role = message.role || 'JUDGE'
          } else if (message.type === 'user_input_accepted') {
            text = message.data.transcript
            role = 'USER_LAWYER'
          } else if (message.type === 'objection_ruling') {
            text = message.data.ruling
            role = message.role || 'JUDGE'
          }

          if (!text) return null

          return (
            <div key={index} className={`transcript-entry ${getRoleClass(role)}`}>
              <span className="role-label">{getRoleLabel(role)}</span>
              <span className="content">{text}</span>
            </div>
          )
        })}
      </div>
      {interimTranscript && (
        <div className="interim-transcript">{interimTranscript}</div>
      )}
    </aside>
  )
}

