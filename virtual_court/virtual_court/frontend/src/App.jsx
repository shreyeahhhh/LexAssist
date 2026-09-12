import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { useVoiceInput } from './hooks/useVoiceInput'
import StartScreen from './components/StartScreen'
import CourtroomView from './components/CourtroomView'
import './styles/App.css'

function App() {
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isUserMuted, setIsUserMuted] = useState(false)
  const lastProcessedIndex = useRef(-1)
  const speechTimeoutRef = useRef(null)
  const {
    connected,
    sendMessage,
    messages,
    currentStage,
    canUserSpeak,
    microphoneEnabled
  } = useWebSocket(sessionId)

  // Reset mute state when stage changes so user can speak again in new stage
  useEffect(() => {
    setIsUserMuted(false)
  }, [currentStage])

  const {
    isListening,
    transcript,
    confidence,
    error: voiceError,
    startListening,
    stopListening,
    abortListening,
  } = useVoiceInput({
    enabled: microphoneEnabled && sessionStarted && !isAiSpeaking && !isUserMuted,
    onFinalTranscript: (text, conf) => {
      if (text.trim() && sessionStarted) {
        sendMessage('user_input', { transcript: text, confidence: conf })
      }
    }
  })

  const handleSetMute = (shouldMute) => {
    setIsUserMuted(shouldMute)
  }

  const handleStartSession = (caseType = 'CONTRACT_DISPUTE') => {
    sendMessage('start_session', { caseType })
    setSessionStarted(true)
  }

  const handleStageComplete = () => {
    sendMessage('stage_complete', {})
  }

  // Handle AI speech messages - text-to-speech
  useEffect(() => {
    messages.forEach((message, index) => {
      // Only process new messages
      if (index > lastProcessedIndex.current) {
        if (message.type === 'ai_speech' && message.data?.text) {
          // IMMEDIATE MUTE: Turn off mic before generating audio to prevent echo
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current)
            speechTimeoutRef.current = null
          }
          setIsAiSpeaking(true)
          // STRICT RULE 5: Forcefully terminate/abort any active session
          abortListening()

          const utterance = new SpeechSynthesisUtterance(message.data.text)
          utterance.rate = 0.9
          utterance.pitch = message.role === 'JUDGE' ? 0.9 : 1.0

          utterance.onstart = () => {
            // Already muted above
          }

          utterance.onend = () => {
            if (speechTimeoutRef.current) {
              clearTimeout(speechTimeoutRef.current)
            }
            // Wait 4s before considering speech "done" to bridge gaps
            speechTimeoutRef.current = setTimeout(() => {
              if (!window.speechSynthesis.pending) {
                setIsAiSpeaking(false)
              }
            }, 4000)
          }

          utterance.onerror = () => {
            if (speechTimeoutRef.current) {
              clearTimeout(speechTimeoutRef.current)
            }
            if (!window.speechSynthesis.pending) {
              setIsAiSpeaking(false)
            }
          }

          // Queue speech instead of cancelling
          window.speechSynthesis.speak(utterance)
        }
        lastProcessedIndex.current = index
      }
    })
  }, [messages])

  return (
    <div className="app">
      <div className="disclaimer-banner">
        ⚖️ EDUCATIONAL SIMULATION ONLY - NOT LEGAL ADVICE
      </div>

      {!sessionStarted ? (
        <StartScreen onStart={handleStartSession} connected={connected} />
      ) : (
        <CourtroomView
          messages={messages}
          currentStage={currentStage}
          canUserSpeak={canUserSpeak}
          microphoneEnabled={microphoneEnabled}
          isListening={isListening}
          transcript={transcript}
          onStageComplete={handleStageComplete}
          onSetMute={handleSetMute}
          isUserMuted={isUserMuted}
          error={voiceError}
        />
      )}
    </div>
  )
}

export default App

