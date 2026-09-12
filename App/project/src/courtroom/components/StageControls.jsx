const stageCopy = {
  COURT_OPENING: 'Stand by while the Honorable Judge opens the session and frames the issue.',
  OPENING_ARGUMENT: 'State facts first, then relief sought. Keep it short and respectful.',
  EVIDENCE_SUBMISSION: 'Present documents/witness points with relevance and date context.',
  COUNTER_ARGUMENT: 'Listen fully, then object only on valid grounds (hearsay, relevance, leading).',
  CLOSING_ARGUMENT: 'Summarize facts, legal basis, and exact relief in 3-5 points.',
  EDUCATIONAL_JUDGMENT: 'Judge provides educational order and improvement notes.',
}

const stageCopyHindi = {
  COURT_OPENING: 'माननीय न्यायाधीश द्वारा कार्यवाही शुरू होने की प्रतीक्षा करें।',
  OPENING_ARGUMENT: 'पहले तथ्य रखें, फिर मांगी गई राहत स्पष्ट बताएं।',
  EVIDENCE_SUBMISSION: 'साक्ष्य क्रम से प्रस्तुत करें और उसकी प्रासंगिकता बताएं।',
  COUNTER_ARGUMENT: 'पूरा सुनें, फिर उचित आधार पर ही आपत्ति उठाएं।',
  CLOSING_ARGUMENT: '3-5 बिंदुओं में तथ्य, आधार और राहत का सार दें।',
  EDUCATIONAL_JUDGMENT: 'न्यायाधीश शैक्षिक निर्णय और सुधार सुझाव देंगे।',
}

const stageCopyMalayalam = {
  COURT_OPENING: 'മാന്യനായ ജഡ്ജി വിചാരണ ആരംഭിക്കുന്നതിനായി കാത്തിരിക്കുക.',
  OPENING_ARGUMENT: 'ആദ്യം വസ്തുതകൾ വ്യക്തമാക്കുക, തുടർന്ന് ആവശ്യപ്പെടുന്ന പരിഹാരം പറയുക.',
  EVIDENCE_SUBMISSION: 'രേഖകൾ/സാക്ഷികൾ തീയതിയോടും പ്രസക്തിയോടും കൂടി അവതരിപ്പിക്കുക.',
  COUNTER_ARGUMENT: 'എതിർവാദം മുഴുവനായി കേൾക്കുക; സാധുവായ അടിസ്ഥാനത്തിൽ മാത്രം ആക്ഷേപിക്കുക.',
  CLOSING_ARGUMENT: '3-5 പ്രധാന പോയിന്റുകളിൽ വസ്തുത, നിയമഅടിസ്ഥാനം, പരിഹാരം ചുരുക്കുക.',
  EDUCATIONAL_JUDGMENT: 'ജഡ്ജി പരിശീലന ലക്ഷ്യത്തോടെ വിധിയും നിർദ്ദേശങ്ങളും നൽകും.',
}

export default function StageControls({ currentStage, onStageComplete, canCompleteStage, selectedLanguage }) {
  const stageNameMalayalam = {
    COURT_OPENING: 'കോടതി ആരംഭം',
    OPENING_ARGUMENT: 'പ്രാരംഭ വാദം',
    EVIDENCE_SUBMISSION: 'തെളിവ് സമർപ്പണം',
    COUNTER_ARGUMENT: 'എതിർവാദം',
    CLOSING_ARGUMENT: 'സമാപന വാദം',
    EDUCATIONAL_JUDGMENT: 'പരിശീലന വിധി',
  }
  const activeStageCopy =
    selectedLanguage === 'hi-IN'
      ? stageCopyHindi
      : selectedLanguage === 'ml-IN'
      ? stageCopyMalayalam
      : stageCopy
  const instructions =
    activeStageCopy[currentStage] ||
    (selectedLanguage === 'hi-IN'
      ? 'निर्देश की प्रतीक्षा करें...'
      : selectedLanguage === 'ml-IN'
      ? 'നിർദ്ദേശങ്ങൾ കാത്തിരിക്കുന്നു...'
      : 'Waiting for instructions...')

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
          {selectedLanguage === 'hi-IN' ? 'वर्तमान चरण' : 'Current stage'}
        </div>
        <div className="text-lg font-semibold">
          {currentStage
            ? selectedLanguage === 'ml-IN'
              ? stageNameMalayalam[currentStage] || currentStage.replace(/_/g, ' ')
              : currentStage.replace(/_/g, ' ')
            : selectedLanguage === 'ml-IN'
            ? 'ആരംഭിച്ചിട്ടില്ല'
            : 'Not started'}
        </div>
        <p className="text-sm text-slate-300 mt-1">{instructions}</p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
          {selectedLanguage === 'hi-IN'
            ? 'कोर्टरूम संकेत'
            : selectedLanguage === 'ml-IN'
            ? 'കോടതി സൂചനകൾ'
            : 'Courtroom cues'}
        </div>
        <ul className="text-sm text-slate-200 space-y-1 list-disc list-inside">
          {selectedLanguage === 'hi-IN' ? (
            <>
              <li>न्यायाधीश को “Your Honor” कहकर संबोधित करें।</li>
              <li>आपत्ति कारण सहित उठाएं (जैसे hearsay, relevance)।</li>
              <li>बीच में न बोलें, अपनी बारी का संकेत आने दें।</li>
            </>
          ) : selectedLanguage === 'ml-IN' ? (
            <>
              <li>ജഡ്ജിയെ “Your Honor” എന്നു അഭിസംബോധന ചെയ്യുക.</li>
              <li>കാരണം വ്യക്തമാക്കി ആക്ഷേപിക്കുക (ഉദാ: hearsay, relevance).</li>
              <li>ഇടക്ക് മുറിക്കരുത്; നിങ്ങളുടെ വാരസൂചകം വരുമ്പോൾ സംസാരിക്കുക.</li>
            </>
          ) : (
            <>
              <li>Address judge as “Your Honor”.</li>
              <li>Raise objection only with reason (e.g., hearsay, relevance).</li>
              <li>Avoid interruptions; wait for your speaking turn indicator.</li>
            </>
          )}
        </ul>
      </div>

      {canCompleteStage && (
        <button
          type="button"
          onClick={onStageComplete}
          className="w-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-semibold py-2 rounded-lg shadow"
        >
          {selectedLanguage === 'hi-IN'
            ? 'मौजूदा चरण पूरा करें'
            : selectedLanguage === 'ml-IN'
            ? 'നിലവിലെ ഘട്ടം പൂർത്തിയാക്കുക'
            : 'Complete current stage'}
        </button>
      )}
    </div>
  )
}


