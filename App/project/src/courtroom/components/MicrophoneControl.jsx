export default function MicrophoneControl({
  enabled,
  isListening,
  error,
  onSetMute,
  isUserMuted,
  selectedLanguage = 'en-IN',
}) {
  const isMalayalam = selectedLanguage === 'ml-IN'
  const copy = {
    micIssue: isMalayalam ? 'മൈക്രോഫോൺ പ്രശ്നം' : 'Microphone issue',
    micDisabled: isMalayalam ? 'മൈക്രോഫോൺ ഓഫാണ്' : 'Microphone disabled',
    waitTurn: isMalayalam ? 'സംസാരിക്കാൻ നിങ്ങളുടെ വാരം കാത്തിരിക്കുക.' : 'Wait for your turn to speak.',
    startSpeak: isMalayalam ? 'സംസാരം ആരംഭിക്കുക' : 'Start speaking',
    stopSpeak: isMalayalam ? 'സംസാരം നിർത്തുക' : 'Stop speaking',
    startTitle: isMalayalam ? 'സംസാരം ആരംഭിക്കാൻ ക്ലിക്ക് ചെയ്യുക' : 'Click to start speaking',
    stopTitle: isMalayalam ? 'സംസാരം നിർത്താൻ ക്ലിക്ക് ചെയ്യുക' : 'Click to stop speaking',
    mutedByYou: isMalayalam ? 'നിങ്ങൾ മ്യൂട്ട് ചെയ്തിരിക്കുന്നു' : 'Muted by you',
    listening: isMalayalam ? 'കേൾക്കുന്നു...' : 'Listening...',
    ready: isMalayalam ? 'തയ്യാർ' : 'Ready',
  }

  if (error) {
    return (
      <div className="bg-red-900/30 text-red-200 border border-red-700 rounded-xl p-4">
        <div className="font-semibold mb-1">{copy.micIssue}</div>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="flex items-center gap-3 bg-slate-800/70 border border-slate-700 text-slate-200 rounded-xl px-4 py-3">
        <span className="text-xl">🔇</span>
        <div>
          <div className="font-semibold">{copy.micDisabled}</div>
          <p className="text-sm text-slate-300">{copy.waitTurn}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {isUserMuted ? (
        <button
          className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-4 py-2 rounded-full font-semibold shadow"
          onClick={() => onSetMute(false)}
          title={copy.startTitle}
        >
          🎤 {copy.startSpeak}
        </button>
      ) : (
        <button
          className="bg-amber-400 hover:bg-amber-300 text-amber-950 px-4 py-2 rounded-full font-semibold shadow inline-flex items-center gap-2"
          onClick={() => onSetMute(true)}
          title={copy.stopTitle}
        >
          ⏹️ {copy.stopSpeak}
          {isListening && <span className="animate-ping inline-flex h-2 w-2 rounded-full bg-amber-900" />}
        </button>
      )}
      <div className="text-sm text-slate-200">
        {isUserMuted ? copy.mutedByYou : isListening ? copy.listening : copy.ready}
      </div>
    </div>
  )
}


