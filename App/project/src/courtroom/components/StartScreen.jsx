import { useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'

const languageOptions = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'kn-IN', label: 'Kannada' },
]

const copyByLang = {
  'en-IN': {
    heading: 'Virtual Courtroom',
    intro:
      'Practice an Indian courtroom hearing flow with a voice-first, AI-moderated simulation. Present facts, submit evidence, handle objections, and receive judge-led educational feedback.',
    caseLabel: 'Describe your case',
    caseHint:
      'Include parties, dates, dispute, and the exact relief you seek. The hearing simulation adapts to this brief.',
    startLabel: 'Begin Courtroom Session',
  },
  'hi-IN': {
    heading: 'वर्चुअल कोर्टरूम',
    intro:
      'भारतीय अदालत की सुनवाई प्रक्रिया का अभ्यास करें। तथ्य रखें, साक्ष्य प्रस्तुत करें, आपत्ति उठाएं और जज से शैक्षिक फीडबैक प्राप्त करें।',
    caseLabel: 'अपने मामले का विवरण लिखें',
    caseHint:
      'पक्षकार, तारीख, विवाद और मांगी गई राहत स्पष्ट लिखें। इसी के आधार पर सिमुलेशन तैयार होगा।',
    startLabel: 'कोर्टरूम सत्र शुरू करें',
  },
  'ml-IN': {
    heading: 'വർച്വൽ കോടതി മുറി',
    intro:
      'ഇന്ത്യൻ കോടതിയിലെ വിചാരണ പ്രവാഹം പരിശീലിക്കൂ. വസ്തുതകൾ അവതരിപ്പിക്കുക, തെളിവുകൾ സമർപ്പിക്കുക, ആക്ഷേപങ്ങൾ ഉയർത്തുക, ജഡ്ജിയിൽ നിന്ന് പരിശീലന ഫീഡ്ബാക്ക് ലഭിക്കൂ.',
    caseLabel: 'നിങ്ങളുടെ കേസ് വിവരിക്കുക',
    caseHint:
      'പക്ഷങ്ങൾ, തീയതികൾ, തർക്കവിഷയം, ആവശ്യപ്പെടുന്ന നിയമപരിഹാരം എന്നിവ വ്യക്തമാക്കുക. അതനുസരിച്ച് സിമുലേഷൻ ക്രമീകരിക്കും.',
    startLabel: 'കോടതി സെഷൻ ആരംഭിക്കുക',
  },
}

