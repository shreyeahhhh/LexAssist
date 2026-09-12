import { useState, useEffect, useRef, useCallback } from 'react'

export function useVoiceInput({ enabled, onFinalTranscript, language = 'en-IN' }) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const enabledRef = useRef(enabled)
  const silenceTimerRef = useRef(null)

  // keep the latest enabled flag in a ref for callbacks
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      if (!enabledRef.current) {
        try {
          recognition.stop()
        } catch (e) {
          /* ignore */
        }
        setIsListening(false)
        return
      }
      setIsListening(true)
      setError(null)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        stopListening()
      }, 10000)
    }

    recognition.onresult = (event) => {
      if (!enabledRef.current) return
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        stopListening()
      }, 9000)

      const results = event.results
      const lastResult = results[results.length - 1]

      if (lastResult.isFinal) {
        const text = lastResult[0].transcript
        const conf = lastResult[0].confidence || 0.8

        setTranscript(text)
        setConfidence(conf)

        if (onFinalTranscript) {
          onFinalTranscript(text, conf)
        }
      } else {
        setTranscript(lastResult[0].transcript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return
      }

      const errorMessages = {
        'no-speech': 'No speech detected',
        'audio-capture': 'Microphone not accessible',
        'not-allowed': 'Microphone permission denied',
        network: 'Network error',
      }

      setError(errorMessages[event.error] || 'Speech recognition error')

      if (event.error === 'not-allowed') {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      // Do not auto-restart; user must click "Start speaking" again.
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          /* ignore */
        }
      }
    }
  }, [language, onFinalTranscript])

  const startListening = useCallback(() => {
    if (!enabledRef.current) return
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (error) {
        /* ignore already started */
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        /* ignore already stopped */
      }
    }
  }, [])

  const abortListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch (error) {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled && recognitionRef.current) {
      stopListening()
    }
  }, [enabled, stopListening])

  return {
    isListening,
    transcript,
    confidence,
    error,
    startListening,
    stopListening,
    abortListening,
  }
}


