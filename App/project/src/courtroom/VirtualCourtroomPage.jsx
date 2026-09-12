import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import StartScreen from './components/StartScreen'
import VirtualCourtroomView from './components/VirtualCourtroomView'
import { useCourtroomWebSocket } from './useCourtroomWebSocket'
import { useVoiceInput } from './useVoiceInput'
import {
  matchesScriptedFallback,
  SCRIPTED_FLOW,
  SCRIPTED_CASE_TITLE,
  EVIDENCE_ACK,
  SYSTEM_NOTES,
} from './scriptedFallback'

// How long to wait for the live AI courtroom to respond before
// falling back to the predefined script (only when eligible).
const SCRIPTED_CONNECTION_GRACE_MS = 4000
const SCRIPTED_AI_RESPONSE_GRACE_MS = 12000

export default function VirtualCourtroomPage() {
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}`)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isUserMuted, setIsUserMuted] = useState(true) // require explicit click to speak
  const [listeningAllowed, setListeningAllowed] = useState(false)
  const [caseSummary, setCaseSummary] = useState('')
  const [exhibits, setExhibits] = useState([])
  const [isExhibitUploading, setIsExhibitUploading] = useState(false)
  const [exhibitUploadStatus, setExhibitUploadStatus] = useState('')
  const [exhibitUploadError, setExhibitUploadError] = useState('')
  const [spokenMessages, setSpokenMessages] = useState([])
  const [sessionSummary, setSessionSummary] = useState(null)
  const [userId, setUserId] = useState(null)
  const [scriptedEligible, setScriptedEligible] = useState(false)
  const [scriptedMode, setScriptedMode] = useState(false)
  const [scriptedStageIdx, setScriptedStageIdx] = useState(-1)
  const [scriptedAwaitingUser, setScriptedAwaitingUser] = useState(false)
  const lastProcessedIndex = useRef(-1)
  const aiSpeechTimeoutRef = useRef(null)
  const spokenMessagesRef = useRef([])
  const scriptedAbortRef = useRef(false)
  const scriptedActiveRef = useRef(false)
  const scriptedAwaitingUserRef = useRef(false)
  const scriptedStageIdxRef = useRef(-1)
  const scriptedConnectionTimerRef = useRef(null)
  const scriptedResponseTimerRef = useRef(null)
  const scriptedEligibleRef = useRef(false)
  const lastWsMessageCountRef = useRef(0)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  // The courtroom FastAPI backend (where the websocket lives) is what serves
  // /document-analyser/upload now. Derive its HTTP origin from the same env
  // var used for the websocket so prod and dev stay in sync.
  const courtBaseUrl = useMemo(() => {
    const envBase = import.meta.env.VITE_COURT_WS_URL
    if (envBase) {
      try {
        const url = new URL(envBase)
        const httpProto = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol
        return `${httpProto}//${url.host}${url.pathname.replace(/\/+$/, '')}`
      } catch (e) {
        console.warn('Invalid VITE_COURT_WS_URL, falling back', e)
      }
    }
    if (typeof window !== 'undefined') {
      const host = window.location.host
      if (host.startsWith('localhost:5173') || host.startsWith('localhost:5174') || host.startsWith('localhost:5175')) {
        return 'http://localhost:8000'
      }
      return `${window.location.protocol}//${window.location.host}`
    }
    return 'http://localhost:8000'
  }, [])
  const ocrLangMap = {
    'en-IN': 'eng',
    'hi-IN': 'hin',
    'ta-IN': 'tam',
    'te-IN': 'tel',
    'ml-IN': 'mal',
    'kn-IN': 'kan',
  }
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    fetchUser()
  }, [])

  // Keep refs in sync with state so the scripted player (which lives outside
  // React render lifecycle) can read current values without stale closures.
  useEffect(() => {
    spokenMessagesRef.current = spokenMessages
  }, [spokenMessages])
  useEffect(() => {
    scriptedActiveRef.current = scriptedMode
  }, [scriptedMode])
  useEffect(() => {
    scriptedAwaitingUserRef.current = scriptedAwaitingUser
  }, [scriptedAwaitingUser])
  useEffect(() => {
    scriptedStageIdxRef.current = scriptedStageIdx
  }, [scriptedStageIdx])
  useEffect(() => {
    scriptedEligibleRef.current = scriptedEligible
  }, [scriptedEligible])

  const clearScriptedTimers = () => {
    if (scriptedConnectionTimerRef.current) {
      clearTimeout(scriptedConnectionTimerRef.current)
      scriptedConnectionTimerRef.current = null
    }
    if (scriptedResponseTimerRef.current) {
      clearTimeout(scriptedResponseTimerRef.current)
      scriptedResponseTimerRef.current = null
    }
  }

  const playScriptedLine = (line) =>
    new Promise((resolve) => {
      if (scriptedAbortRef.current) {
        resolve()
        return
      }
      // Append immediately so the transcript fills regardless of TTS support.
      setSpokenMessages((prev) => [
        ...prev,
        { type: 'ai_speech', role: line.role, data: { text: line.text } },
      ])

      let resolved = false
      const safeResolve = () => {
        if (resolved) return
        resolved = true
        setIsAiSpeaking(false)
        resolve()
      }

      try {
        if (window.speechSynthesis) {
          try { window.speechSynthesis.cancel() } catch (_) { /* ignore */ }
          const utterance = new SpeechSynthesisUtterance(line.text)
          utterance.lang = selectedLanguage
          utterance.rate = 0.95
          utterance.pitch = line.role === 'JUDGE' ? 0.9 : 1
          const voiceMatch = window.speechSynthesis
            .getVoices()
            .find((voice) => voice.lang?.toLowerCase().startsWith(selectedLanguage.slice(0, 2).toLowerCase()))
          if (voiceMatch) utterance.voice = voiceMatch
          setIsAiSpeaking(true)
          utterance.onend = safeResolve
          utterance.onerror = safeResolve
          window.speechSynthesis.speak(utterance)
        } else {
          setIsAiSpeaking(true)
        }
      } catch (_) {
        setIsAiSpeaking(true)
      }

      // Hard fail-safe so the demo never stalls if TTS misbehaves.
      const fallbackMs = Math.max(2400, line.text.length * 65)
      setTimeout(safeResolve, fallbackMs)
    })

  const playScriptedLines = async (lines) => {
    for (const line of lines || []) {
      if (scriptedAbortRef.current) return
      await playScriptedLine(line)
      await new Promise((r) => setTimeout(r, 350))
    }
  }

  const finishScriptedSession = () => {
    scriptedAbortRef.current = true
    setScriptedAwaitingUser(false)
    setIsAiSpeaking(false)
    setIsUserMuted(true)
    setListeningAllowed(false)
    setSessionSummary({
      entries: spokenMessagesRef.current
        .filter((m) => ['ai_speech', 'user_input_accepted', 'objection_ruling'].includes(m.type))
        .map((m) => ({
          role:
            m.type === 'user_input_accepted'
              ? 'PROSECUTOR'
              : m.role || 'SYSTEM',
          text: m.data?.text || m.data?.transcript || m.data?.ruling || '',
        })),
    })
    setSpokenMessages((prev) => [
      ...prev,
      { type: 'system_note', role: 'SYSTEM', data: { text: SYSTEM_NOTES.judgmentDelivered } },
    ])
    setSessionStarted(false)
  }

  const playScriptedPostAndAdvance = async () => {
    const idx = scriptedStageIdxRef.current
    const stage = SCRIPTED_FLOW[idx]
    if (!stage) return
    setScriptedAwaitingUser(false)
    if (stage.post && stage.post.length) {
      await playScriptedLines(stage.post)
    }
    await startScriptedStage(idx + 1)
  }

  const startScriptedStage = async (nextIdx) => {
    if (scriptedAbortRef.current) return
    if (nextIdx < 0 || nextIdx >= SCRIPTED_FLOW.length) {
      finishScriptedSession()
      return
    }
    setScriptedStageIdx(nextIdx)
    scriptedStageIdxRef.current = nextIdx
    setScriptedAwaitingUser(false)
    const stage = SCRIPTED_FLOW[nextIdx]
    setSpokenMessages((prev) => [
      ...prev,
      {
        type: 'system_note',
        role: 'SYSTEM',
        data: { text: `${nextIdx + 1}. ${stage.label}` },
      },
    ])
    await playScriptedLines(stage.pre)
    if (stage.final) {
      finishScriptedSession()
      return
    }
    if (stage.waitsForUser) {
      setScriptedAwaitingUser(true)
      setSpokenMessages((prev) => [
        ...prev,
        {
          type: 'system_note',
          role: 'SYSTEM',
          data: {
            text: stage.triggersOnExhibit ? SYSTEM_NOTES.uploadHint : SYSTEM_NOTES.awaitingUser,
          },
        },
      ])
    } else {
      await playScriptedPostAndAdvance()
    }
  }

  const enterScriptedMode = (reason = 'auto') => {
    if (scriptedActiveRef.current) return
    if (!scriptedEligibleRef.current) return
    clearScriptedTimers()
    scriptedAbortRef.current = false
    scriptedActiveRef.current = true
    setScriptedMode(true)
    setSpokenMessages((prev) => [
      ...prev,
      {
        type: 'system_note',
        role: 'SYSTEM',
        data: {
          text: `${SYSTEM_NOTES.activated}${reason ? ` [${reason}]` : ''}`,
        },
      },
    ])
    // Stop listening / muting while AI plays scripted lines.
    setIsUserMuted(true)
    setListeningAllowed(false)
    try { stopListening() } catch (_) { /* noop */ }
    try { abortListening() } catch (_) { /* noop */ }
    startScriptedStage(0)
  }

  const handleScriptedUserInput = async (text) => {
    if (!scriptedActiveRef.current) return false
    if (!scriptedAwaitingUserRef.current) return true
    setSpokenMessages((prev) => [
      ...prev,
      {
        type: 'user_input_accepted',
        role: 'USER_LAWYER',
        data: { transcript: text, confidence: 1 },
      },
    ])
    setIsUserMuted(true)
    setListeningAllowed(false)
    try { stopListening() } catch (_) { /* noop */ }
    await playScriptedPostAndAdvance()
    return true
  }

  const cancelSpeech = () => {
    if (aiSpeechTimeoutRef.current) {
      clearTimeout(aiSpeechTimeoutRef.current)
      aiSpeechTimeoutRef.current = null
    }
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }
    setIsAiSpeaking(false)
  }

  const localizeClientNote = (englishText, malayalamText) =>
    selectedLanguage === 'ml-IN' ? malayalamText : englishText

  const {
    connected,
    sendMessage,
    messages,
    currentStage,
    microphoneEnabled,
  } = useCourtroomWebSocket(sessionId)

  const {
    isListening,
    transcript,
    error: voiceError,
    abortListening,
    startListening,
    stopListening,
  } = useVoiceInput({
    enabled: listeningAllowed && (scriptedMode || microphoneEnabled) && sessionStarted && !isAiSpeaking && !isUserMuted,
    language: selectedLanguage,
    onFinalTranscript: (text, conf) => {
      if (isAiSpeaking) return
      if (text.trim() && sessionStarted) {
        if (scriptedActiveRef.current) {
          handleScriptedUserInput(text.trim())
        } else {
          sendMessage('user_input', { transcript: text, confidence: conf })
        }
        // Mute user until AI responds to avoid overlapping turns
        setIsUserMuted(true)
        stopListening()
        setListeningAllowed(false)
      }
    },
  })

  const latestAiSpeaker = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const item = messages[i]
      if (item.type === 'ai_speech') return item.role || 'JUDGE'
    }
    return null
  }, [messages])

  // Objections are permitted in any stage where it would make courtroom sense:
  //   - during the opposing counsel's counter-argument
  //   - immediately after opposing counsel made a remark in any other stage
  //   - during the user's own argument stages (procedurally rare but allowed
  //     so the student can practise raising one)
  const objectionAllowedStages = new Set([
    'OPENING_ARGUMENT',
    'EVIDENCE_SUBMISSION',
    'COUNTER_ARGUMENT',
    'CLOSING_ARGUMENT',
  ])
  const canRaiseObjection =
    sessionStarted &&
    !isAiSpeaking &&
    objectionAllowedStages.has(currentStage) &&
    (currentStage === 'COUNTER_ARGUMENT' || latestAiSpeaker === 'OPPOSING_LAWYER' || objectionAllowedStages.has(currentStage))

  const addSystemNote = (text) => {
    setSpokenMessages((prev) => [
      ...prev,
      {
        type: 'system_note',
        role: 'SYSTEM',
        data: { text },
      },
    ])
  }

  useEffect(() => {
    if (!sessionStarted || !currentStage) return
    // Require explicit click to speak on every stage.
    setIsUserMuted(true)
    setListeningAllowed(false)
    stopListening()
    abortListening()
  }, [currentStage, sessionStarted, stopListening, abortListening])

  // Speak AI responses and log transcript only when speech starts
  useEffect(() => {
    if (!window.speechSynthesis) return
    // While the predefined script is running, ignore WS-driven AI messages so
    // the offline flow remains the single source of truth.
    if (scriptedActiveRef.current) {
      lastProcessedIndex.current = messages.length - 1
      return
    }

    // If a fresh AI message arrived, clear any pending response watchdog.
    const hasNewAiMessage = messages.some(
      (m, idx) => idx > lastProcessedIndex.current && m.type === 'ai_speech',
    )
    if (hasNewAiMessage && scriptedResponseTimerRef.current) {
      clearTimeout(scriptedResponseTimerRef.current)
      scriptedResponseTimerRef.current = null
    }

    messages.forEach((message, index) => {
      if (index > lastProcessedIndex.current && message.type === 'ai_speech' && message.data?.text) {
        stopListening()
        abortListening()
        setIsAiSpeaking(true)
        setIsUserMuted(true)
        setListeningAllowed(false)
        if (aiSpeechTimeoutRef.current) {
          clearTimeout(aiSpeechTimeoutRef.current)
          aiSpeechTimeoutRef.current = null
        }

        const utterance = new SpeechSynthesisUtterance(message.data.text)
        utterance.lang = selectedLanguage
        utterance.rate = 0.95
        utterance.pitch = message.role === 'JUDGE' ? 0.9 : 1
        const voiceMatch = window
          .speechSynthesis
          .getVoices()
          .find((voice) => voice.lang?.toLowerCase().startsWith(selectedLanguage.slice(0, 2).toLowerCase()))
        if (voiceMatch) {
          utterance.voice = voiceMatch
        }

        utterance.onstart = () => {
          setSpokenMessages((prev) => [...prev, message])
        }
        utterance.onend = () => {
          setIsAiSpeaking(false)
          if (aiSpeechTimeoutRef.current) {
            clearTimeout(aiSpeechTimeoutRef.current)
            aiSpeechTimeoutRef.current = null
          }
        }
        utterance.onerror = () => {
          setIsAiSpeaking(false)
          if (aiSpeechTimeoutRef.current) {
            clearTimeout(aiSpeechTimeoutRef.current)
            aiSpeechTimeoutRef.current = null
          }
        }

        window.speechSynthesis.speak(utterance)
        // Fail-safe: if onend never fires, unmute after 8s
        aiSpeechTimeoutRef.current = setTimeout(() => {
          setIsAiSpeaking(false)
          aiSpeechTimeoutRef.current = null
        }, 8000)
      } else if (index > lastProcessedIndex.current && message.type === 'user_input_accepted') {
        // Add user speech to transcript when backend accepts it
        setSpokenMessages((prev) => [...prev, message])
        // Keep user muted until AI responds
        setIsUserMuted(true)
      } else if (index > lastProcessedIndex.current && message.type === 'objection_ruling') {
        setSpokenMessages((prev) => [...prev, message])
      } else if (index > lastProcessedIndex.current && message.type === 'system') {
        setSpokenMessages((prev) => [...prev, message])
      }

      if (index > lastProcessedIndex.current) {
        lastProcessedIndex.current = index
      }
    })
  }, [messages, abortListening, selectedLanguage])

  // Handle backend-driven session end
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.type === 'session_complete') {
      // Ignore the WS-driven session end while the predefined script is the
      // active source of truth — the scripted player owns the wrap-up flow.
      if (scriptedActiveRef.current) return
      cancelSpeech()
      setSessionStarted(false)
      setIsUserMuted(true)
      setSpokenMessages([])
      setExhibits([])
      setExhibitUploadStatus('')
      setExhibitUploadError('')
      setSessionSummary(lastMessage.data?.transcript || null)
      stopListening()
    }
  }, [messages, stopListening])

  // Force stop listening while AI is speaking
  useEffect(() => {
    if (isAiSpeaking) {
      setListeningAllowed(false)
      stopListening()
    }
  }, [isAiSpeaking, stopListening])

  const handleStartSession = (caseType = 'USER_PROVIDED', summary = '') => {
    setCaseSummary(summary || '')
    setExhibits([])
    setExhibitUploadStatus('')
    setExhibitUploadError('')
    setSpokenMessages([])
    setSessionSummary(null)

    // Reset scripted-mode state every time a new session begins.
    clearScriptedTimers()
    scriptedAbortRef.current = false
    scriptedActiveRef.current = false
    setScriptedMode(false)
    setScriptedStageIdx(-1)
    setScriptedAwaitingUser(false)

    const isEligible = matchesScriptedFallback(summary, caseType, SCRIPTED_CASE_TITLE.toLowerCase())
    setScriptedEligible(isEligible)
    scriptedEligibleRef.current = isEligible

    sendMessage('start_session', { caseType, userCaseSummary: summary, language: selectedLanguage })
    setSessionStarted(true)
    setIsUserMuted(true)
    setListeningAllowed(false)
    stopListening()

    // Watchdog: if backend never confirms a stage within the grace window,
    // fall back to the predefined script (only when this case is eligible).
    if (isEligible) {
      lastWsMessageCountRef.current = messages.length
      scriptedConnectionTimerRef.current = setTimeout(() => {
        if (scriptedActiveRef.current) return
        const noWsActivity = messages.length === lastWsMessageCountRef.current
        if (!connected || noWsActivity) {
          enterScriptedMode('connection-timeout')
        }
      }, SCRIPTED_CONNECTION_GRACE_MS)
    }

    if (summary && userId) {
      fetch(`${apiUrl}/user/current-case`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          summary,
          service: 'Virtual Courtroom',
          source: 'virtual-courtroom',
        }),
      }).catch((error) => {
        console.warn('Could not save current case:', error?.message || error)
      })
    }
  }

  const handleStageComplete = () => {
    if (scriptedActiveRef.current) {
      if (scriptedAwaitingUserRef.current) {
        playScriptedPostAndAdvance()
      }
      return
    }
    sendMessage('stage_complete', {})
  }

  const handleEndSession = () => {
    clearScriptedTimers()
    scriptedAbortRef.current = true
    scriptedActiveRef.current = false
    setScriptedMode(false)
    setScriptedAwaitingUser(false)
    setScriptedStageIdx(-1)
    sendMessage('session_complete', { clientRequested: true })
    cancelSpeech()
    setSessionStarted(false)
    setIsUserMuted(true)
    setListeningAllowed(false)
    setSpokenMessages([])
    setExhibits([])
    setExhibitUploadStatus('')
    setExhibitUploadError('')
    setSessionSummary(null)
    stopListening()
  }

  const handleSendTextInput = (text) => {
    if (scriptedActiveRef.current) {
      handleScriptedUserInput(text)
      return
    }
    // Start AI-response watchdog so we can fall back if the backend stalls.
    if (scriptedEligibleRef.current && !scriptedActiveRef.current) {
      if (scriptedResponseTimerRef.current) {
        clearTimeout(scriptedResponseTimerRef.current)
      }
      lastWsMessageCountRef.current = messages.length
      scriptedResponseTimerRef.current = setTimeout(() => {
        if (scriptedActiveRef.current) return
        if (messages.length === lastWsMessageCountRef.current) {
          enterScriptedMode('ai-response-timeout')
        }
      }, SCRIPTED_AI_RESPONSE_GRACE_MS)
    }
    sendMessage('user_input', { transcript: text, confidence: 0.9 })
  }

  const handleRaiseObjection = (objectionType = 'general') => {
    if (scriptedActiveRef.current) {
      // In scripted mode the judge gives a brief acknowledgement so the
      // demo flow continues seamlessly without depending on AI generation.
      setSpokenMessages((prev) => [
        ...prev,
        {
          type: 'objection_ruling',
          role: 'JUDGE',
          data: {
            ruling:
              'Objection noted. The court will weigh this point during deliberation.',
            objectionType,
          },
        },
      ])
      return
    }
    if (!canRaiseObjection) {
      addSystemNote(
        localizeClientNote(
          'Wait for the AI to finish speaking before raising an objection.',
          'AI സംസാരം പൂർത്തിയാകുന്നതുവരെ കാത്തിരിക്കുക, പിന്നീട് ആക്ഷേപം ഉന്നയിക്കാം.',
        ),
      )
      return
    }
    cancelSpeech()
    setIsAiSpeaking(false)
    setListeningAllowed(false)
    setIsUserMuted(true)
    stopListening()
    sendMessage('raise_objection', { objectionType })
  }

  const handleSubmitExhibit = ({ title, summary, extractedText = '', sourceFile = '' }) => {
    if (!title?.trim() || !summary?.trim()) return

    const activeStage = scriptedActiveRef.current
      ? SCRIPTED_FLOW[scriptedStageIdxRef.current]?.stage
      : currentStage
    if (activeStage !== 'EVIDENCE_SUBMISSION') {
      addSystemNote(
        localizeClientNote(
          'Exhibits are accepted during the evidence submission stage.',
          'തെളിവ് സമർപ്പണ ഘട്ടത്തിൽ മാത്രമേ Exhibit സ്വീകരിക്കൂ.',
        ),
      )
      return
    }

    const exhibitNumber = exhibits.length + 1
    const exhibitLabel = `Exhibit ${String.fromCharCode(64 + Math.min(exhibitNumber, 26))}`
    const entry = {
      id: `exhibit_${Date.now()}`,
      label: exhibitLabel,
      title: title.trim(),
      summary: summary.trim(),
      sourceFile,
      extractedText,
      submittedAt: new Date().toISOString(),
    }
    setExhibits((prev) => [...prev, entry])

    if (scriptedActiveRef.current) {
      // Push the prosecutor's submission as their turn, mark Exhibit A on
      // the record, then run the predefined post-evidence script.
      setSpokenMessages((prev) => [
        ...prev,
        {
          type: 'user_input_accepted',
          role: 'USER_LAWYER',
          data: {
            transcript: `I submit ${entry.label}: ${entry.title}. ${entry.summary}`,
            confidence: 1,
          },
        },
        {
          type: 'system_note',
          role: 'SYSTEM',
          data: { text: EVIDENCE_ACK },
        },
      ])
      setIsUserMuted(true)
      setListeningAllowed(false)
      try { stopListening() } catch (_) { /* noop */ }
      if (scriptedAwaitingUserRef.current) {
        playScriptedPostAndAdvance()
      }
      return
    }

    sendMessage('user_input', {
      transcript: `I submit ${entry.label}: ${entry.title}. ${entry.summary}`,
      confidence: 0.95,
    })
    setIsUserMuted(true)
    setListeningAllowed(false)
    stopListening()
    addSystemNote(
      selectedLanguage === 'ml-IN'
        ? `${entry.label} രേഖപ്പെടുത്തി രേഖാമൂലമായി സമർപ്പിച്ചു.`
        : `${entry.label} marked and submitted to the record.`,
    )
  }

  const handleUploadExhibitFile = async (file) => {
    if (!file) return
    const activeStage = scriptedActiveRef.current
      ? SCRIPTED_FLOW[scriptedStageIdxRef.current]?.stage
      : currentStage
    if (activeStage !== 'EVIDENCE_SUBMISSION') {
      addSystemNote(
        localizeClientNote(
          'File-backed exhibits can be uploaded during evidence submission stage only.',
          'ഫയൽ അടിസ്ഥാനത്തിലുള്ള Exhibit തെളിവ് ഘട്ടത്തിൽ മാത്രം അപ്‌ലോഡ് ചെയ്യാം.',
        ),
      )
      return
    }

    // In offline scripted mode the backend may be unreachable; record the
    // file locally as Exhibit A so the demo never blocks on a network call.
    if (scriptedActiveRef.current) {
      handleSubmitExhibit({
        title: file.name,
        summary: `Disability welfare application document (${file.name}).`,
        sourceFile: file.name,
      })
      setExhibitUploadStatus(
        selectedLanguage === 'ml-IN'
          ? `${file.name} ഓഫ്‌ലൈൻ Exhibit ആയി ഫയൽ ചെയ്തു.`
          : `${file.name} filed locally as Exhibit (offline mode).`,
      )
      return
    }

    setIsExhibitUploading(true)
    setExhibitUploadStatus('')
    setExhibitUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ocr_lang', ocrLangMap[selectedLanguage] || 'eng')
      const res = await fetch(`${courtBaseUrl}/document-analyser/upload`, {
        method: 'POST',
        body: formData,
      })

      let data = null
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()
        throw new Error(text || 'Upload failed')
      }
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || 'Upload failed')
      }

      const extractedText = (data?.text || '').trim()
      const isImage = data?.kind === 'image'
      const summaryPreview = extractedText
        ? extractedText.slice(0, 240).replace(/\s+/g, ' ')
        : isImage
          ? `Image exhibit (${file.name}) — vision analysis unavailable.`
          : `Document uploaded (${file.name}).`

      handleSubmitExhibit({
        title: file.name,
        summary: summaryPreview,
        extractedText,
        sourceFile: file.name,
      })
      setExhibitUploadStatus(
        selectedLanguage === 'ml-IN'
          ? isImage
            ? `${file.name} ൽ AI ദൃഷ്ടി പരിശോധന നടത്തി Exhibit ആയി ഫയൽ ചെയ്തു.`
            : `${file.name} ൽ നിന്ന് ടെക്സ്റ്റ് എടുത്ത് Exhibit ആയി ഫയൽ ചെയ്തു.`
          : isImage
            ? `Vision-analysed ${file.name} and filed as exhibit.`
            : `Extracted and filed ${file.name} as exhibit.`,
      )
    } catch (error) {
      const raw = error?.message || 'Could not upload exhibit file.'
      const network =
        /failed to fetch/i.test(raw) ||
        raw.includes('Load failed') ||
        raw.includes('NetworkError')
      setExhibitUploadError(
        selectedLanguage === 'ml-IN'
          ? network
            ? `കോടതി ബാക്കെൻഡ് (${courtBaseUrl}) ലഭ്യമല്ല. uvicorn സെർവർ പ്രവർത്തിക്കുന്നുവെന്ന് പരിശോധിക്കുക.`
            : raw
          : network
            ? `Unable to reach courtroom backend at ${courtBaseUrl}. Start the FastAPI server (uvicorn main:app --port 8000) and try again.`
            : raw,
      )
    } finally {
      setIsExhibitUploading(false)
    }
  }

  const handleChallengeExhibit = ({ exhibitId, ground = 'authentication' }) => {
    const targetExhibit = exhibits.find((item) => item.id === exhibitId)
    if (!targetExhibit) {
      addSystemNote(
        localizeClientNote('Select a valid exhibit to challenge.', 'വെല്ലുവിളിക്കാൻ സാധുവായ Exhibit തിരഞ്ഞെടുക്കുക.'),
      )
      return
    }
    if (!canRaiseObjection) {
      addSystemNote(
        localizeClientNote(
          'Authenticity challenge is allowed only during opposing counsel argument stage.',
          'എതിർവാദ ഘട്ടത്തിൽ മാത്രം യാഥാർത്ഥ്യ വെല്ലുവിളി അനുവദനീയമാണ്.',
        ),
      )
      return
    }
    addSystemNote(
      selectedLanguage === 'ml-IN'
        ? `വെല്ലുവിളി രേഖപ്പെടുത്തി: ${targetExhibit.label} (${targetExhibit.title}) - കാരണം: ${ground}.`
        : `Challenge recorded: ${targetExhibit.label} (${targetExhibit.title}) on ${ground} grounds.`,
    )
    handleRaiseObjection(ground)
  }

  useEffect(() => {
    return () => {
      cancelSpeech()
      clearScriptedTimers()
      scriptedAbortRef.current = true
    }
  }, [])

  // Watchdog: if the WebSocket disconnects mid-session for an eligible
  // case, switch to the predefined offline script so the demo never stalls.
  useEffect(() => {
    if (!sessionStarted) return undefined
    if (!scriptedEligibleRef.current) return undefined
    if (scriptedActiveRef.current) return undefined
    if (connected) return undefined
    const dropTimer = setTimeout(() => {
      if (!scriptedActiveRef.current && !connected) {
        enterScriptedMode('connection-dropped')
      }
    }, 3000)
    return () => clearTimeout(dropTimer)
  }, [connected, sessionStarted])

  const handleSetMute = (shouldMute) => {
    if (shouldMute) {
      setIsUserMuted(true)
      setListeningAllowed(false)
      stopListening()
      return
    }
    if (isAiSpeaking || !microphoneEnabled || !sessionStarted) return
    // Reset any AI speech flags/timers and force restart listening
    if (aiSpeechTimeoutRef.current) {
      clearTimeout(aiSpeechTimeoutRef.current)
      aiSpeechTimeoutRef.current = null
    }
    setIsAiSpeaking(false)
    setIsUserMuted(false)
    setListeningAllowed(true)
    abortListening()
    // Slight delay to avoid "already starting" errors from the API
    setTimeout(() => {
      startListening()
    }, 120)
  }

  const effectiveStage = scriptedMode
    ? (scriptedStageIdx >= 0 && scriptedStageIdx < SCRIPTED_FLOW.length
        ? SCRIPTED_FLOW[scriptedStageIdx].stage
        : null)
    : currentStage
  const effectiveConnected = scriptedMode ? true : connected
  const effectiveMicrophoneEnabled = scriptedMode
    ? (sessionStarted && !isAiSpeaking && scriptedAwaitingUser)
    : (microphoneEnabled && sessionStarted && !isAiSpeaking)

  return (
    <>
      {!sessionStarted ? (
        <StartScreen
          onStart={handleStartSession}
          connected={connected}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
        />
      ) : (
        <VirtualCourtroomView
          connected={effectiveConnected}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          messages={spokenMessages}
          currentStage={effectiveStage}
          caseSummary={caseSummary}
          exhibits={exhibits}
          isExhibitUploading={isExhibitUploading}
          exhibitUploadStatus={exhibitUploadStatus}
          exhibitUploadError={exhibitUploadError}
          objectionEnabled={canRaiseObjection || scriptedMode}
          microphoneEnabled={effectiveMicrophoneEnabled}
          isListening={isListening}
          transcript={isListening ? transcript : ''}
          onStageComplete={handleStageComplete}
          onEndSession={handleEndSession}
          onSetMute={handleSetMute}
          isUserMuted={isUserMuted}
          voiceError={voiceError}
          onSendTextInput={handleSendTextInput}
          onSubmitExhibit={handleSubmitExhibit}
          onUploadExhibitFile={handleUploadExhibitFile}
          onChallengeExhibit={handleChallengeExhibit}
          sessionSummary={sessionSummary}
          onRaiseObjection={handleRaiseObjection}
        />
      )}
    </>
  )
}


