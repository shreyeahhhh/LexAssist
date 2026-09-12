import { useMemo, useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'
import TranscriptPanel from './TranscriptPanel'
import MicrophoneControl from './MicrophoneControl'
import StageControls from './StageControls'

const STAGE_ORDER = [
  'COURT_OPENING',
  'OPENING_ARGUMENT',
  'EVIDENCE_SUBMISSION',
  'COUNTER_ARGUMENT',
  'CLOSING_ARGUMENT',
  'EDUCATIONAL_JUDGMENT',
]

export default function VirtualCourtroomView({
  connected,
  selectedLanguage,
  onLanguageChange,
  messages,
  currentStage,
  caseSummary,
  exhibits,
  isExhibitUploading,
  exhibitUploadStatus,
  exhibitUploadError,
  objectionEnabled,
  microphoneEnabled,
  isListening,
  transcript,
  onStageComplete,
  onEndSession,
  onSetMute,
  isUserMuted,
  voiceError,
  onSendTextInput,
  onSubmitExhibit,
  onUploadExhibitFile,
  onChallengeExhibit,
  sessionSummary,
  onRaiseObjection,
}) {
  const [manualText, setManualText] = useState('')
  const [exhibitTitle, setExhibitTitle] = useState('')
  const [exhibitSummary, setExhibitSummary] = useState('')
  const [selectedChallengeExhibitId, setSelectedChallengeExhibitId] = useState('')
  const isMalayalam = selectedLanguage === 'ml-IN'

  const progress = useMemo(() => {
    const idx = STAGE_ORDER.indexOf(currentStage)
    if (idx < 0) return 0
    return ((idx + 1) / STAGE_ORDER.length) * 100
  }, [currentStage])

  const objectionReferenceMap = {
    hearsay: 'BSA principles on direct oral evidence, relevance, and recognized exceptions.',
    relevance: 'BSA framework on facts in issue and relevant facts for admissibility.',
    'leading question': 'BSA safeguards on leading questions during examination.',
    authentication: 'BSA principles on proof of documents and authentication of records.',
    general: 'Admissibility depends on relevance, authenticity, and probative value under BSA.',
  }
  const objectionReferenceMapMalayalam = {
    hearsay: 'ഭാരതീയ സാക്ഷ്യ അധിനിയമത്തിലെ നേരിട്ടുള്ള മൊഴി, പ്രസക്തി, ഒഴിവാക്കൽ സിദ്ധാന്തങ്ങൾ.',
    relevance: 'ഭാരതീയ സാക്ഷ്യ അധിനിയമത്തിലെ facts in issue, relevant facts മാനദണ്ഡങ്ങൾ.',
    'leading question': 'സാക്ഷി ചോദ്യം ചെയ്യലിലെ leading question നിയന്ത്രണങ്ങൾ.',
    authentication: 'രേഖകളുടെ തെളിയിക്കൽ (proof)യും യാഥാർത്ഥ്യസ്ഥാപന (authentication) മാനദണ്ഡങ്ങളും.',
    general: 'സ്വീകര്യത പ്രസക്തി, യാഥാർത്ഥ്യം, probative value എന്നിവയെ ആശ്രയിക്കുന്നു.',
  }

  const formatRulingWithReference = (rulingData = {}) => {
    const objectionType = (rulingData.objectionType || 'general').toLowerCase()
    const referenceSource = isMalayalam ? objectionReferenceMapMalayalam : objectionReferenceMap
    const reference = referenceSource[objectionType] || referenceSource.general
    const rulingText = rulingData.ruling || ''
    return `${rulingText}\n\n${isMalayalam ? 'റഫറൻസ്' : 'Reference'}: ${reference}`
  }

  const transcriptEntries = useMemo(() => {
    return messages
      .filter((m) => ['ai_speech', 'user_input_accepted', 'objection_ruling', 'system_note', 'system'].includes(m.type))
      .map((m) => {
        if (m.type === 'ai_speech') {
          return { role: m.role || 'JUDGE', text: m.data?.text || '' }
        }
        if (m.type === 'user_input_accepted') {
          return { role: 'USER_LAWYER', text: m.data?.transcript || '' }
        }
        if (m.type === 'objection_ruling') {
          return { role: m.role || 'JUDGE', text: formatRulingWithReference(m.data || {}) }
        }
        if (m.type === 'system_note') {
          return { role: 'SYSTEM', text: m.data?.text || '' }
        }
        if (m.type === 'system') {
          return { role: 'SYSTEM', text: m.data?.message || '' }
        }
        return null
      })
      .filter(Boolean)
  }, [messages, isMalayalam])

  const latestByRole = useMemo(() => {
    const latest = {
      JUDGE: '',
      USER_LAWYER: '',
      OPPOSING_LAWYER: '',
    }
    transcriptEntries.forEach((entry) => {
      if (entry.role === 'JUDGE') latest.JUDGE = entry.text
      if (entry.role === 'USER_LAWYER') latest.USER_LAWYER = entry.text
      if (entry.role === 'OPPOSING_LAWYER') latest.OPPOSING_LAWYER = entry.text
    })
    return latest
  }, [transcriptEntries])

  const canCompleteStage = [
    'COURT_OPENING',
    'OPENING_ARGUMENT',
    'EVIDENCE_SUBMISSION',
    'COUNTER_ARGUMENT',
    'CLOSING_ARGUMENT',
  ].includes(currentStage)

  const stageLabels = {
    COURT_OPENING: 'Court Opening',
    OPENING_ARGUMENT: 'Opening Argument',
    EVIDENCE_SUBMISSION: 'Evidence Submission',
    COUNTER_ARGUMENT: 'Counter Argument',
    CLOSING_ARGUMENT: 'Closing Argument',
    EDUCATIONAL_JUDGMENT: 'Educational Judgment',
  }
  const stageLabelsMalayalam = {
    COURT_OPENING: 'കോടതി ആരംഭം',
    OPENING_ARGUMENT: 'പ്രാരംഭ വാദം',
    EVIDENCE_SUBMISSION: 'തെളിവ് സമർപ്പണം',
    COUNTER_ARGUMENT: 'എതിർവാദം',
    CLOSING_ARGUMENT: 'സമാപന വാദം',
    EDUCATIONAL_JUDGMENT: 'പരിശീലന വിധി',
  }

  const languageOptions = [
    { code: 'en-IN', label: 'English' },
    { code: 'hi-IN', label: 'Hindi' },
    { code: 'ta-IN', label: 'Tamil' },
    { code: 'te-IN', label: 'Telugu' },
    { code: 'ml-IN', label: 'Malayalam' },
    { code: 'kn-IN', label: 'Kannada' },
  ]

  const objectionHint = objectionEnabled
    ? isMalayalam
      ? 'ഇപ്പോൾ ആക്ഷേപം ഉന്നയിക്കാം — കാരണം തിരഞ്ഞെടുക്കുക.'
      : 'You may raise an objection now — pick a ground.'
    : isMalayalam
    ? 'AI സംസാരം പൂർത്തിയാകുമ്പോൾ ആക്ഷേപ ബട്ടണുകൾ സജ്ജമാകും.'
    : 'Objection buttons unlock as soon as the AI finishes speaking.'

  return (
    <div className="virtual-courtroom bg-gradient-to-br from-slate-900 via-slate-950 to-black min-h-screen text-white pt-20 pb-4 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">{isMalayalam ? 'കേസ്' : 'Case'}</div>
              <div className="text-2xl font-bold">
                {isMalayalam ? 'വർച്വൽ കോടതി സെഷൻ' : 'Virtual Courtroom Session'}
              </div>
              <div className="text-sm text-slate-300">
                {isMalayalam ? 'നിലവിലെ ഘട്ടം:' : 'Current stage:'}{' '}
                {currentStage
                  ? isMalayalam
                    ? stageLabelsMalayalam[currentStage] || currentStage.replace(/_/g, ' ')
                    : currentStage.replace(/_/g, ' ')
                  : isMalayalam
                  ? 'ആരംഭിച്ചിട്ടില്ല'
                  : 'Not started'}
              </div>
              <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs border ${
                connected ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-rose-500/15 text-rose-200 border-rose-500/40'
              }`}>
                {connected
                  ? isMalayalam
                    ? 'കോടതി സർവർ ബന്ധിപ്പിച്ചിരിക്കുന്നു'
                    : 'Court server connected'
                  : isMalayalam
                  ? 'കോടതി സർവറിലേക്ക് വീണ്ടും ബന്ധിപ്പിക്കുന്നു...'
                  : 'Reconnecting to court server...'}
              </div>
              {caseSummary ? (
                <div className="mt-2 text-sm text-slate-200">
                  <span className="font-semibold text-amber-200">{isMalayalam ? 'ഉപയോക്തൃ കേസ്:' : 'User case:'}</span> {caseSummary}
                </div>
              ) : null}
            </div>
            <div className="flex-1 md:max-w-md space-y-2">
              <div className="flex justify-end">
                <label className="text-xs text-slate-300 inline-flex items-center gap-2">
                  {isMalayalam ? 'കോടതി ഭാഷ' : 'Court language'}
                  <div className="relative">
                    <select
                      value={selectedLanguage}
                      onChange={(e) => onLanguageChange(e.target.value)}
                      className="lexassist-select appearance-none bg-slate-800/80 border border-slate-600 text-slate-100 text-xs rounded-lg px-3 pr-8 py-1.5 shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {languageOptions.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  </div>
                </label>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-amber-400 transition-all"
                  style={{ width: `${progress}%` }}
                  aria-label="Stage progress"
                />
              </div>
              <div className="text-xs text-right text-slate-400 mt-1">
                {isMalayalam ? `പ്രവാഹത്തിൽ ${Math.round(progress)}% പൂർത്തിയായി` : `${Math.round(progress)}% through the flow`}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">
            {isMalayalam ? 'വാദക്രമം' : 'Hearing flow'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {STAGE_ORDER.map((stage, idx) => {
              const currentIdx = STAGE_ORDER.indexOf(currentStage)
              const completed = currentIdx > idx
              const active = currentIdx === idx
              return (
                <div
                  key={stage}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    active
                      ? 'border-amber-300 bg-amber-500/20 text-amber-100'
                      : completed
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                      : 'border-slate-700 bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="font-semibold">
                    {idx + 1}. {isMalayalam ? stageLabelsMalayalam[stage] : stageLabels[stage]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] gap-5 items-stretch lg:h-[calc(100vh-13.5rem)]">
          <div className="space-y-4 min-w-0 flex flex-col min-h-0">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-200 font-semibold">
                  <span className="text-xl">👨‍⚖️</span> {isMalayalam ? 'ജഡ്ജി' : 'Judge'}
                </div>
                <div className="text-sm text-slate-200 whitespace-pre-line min-h-[48px]">
                  {latestByRole.JUDGE || (isMalayalam ? 'കാത്തിരിക്കുന്നു...' : 'Waiting...')}
                </div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-200 font-semibold">
                  <span className="text-xl">🧑‍⚖️</span> {isMalayalam ? 'നിങ്ങൾ (അഭിഭാഷകൻ)' : 'You (Counsel)'}
                </div>
                <div className="text-sm text-slate-200 whitespace-pre-line min-h-[48px]">
                  {latestByRole.USER_LAWYER || (isMalayalam ? '“സംസാരം ആരംഭിക്കുക” അമർത്തുമ്പോൾ നിങ്ങളുടെ വാറ്.' : 'Your turn when you click Start speaking')}
                </div>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-200 font-semibold">
                  <span className="text-xl">👔</span> {isMalayalam ? 'എതിര്‍ അഭിഭാഷകൻ' : 'Defense Counsel'}
                </div>
                <div className="text-sm text-slate-200 whitespace-pre-line min-h-[48px]">
                  {latestByRole.OPPOSING_LAWYER || (isMalayalam ? 'കാത്തിരിക്കുന്നു...' : 'Waiting...')}
                </div>
              </div>
            </div>

            <TranscriptPanel
              messages={transcriptEntries}
              interimTranscript={transcript}
              selectedLanguage={selectedLanguage}
              className="flex-1 min-h-[360px]"
            />
          </div>

          <aside className="space-y-4 md:sticky md:top-24 md:max-h-[calc(100vh-7.5rem)] md:overflow-y-auto md:pr-1">
            <MicrophoneControl
              enabled={microphoneEnabled}
              isListening={isListening}
              error={voiceError}
              onSetMute={onSetMute}
              isUserMuted={isUserMuted}
              selectedLanguage={selectedLanguage}
            />
            <div className="bg-slate-900/60 border border-amber-800/60 rounded-2xl p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-200">
                {isMalayalam ? 'കോടതി പ്രവർത്തനങ്ങൾ' : 'Court actions'}
              </div>
              <p className={`text-xs ${objectionEnabled ? 'text-emerald-200' : 'text-slate-300'}`}>
                {objectionHint}
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => onRaiseObjection('relevance')}
                  disabled={!objectionEnabled}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 font-semibold py-2 rounded-lg shadow"
                >
                  {isMalayalam ? 'ആക്ഷേപം: പ്രസക്തിയില്ല' : 'Objection: Relevance'}
                </button>
                <button
                  type="button"
                  onClick={() => onRaiseObjection('hearsay')}
                  disabled={!objectionEnabled}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 font-semibold py-2 rounded-lg shadow"
                >
                  {isMalayalam ? 'ആക്ഷേപം: കേട്ടറിവ്' : 'Objection: Hearsay'}
                </button>
                <button
                  type="button"
                  onClick={() => onRaiseObjection('leading question')}
                  disabled={!objectionEnabled}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-amber-950 font-semibold py-2 rounded-lg shadow"
                >
                  {isMalayalam ? 'ആക്ഷേപം: സൂചനാ ചോദ്യം' : 'Objection: Leading'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold">
                  {isMalayalam ? 'തെളിവ് (Exhibit) സമർപ്പിക്കൽ' : 'Exhibit submission'}
                </div>
                <p className="text-xs text-slate-400">
                  {isMalayalam
                    ? 'A, B, C ആയി അടയാളപ്പെടുത്തി തെളിവ് ഘട്ടത്തിൽ സമർപ്പിക്കുക.'
                    : 'Mark exhibits as A, B, C and submit during evidence stage.'}
                </p>
              </div>
              <label className="w-full inline-flex items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-800/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/70 cursor-pointer">
                {isMalayalam ? '📎 Exhibit ഫയൽ അപ്‌ലോഡ് ചെയ്യുക (PDF/Image/Doc)' : '📎 Upload exhibit file (PDF/Image/Doc)'}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      onUploadExhibitFile(file)
                    }
                    e.target.value = ''
                  }}
                />
              </label>
              {isExhibitUploading ? (
                <p className="text-xs text-amber-200">
                  {isMalayalam ? 'Exhibit അപ്‌ലോഡ് ചെയ്ത് ടെക്സ്റ്റ് എടുക്കുന്നു...' : 'Uploading and extracting exhibit...'}
                </p>
              ) : null}
              {exhibitUploadStatus ? <p className="text-xs text-emerald-200">{exhibitUploadStatus}</p> : null}
              {exhibitUploadError ? <p className="text-xs text-rose-200">{exhibitUploadError}</p> : null}
              <input
                type="text"
                value={exhibitTitle}
                onChange={(e) => setExhibitTitle(e.target.value)}
                placeholder={
                  isMalayalam
                    ? 'Exhibit ശീർഷകം (ഉദാ: Loan Agreement dated 12 Jan 2024)'
                    : 'Exhibit title (e.g., Loan Agreement dated 12 Jan 2024)'
                }
                className="w-full bg-slate-800/70 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <textarea
                rows={2}
                value={exhibitSummary}
                onChange={(e) => setExhibitSummary(e.target.value)}
                placeholder={isMalayalam ? 'ഈ Exhibit എന്തുകൊണ്ട് പ്രധാനമാണ്?' : 'Why this exhibit matters'}
                className="w-full bg-slate-800/70 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (!exhibitTitle.trim() || !exhibitSummary.trim()) return
                  onSubmitExhibit({
                    title: exhibitTitle.trim(),
                    summary: exhibitSummary.trim(),
                  })
                  setExhibitTitle('')
                  setExhibitSummary('')
                }}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-indigo-950 font-semibold py-2 rounded-lg shadow"
              >
                {isMalayalam ? 'Exhibit അടയാളപ്പെടുത്തി സമർപ്പിക്കുക' : 'Mark and submit exhibit'}
              </button>
              {exhibits?.length ? (
                <div className="border border-slate-700 rounded-xl p-2 max-h-40 overflow-y-auto space-y-2">
                  {exhibits.map((item) => (
                    <div key={item.id} className="text-xs text-slate-200">
                      <div>
                        <span className="font-semibold text-indigo-200">{item.label}</span>: {item.title}
                      </div>
                      {item.sourceFile ? (
                        <div className="text-[11px] text-slate-400">Source: {item.sourceFile}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  {isMalayalam ? 'ഇപ്പോൾ Exhibit ഒന്നും സമർപ്പിച്ചിട്ടില്ല.' : 'No exhibits submitted yet.'}
                </p>
              )}
            </div>

            <div className="bg-slate-900/60 border border-cyan-800/60 rounded-2xl p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-cyan-100">
                  {isMalayalam ? 'സ്വീകര്യത (Admissibility) വെല്ലുവിളി' : 'Admissibility challenge'}
                </div>
                <p className="text-xs text-slate-300">
                  {isMalayalam
                    ? 'എതിർവാദ ഘട്ടത്തിൽ Exhibit യാഥാർത്ഥ്യം ചോദ്യം ചെയ്ത് ജഡ്ജിയുടെ വിധി അഭ്യർത്ഥിക്കുക.'
                    : 'Challenge exhibit authenticity during counter argument to request a judicial ruling.'}
                </p>
              </div>
              <div className="relative">
                <select
                  value={selectedChallengeExhibitId}
                  onChange={(e) => setSelectedChallengeExhibitId(e.target.value)}
                  className="lexassist-select w-full appearance-none bg-slate-800/70 border border-slate-700 rounded-xl px-3 pr-10 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="">{isMalayalam ? 'വെല്ലുവിളിക്കേണ്ട Exhibit തിരഞ്ഞെടുക്കുക' : 'Select exhibit to challenge'}</option>
                  {(exhibits || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} - {item.title}
                    </option>
                  ))}
                </select>
                <FiChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
              </div>
              <button
                type="button"
                disabled={!selectedChallengeExhibitId || !objectionEnabled}
                onClick={() => onChallengeExhibit({ exhibitId: selectedChallengeExhibitId, ground: 'authentication' })}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-950 font-semibold py-2 rounded-lg shadow"
              >
                {isMalayalam ? 'യാഥാർത്ഥ്യം വെല്ലുവിളിക്കുക' : 'Challenge authenticity'}
              </button>
            </div>

            <StageControls
              currentStage={currentStage}
              onStageComplete={onStageComplete}
              canCompleteStage={canCompleteStage}
              selectedLanguage={selectedLanguage}
            />

            <div className="bg-slate-900/60 border border-rose-800/60 rounded-2xl p-4 space-y-3">
              <div className="text-sm font-semibold text-rose-100">
                {isMalayalam ? 'കോടതി സെഷൻ അവസാനിപ്പിക്കുക' : 'End courtroom session'}
              </div>
              <p className="text-xs text-slate-300">
                {isMalayalam
                  ? 'ഇത് നിലവിലെ സിമുലേഷൻ അവസാനിപ്പിച്ച് ആരംഭ സ്ക്രീനിലേക്ക് തിരികെ കൊണ്ടുപോകും.'
                  : 'This will end the current simulation and return you to the start screen.'}
              </p>
              <button
                type="button"
                onClick={onEndSession}
                className="w-full bg-rose-500 hover:bg-rose-400 text-rose-950 font-semibold py-2 rounded-lg shadow"
              >
                {isMalayalam ? 'സെഷൻ അവസാനിപ്പിക്കുക' : 'End session'}
              </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{isMalayalam ? 'ടെക്സ്റ്റ് ഓപ്ഷൻ' : 'Text fallback'}</div>
                  <p className="text-xs text-slate-400">
                    {isMalayalam
                      ? 'സംസാരിക്കാൻ പകരം ടൈപ്പ് ചെയ്യാം. അത് നിങ്ങളുടെ വാറായി അയക്കും.'
                      : 'Type instead of speaking. We will send it as your turn.'}
                  </p>
                </div>
              </div>
              <textarea
                className="w-full bg-slate-800/70 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                rows={3}
                placeholder={isMalayalam ? 'നിങ്ങൾ പറയേണ്ടത് ടൈപ്പ് ചെയ്യുക...' : 'Type what you would like to say...'}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!manualText.trim()) return
                    onSendTextInput(manualText.trim())
                    setManualText('')
                  }}
                  className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-semibold px-4 py-2 rounded-lg shadow"
                >
                  {isMalayalam ? 'കോടതിയിലേക്ക് അയയ്ക്കുക' : 'Send to courtroom'}
                </button>
              </div>
            </div>

            {sessionSummary ? (
              <div className="bg-slate-900/70 border border-amber-700/60 rounded-2xl p-4 space-y-3">
                <div className="text-sm font-semibold text-amber-200">
                  {isMalayalam ? 'സെഷൻ സംഗ്രഹം' : 'Session summary'}
                </div>
                <div className="text-xs text-slate-100 space-y-2 max-h-60 overflow-y-auto">
                  {(sessionSummary.entries || []).map((entry, idx) => (
                    <div key={idx} className="border-b border-slate-800 pb-1">
                      <div className="text-amber-300 font-semibold">{entry.role}</div>
                      <div className="text-slate-100 whitespace-pre-line">{entry.text}</div>
                    </div>
                  ))}
                  {!sessionSummary.entries?.length && (
                    <div>{isMalayalam ? 'ട്രാൻസ്‌ക്രിപ്റ്റ് ലഭ്യമല്ല.' : 'No transcript available.'}</div>
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}