export default function StartScreen({ onStart, connected, selectedLanguage, onLanguageChange }) {
  const [caseText, setCaseText] = useState('')
  const charCount = caseText.trim().length
  const copy = copyByLang[selectedLanguage] || copyByLang['en-IN']
  const isMalayalam = selectedLanguage === 'ml-IN'

  return (
    <div className="virtual-courtroom bg-gradient-to-br from-slate-900 via-slate-950 to-black min-h-screen text-white pt-20 pb-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="text-5xl">⚖️</div>
          <h1 className="text-4xl font-extrabold tracking-tight">{copy.heading}</h1>
          <p className="text-slate-300 max-w-2xl mx-auto">
            {copy.intro}
          </p>
          <div className="flex justify-center">
            <label className="text-xs text-slate-300 flex items-center gap-2">
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
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs border ${
            connected ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-amber-500/15 text-amber-100 border-amber-400/40'
          }`}>
            {connected
              ? isMalayalam
                ? 'കോടതി എഞ്ചിൻ തയ്യാറാണ്'
                : 'Courtroom engine ready'
              : isMalayalam
              ? 'കോടതി എഞ്ചിനിലേക്ക് ബന്ധിപ്പിക്കുന്നു...'
              : 'Connecting to courtroom engine...'}
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
            <h2 className="font-semibold text-lg mb-2">{isMalayalam ? 'എന്താണ് പ്രതീക്ഷിക്കേണ്ടത്' : 'What to expect'}</h2>
            <ul className="text-sm text-slate-200 space-y-2">
              {isMalayalam ? (
                <>
                  <li>• ജില്ലാ കോടതിയുടെ രീതിയിലുള്ള ഘട്ടംഘട്ടമായ വിചാരണ</li>
                  <li>• തെളിവ് സമർപ്പണം, ചാലഞ്ച്, മറുപടി ഘട്ടങ്ങൾ</li>
                  <li>• ജഡ്ജിയുടെ ആക്ഷേപ വിധിയും പഠനപരമായ നിരീക്ഷണവും</li>
                </>
              ) : (
                <>
                  <li>• Structured hearing stages like district court flow</li>
                  <li>• Evidence submission, challenge, and rebuttal rounds</li>
                  <li>• Judge objections ruling and educational order</li>
                </>
              )}
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
            <h2 className="font-semibold text-lg mb-2">{isMalayalam ? 'ശബ്ദ ക്രമീകരണം' : 'Voice setup'}</h2>
            <ul className="text-sm text-slate-200 space-y-2">
              {isMalayalam ? (
                <>
                  <li>• മികച്ച തിരിച്ചറിയലിന് Chrome/Edge ഉപയോഗിക്കുക</li>
                  <li>• ആവശ്യപ്പെട്ടാൽ മൈക്രോഫോൺ അനുമതി നൽകുക</li>
                  <li>• ശബ്ദക്കുറവ് ഉള്ള അന്തരീക്ഷം കൃത്യത കൂട്ടും</li>
                </>
              ) : (
                <>
                  <li>• Use Chrome/Edge for best recognition</li>
                  <li>• Allow microphone access when prompted</li>
                  <li>• Quiet environment improves accuracy</li>
                </>
              )}
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg">
            <h2 className="font-semibold text-lg mb-2">{isMalayalam ? 'കോടതി ശിഷ്ടാചാരം' : 'Court etiquette'}</h2>
            <ul className="text-sm text-slate-200 space-y-2">
              {isMalayalam ? (
                <>
                  <li>• ജഡ്ജിയെ “Your Honor” എന്നു അഭിസംബോധന ചെയ്യുക</li>
                  <li>• ആദ്യം വസ്തുതകൾ, തുടർന്ന് ആവശ്യപ്പെടുന്ന നിയമപരിഹാരം പറയുക</li>
                  <li>• എതിർവാദിയെ ഇടക്കു മുറിക്കരുത്</li>
                </>
              ) : (
                <>
                  <li>• Address the bench as “Your Honor”</li>
                  <li>• State facts first, then legal relief sought</li>
                  <li>• Avoid interrupting opposing counsel</li>
                </>
              )}
            </ul>
          </div>
        </section>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">{copy.caseLabel}</h2>
              <p className="text-sm text-slate-300">
                {copy.caseHint}
              </p>
            </div>
            <span className="text-xs text-slate-400">{charCount} {isMalayalam ? 'അക്ഷരങ്ങൾ' : 'chars'}</span>
          </div>
          <textarea
            className="w-full bg-slate-800/70 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            rows={4}
            placeholder={
              isMalayalam
                ? 'ഉദാഹരണം: ഒപ്പിട്ട കരാറിന്റെ അടിസ്ഥാനത്തിൽ ഞാൻ ഒരു ബിസിനസ് പങ്കാളിക്കു ₹5,00,000 കടം നൽകി. 3 മാസം കഴിഞ്ഞിട്ടും തിരിച്ചടച്ചില്ല. പലിശയോടെ തുക വീണ്ടെടുക്കാൻ കോടതി സഹായം തേടുന്നു.'
                : 'Example: I lent ₹5,00,000 to a business partner under a signed agreement. They missed the repayment date by 3 months despite reminders. I seek repayment with interest.'
            }
            value={caseText}
            onChange={(e) => setCaseText(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => onStart('USER_PROVIDED', caseText.trim())}
            disabled={!connected || charCount < 30}
            className={`px-6 py-3 rounded-full text-lg font-semibold shadow-lg transition ${
              connected && charCount >= 30
                ? 'bg-amber-400 text-slate-900 hover:bg-amber-300'
                : 'bg-slate-600 text-slate-300 cursor-not-allowed'
            }`}
          >
            {connected ? copy.startLabel : isMalayalam ? 'ബന്ധിപ്പിക്കുന്നു...' : 'Connecting...'}
          </button>
        </div>
        {!connected || charCount < 30 ? (
          <p className="text-center text-xs text-slate-400">
            {!connected
              ? isMalayalam
                ? 'കോടതി കണക്ഷൻ കാത്തിരിക്കുന്നു.'
                : 'Waiting for courtroom connection.'
              : isMalayalam
              ? 'സിമുലേഷൻ കൃത്യമായി ക്രമീകരിക്കാൻ കുറഞ്ഞത് 30 അക്ഷരങ്ങൾ ചേർക്കുക.'
              : 'Add at least 30 characters so the simulation can frame your case properly.'}
          </p>
        ) : null}

        <p className="text-center text-xs text-slate-500">
          {isMalayalam
            ? 'ഇത് പരിശീലനത്തിനുള്ള സിമുലേഷൻ മാത്രം. ഇത് നിയമോപദേശം അല്ല, അഭിഭാഷകന്റെ സേവനത്തിന് പകരം വരില്ല.'
            : 'Educational simulation only. Not legal advice and not a substitute for an advocate.'}
        </p>
      </div>
    </div>
  )
}


