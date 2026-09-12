import { useEffect, useMemo, useRef, useState } from 'react'

const roleStyles = {
  JUDGE: 'border-amber-400/70 bg-amber-500/10 text-amber-100',
  USER_LAWYER: 'border-emerald-400/70 bg-emerald-500/10 text-emerald-100',
  OPPOSING_LAWYER: 'border-rose-400/70 bg-rose-500/10 text-rose-100',
  WITNESS: 'border-sky-400/70 bg-sky-500/10 text-sky-100',
  ACCUSED: 'border-fuchsia-400/70 bg-fuchsia-500/10 text-fuchsia-100',
  SYSTEM: 'border-slate-600 bg-slate-800/60 text-slate-200',
}

export default function TranscriptPanel({
  messages,
  interimTranscript,
  selectedLanguage = 'en-IN',
  className = '',
}) {
  const containerRef = useRef(null)
  const [roleFilter, setRoleFilter] = useState('ALL')
  const isMalayalam = selectedLanguage === 'ml-IN'

  const roleLabels = {
    JUDGE: isMalayalam ? 'ജഡ്ജി' : 'Judge',
    USER_LAWYER: isMalayalam ? 'നിങ്ങൾ (Prosecutor)' : 'You (Prosecutor)',
    OPPOSING_LAWYER: isMalayalam ? 'പ്രതിഭാഗം അഭിഭാഷകൻ' : 'Defense Lawyer',
    WITNESS: isMalayalam ? 'സാക്ഷി' : 'Witness',
    ACCUSED: isMalayalam ? 'പ്രതി' : 'Accused',
    SYSTEM: isMalayalam ? 'സിസ്റ്റം' : 'System',
  }

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const filteredMessages = useMemo(() => {
    if (roleFilter === 'ALL') return messages
    return messages.filter((item) => item.role === roleFilter)
  }, [messages, roleFilter])

  return (
    <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col min-h-[320px] ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg">{isMalayalam ? 'ട്രാൻസ്‌ക്രിപ്റ്റ്' : 'Transcript'}</h3>
        <span className="text-xs text-slate-400">{isMalayalam ? 'തത്സമയ ഫീഡ്' : 'Live feed'}</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { id: 'ALL', label: isMalayalam ? 'എല്ലാം' : 'All' },
          { id: 'JUDGE', label: isMalayalam ? 'ജഡ്ജി' : 'Judge' },
          { id: 'USER_LAWYER', label: isMalayalam ? 'നിങ്ങൾ' : 'You' },
          { id: 'OPPOSING_LAWYER', label: isMalayalam ? 'എതിർവശം' : 'Opposing' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRoleFilter(item.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              roleFilter === item.id
                ? 'bg-amber-400/30 border-amber-300 text-amber-100'
                : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-700/70'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredMessages.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-6">
            {isMalayalam
              ? 'ഈ ഫിൽറ്ററിന് ഇപ്പോൾ ട്രാൻസ്‌ക്രിപ്റ്റ് എൻട്രികൾ ഇല്ല.'
              : 'No transcript entries for this filter yet.'}
          </div>
        )}
        {filteredMessages.map((item, idx) => (
          <div
            key={idx}
            className={`rounded-xl border px-3 py-2 text-sm shadow-sm ${roleStyles[item.role] || roleStyles.SYSTEM}`}
          >
            <div className="font-semibold text-xs uppercase tracking-wide mb-1">
              {roleLabels[item.role] || roleLabels.SYSTEM}
            </div>
            <p className="leading-relaxed whitespace-pre-line">{item.text}</p>
          </div>
        ))}
      </div>
      {interimTranscript ? (
        <div className="mt-3 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2">
          {isMalayalam ? 'കേൾക്കുന്നു:' : 'Listening:'} {interimTranscript}
        </div>
      ) : null}
    </div>
  )
}


