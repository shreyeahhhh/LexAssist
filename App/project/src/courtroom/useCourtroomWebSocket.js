import { useState, useEffect, useRef, useCallback } from 'react'

const buildWebSocketUrl = (sessionId) => {
  const envBase = import.meta.env.VITE_COURT_WS_URL

  // Allow overriding host via env (http/https or ws/wss). Append /ws/{sessionId}.
  if (envBase) {
    try {
      const url = new URL(envBase)
      const protocol = url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol
      return `${protocol}//${url.host}${url.pathname.replace(/\/$/, '')}/ws/${sessionId}`
    } catch (e) {
      console.warn('Invalid VITE_COURT_WS_URL, falling back to same-origin WebSocket', e)
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  if (host.startsWith('localhost:5173') || host.startsWith('localhost:5174') || host.startsWith('localhost:5175')) {
    return `${protocol}//localhost:8000/ws/${sessionId}`
  }
  return `${protocol}//${host}/ws/${sessionId}`
}

export function useCourtroomWebSocket(sessionId) {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [currentStage, setCurrentStage] = useState(null)
  const [canUserSpeak, setCanUserSpeak] = useState(false)
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const handleMessage = useCallback((message) => {
    setMessages((prev) => [...prev, message])

    switch (message.type) {
      case 'stage_change':
        setCurrentStage(message.data.stageName)
        setCanUserSpeak(Boolean(message.data.canUserSpeak))
        setMicrophoneEnabled(Boolean(message.data.canUserSpeak))
        break
      case 'session_complete':
        setMicrophoneEnabled(false)
        setCanUserSpeak(false)
        break
      default:
        break
    }
  }, [])

  const connect = useCallback(() => {
    const wsUrl = buildWebSocketUrl(sessionId)

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setConnected(true)
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          handleMessage(parsed)
        } catch (error) {
          console.error('Failed to parse WebSocket message', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error', error)
      }

      ws.onclose = (event) => {
        setConnected(false)
        if (event.code !== 1000 && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
              connect()
            }
          }, 3000)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket', error)
    }
  }, [handleMessage, sessionId])

  const sendMessage = useCallback((type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
        }),
      )
    } else {
      console.warn('WebSocket not connected; message skipped')
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return {
    connected,
    sendMessage,
    messages,
    currentStage,
    canUserSpeak,
    microphoneEnabled,
  }
}


