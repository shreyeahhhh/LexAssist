import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { FiMic, FiSend, FiVolume2, FiVolumeX, FiGlobe, FiTrash2 } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import { franc } from "franc";
import { supabase } from "./supabase";
import SelfLawyerTopBar from "./components/selfLawyer/SelfLawyerTopBar";
import SelfLawyerHistoryPanel from "./components/selfLawyer/SelfLawyerHistoryPanel";
import SelfLawyerToolkitPanel from "./components/selfLawyer/SelfLawyerToolkitPanel";
import SelfLawyerEvidencePanel from "./components/selfLawyer/SelfLawyerEvidencePanel";
import SelfLawyerChatPanel from "./components/selfLawyer/SelfLawyerChatPanel";
import LanguageSelect from "./components/LanguageSelect";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const normalizeServiceSlug = (title = "") =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isGuidedAssistanceRoute = (title = "") => {
  const normalized = normalizeServiceSlug(title);
  return (
    normalized === "personal-and-family-legal-assistance" ||
    normalized === "business-consumer-and-criminal-legal-assistance" ||
    normalized === "consumer-rights"
  );
};
const isSelfLawyerRoute = (title = "") =>
  normalizeServiceSlug(title) === "self-lawyer-guide";
const createChatSessionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const SELF_LAWYER_UI = {
  "en-US": {
    toolkitTitle: "Self Lawyer Assistant Toolkit",
    toolkitDesc: "Build your case profile once, then generate advanced strategy prompts in one click.",
    caseType: "Case type",
    stage: "Stage",
    courtLevel: "Court level",
    oppositeParty: "Opposite party",
    hearingDate: "Upcoming hearing date",
    reliefWanted: "Relief you want from court",
    keyFacts: "Key facts (short timeline)",
    opponentPlaceholder: "e.g. Landlord, employer, complainant",
    reliefPlaceholder: "e.g. bail, injunction, compensation, dismissal",
    factsPlaceholder: "Mention major dates and facts in sequence...",
    generatePrompt: "Generate guided strategy prompt",
    clearDraft: "Clear draft",
    draftAdded: "Draft prompt added to chat input:",
    quickActions: "Quick advanced actions",
    evidenceTitle: "Attach your proofs & evidence",
    evidenceDesc: "Upload FIR copies, notices, screenshots, documents, or other evidence. We'll extract the text and use it while guiding you as your self-lawyer mentor.",
    uploadEvidence: "Upload evidence",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "Uploading and reading your evidence...",
    evidenceUploaded: "Evidence extracted and attached to this chat.",
    extractedEvidence: "Extracted evidence text (you can edit this before asking questions):",
    chatPlaceholder: "Ask for strategy, drafts, arguments, checklists, or hearing prep...",
  },
  "hi-IN": {
    toolkitTitle: "सेल्फ लॉयर सहायक टूलकिट",
    toolkitDesc: "अपनी केस प्रोफाइल एक बार बनाएं, फिर एक क्लिक में उन्नत रणनीति प्रॉम्प्ट तैयार करें।",
    caseType: "मामले का प्रकार",
    stage: "चरण",
    courtLevel: "न्यायालय स्तर",
    oppositeParty: "विपक्षी पक्ष",
    hearingDate: "अगली सुनवाई की तारीख",
    reliefWanted: "अदालत से मांगी गई राहत",
    keyFacts: "मुख्य तथ्य (संक्षिप्त टाइमलाइन)",
    opponentPlaceholder: "उदा. मकान मालिक, नियोक्ता, शिकायतकर्ता",
    reliefPlaceholder: "उदा. जमानत, स्थगन आदेश, मुआवजा, खारिज",
    factsPlaceholder: "मुख्य तारीखें और तथ्य क्रम में लिखें...",
    generatePrompt: "मार्गदर्शित रणनीति प्रॉम्प्ट बनाएं",
    clearDraft: "ड्राफ्ट साफ करें",
    draftAdded: "ड्राफ्ट प्रॉम्प्ट चैट इनपुट में जोड़ा गया:",
    quickActions: "त्वरित उन्नत कार्य",
    evidenceTitle: "अपने प्रमाण और साक्ष्य जोड़ें",
    evidenceDesc: "FIR कॉपी, नोटिस, स्क्रीनशॉट, दस्तावेज या अन्य साक्ष्य अपलोड करें। हम टेक्स्ट निकालकर आपके सेल्फ लॉयर मार्गदर्शन में उपयोग करेंगे।",
    uploadEvidence: "साक्ष्य अपलोड करें",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "आपके साक्ष्य को अपलोड और पढ़ा जा रहा है...",
    evidenceUploaded: "साक्ष्य निकाला गया और इस चैट में जोड़ दिया गया।",
    extractedEvidence: "निकाला गया साक्ष्य टेक्स्ट (प्रश्न पूछने से पहले आप इसे संपादित कर सकते हैं):",
    chatPlaceholder: "रणनीति, ड्राफ्ट, तर्क, चेकलिस्ट या सुनवाई तैयारी पूछें...",
  },
  "ml-IN": {
    toolkitTitle: "സ്വയം അഭിഭാഷക സഹായ ടൂൾകിറ്റ്",
    toolkitDesc: "കേസ് പ്രൊഫൈൽ ഒരിക്കൽ തയ്യാറാക്കി, ഒരു ക്ലിക്കിൽ പ്രായോഗിക തന്ത്ര പ്രോംപ്റ്റുകൾ സൃഷ്ടിക്കുക.",
    caseType: "കേസ് തരം",
    stage: "ഘട്ടം",
    courtLevel: "കോടതി നില",
    oppositeParty: "എതിര്‍ പാര്‍ട്ടി",
    hearingDate: "അടുത്ത കേള്‍വി തീയതി",
    reliefWanted: "കോടതിയില്‍ ആവശ്യപ്പെടുന്ന പരിഹാരം",
    keyFacts: "പ്രധാന വസ്തുതകള്‍ (ചുരുക്ക സമയരേഖ)",
    opponentPlaceholder: "ഉദാ. വീട്ടുടമ, തൊഴിലുടമ, പരാതിക്കാരി",
    reliefPlaceholder: "ഉദാ. ജാമ്യം, ഇൻജങ്ഷൻ, നഷ്ടപരിഹാരം, തള്ളല്‍",
    factsPlaceholder: "പ്രധാന തീയതികളും വസ്തുതകളും ക്രമത്തില്‍ രേഖപ്പെടുത്തുക...",
    generatePrompt: "ഗൈഡഡ് തന്ത്ര പ്രോംപ്റ്റ് സൃഷ്ടിക്കുക",
    clearDraft: "ഡ്രാഫ്റ്റ് മായ്ക്കുക",
    draftAdded: "ഡ്രാഫ്റ്റ് പ്രോംപ്റ്റ് ചാറ്റ് ഇൻപുട്ടിലേക്ക് ചേർത്തു:",
    quickActions: "വേഗത്തിലുള്ള അഡ്വാൻസ്ഡ് പ്രവർത്തനങ്ങൾ",
    evidenceTitle: "നിങ്ങളുടെ തെളിവുകൾ ചേർക്കുക",
    evidenceDesc: "FIR പകർപ്പുകൾ, നോട്ടീസുകൾ, സ്ക്രീൻഷോട്ടുകൾ, രേഖകൾ മുതലായവ അപ്ലോഡ് ചെയ്യുക. ടെക്സ്റ്റ് എക്സ്ട്രാക്റ്റ് ചെയ്ത് മാർഗനിർദേശത്തിൽ ഉപയോഗിക്കും.",
    uploadEvidence: "തെളിവ് അപ്ലോഡ് ചെയ്യുക",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "തെളിവുകൾ അപ്ലോഡ് ചെയ്ത് വായിക്കുകയാണ്...",
    evidenceUploaded: "തെളിവ് എക്സ്ട്രാക്റ്റ് ചെയ്ത് ഈ ചാറ്റിലേക്ക് ചേർത്തു.",
    extractedEvidence: "എക്സ്ട്രാക്റ്റ് ചെയ്ത തെളിവ് ടെക്സ്റ്റ് (ചോദിക്കാൻ മുമ്പ് എഡിറ്റ് ചെയ്യാം):",
    chatPlaceholder: "തന്ത്രം, ഡ്രാഫ്റ്റ്, വാദം, ചെക്ക്ലിസ്റ്റ്, കേൾവി തയ്യാറെടുപ്പ് എന്നിവ ചോദിക്കുക...",
  },
  "ta-IN": {
    toolkitTitle: "சுய வழக்கறிஞர் உதவி கருவிப்பெட்டி",
    toolkitDesc: "ஒருமுறை வழக்கு சுயவிவரம் உருவாக்கி, ஒரு கிளிக்கில் மேம்பட்ட வழிகாட்டல் பிராம்ப்ட்களை உருவாக்குங்கள்.",
    caseType: "வழக்கு வகை",
    stage: "நிலை",
    courtLevel: "நீதிமன்ற நிலை",
    oppositeParty: "எதிர் தரப்பு",
    hearingDate: "அடுத்த விசாரணை தேதி",
    reliefWanted: "நீதிமன்றத்தில் நீங்கள் கோரும் நிவாரணம்",
    keyFacts: "முக்கிய உண்மைகள் (சுருக்க காலவரிசை)",
    opponentPlaceholder: "எ.கா. வீட்டு உரிமையாளர், வேலைவாய்ப்பு நிறுவனம், புகாராளர்",
    reliefPlaceholder: "எ.கா. ஜாமீன், தடை உத்தரவு, இழப்பீடு, தள்ளுபடி",
    factsPlaceholder: "முக்கிய தேதிகள் மற்றும் உண்மைகளை வரிசையாக எழுதுங்கள்...",
    generatePrompt: "வழிகாட்டும் தந்திர பிராம்ப்டை உருவாக்கு",
    clearDraft: "வரைவை நீக்கு",
    draftAdded: "வரைவு பிராம்ப்ட் உரையாடல் உள்ளீட்டில் சேர்க்கப்பட்டது:",
    quickActions: "விரைவு மேம்பட்ட செயல்கள்",
    evidenceTitle: "உங்கள் ஆதாரங்களை இணைக்கவும்",
    evidenceDesc: "FIR நகல்கள், நோட்டீஸ், ஸ்கிரீன்‌ஷாட்கள், ஆவணங்கள் போன்ற ஆதாரங்களை பதிவேற்றவும். அவற்றை எடுத்துச் செயல்படுத்தி வழிகாட்டலில் பயன்படுத்துவோம்.",
    uploadEvidence: "ஆதாரம் பதிவேற்று",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "உங்கள் ஆதாரம் பதிவேற்றப்பட்டு வாசிக்கப்படுகிறது...",
    evidenceUploaded: "ஆதாரம் எடுத்தெடுக்கப்பட்டு இந்த உரையாடலுடன் இணைக்கப்பட்டது.",
    extractedEvidence: "எடுத்தெடுக்கப்பட்ட ஆதார உரை (கேள்வி கேட்கும் முன் திருத்தலாம்):",
    chatPlaceholder: "தந்திரம், வரைவு, வாதங்கள், சரிபார்ப்பு பட்டியல், விசாரணை தயார் பற்றி கேளுங்கள்...",
  },
  "te-IN": {
    toolkitTitle: "సెల్ఫ్ లాయర్ అసిస్టెంట్ టూల్‌కిట్",
    toolkitDesc: "మీ కేసు ప్రొఫైల్‌ను ఒకసారి సెట్ చేసి, ఒక్క క్లిక్‌తో అడ్వాన్స్డ్ స్ట్రాటజీ ప్రాంప్ట్‌లు సృష్టించండి.",
    caseType: "కేసు రకం",
    stage: "దశ",
    courtLevel: "కోర్టు స్థాయి",
    oppositeParty: "ప్రత్యర్థి పార్టీ",
    hearingDate: "తదుపరి విచారణ తేదీ",
    reliefWanted: "కోర్టు నుండి కోరే ఉపశమనం",
    keyFacts: "ముఖ్య విషయాలు (సంక్షిప్త టైమ్‌లైన్)",
    opponentPlaceholder: "ఉదా. ఇంటి యజమాని, ఉద్యోగదాత, ఫిర్యాదుదారు",
    reliefPlaceholder: "ఉదా. బెయిల్, ఇంజంక్షన్, పరిహారం, డిస్మిస్",
    factsPlaceholder: "ప్రధాన తేదీలు మరియు విషయాలను క్రమంగా వ్రాయండి...",
    generatePrompt: "గైడెడ్ స్ట్రాటజీ ప్రాంప్ట్ సృష్టించండి",
    clearDraft: "డ్రాఫ్ట్ క్లియర్ చేయండి",
    draftAdded: "డ్రాఫ్ట్ ప్రాంప్ట్ చాట్ ఇన్‌పుట్‌లో చేర్చబడింది:",
    quickActions: "త్వరిత అడ్వాన్స్డ్ చర్యలు",
    evidenceTitle: "మీ ఆధారాలు జోడించండి",
    evidenceDesc: "FIR కాపీలు, నోటీసులు, స్క్రీన్‌షాట్‌లు, పత్రాలు లేదా ఇతర ఆధారాలు అప్‌లోడ్ చేయండి. వాటిని చదివి మీకు మార్గదర్శకంగా ఉపయోగిస్తాము.",
    uploadEvidence: "ఆధారం అప్‌లోడ్ చేయండి",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "మీ ఆధారాన్ని అప్‌లోడ్ చేసి చదువుతున్నాం...",
    evidenceUploaded: "ఆధారం ఎక్స్‌ట్రాక్ట్ చేసి ఈ చాట్‌కు జోడించబడింది.",
    extractedEvidence: "ఎక్స్‌ట్రాక్ట్ చేసిన ఆధార పాఠ్యం (ప్రశ్నించే ముందు సవరించవచ్చు):",
    chatPlaceholder: "స్ట్రాటజీ, డ్రాఫ్ట్‌లు, వాదనలు, చెక్‌లిస్టులు లేదా విచారణ సిద్ధత గురించి అడగండి...",
  },
  "kn-IN": {
    toolkitTitle: "ಸ್ವಯಂ ವಕೀಲ ಸಹಾಯಕ ಟೂಲ್‌ಕಿಟ್",
    toolkitDesc: "ನಿಮ್ಮ ಕೇಸ್ ಪ್ರೊಫೈಲ್ ಅನ್ನು ಒಮ್ಮೆ ಸಿದ್ಧಪಡಿಸಿ, ಒಂದು ಕ್ಲಿಕ್‌ನಲ್ಲಿ ಮುಂದುವರಿದ ತಂತ್ರ ಪ್ರಾಂಪ್ಟ್‌ಗಳನ್ನು ರಚಿಸಿ.",
    caseType: "ಕೇಸ್ ಪ್ರಕಾರ",
    stage: "ಹಂತ",
    courtLevel: "ನ್ಯಾಯಾಲಯದ ಮಟ್ಟ",
    oppositeParty: "ವಿರೋಧಿ ಪಕ್ಷ",
    hearingDate: "ಮುಂದಿನ ವಿಚಾರಣೆ ದಿನಾಂಕ",
    reliefWanted: "ನ್ಯಾಯಾಲಯದಿಂದ ಬೇಕಾದ ಪರಿಹಾರ",
    keyFacts: "ಮುಖ್ಯ ಅಂಶಗಳು (ಸಂಕ್ಷಿಪ್ತ ಕಾಲರೇಖೆ)",
    opponentPlaceholder: "ಉದಾ. ಮನೆಮಾಲೀಕ, ಉದ್ಯೋಗದಾತ, ದೂರುದಾರ",
    reliefPlaceholder: "ಉದಾ. ಜಾಮೀನು, ಇಂಜಂಕ್ಷನ್, ಪರಿಹಾರ, ವಜಾ",
    factsPlaceholder: "ಮುಖ್ಯ ದಿನಾಂಕಗಳು ಮತ್ತು ಅಂಶಗಳನ್ನು ಕ್ರಮವಾಗಿ ಬರೆಯಿರಿ...",
    generatePrompt: "ಮಾರ್ಗದರ್ಶಿತ ತಂತ್ರ ಪ್ರಾಂಪ್ಟ್ ರಚಿಸಿ",
    clearDraft: "ಡ್ರಾಫ್ಟ್ ತೆರವುಗೊಳಿಸಿ",
    draftAdded: "ಡ್ರಾಫ್ಟ್ ಪ್ರಾಂಪ್ಟ್ ಚಾಟ್ ಇನ್‌ಪುಟ್‌ಗೆ ಸೇರಿಸಲಾಗಿದೆ:",
    quickActions: "ವೇಗದ ಮುಂದುವರಿದ ಕ್ರಿಯೆಗಳು",
    evidenceTitle: "ನಿಮ್ಮ ಸಾಕ್ಷಿ ಮತ್ತು ದಾಖಲೆಗಳನ್ನು ಸೇರಿಸಿ",
    evidenceDesc: "FIR ಪ್ರತಿಗಳು, ನೋಟಿಸ್, ಸ್ಕ್ರೀನ್‌ಶಾಟ್, ದಾಖಲೆಗಳು ಅಥವಾ ಇತರೆ ಸಾಕ್ಷಿಗಳನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ. ನಾವು ಪಠ್ಯವನ್ನು ತೆಗೆಯಿಸಿ ಮಾರ್ಗದರ್ಶನದಲ್ಲಿ ಬಳಸುತ್ತೇವೆ.",
    uploadEvidence: "ಸಾಕ್ಷಿ ಅಪ್ಲೋಡ್ ಮಾಡಿ",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "ನಿಮ್ಮ ಸಾಕ್ಷಿಯನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ ಓದುತ್ತಿದ್ದೇವೆ...",
    evidenceUploaded: "ಸಾಕ್ಷಿ ಪಠ್ಯವನ್ನು ತೆಗೆದು ಈ ಚಾಟ್‌ಗೆ ಸೇರಿಸಲಾಗಿದೆ.",
    extractedEvidence: "ತೆಗೆದ ಸಾಕ್ಷಿ ಪಠ್ಯ (ಪ್ರಶ್ನಿಸುವ ಮೊದಲು ಸಂಪಾದಿಸಬಹುದು):",
    chatPlaceholder: "ತಂತ್ರ, ಡ್ರಾಫ್ಟ್, ವಾದಗಳು, ಚೆಕ್‌ಲಿಸ್ಟ್ ಅಥವಾ ವಿಚಾರಣೆ ಸಿದ್ಧತೆ ಬಗ್ಗೆ ಕೇಳಿ...",
  },
  "gu-IN": {
    toolkitTitle: "સ્વ-વકીલ સહાયક ટૂલકિટ",
    toolkitDesc: "તમારી કેસ પ્રોફાઇલ એકવાર તૈયાર કરો, પછી એક ક્લિકમાં માર્ગદર્શિત સ્ટ્રેટેજી પ્રોમ્પ્ટ બનાવો.",
    caseType: "કેસનો પ્રકાર",
    stage: "સ્ટેજ",
    courtLevel: "કોર્ટ સ્તર",
    oppositeParty: "વિરોધી પક્ષ",
    hearingDate: "આગામી હિયરીંગ તારીખ",
    reliefWanted: "કોર્ટમાંથી માંગેલ રાહત",
    keyFacts: "મુખ્ય તથ્યો (ટૂંકો સમયક્રમ)",
    opponentPlaceholder: "દા.ત. મકાનમાલિક, નોકરીદાતા, ફરિયાદી",
    reliefPlaceholder: "દા.ત. જામીન, ઇન્જન્ક્શન, વળતર, રદ",
    factsPlaceholder: "મુખ્ય તારીખો અને તથ્યો ક્રમમાં લખો...",
    generatePrompt: "માર્ગદર્શિત સ્ટ્રેટેજી પ્રોમ્પ્ટ બનાવો",
    clearDraft: "ડ્રાફ્ટ સાફ કરો",
    draftAdded: "ડ્રાફ્ટ પ્રોમ્પ્ટ ચેટ ઇનપુટમાં ઉમેરાયો:",
    quickActions: "ઝડપી એડવાન્સ્ડ ક્રિયાઓ",
    evidenceTitle: "તમારા પુરાવા અને દસ્તાવેજો ઉમેરો",
    evidenceDesc: "FIR નકલ, નોટિસ, સ્ક્રીનશોટ, દસ્તાવેજો વગેરે અપલોડ કરો. અમે લખાણ કાઢીને માર્ગદર્શન માટે ઉપયોગ કરીશું.",
    uploadEvidence: "પુરાવો અપલોડ કરો",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "તમારો પુરાવો અપલોડ કરી વાંચી રહ્યા છીએ...",
    evidenceUploaded: "પુરાવાનું લખાણ કાઢીને આ ચેટમાં જોડાયું.",
    extractedEvidence: "કાઢેલ પુરાવાનું લખાણ (પ્રશ્ન પહેલાં તમે સંપાદિત કરી શકો):",
    chatPlaceholder: "સ્ટ્રેટેજી, ડ્રાફ્ટ, દલીલો, ચેકલિસ્ટ અથવા હિયરીંગ તૈયારી વિશે પૂછો...",
  },
  "mr-IN": {
    toolkitTitle: "सेल्फ लॉयर सहाय्यक टूलकिट",
    toolkitDesc: "तुमची केस प्रोफाइल एकदा तयार करा, मग एका क्लिकमध्ये मार्गदर्शित स्ट्रॅटेजी प्रॉम्प्ट तयार करा.",
    caseType: "केस प्रकार",
    stage: "टप्पा",
    courtLevel: "न्यायालय पातळी",
    oppositeParty: "विरोधी पक्ष",
    hearingDate: "पुढील सुनावणी तारीख",
    reliefWanted: "न्यायालयाकडून हवी असलेली दिलासा",
    keyFacts: "मुख्य तथ्ये (संक्षिप्त टाइमलाइन)",
    opponentPlaceholder: "उदा. घरमालक, नियोक्ता, तक्रारदार",
    reliefPlaceholder: "उदा. जामीन, स्थगिती आदेश, नुकसानभरपाई, खारिज",
    factsPlaceholder: "महत्त्वाच्या तारखा आणि तथ्ये क्रमाने लिहा...",
    generatePrompt: "मार्गदर्शित स्ट्रॅटेजी प्रॉम्प्ट तयार करा",
    clearDraft: "ड्राफ्ट साफ करा",
    draftAdded: "ड्राफ्ट प्रॉम्प्ट चॅट इनपुटमध्ये जोडला गेला:",
    quickActions: "त्वरित प्रगत कृती",
    evidenceTitle: "तुमचे पुरावे आणि कागदपत्रे जोडा",
    evidenceDesc: "FIR प्रती, नोटीस, स्क्रीनशॉट, कागदपत्रे इ. अपलोड करा. आम्ही मजकूर काढून मार्गदर्शनात वापरू.",
    uploadEvidence: "पुरावा अपलोड करा",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "पुरावा अपलोड करून वाचत आहोत...",
    evidenceUploaded: "पुराव्याचा मजकूर काढून या चॅटमध्ये जोडला.",
    extractedEvidence: "काढलेला पुरावा मजकूर (प्रश्न विचारण्यापूर्वी संपादित करू शकता):",
    chatPlaceholder: "स्ट्रॅटेजी, ड्राफ्ट, युक्तिवाद, चेकलिस्ट किंवा सुनावणी तयारीबद्दल विचारा...",
  },
  "bn-IN": {
    toolkitTitle: "সেলফ লইয়ার সহায়ক টুলকিট",
    toolkitDesc: "একবার আপনার কেস প্রোফাইল তৈরি করুন, তারপর এক ক্লিকে গাইডেড স্ট্র্যাটেজি প্রম্পট তৈরি করুন।",
    caseType: "মামলার ধরন",
    stage: "পর্যায়",
    courtLevel: "আদালতের স্তর",
    oppositeParty: "বিপক্ষ পক্ষ",
    hearingDate: "পরবর্তী শুনানির তারিখ",
    reliefWanted: "আদালতের কাছে চাওয়া প্রতিকার",
    keyFacts: "মূল তথ্য (সংক্ষিপ্ত টাইমলাইন)",
    opponentPlaceholder: "যেমন: বাড়িওয়ালা, নিয়োগকর্তা, অভিযোগকারী",
    reliefPlaceholder: "যেমন: জামিন, স্থগিতাদেশ, ক্ষতিপূরণ, খারিজ",
    factsPlaceholder: "গুরুত্বপূর্ণ তারিখ ও তথ্য ধারাবাহিকভাবে লিখুন...",
    generatePrompt: "গাইডেড স্ট্র্যাটেজি প্রম্পট তৈরি করুন",
    clearDraft: "ড্রাফ্ট মুছুন",
    draftAdded: "ড্রাফ্ট প্রম্পট চ্যাট ইনপুটে যোগ হয়েছে:",
    quickActions: "দ্রুত উন্নত অ্যাকশন",
    evidenceTitle: "আপনার প্রমাণ ও নথি যুক্ত করুন",
    evidenceDesc: "FIR কপি, নোটিশ, স্ক্রিনশট, নথি ইত্যাদি আপলোড করুন। আমরা লেখা বের করে গাইডেন্সে ব্যবহার করব।",
    uploadEvidence: "প্রমাণ আপলোড করুন",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "আপনার প্রমাণ আপলোড করে পড়া হচ্ছে...",
    evidenceUploaded: "প্রমাণের লেখা বের করে এই চ্যাটে যুক্ত করা হয়েছে।",
    extractedEvidence: "বের করা প্রমাণের লেখা (প্রশ্ন করার আগে সম্পাদনা করতে পারেন):",
    chatPlaceholder: "স্ট্র্যাটেজি, ড্রাফ্ট, যুক্তি, চেকলিস্ট বা শুনানির প্রস্তুতি সম্পর্কে জিজ্ঞেস করুন...",
  },
  "pa-IN": {
    toolkitTitle: "ਸੈਲਫ ਲਾਇਰ ਸਹਾਇਕ ਟੂਲਕਿਟ",
    toolkitDesc: "ਆਪਣਾ ਕੇਸ ਪ੍ਰੋਫਾਇਲ ਇਕ ਵਾਰ ਬਣਾਓ, ਫਿਰ ਇਕ ਕਲਿੱਕ ਨਾਲ ਗਾਈਡਡ ਰਣਨੀਤੀ ਪ੍ਰਾਂਪਟ ਬਣਾਓ।",
    caseType: "ਕੇਸ ਕਿਸਮ",
    stage: "ਪੜਾਅ",
    courtLevel: "ਅਦਾਲਤੀ ਪੱਧਰ",
    oppositeParty: "ਵਿਰੋਧੀ ਪੱਖ",
    hearingDate: "ਅਗਲੀ ਸੁਣਵਾਈ ਦੀ ਤਾਰੀਖ",
    reliefWanted: "ਅਦਾਲਤ ਤੋਂ ਮੰਗੀ ਰਾਹਤ",
    keyFacts: "ਮੁੱਖ ਤੱਥ (ਛੋਟੀ ਟਾਈਮਲਾਈਨ)",
    opponentPlaceholder: "ਉਦਾਹਰਣ: ਮਕਾਨਮਾਲਿਕ, ਨਿਯੋਗਕਰਤਾ, ਸ਼ਿਕਾਇਤਕਰਤਾ",
    reliefPlaceholder: "ਉਦਾਹਰਣ: ਜ਼ਮਾਨਤ, ਇੰਜੰਕਸ਼ਨ, ਮੁਆਵਜ਼ਾ, ਖ਼ਾਰਜੀ",
    factsPlaceholder: "ਮੁੱਖ ਤਾਰੀਖਾਂ ਅਤੇ ਤੱਥ ਕ੍ਰਮ ਨਾਲ ਲਿਖੋ...",
    generatePrompt: "ਗਾਈਡਡ ਰਣਨੀਤੀ ਪ੍ਰਾਂਪਟ ਬਣਾਓ",
    clearDraft: "ਡਰਾਫਟ ਸਾਫ ਕਰੋ",
    draftAdded: "ਡਰਾਫਟ ਪ੍ਰਾਂਪਟ ਚੈਟ ਇਨਪੁਟ ਵਿੱਚ ਜੋੜਿਆ ਗਿਆ:",
    quickActions: "ਤੇਜ਼ ਅਡਵਾਂਸ ਕਾਰਵਾਈਆਂ",
    evidenceTitle: "ਆਪਣੇ ਸਬੂਤ ਅਤੇ ਦਸਤਾਵੇਜ਼ ਜੋੜੋ",
    evidenceDesc: "FIR ਕਾਪੀਆਂ, ਨੋਟਿਸ, ਸਕ੍ਰੀਨਸ਼ਾਟ, ਦਸਤਾਵੇਜ਼ ਆਦਿ ਅਪਲੋਡ ਕਰੋ। ਅਸੀਂ ਟੈਕਸਟ ਕੱਢ ਕੇ ਗਾਈਡੈਂਸ ਵਿੱਚ ਵਰਤਾਂਗੇ।",
    uploadEvidence: "ਸਬੂਤ ਅਪਲੋਡ ਕਰੋ",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "ਤੁਹਾਡਾ ਸਬੂਤ ਅਪਲੋਡ ਅਤੇ ਪੜ੍ਹਿਆ ਜਾ ਰਿਹਾ ਹੈ...",
    evidenceUploaded: "ਸਬੂਤ ਦਾ ਟੈਕਸਟ ਕੱਢ ਕੇ ਇਸ ਚੈਟ ਵਿੱਚ ਜੋੜਿਆ ਗਿਆ।",
    extractedEvidence: "ਕੱਢਿਆ ਸਬੂਤ ਟੈਕਸਟ (ਸਵਾਲ ਪੁੱਛਣ ਤੋਂ ਪਹਿਲਾਂ ਸੋਧ ਸਕਦੇ ਹੋ):",
    chatPlaceholder: "ਰਣਨੀਤੀ, ਡਰਾਫਟ, ਦਲੀਲਾਂ, ਚੈਕਲਿਸਟ ਜਾਂ ਸੁਣਵਾਈ ਤਿਆਰੀ ਬਾਰੇ ਪੁੱਛੋ...",
  },
  "ur-IN": {
    toolkitTitle: "سیلف لایر معاون ٹول کِٹ",
    toolkitDesc: "اپنا کیس پروفائل ایک بار تیار کریں، پھر ایک کلک میں گائیڈڈ اسٹریٹیجی پرامپٹ بنائیں۔",
    caseType: "کیس کی قسم",
    stage: "مرحلہ",
    courtLevel: "عدالت کی سطح",
    oppositeParty: "مخالف فریق",
    hearingDate: "اگلی سماعت کی تاریخ",
    reliefWanted: "عدالت سے مطلوب ریلیف",
    keyFacts: "اہم حقائق (مختصر ٹائم لائن)",
    opponentPlaceholder: "مثلاً: مکان مالک، آجر، شکایت کنندہ",
    reliefPlaceholder: "مثلاً: ضمانت، حکم امتناعی، معاوضہ، خارج",
    factsPlaceholder: "اہم تاریخیں اور حقائق ترتیب سے لکھیں...",
    generatePrompt: "گائیڈڈ اسٹریٹیجی پرامپٹ بنائیں",
    clearDraft: "ڈرافٹ صاف کریں",
    draftAdded: "ڈرافٹ پرامپٹ چیٹ اِن پٹ میں شامل ہوگیا:",
    quickActions: "فوری جدید ایکشنز",
    evidenceTitle: "اپنے ثبوت اور دستاویزات شامل کریں",
    evidenceDesc: "FIR کی کاپیاں، نوٹس، اسکرین شاٹس، دستاویزات وغیرہ اپلوڈ کریں۔ ہم متن نکال کر رہنمائی میں استعمال کریں گے۔",
    uploadEvidence: "ثبوت اپلوڈ کریں",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "ثبوت اپلوڈ کرکے پڑھا جا رہا ہے...",
    evidenceUploaded: "ثبوت کا متن نکال کر اس چیٹ میں شامل کر دیا گیا۔",
    extractedEvidence: "نکالا گیا ثبوتی متن (سوال سے پہلے ترمیم کرسکتے ہیں):",
    chatPlaceholder: "اسٹریٹیجی، ڈرافٹ، دلائل، چیک لسٹ یا سماعت کی تیاری کے بارے میں پوچھیں...",
  },
  "as-IN": {
    toolkitTitle: "Self-Lawyer সহায়ক টুলকিট",
    toolkitDesc: "আপোনাৰ কেছ প্ৰোফাইল এবাৰ সাজু কৰক, তাৰ পিছত এটা ক্লিকতে গাইডেড ষ্ট্ৰেটেজি প্ৰম্প্ট বনাওক।",
    caseType: "কেছৰ ধৰণ",
    stage: "পৰ্যায়",
    courtLevel: "আদালতৰ স্তৰ",
    oppositeParty: "বিৰোধী পক্ষ",
    hearingDate: "পৰৱৰ্তী শুনানিৰ তাৰিখ",
    reliefWanted: "আদালতৰ পৰা বিচৰা সহায়",
    keyFacts: "মুখ্য তথ্য (চমু টাইমলাইন)",
    opponentPlaceholder: "যেনে: ঘৰমালিক, নিয়োগকৰ্তা, অভিযোগকাৰী",
    reliefPlaceholder: "যেনে: জামিন, injunction, ক্ষতিপূৰণ, খাৰিজ",
    factsPlaceholder: "গুৰুত্বপূর্ণ তাৰিখ আৰু তথ্য ধাৰাবাহিকভাৱে লিখক...",
    generatePrompt: "গাইডেড ষ্ট্ৰেটেজি প্ৰম্প্ট তৈয়াৰ কৰক",
    clearDraft: "ড্ৰাফ্ট মচি দিয়ক",
    draftAdded: "ড্ৰাফ্ট প্ৰম্প্ট চেট ইনপুটত যোগ কৰা হৈছে:",
    quickActions: "দ্ৰুত উন্নত কাৰ্য",
    evidenceTitle: "আপোনাৰ প্ৰমাণ আৰু নথিপত্ৰ সংলগ্ন কৰক",
    evidenceDesc: "FIR কপি, নোটিচ, স্ক্ৰিনশ্বট, নথিপত্ৰ আদি আপলোড কৰক। আমি লিখনী উলিয়াই গাইডেন্সত ব্যৱহাৰ কৰিম।",
    uploadEvidence: "প্ৰমাণ আপলোড কৰক",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "প্ৰমাণ আপলোড কৰি পঢ়া হৈছে...",
    evidenceUploaded: "প্ৰমাণৰ লিখনী উলিয়াই এই চেটত সংলগ্ন কৰা হৈছে।",
    extractedEvidence: "উলিয়াই অনা প্ৰমাণৰ লিখনী (প্ৰশ্ন কৰাৰ আগতে সম্পাদনা কৰিব পাৰিব):",
    chatPlaceholder: "ষ্ট্ৰেটেজি, ড্ৰাফ্ট, যুক্তি, চেকলিস্ট বা শুনানিৰ প্ৰস্তুতি বিষয়ে সুধক...",
  },
  "or-IN": {
    toolkitTitle: "ସେଲ୍ଫ ଲୟର ସହାୟକ ଟୁଲକିଟ",
    toolkitDesc: "ଆପଣଙ୍କ କେସ୍ ପ୍ରୋଫାଇଲ୍ ଥରେ ପ୍ରସ୍ତୁତ କରନ୍ତୁ, ପରେ ଏକ କ୍ଲିକରେ ଗାଇଡେଡ୍ ଷ୍ଟ୍ରାଟେଜି ପ୍ରମ୍ପ୍ଟ ତିଆରି କରନ୍ତୁ।",
    caseType: "କେସ୍ ପ୍ରକାର",
    stage: "ପର୍ଯ୍ୟାୟ",
    courtLevel: "ଆଦାଲତ ସ୍ତର",
    oppositeParty: "ପ୍ରତିପକ୍ଷ ପକ୍ଷ",
    hearingDate: "ଆସନ୍ତା ଶୁଣାଣି ତାରିଖ",
    reliefWanted: "ଆଦାଲତରୁ ଚାହୁଁଥିବା ରାହତ",
    keyFacts: "ମୁଖ୍ୟ ତଥ୍ୟ (ଛୋଟ ଟାଇମଲାଇନ୍)",
    opponentPlaceholder: "ଉଦାହରଣ: ଘରମାଲିକ, ନିଯୁକ୍ତିକର୍ତ୍ତା, ଅଭିଯୋଗକାରୀ",
    reliefPlaceholder: "ଉଦାହରଣ: ଜାମିନ, ଇଞ୍ଜଙ୍କସନ୍, କ୍ଷତିପୂରଣ, ଖାରଜ",
    factsPlaceholder: "ମୁଖ୍ୟ ତାରିଖ ଓ ତଥ୍ୟକୁ କ୍ରମରେ ଲେଖନ୍ତୁ...",
    generatePrompt: "ଗାଇଡେଡ୍ ଷ୍ଟ୍ରାଟେଜି ପ୍ରମ୍ପ୍ଟ ତିଆରି କରନ୍ତୁ",
    clearDraft: "ଡ୍ରାଫ୍ଟ ସଫା କରନ୍ତୁ",
    draftAdded: "ଡ୍ରାଫ୍ଟ ପ୍ରମ୍ପ୍ଟ ଚ୍ୟାଟ ଇନପୁଟ୍‌ରେ ଯୋଡାଗଲା:",
    quickActions: "ଦ୍ରୁତ ଉନ୍ନତ କାର୍ଯ୍ୟ",
    evidenceTitle: "ଆପଣଙ୍କ ପ୍ରମାଣ ଓ ଦଲିଲ୍ ଯୋଡନ୍ତୁ",
    evidenceDesc: "FIR କପି, ନୋଟିସ, ସ୍କ୍ରିନସଟ୍, ଦଲିଲ୍ ଇତ୍ୟାଦି ଅପଲୋଡ୍ କରନ୍ତୁ। ଆମେ ଟେକ୍ସଟ୍ କଢି ଗାଇଡେନ୍ସରେ ବ୍ୟବହାର କରିବୁ।",
    uploadEvidence: "ପ୍ରମାଣ ଅପଲୋଡ୍ କରନ୍ତୁ",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "ଆପଣଙ୍କ ପ୍ରମାଣ ଅପଲୋଡ୍ ହୋଇ ପଢାଯାଉଛି...",
    evidenceUploaded: "ପ୍ରମାଣର ଟେକ୍ସଟ୍ କଢି ଏହି ଚ୍ୟାଟ୍‌ରେ ଯୋଡାଗଲା।",
    extractedEvidence: "କଢାଯାଇଥିବା ପ୍ରମାଣ ଟେକ୍ସଟ୍ (ପ୍ରଶ୍ନ ପୂର୍ବରୁ ସମ୍ପାଦନ କରିପାରିବେ):",
    chatPlaceholder: "ଷ୍ଟ୍ରାଟେଜି, ଡ୍ରାଫ୍ଟ, ଯୁକ୍ତି, ଚେକଲିଷ୍ଟ କିମ୍ବା ଶୁଣାଣି ପ୍ରସ୍ତୁତି ବିଷୟରେ ପଚାରନ୍ତୁ...",
  },
  "ne-IN": {
    toolkitTitle: "सेल्फ-लयर सहायक टुलकिट",
    toolkitDesc: "तपाईंको केस प्रोफाइल एकपटक तयार गर्नुहोस्, त्यसपछि एक क्लिकमै गाइडेड रणनीति प्रम्प्ट बनाउनुहोस्।",
    caseType: "मुद्दा प्रकार",
    stage: "चरण",
    courtLevel: "अदालत स्तर",
    oppositeParty: "विपक्षी पक्ष",
    hearingDate: "अर्को सुनुवाइ मिति",
    reliefWanted: "अदालतबाट चाहिएको राहत",
    keyFacts: "मुख्य तथ्य (छोटो टाइमलाइन)",
    opponentPlaceholder: "जस्तै: घरधनी, रोजगारदाता, उजुरीकर्ता",
    reliefPlaceholder: "जस्तै: धरौटी, निषेधाज्ञा, क्षतिपूर्ति, खारेज",
    factsPlaceholder: "मुख्य मिति र तथ्यहरू क्रम मिलाएर लेख्नुहोस्...",
    generatePrompt: "गाइडेड रणनीति प्रम्प्ट बनाउनुहोस्",
    clearDraft: "ड्राफ्ट खाली गर्नुहोस्",
    draftAdded: "ड्राफ्ट प्रम्प्ट च्याट इनपुटमा थपियो:",
    quickActions: "छिटो उन्नत कार्यहरू",
    evidenceTitle: "आफ्ना प्रमाण र कागजात जोड्नुहोस्",
    evidenceDesc: "FIR प्रतिलिपि, नोटिस, स्क्रिनसट, कागजात आदि अपलोड गर्नुहोस्। हामी पाठ निकालेर मार्गदर्शनमा प्रयोग गर्छौं।",
    uploadEvidence: "प्रमाण अपलोड गर्नुहोस्",
    uploadTypes: "(PDF, Word, Image)",
    uploadingEvidence: "प्रमाण अपलोड गरेर पढ्दैछौं...",
    evidenceUploaded: "प्रमाणको पाठ निकालेर यस च्याटमा जोडियो।",
    extractedEvidence: "निकालिएको प्रमाण पाठ (प्रश्न अघि सम्पादन गर्न सक्नुहुन्छ):",
    chatPlaceholder: "रणनीति, ड्राफ्ट, तर्क, चेकलिस्ट वा सुनुवाइ तयारीबारे सोध्नुहोस्...",
  },
};

const SELF_LAWYER_OPTION_LABELS = {
  "en-US": {
    caseType: { criminal: "Criminal", civil: "Civil", family: "Family", consumer: "Consumer", labour: "Labour" },
    stage: {
      "pre-filing": "Pre filing",
      filing: "Filing",
      "notice-reply": "Notice reply",
      evidence: "Evidence stage",
      arguments: "Final arguments",
      appeal: "Appeal",
    },
    courtLevel: { magistrate: "Magistrate", district: "District Court", sessions: "Sessions Court", "high-court": "High Court" },
    quick: {
      timeline: "Case timeline",
      evidence: "Evidence checklist",
      opening: "Opening statement",
      cross: "Cross questions",
      hearingDay: "Hearing day plan",
    },
  },
  "hi-IN": {
    caseType: { criminal: "आपराधिक", civil: "सिविल", family: "परिवार", consumer: "उपभोक्ता", labour: "श्रम" },
    stage: {
      "pre-filing": "फाइलिंग से पहले",
      filing: "फाइलिंग",
      "notice-reply": "नोटिस उत्तर",
      evidence: "साक्ष्य चरण",
      arguments: "अंतिम बहस",
      appeal: "अपील",
    },
    courtLevel: { magistrate: "मजिस्ट्रेट", district: "जिला न्यायालय", sessions: "सेशंस न्यायालय", "high-court": "उच्च न्यायालय" },
    quick: {
      timeline: "केस टाइमलाइन",
      evidence: "साक्ष्य चेकलिस्ट",
      opening: "प्रारंभिक बयान",
      cross: "जिरह प्रश्न",
      hearingDay: "सुनवाई दिवस योजना",
    },
  },
  "ml-IN": {
    caseType: { criminal: "ക്രിമിനൽ", civil: "സിവിൽ", family: "കുടുംബ", consumer: "ഉപഭോക്തൃ", labour: "തൊഴിൽ" },
    stage: {
      "pre-filing": "ഫയലിംഗിന് മുമ്പ്",
      filing: "ഫയലിംഗ്",
      "notice-reply": "നോട്ടീസ് മറുപടി",
      evidence: "തെളിവ് ഘട്ടം",
      arguments: "അവസാന വാദം",
      appeal: "അപ്പീൽ",
    },
    courtLevel: { magistrate: "മജിസ്‌ട്രേറ്റ്", district: "ജില്ലാ കോടതി", sessions: "സെഷൻസ് കോടതി", "high-court": "ഹൈക്കോടതി" },
    quick: {
      timeline: "കേസ് സമയരേഖ",
      evidence: "തെളിവ് ചെക്ക്ലിസ്റ്റ്",
      opening: "തുടക്ക പ്രസ്താവന",
      cross: "ക്രോസ് ചോദ്യങ്ങൾ",
      hearingDay: "കേൾവി ദിന പദ്ധതി",
    },
  },
  "ta-IN": {
    caseType: { criminal: "குற்றவியல்", civil: "சிவில்", family: "குடும்ப", consumer: "நுகர்வோர்", labour: "தொழிலாளர்" },
    stage: {
      "pre-filing": "தாக்கல் முன்",
      filing: "தாக்கல்",
      "notice-reply": "நோட்டீஸ் பதில்",
      evidence: "ஆதார நிலை",
      arguments: "இறுதி வாதம்",
      appeal: "மேல்முறையீடு",
    },
    courtLevel: { magistrate: "மஜிஸ்திரேட்", district: "மாவட்ட நீதிமன்றம்", sessions: "செஷன்ஸ் நீதிமன்றம்", "high-court": "உயர் நீதிமன்றம்" },
    quick: {
      timeline: "வழக்கு காலவரிசை",
      evidence: "ஆதார சரிபார்ப்பு பட்டியல்",
      opening: "தொடக்க அறிக்கை",
      cross: "எதிர் விசாரணை கேள்விகள்",
      hearingDay: "விசாரணை நாள் திட்டம்",
    },
  },
  "te-IN": {
    caseType: { criminal: "క్రిమినల్", civil: "సివిల్", family: "కుటుంబ", consumer: "వినియోగదారు", labour: "శ్రమ" },
    stage: {
      "pre-filing": "ఫైలింగ్‌కు ముందు",
      filing: "ఫైలింగ్",
      "notice-reply": "నోటీస్ ప్రత్యుత్తరం",
      evidence: "ఆధార దశ",
      arguments: "చివరి వాదనలు",
      appeal: "అపీలు",
    },
    courtLevel: { magistrate: "మేజిస్ట్రేట్", district: "జిల్లా కోర్టు", sessions: "సెషన్స్ కోర్టు", "high-court": "హైకోర్టు" },
    quick: {
      timeline: "కేసు టైమ్‌లైన్",
      evidence: "ఆధార చెక్‌లిస్ట్",
      opening: "ప్రారంభ వాదన",
      cross: "క్రాస్ ప్రశ్నలు",
      hearingDay: "విచారణ రోజు ప్రణాళిక",
    },
  },
  "kn-IN": {
    caseType: { criminal: "ಕ್ರಿಮಿನಲ್", civil: "ಸಿವಿಲ್", family: "ಕುಟುಂಬ", consumer: "ಗ್ರಾಹಕ", labour: "ಕಾರ್ಮಿಕ" },
    stage: {
      "pre-filing": "ಫೈಲಿಂಗ್ ಮೊದಲು",
      filing: "ಫೈಲಿಂಗ್",
      "notice-reply": "ನೋಟಿಸ್ ಉತ್ತರ",
      evidence: "ಸಾಕ್ಷಿ ಹಂತ",
      arguments: "ಅಂತಿಮ ವಾದಗಳು",
      appeal: "ಅಪೀಲು",
    },
    courtLevel: { magistrate: "ಮ್ಯಾಜಿಸ್ಟ್ರೇಟ್", district: "ಜಿಲ್ಲಾ ನ್ಯಾಯಾಲಯ", sessions: "ಸೆಷನ್ಸ್ ನ್ಯಾಯಾಲಯ", "high-court": "ಹೈಕೋರ್ಟ್" },
    quick: {
      timeline: "ಕೇಸ್ ಕಾಲರೇಖೆ",
      evidence: "ಸಾಕ್ಷಿ ಚೆಕ್‌ಲಿಸ್ಟ್",
      opening: "ಆರಂಭಿಕ ಹೇಳಿಕೆ",
      cross: "ಕ್ರಾಸ್ ಪ್ರಶ್ನೆಗಳು",
      hearingDay: "ವಿಚಾರಣೆ ದಿನ ಯೋಜನೆ",
    },
  },
  "gu-IN": {
    caseType: { criminal: "ફોજદારી", civil: "સિવિલ", family: "કુટુંબ", consumer: "ગ્રાહક", labour: "મજૂરી" },
    stage: {
      "pre-filing": "ફાઇલિંગ પહેલાં",
      filing: "ફાઇલિંગ",
      "notice-reply": "નોટિસનો જવાબ",
      evidence: "પુરાવા તબક્કો",
      arguments: "અંતિમ દલીલો",
      appeal: "અપીલ",
    },
    courtLevel: { magistrate: "મેજિસ્ટ્રેટ", district: "જિલ્લા કોર્ટ", sessions: "સેશન્સ કોર્ટ", "high-court": "હાઇ કોર્ટ" },
    quick: {
      timeline: "કેસ સમયરેખા",
      evidence: "પુરાવાની ચેકલિસ્ટ",
      opening: "શરૂઆતનું નિવેદન",
      cross: "ક્રોસ પ્રશ્નો",
      hearingDay: "હિયરીંગ દિવસ યોજના",
    },
  },
  "mr-IN": {
    caseType: { criminal: "फौजदारी", civil: "दिवाणी", family: "कौटुंबिक", consumer: "ग्राहक", labour: "कामगार" },
    stage: {
      "pre-filing": "फाइलिंगपूर्व",
      filing: "फाइलिंग",
      "notice-reply": "नोटीसला उत्तर",
      evidence: "पुरावा टप्पा",
      arguments: "अंतिम युक्तिवाद",
      appeal: "अपील",
    },
    courtLevel: { magistrate: "मजिस्ट्रेट", district: "जिल्हा न्यायालय", sessions: "सेशन्स न्यायालय", "high-court": "उच्च न्यायालय" },
    quick: {
      timeline: "केस टाइमलाइन",
      evidence: "पुरावा चेकलिस्ट",
      opening: "प्रारंभिक निवेदन",
      cross: "उलटतपास प्रश्न",
      hearingDay: "सुनावणी दिवस योजना",
    },
  },
  "bn-IN": {
    caseType: { criminal: "ফৌজদারি", civil: "দেওয়ানি", family: "পারিবারিক", consumer: "ভোক্তা", labour: "শ্রম" },
    stage: {
      "pre-filing": "ফাইলিংয়ের আগে",
      filing: "ফাইলিং",
      "notice-reply": "নোটিশের জবাব",
      evidence: "প্রমাণ পর্যায়",
      arguments: "চূড়ান্ত যুক্তি",
      appeal: "আপিল",
    },
    courtLevel: { magistrate: "ম্যাজিস্ট্রেট", district: "জেলা আদালত", sessions: "সেশনস আদালত", "high-court": "হাইকোর্ট" },
    quick: {
      timeline: "মামলার টাইমলাইন",
      evidence: "প্রমাণ চেকলিস্ট",
      opening: "শুরুর বক্তব্য",
      cross: "জেরা প্রশ্ন",
      hearingDay: "শুনানি দিনের পরিকল্পনা",
    },
  },
  "pa-IN": {
    caseType: { criminal: "ਫੌਜਦਾਰੀ", civil: "ਸਿਵਲ", family: "ਪਰਿਵਾਰਕ", consumer: "ਖਪਤਕਾਰ", labour: "ਮਜ਼ਦੂਰੀ" },
    stage: {
      "pre-filing": "ਦਾਇਰੀ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ",
      filing: "ਦਾਇਰੀ",
      "notice-reply": "ਨੋਟਿਸ ਜਵਾਬ",
      evidence: "ਸਬੂਤ ਪੜਾਅ",
      arguments: "ਅੰਤਿਮ ਦਲੀਲਾਂ",
      appeal: "ਅਪੀਲ",
    },
    courtLevel: { magistrate: "ਮੈਜਿਸਟ੍ਰੇਟ", district: "ਜ਼ਿਲ੍ਹਾ ਅਦਾਲਤ", sessions: "ਸੈਸ਼ਨ ਅਦਾਲਤ", "high-court": "ਹਾਈ ਕੋਰਟ" },
    quick: {
      timeline: "ਕੇਸ ਟਾਈਮਲਾਈਨ",
      evidence: "ਸਬੂਤ ਚੈਕਲਿਸਟ",
      opening: "ਸ਼ੁਰੂਆਤੀ ਬਿਆਨ",
      cross: "ਜਿਰਹ ਪ੍ਰਸ਼ਨ",
      hearingDay: "ਸੁਣਵਾਈ ਦਿਨ ਯੋਜਨਾ",
    },
  },
  "ur-IN": {
    caseType: { criminal: "فوجداری", civil: "دیوانی", family: "خاندانی", consumer: "صارف", labour: "مزدوری" },
    stage: {
      "pre-filing": "فائلنگ سے پہلے",
      filing: "فائلنگ",
      "notice-reply": "نوٹس کا جواب",
      evidence: "ثبوت مرحلہ",
      arguments: "حتمی دلائل",
      appeal: "اپیل",
    },
    courtLevel: { magistrate: "مجسٹریٹ", district: "ضلع عدالت", sessions: "سیشن عدالت", "high-court": "ہائی کورٹ" },
    quick: {
      timeline: "کیس ٹائم لائن",
      evidence: "ثبوت چیک لسٹ",
      opening: "ابتدائی بیان",
      cross: "جرح سوالات",
      hearingDay: "سماعت دن کا منصوبہ",
    },
  },
  "as-IN": {
    caseType: { criminal: "ফৌজদাৰী", civil: "দেৱানী", family: "পৰিয়াল", consumer: "গ্ৰাহক", labour: "শ্ৰম" },
    stage: {
      "pre-filing": "ফাইলিঙৰ আগতে",
      filing: "ফাইলিং",
      "notice-reply": "নোটিচ উত্তৰ",
      evidence: "প্ৰমাণ পৰ্যায়",
      arguments: "চূড়ান্ত যুক্তি",
      appeal: "আপিল",
    },
    courtLevel: { magistrate: "মেজিষ্ট্ৰেট", district: "জিলা আদালত", sessions: "চেচন আদালত", "high-court": "উচ্চ ন্যায়ালয়" },
    quick: {
      timeline: "কেছ টাইমলাইন",
      evidence: "প্ৰমাণ চেকলিষ্ট",
      opening: "আৰম্ভিক বিবৃতি",
      cross: "জেৰা প্ৰশ্ন",
      hearingDay: "শুনানি দিনৰ পৰিকল্পনা",
    },
  },
  "or-IN": {
    caseType: { criminal: "ଅପରାଧିକ", civil: "ଦିବାନୀ", family: "ପରିବାର", consumer: "ଉପଭୋକ୍ତା", labour: "ଶ୍ରମ" },
    stage: {
      "pre-filing": "ଦାଖଲ ପୂର୍ବରୁ",
      filing: "ଦାଖଲ",
      "notice-reply": "ନୋଟିସ୍ ଉତ୍ତର",
      evidence: "ପ୍ରମାଣ ପର୍ଯ୍ୟାୟ",
      arguments: "ଶେଷ ଯୁକ୍ତି",
      appeal: "ଆପିଲ୍",
    },
    courtLevel: { magistrate: "ମ୍ୟାଜିଷ୍ଟ୍ରେଟ୍", district: "ଜିଲ୍ଲା ଅଦାଲତ", sessions: "ସେସନ୍ସ ଅଦାଲତ", "high-court": "ହାଇ କୋର୍ଟ" },
    quick: {
      timeline: "କେସ୍ ଟାଇମଲାଇନ୍",
      evidence: "ପ୍ରମାଣ ଚେକଲିଷ୍ଟ",
      opening: "ଆରମ୍ଭିକ ବିବୃତ୍ତି",
      cross: "ଜିଜ୍ଞାସା ପ୍ରଶ୍ନ",
      hearingDay: "ଶୁଣାଣି ଦିନ ଯୋଜନା",
    },
  },
  "ne-IN": {
    caseType: { criminal: "फौजदारी", civil: "दिवानी", family: "परिवार", consumer: "उपभोक्ता", labour: "श्रम" },
    stage: {
      "pre-filing": "दर्ता अघि",
      filing: "दर्ता",
      "notice-reply": "नोटिसको जवाफ",
      evidence: "प्रमाण चरण",
      arguments: "अन्तिम बहस",
      appeal: "पुनरावेदन",
    },
    courtLevel: { magistrate: "म्याजिस्ट्रेट", district: "जिल्ला अदालत", sessions: "सेसन अदालत", "high-court": "उच्च अदालत" },
    quick: {
      timeline: "केस टाइमलाइन",
      evidence: "प्रमाण चेकलिस्ट",
      opening: "सुरुवाती वक्तव्य",
      cross: "जिरह प्रश्न",
      hearingDay: "सुनुवाइ दिन योजना",
    },
  },
};

const ASSIST_UI = {
  "en-US": {
    personalTitle: "Personal & Family Quick Help",
    consumerTitle: "Consumer Quick Help",
    description: "No forms needed. Type in your own words, or tap one quick action below.",
    quickActionsLabel: "Quick help actions",
    chatPlaceholder: "Tell your issue in simple words...",
    historyButton: "History",
    newChatButton: "New chat",
    historyTitle: "Previous conversations",
    noHistory: "No previous conversations yet.",
    loadChat: "Open",
    ttsOn: "TTS On",
    ttsOff: "TTS Off",
  },
  "hi-IN": {
    personalTitle: "व्यक्तिगत और परिवार त्वरित सहायता",
    consumerTitle: "उपभोक्ता त्वरित सहायता",
    description: "कोई फॉर्म नहीं भरना है। अपनी भाषा में लिखें या नीचे एक त्वरित विकल्प चुनें।",
    quickActionsLabel: "त्वरित सहायता विकल्प",
    chatPlaceholder: "अपनी समस्या सरल शब्दों में बताएं...",
    historyButton: "इतिहास",
    newChatButton: "नई चैट",
    historyTitle: "पिछली बातचीत",
    noHistory: "अभी तक कोई पिछली बातचीत नहीं है।",
    loadChat: "खोलें",
    ttsOn: "टीटीएस चालू",
    ttsOff: "टीटीएस बंद",
  },
  "ml-IN": {
    personalTitle: "വ്യക്തിഗതവും കുടുംബവുമായി ബന്ധപ്പെട്ട ത്വരിത സഹായം",
    consumerTitle: "ഉപഭോക്തൃ ത്വരിത സഹായം",
    description: "ഫോം വേണ്ട. നിങ്ങളുടെ ഭാഷയിൽ ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ താഴെയുള്ള ത്വരിത ഓപ്ഷൻ തൊടുക.",
    quickActionsLabel: "ത്വരിത സഹായ ഓപ്ഷനുകൾ",
    chatPlaceholder: "നിങ്ങളുടെ പ്രശ്നം ലളിതമായി പറയൂ...",
    historyButton: "ചരിത്രം",
    newChatButton: "പുതിയ ചാറ്റ്",
    historyTitle: "മുൻ സംഭാഷണങ്ങൾ",
    noHistory: "ഇതുവരെ മുൻ സംഭാഷണങ്ങളൊന്നുമില്ല.",
    loadChat: "തുറക്കുക",
    ttsOn: "TTS ഓൺ",
    ttsOff: "TTS ഓഫാണ്",
  },
  "ta-IN": {
    personalTitle: "தனிநபர் & குடும்ப விரைவு உதவி",
    consumerTitle: "நுகர்வோர் விரைவு உதவி",
    description: "படிவம் தேவையில்லை. உங்கள் சொற்களில் টাইப் செய்யுங்கள் அல்லது கீழே உள்ள விரைவு விருப்பத்தைத் தொடுங்கள்.",
    quickActionsLabel: "விரைவு உதவி விருப்பங்கள்",
    chatPlaceholder: "உங்கள் பிரச்சினையை எளிய வார்த்தைகளில் சொல்லுங்கள்...",
    historyButton: "வரலாறு",
    newChatButton: "புதிய உரையாடல்",
    historyTitle: "முந்தைய உரையாடல்கள்",
    noHistory: "முந்தைய உரையாடல்கள் இல்லை.",
    loadChat: "திற",
    ttsOn: "TTS ஆன்",
    ttsOff: "TTS ஆஃப்",
  },
  "te-IN": {
    personalTitle: "వ్యక్తిగత & కుటుంబ త్వరిత సహాయం",
    consumerTitle: "వినియోగదారు త్వరిత సహాయం",
    description: "ఫారమ్ అవసరం లేదు. మీ మాటల్లో టైప్ చేయండి లేదా కింద ఉన్న త్వరిత ఎంపికను నొక్కండి.",
    quickActionsLabel: "త్వరిత సహాయ ఎంపికలు",
    chatPlaceholder: "మీ సమస్యను సులభమైన మాటల్లో చెప్పండి...",
    historyButton: "చరిత్ర",
    newChatButton: "కొత్త చాట్",
    historyTitle: "గత సంభాషణలు",
    noHistory: "ఇప్పటివరకు గత సంభాషణలు లేవు.",
    loadChat: "తెరవండి",
    ttsOn: "TTS ఆన్",
    ttsOff: "TTS ఆఫ్",
  },
  "kn-IN": {
    personalTitle: "ವೈಯಕ್ತಿಕ ಮತ್ತು ಕುಟುಂಬ ತ್ವರಿತ ಸಹಾಯ",
    consumerTitle: "ಗ್ರಾಹಕ ತ್ವರಿತ ಸಹಾಯ",
    description: "ಫಾರ್ಮ್ ಅಗತ್ಯವಿಲ್ಲ. ನಿಮ್ಮದೇ ಮಾತಿನಲ್ಲಿ ಬರೆಯಿರಿ ಅಥವಾ ಕೆಳಗಿನ ತ್ವರಿತ ಆಯ್ಕೆಯನ್ನು ಒತ್ತಿರಿ.",
    quickActionsLabel: "ತ್ವರಿತ ಸಹಾಯ ಆಯ್ಕೆಗಳು",
    chatPlaceholder: "ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು ಸರಳವಾಗಿ ತಿಳಿಸಿ...",
    historyButton: "ಇತಿಹಾಸ",
    newChatButton: "ಹೊಸ ಚಾಟ್",
    historyTitle: "ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳು",
    noHistory: "ಇನ್ನೂ ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ.",
    loadChat: "ತೆರೆಯಿರಿ",
    ttsOn: "TTS ಆನ್",
    ttsOff: "TTS ಆಫ್",
  },
  "gu-IN": {
    personalTitle: "વ્યક્તિગત અને પરિવાર તાત્કાલિક સહાય",
    consumerTitle: "ગ્રાહક તાત્કાલિક સહાય",
    description: "ફોર્મની જરૂર નથી. તમારી ભાષામાં લખો અથવા નીચેના ઝડપી વિકલ્પોમાંથી પસંદ કરો.",
    quickActionsLabel: "ઝડપી સહાય વિકલ્પો",
    chatPlaceholder: "તમારી સમસ્યા સરળ શબ્દોમાં લખો...",
    historyButton: "ઇતિહાસ",
    newChatButton: "નવો ચેટ",
    historyTitle: "પાછલી વાતચીત",
    noHistory: "હજુ સુધી કોઈ અગાઉની વાતચીત નથી.",
    loadChat: "ખોલો",
    ttsOn: "TTS ચાલુ",
    ttsOff: "TTS બંધ",
  },
  "mr-IN": {
    personalTitle: "वैयक्तिक आणि कुटुंबीय तात्काळ मदत",
    consumerTitle: "ग्राहक तात्काळ मदत",
    description: "फॉर्म भरण्याची गरज नाही. आपल्या भाषेत लिहा किंवा खालील झटपट पर्याय निवडा.",
    quickActionsLabel: "झटपट मदत पर्याय",
    chatPlaceholder: "तुमची अडचण सोप्या शब्दांत सांगा...",
    historyButton: "इतिहास",
    newChatButton: "नवीन चॅट",
    historyTitle: "मागील संभाषणे",
    noHistory: "अद्याप कोणतीही मागील संभाषणे नाहीत.",
    loadChat: "उघडा",
    ttsOn: "TTS सुरू",
    ttsOff: "TTS बंद",
  },
  "bn-IN": {
    personalTitle: "ব্যক্তিগত ও পারিবারিক দ্রুত সহায়তা",
    consumerTitle: "ভোক্তা দ্রুত সহায়তা",
    description: "কোনো ফর্ম দরকার নেই। নিজের ভাষায় লিখুন বা নিচের দ্রুত অপশন বেছে নিন।",
    quickActionsLabel: "দ্রুত সহায়তা অপশন",
    chatPlaceholder: "সহজ ভাষায় আপনার সমস্যা লিখুন...",
    historyButton: "ইতিহাস",
    newChatButton: "নতুন চ্যাট",
    historyTitle: "আগের কথোপকথন",
    noHistory: "এখনও কোনো আগের কথোপকথন নেই।",
    loadChat: "খুলুন",
    ttsOn: "TTS চালু",
    ttsOff: "TTS বন্ধ",
  },
  "pa-IN": {
    personalTitle: "ਨਿੱਜੀ ਅਤੇ ਪਰਿਵਾਰਕ ਤੁਰੰਤ ਮਦਦ",
    consumerTitle: "ਖਪਤਕਾਰ ਤੁਰੰਤ ਮਦਦ",
    description: "ਫਾਰਮ ਦੀ ਲੋੜ ਨਹੀਂ। ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਲਿਖੋ ਜਾਂ ਹੇਠਾਂ ਦਿੱਤਾ ਤੁਰੰਤ ਵਿਕਲਪ ਚੁਣੋ।",
    quickActionsLabel: "ਤੁਰੰਤ ਮਦਦ ਵਿਕਲਪ",
    chatPlaceholder: "ਆਪਣੀ ਸਮੱਸਿਆ ਸੌਖੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਦੱਸੋ...",
    historyButton: "ਇਤਿਹਾਸ",
    newChatButton: "ਨਵੀਂ ਚੈਟ",
    historyTitle: "ਪਿਛਲੀਆਂ ਗੱਲਬਾਤਾਂ",
    noHistory: "ਹਾਲੇ ਤੱਕ ਕੋਈ ਪਿਛਲੀ ਗੱਲਬਾਤ ਨਹੀਂ ਹੈ।",
    loadChat: "ਖੋਲ੍ਹੋ",
    ttsOn: "TTS ਚਾਲੂ",
    ttsOff: "TTS ਬੰਦ",
  },
  "ur-IN": {
    personalTitle: "ذاتی اور خاندانی فوری مدد",
    consumerTitle: "صارف فوری مدد",
    description: "فارم کی ضرورت نہیں۔ اپنی زبان میں لکھیں یا نیچے سے فوری آپشن منتخب کریں۔",
    quickActionsLabel: "فوری مدد کے اختیارات",
    chatPlaceholder: "اپنا مسئلہ آسان الفاظ میں لکھیں...",
    historyButton: "ہسٹری",
    newChatButton: "نیا چیٹ",
    historyTitle: "پچھلی گفتگو",
    noHistory: "ابھی تک کوئی پچھلی گفتگو نہیں ہے۔",
    loadChat: "کھولیں",
    ttsOn: "TTS آن",
    ttsOff: "TTS آف",
  },
  "as-IN": {
    personalTitle: "ব্যক্তিগত আৰু পাৰিবাৰিক দ্ৰুত সহায়",
    consumerTitle: "গ্ৰাহক দ্ৰুত সহায়",
    description: "ফৰ্মৰ প্ৰয়োজন নাই। নিজৰ ভাষাত লিখক বা তলৰ দ্ৰুত বিকল্প বাছক।",
    quickActionsLabel: "দ্ৰুত সহায় বিকল্প",
    chatPlaceholder: "সহজ ভাষাত আপোনাৰ সমস্যাটো লিখক...",
    historyButton: "ইতিহাস",
    newChatButton: "নতুন চেট",
    historyTitle: "আগৰ কথোপকথন",
    noHistory: "এতিয়ালৈ কোনো আগৰ কথোপকথন নাই।",
    loadChat: "খোলক",
    ttsOn: "TTS অন",
    ttsOff: "TTS অফ",
  },
  "or-IN": {
    personalTitle: "ବ୍ୟକ୍ତିଗତ ଓ ପରିବାରିକ ତ୍ୱରିତ ସହାୟତା",
    consumerTitle: "ଉପଭୋକ୍ତା ତ୍ୱରିତ ସହାୟତା",
    description: "କୌଣସି ଫର୍ମ ଦରକାର ନାହିଁ। ନିଜ ଭାଷାରେ ଲେଖନ୍ତୁ କିମ୍ବା ତଳର ତ୍ୱରିତ ବିକଳ୍ପ ବାଛନ୍ତୁ।",
    quickActionsLabel: "ତ୍ୱରିତ ସହାୟତା ବିକଳ୍ପ",
    chatPlaceholder: "ସହଜ ଭାଷାରେ ଆପଣଙ୍କ ସମସ୍ୟା ଲେଖନ୍ତୁ...",
    historyButton: "ଇତିହାସ",
    newChatButton: "ନୂଆ ଚ୍ୟାଟ",
    historyTitle: "ପୂର୍ବତନ କଥୋପକଥନ",
    noHistory: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ପୂର୍ବତନ କଥୋପକଥନ ନାହିଁ।",
    loadChat: "ଖୋଲନ୍ତୁ",
    ttsOn: "TTS ଚାଲୁ",
    ttsOff: "TTS ବନ୍ଦ",
  },
  "ne-IN": {
    personalTitle: "व्यक्तिगत र परिवार द्रुत सहायता",
    consumerTitle: "उपभोक्ता द्रुत सहायता",
    description: "फारम आवश्यक छैन। आफ्नो भाषामा लेख्नुहोस् वा तलको द्रुत विकल्प छान्नुहोस्।",
    quickActionsLabel: "द्रुत सहायता विकल्प",
    chatPlaceholder: "आफ्नो समस्या सरल शब्दमा लेख्नुहोस्...",
    historyButton: "इतिहास",
    newChatButton: "नयाँ च्याट",
    historyTitle: "अघिल्ला कुराकानीहरू",
    noHistory: "अहिलेसम्म कुनै अघिल्ला कुराकानी छैनन्।",
    loadChat: "खोल्नुहोस्",
    ttsOn: "TTS अन",
    ttsOff: "TTS अफ",
  },
};

const ASSIST_QUICK_ACTIONS = {
  personal: {
    "en-US": [
      "Explain my rights in simple words",
      "Give me step-by-step next actions",
      "Create document checklist I should keep ready",
      "Draft a simple complaint/representation format",
    ],
    "hi-IN": [
      "मेरे अधिकार आसान शब्दों में समझाएं",
      "अगले कदम चरणबद्ध बताएं",
      "कौन-कौन से दस्तावेज तैयार रखें, सूची दें",
      "सरल शिकायत/प्रार्थना पत्र का प्रारूप दें",
    ],
    "ml-IN": [
      "എന്റെ അവകാശങ്ങൾ ലളിതമായി വിശദീകരിക്കൂ",
      "അടുത്ത ഘട്ടങ്ങൾ ഘട്ടംഘട്ടമായി പറയൂ",
      "തയ്യാറാക്കി വെക്കേണ്ട രേഖകളുടെ പട്ടിക തരൂ",
      "ലളിതമായ പരാതി/പ്രതിനിധാനം ഡ്രാഫ്റ്റ് തരൂ",
    ],
    "ta-IN": [
      "என் உரிமைகளை எளிய மொழியில் விளக்கவும்",
      "அடுத்த படிகளை படிப்படியாக சொல்லவும்",
      "தயார் வைத்து கொள்ள வேண்டிய ஆவண பட்டியல் கொடுக்கவும்",
      "எளிய புகார்/மனு வடிவம் தயார் செய்யவும்",
    ],
    "te-IN": [
      "నా హక్కులు సులభమైన భాషలో వివరించండి",
      "తర్వాతి చర్యలను దశలవారీగా చెప్పండి",
      "తయారుగా ఉంచాల్సిన పత్రాల చెక్‌లిస్ట్ ఇవ్వండి",
      "సరళమైన ఫిర్యాదు/ప్రతినిధి లేఖ ముసాయిదా ఇవ్వండి",
    ],
    "kn-IN": [
      "ನನ್ನ ಹಕ್ಕುಗಳನ್ನು ಸರಳವಾಗಿ ವಿವರಿಸಿ",
      "ಮುಂದಿನ ಕ್ರಮಗಳನ್ನು ಹಂತ ಹಂತವಾಗಿ ತಿಳಿಸಿ",
      "ತಯಾರಿರಬೇಕಾದ ದಾಖಲೆಗಳ ಪಟ್ಟಿಯನ್ನು ಕೊಡಿ",
      "ಸರಳ ದೂರು/ಪ್ರತಿನಿಧಿ ಅರ್ಜಿ ಮಾದರಿ ಕೊಡಿ",
    ],
    "gu-IN": [
      "મારા અધિકારો સરળ ભાષામાં સમજાવો",
      "આગલા પગલાં એક પછી એક કહો",
      "તૈયાર રાખવાના દસ્તાવેજોની યાદી આપો",
      "સરળ ફરિયાદ/અરજીનો નમૂનો આપો",
    ],
    "mr-IN": [
      "माझे हक्क सोप्या भाषेत समजवा",
      "पुढील पावले टप्प्याटप्प्याने सांगा",
      "तयार ठेवायच्या कागदपत्रांची यादी द्या",
      "सोप्या तक्रार/अर्जाचा नमुना द्या",
    ],
    "bn-IN": [
      "আমার অধিকার সহজ ভাষায় বুঝিয়ে দিন",
      "পরবর্তী পদক্ষেপ ধাপে ধাপে বলুন",
      "যে নথিগুলো প্রস্তুত রাখতে হবে তার তালিকা দিন",
      "সহজ অভিযোগ/আবেদনপত্রের খসড়া দিন",
    ],
    "pa-IN": [
      "ਮੇਰੇ ਹੱਕ ਸੌਖੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸਮਝਾਓ",
      "ਅਗਲੇ ਕਦਮ ਪੜਾਅਵਾਰ ਦੱਸੋ",
      "ਤਿਆਰ ਰੱਖਣ ਵਾਲੇ ਦਸਤਾਵੇਜ਼ਾਂ ਦੀ ਸੂਚੀ ਦਿਓ",
      "ਸਰਲ ਸ਼ਿਕਾਇਤ/ਅਰਜ਼ੀ ਦਾ ਫਾਰਮੈਟ ਦਿਓ",
    ],
    "ur-IN": [
      "میرے حقوق آسان زبان میں سمجھائیں",
      "اگلے اقدامات مرحلہ وار بتائیں",
      "تیار رکھنے والی دستاویزات کی فہرست دیں",
      "سادہ شکایت/درخواست کا فارمیٹ دیں",
    ],
    "as-IN": [
      "মোৰ অধিকাৰ সহজ ভাষাত বুজাই দিয়ক",
      "পৰৱৰ্তী পদক্ষেপ ধাপে ধাপে কওক",
      "প্ৰস্তুত ৰাখিবলগীয়া নথিপত্ৰৰ তালিকা দিয়ক",
      "সহজ অভিযোগ/আবেদনৰ ফৰ্মেট দিয়ক",
    ],
    "or-IN": [
      "ମୋ ଅଧିକାର ସହଜ ଭାଷାରେ ବୁଝାନ୍ତୁ",
      "ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ ଧିରେ ଧିରେ କହନ୍ତୁ",
      "ପ୍ରସ୍ତୁତ ରଖିବାକୁ ପଡିବା ଦଳିଳ ତାଲିକା ଦିଅନ୍ତୁ",
      "ସହଜ ଅଭିଯୋଗ/ଆବେଦନ ଫର୍ମାଟ ଦିଅନ୍ତୁ",
    ],
    "ne-IN": [
      "मेरो अधिकार सरल भाषामा बुझाइदिनुहोस्",
      "अर्का कदमहरू चरणबद्ध बताउनुहोस्",
      "तयार राख्नुपर्ने कागजातहरूको सूची दिनुहोस्",
      "सरल उजुरी/निवेदनको ढाँचा दिनुहोस्",
    ],
  },
  consumer: {
    "en-US": [
      "Explain my consumer/criminal options in simple words",
      "Which authority should I approach first?",
      "Create document and evidence checklist",
      "Draft a simple consumer complaint notice",
    ],
    "hi-IN": [
      "मेरे उपभोक्ता/कानूनी विकल्प आसान भाषा में बताएं",
      "मुझे पहले किस प्राधिकरण के पास जाना चाहिए?",
      "दस्तावेज और साक्ष्य चेकलिस्ट बनाएं",
      "सरल उपभोक्ता शिकायत नोटिस का प्रारूप दें",
    ],
    "ml-IN": [
      "എന്റെ ഉപഭോക്തൃ/നിയമ വഴികൾ ലളിതമായി പറയൂ",
      "ആദ്യം ഏത് അതോറിറ്റിയെ സമീപിക്കണം?",
      "രേഖകളും തെളിവുകളും ചെക്ക്ലിസ്റ്റ് തരൂ",
      "ലളിതമായ ഉപഭോക്തൃ പരാതി നോട്ടീസ് ഡ്രാഫ്റ്റ് തരൂ",
    ],
    "ta-IN": [
      "என் நுகர்வோர்/சட்ட விருப்பங்களை எளிய மொழியில் விளக்கவும்",
      "முதலில் எந்த அதிகாரியை அணுக வேண்டும்?",
      "ஆவணங்கள் மற்றும் ஆதார பட்டியல் தயார் செய்யவும்",
      "எளிய நுகர்வோர் புகார் நோட்டீஸ் வரைவு தரவும்",
    ],
    "te-IN": [
      "నా వినియోగదారు/చట్టపరమైన ఎంపికలను సులభంగా వివరించండి",
      "మొదట నేను ఏ అధికారిని సంప్రదించాలి?",
      "పత్రాలు మరియు ఆధారాల చెక్‌లిస్ట్ ఇవ్వండి",
      "సరళమైన వినియోగదారు ఫిర్యాదు నోటీసు ముసాయిదా ఇవ్వండి",
    ],
    "kn-IN": [
      "ನನ್ನ ಗ್ರಾಹಕ/ಕಾನೂನು ಆಯ್ಕೆಗಳು ಸರಳವಾಗಿ ತಿಳಿಸಿ",
      "ಮೊದಲು ಯಾವ ಪ್ರಾಧಿಕಾರವನ್ನು ಸಂಪರ್ಕಿಸಬೇಕು?",
      "ದಾಖಲೆ ಮತ್ತು ಸಾಕ್ಷಿ ಚೆಕ್‌ಲಿಸ್ಟ್ ನೀಡಿ",
      "ಸರಳ ಗ್ರಾಹಕ ದೂರು ನೋಟಿಸ್ ಮಾದರಿ ಕೊಡಿ",
    ],
    "gu-IN": [
      "મારા ગ્રાહક/કાનૂની વિકલ્પો સરળ ભાષામાં સમજાવો",
      "મારે પહેલા કઈ સત્તા પાસે જવું જોઈએ?",
      "દસ્તાવેજ અને પુરાવાની ચેકલિસ્ટ બનાવો",
      "સરળ ગ્રાહક ફરિયાદ નોટિસનો નમૂનો આપો",
    ],
    "mr-IN": [
      "माझे ग्राहक/कायदेशीर पर्याय सोप्या भाषेत समजवा",
      "मी प्रथम कोणत्या प्राधिकरणाकडे जावे?",
      "कागदपत्रे आणि पुरावा चेकलिस्ट तयार करा",
      "सोपे ग्राहक तक्रार नोटीस मसुदा द्या",
    ],
    "bn-IN": [
      "আমার ভোক্তা/আইনি বিকল্পগুলো সহজ ভাষায় বুঝিয়ে দিন",
      "আমি প্রথমে কোন কর্তৃপক্ষের কাছে যাব?",
      "নথি ও প্রমাণের চেকলিস্ট তৈরি করুন",
      "সহজ ভোক্তা অভিযোগ নোটিশের খসড়া দিন",
    ],
    "pa-IN": [
      "ਮੇਰੇ ਖਪਤਕਾਰ/ਕਾਨੂੰਨੀ ਵਿਕਲਪ ਸੌਖੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸਮਝਾਓ",
      "ਮੈਂ ਪਹਿਲਾਂ ਕਿਹੜੇ ਅਧਿਕਾਰ ਕੋਲ ਜਾਵਾਂ?",
      "ਦਸਤਾਵੇਜ਼ ਅਤੇ ਸਬੂਤ ਦੀ ਚੈਕਲਿਸਟ ਬਣਾਓ",
      "ਸਰਲ ਖਪਤਕਾਰ ਸ਼ਿਕਾਇਤ ਨੋਟਿਸ ਦਾ ਮਸੌਦਾ ਦਿਓ",
    ],
    "ur-IN": [
      "میرے صارف/قانونی اختیارات آسان زبان میں سمجھائیں",
      "مجھے پہلے کس اتھارٹی سے رابطہ کرنا چاہیے؟",
      "دستاویزات اور ثبوت کی چیک لسٹ بنائیں",
      "سادہ صارف شکایت نوٹس کا مسودہ دیں",
    ],
    "as-IN": [
      "মোৰ গ্ৰাহক/আইনী বিকল্পসমূহ সহজ ভাষাত বুজাই দিয়ক",
      "মই প্ৰথমে কোন কৰ্তৃপক্ষৰ ওচৰলৈ যাম?",
      "নথিপত্ৰ আৰু প্ৰমাণৰ চেকলিষ্ট তৈয়াৰ কৰক",
      "সহজ গ্ৰাহক অভিযোগ নোটিছৰ খচৰা দিয়ক",
    ],
    "or-IN": [
      "ମୋ ଉପଭୋକ୍ତା/କାନୁନୀ ବିକଳ୍ପ ସହଜ ଭାଷାରେ ବୁଝାନ୍ତୁ",
      "ମୁଁ ପ୍ରଥମେ କେଉଁ କର୍ତ୍ତୃପକ୍ଷଙ୍କ ପାଖକୁ ଯିବି?",
      "ଦଳିଳ ଓ ପ୍ରମାଣର ଚେକଲିଷ୍ଟ ତିଆରି କରନ୍ତୁ",
      "ସହଜ ଉପଭୋକ୍ତା ଅଭିଯୋଗ ନୋଟିସ ଖସଡା ଦିଅନ୍ତୁ",
    ],
    "ne-IN": [
      "मेरो उपभोक्ता/कानुनी विकल्पहरू सरल भाषामा बुझाइदिनुहोस्",
      "मैले पहिले कुन निकायमा जानुपर्छ?",
      "कागजात र प्रमाणको चेकलिस्ट तयार गर्नुहोस्",
      "सरल उपभोक्ता उजुरी नोटिसको मस्यौदा दिनुहोस्",
    ],
  },
};

const ServiceChatPage = () => {
  const { serviceTitle } = useParams();
  const location = useLocation();
  const decodedTitle = decodeURIComponent(serviceTitle);
  const backendUrl = location.state?.port || apiUrl;

  const [prompt, setPrompt] = useState("");
  const [recognition, setRecognition] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [userId, setUserId] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US"); // Default to English
  const [speechRecognitionLang, setSpeechRecognitionLang] = useState("en-US"); // Default to English
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [activeSpeechKey, setActiveSpeechKey] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadedDocName, setUploadedDocName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [docAnalysis, setDocAnalysis] = useState("");
  const [docText, setDocText] = useState("");
  const [docFollowup, setDocFollowup] = useState("");
  const [isIntenseAnalysis, setIsIntenseAnalysis] = useState(false);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceUploadStatus, setEvidenceUploadStatus] = useState("");
  const [evidenceUploadError, setEvidenceUploadError] = useState("");
  const [isEvidenceUploading, setIsEvidenceUploading] = useState(false);
  const [docFollowupError, setDocFollowupError] = useState("");
  const [docFollowupStatus, setDocFollowupStatus] = useState("");
  const [isDocSending, setIsDocSending] = useState(false);
  const [docHistory, setDocHistory] = useState([]);
  const [docHistoryError, setDocHistoryError] = useState("");
  const [isDocHistoryOpen, setIsDocHistoryOpen] = useState(false);
  const [isDocHistoryLoading, setIsDocHistoryLoading] = useState(false);
  const [selfLawyerDraftPrompt, setSelfLawyerDraftPrompt] = useState("");
  const [selfLawyerHistory, setSelfLawyerHistory] = useState([]);
  const [isSelfLawyerHistoryOpen, setIsSelfLawyerHistoryOpen] = useState(false);
  const [assistHistory, setAssistHistory] = useState([]);
  const [chatSessionId, setChatSessionId] = useState(createChatSessionId());
  const [selfLawyerSessionId, setSelfLawyerSessionId] = useState(createChatSessionId());
  const [selfLawyerCase, setSelfLawyerCase] = useState({
    caseType: "criminal",
    stage: "pre-filing",
    courtLevel: "magistrate",
    opponentType: "",
    upcomingDate: "",
    reliefWanted: "",
    keyFacts: "",
  });
  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);
  const listeningRequestedRef = useRef(false);
  const recognitionLangCycleRef = useRef([]);
  const recognitionLangIndexRef = useRef(0);
  const recognitionAttemptTimeoutRef = useRef(null);
  const languageDropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const isScrollingDropdownRef = useRef(false);
  const caseSavedRef = useRef(false);
  const historyPersistTimeoutRef = useRef(null);
  const ttsAudioRef = useRef(null);
  const ttsObjectUrlRef = useRef(null);
  const browserUtteranceRef = useRef(null);
  const speechRequestIdRef = useRef(0);
  const ttsFetchAbortRef = useRef(null);

  // Language mapping with display names
  const languageMapping = {
    asm: { name: "Assamese", speechLang: "as-IN", nativeName: "অসমীয়া" },
    ben: { name: "Bengali", speechLang: "bn-IN", nativeName: "বাংলা" },
    bod: { name: "Bodo", speechLang: "brx-IN", nativeName: "बड़ो" },
    dgo: { name: "Dogri", speechLang: "doi-IN", nativeName: "डोगरी" },
    guj: { name: "Gujarati", speechLang: "gu-IN", nativeName: "ગુજરાતી" },
    hin: { name: "Hindi", speechLang: "hi-IN", nativeName: "हिन्दी" },
    kan: { name: "Kannada", speechLang: "kn-IN", nativeName: "ಕನ್ನಡ" },
    kas: { name: "Kashmiri", speechLang: "ks-IN", nativeName: "کٲشُر" },
    kok: { name: "Konkani", speechLang: "kok-IN", nativeName: "कोंकणी" },
    mai: { name: "Maithili", speechLang: "mai-IN", nativeName: "मैथिली" },
    mal: { name: "Malayalam", speechLang: "ml-IN", nativeName: "മലയാളം" },
    mni: { name: "Manipuri", speechLang: "mni-IN", nativeName: "ꯃꯅꯤꯄꯨꯔꯤ" },
    mar: { name: "Marathi", speechLang: "mr-IN", nativeName: "मराठी" },
    npi: { name: "Nepali", speechLang: "ne-IN", nativeName: "नेपाली" },
    ory: { name: "Odia", speechLang: "or-IN", nativeName: "ଓଡିଆ" },
    pan: { name: "Punjabi", speechLang: "pa-IN", nativeName: "ਪੰਜਾਬੀ" },
    san: { name: "Sanskrit", speechLang: "sa-IN", nativeName: "संस्कृतम्" },
    sat: { name: "Santali", speechLang: "sat-IN", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
    snd: { name: "Sindhi", speechLang: "sd-IN", nativeName: "सिन्धी" },
    tam: { name: "Tamil", speechLang: "ta-IN", nativeName: "தமிழ்" },
    tel: { name: "Telugu", speechLang: "te-IN", nativeName: "తెలుగు" },
    urd: { name: "Urdu", speechLang: "ur-IN", nativeName: "اردو" },
    eng: { name: "English", speechLang: "en-US", nativeName: "English" },
  };

  // List of commonly used languages for the dropdown
  const commonLanguages = [
    { code: "en-US", mappingKey: "eng" },
    { code: "hi-IN", mappingKey: "hin" },
    { code: "ta-IN", mappingKey: "tam" },
    { code: "te-IN", mappingKey: "tel" },
    { code: "kn-IN", mappingKey: "kan" },
    { code: "ml-IN", mappingKey: "mal" },
    { code: "gu-IN", mappingKey: "guj" },
    { code: "mr-IN", mappingKey: "mar" },
    { code: "bn-IN", mappingKey: "ben" },
    { code: "pa-IN", mappingKey: "pan" },
    { code: "ur-IN", mappingKey: "urd" },
    { code: "as-IN", mappingKey: "asm" },
    { code: "or-IN", mappingKey: "ory" },
    { code: "ne-IN", mappingKey: "npi" },
  ];

  const tesseractLangMap = {
    "en-US": "eng",
    "hi-IN": "hin",
    "ta-IN": "tam",
    "te-IN": "tel",
    "kn-IN": "kan",
    "ml-IN": "mal+eng",
    "gu-IN": "guj",
    "mr-IN": "mar",
    "bn-IN": "ben",
    "pa-IN": "pan",
    "ur-IN": "urd",
    "as-IN": "asm",
    "or-IN": "ori",
    "ne-IN": "nep",
  };

  // Keep userId synced with auth state across sign-in/sign-out events.
  useEffect(() => {
    let mounted = true;

    const syncUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setUserId(session?.user?.id || "default_user");
      } catch {
        if (!mounted) return;
        setUserId("default_user");
      }
    };

    syncUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id || "default_user");
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Fetch chat history when the component mounts and userId is available
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!userId) return;
      if (isGuidedAssistanceRoute(decodedTitle)) {
        setConversation([]);
        return;
      }
  
      try {
        const formattedServiceTitle = decodedTitle.toLowerCase().replace(/\s+/g, "-");
        const res = await fetch(`${backendUrl}/${formattedServiceTitle}/history`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": userId,
          },
        });
  
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg = errorData.error || `HTTP error! status: ${res.status}`;
          console.error("Server error fetching history:", errorData);
          console.error("Service used:", formattedServiceTitle);
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.history && data.history.length) {
          setConversation(data.history);
          return;
        }

        if (userId && userId !== "default_user") {
          const { data: rows } = await supabase
            .from("chat_histories")
            .select("history, updated_at")
            .eq("user_id", userId)
            .eq("service", formattedServiceTitle)
            .order("updated_at", { ascending: false })
            .limit(1);
          if (rows && rows.length && rows[0].history) {
            setConversation(rows[0].history);
          }
        }
      } catch (error) {
        // Silently fail if history can't be loaded - it's not critical for initial page load
        console.warn("Could not load chat history (this is okay for new sessions):", error.message);
      }
    };
  
    fetchChatHistory();
  }, [userId, decodedTitle]);

  useEffect(() => {
    if (!isGuidedAssistanceRoute(decodedTitle)) {
      setAssistHistory([]);
      return;
    }
    setAssistHistory(readAssistHistory());
  }, [userId, decodedTitle]);

  useEffect(() => {
    if (!isGuidedAssistanceRoute(decodedTitle)) return;
    setChatSessionId(createChatSessionId());
  }, [decodedTitle, userId]);

  useEffect(() => {
    if (!isSelfLawyerRoute(decodedTitle)) {
      setSelfLawyerHistory([]);
      setIsSelfLawyerHistoryOpen(false);
      return;
    }
    setSelfLawyerHistory(readSelfLawyerHistory());
  }, [userId, decodedTitle]);

  useEffect(() => {
    if (!isSelfLawyerRoute(decodedTitle)) return;
    setSelfLawyerSessionId(createChatSessionId());
  }, [decodedTitle, userId]);

  useEffect(() => {
    if (!isGuidedAssistanceRoute(decodedTitle)) return undefined;
    const handleBeforeLogout = () => {
      archiveCurrentAssistConversation();
    };
    window.addEventListener("lexassist:before-logout", handleBeforeLogout);
    return () => {
      window.removeEventListener("lexassist:before-logout", handleBeforeLogout);
    };
  }, [conversation, userId, decodedTitle]);

  useEffect(() => {
    if (!isSelfLawyerRoute(decodedTitle)) return undefined;
    const handleBeforeLogout = () => {
      archiveCurrentSelfLawyerConversation();
    };
    window.addEventListener("lexassist:before-logout", handleBeforeLogout);
    return () => {
      window.removeEventListener("lexassist:before-logout", handleBeforeLogout);
    };
  }, [conversation, userId, decodedTitle, selfLawyerSessionId]);

  // Persist chat history to Supabase as a fallback
  useEffect(() => {
    if (isGuidedAssistanceRoute(decodedTitle)) return;
    if (!userId || userId === "default_user" || conversation.length === 0) return;
    const formattedServiceTitle = decodedTitle.toLowerCase().replace(/\s+/g, "-");

    if (historyPersistTimeoutRef.current) {
      clearTimeout(historyPersistTimeoutRef.current);
    }
    historyPersistTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase.from("chat_histories").insert({
          user_id: userId,
          service: formattedServiceTitle,
          history: conversation,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn("Could not persist chat history:", error?.message || error);
      }
    }, 600);

    return () => {
      if (historyPersistTimeoutRef.current) {
        clearTimeout(historyPersistTimeoutRef.current);
      }
    };
  }, [conversation, userId, decodedTitle]);

  // Cleanup TTS audio element/object URL
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (ttsObjectUrlRef.current) {
        URL.revokeObjectURL(ttsObjectUrlRef.current);
        ttsObjectUrlRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      browserUtteranceRef.current = null;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (ttsObjectUrlRef.current) {
        URL.revokeObjectURL(ttsObjectUrlRef.current);
        ttsObjectUrlRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      browserUtteranceRef.current = null;
    };
  }, []);

  // Handle language selection change
  const handleLanguageChange = (langCode) => {
    setSelectedLanguage(langCode);
    setSpeechRecognitionLang(langCode);
    setIsLanguageDropdownOpen(false);
    console.log(`Language changed to: ${langCode}`);
    // If recognition is active, stop it (user will need to click mic again with new language)
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
      resetRecognitionCycle();
    }
  };

  // Sync speechRecognitionLang with selectedLanguage
  useEffect(() => {
    setSpeechRecognitionLang(selectedLanguage);
  }, [selectedLanguage]);

  // Get dropdown position for fixed positioning
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  useEffect(() => {
    if (isLanguageDropdownOpen && languageDropdownRef.current) {
      const rect = languageDropdownRef.current.getBoundingClientRect();
      // For fixed positioning, use viewport coordinates (no scroll offset needed)
      setDropdownPosition({
        top: rect.bottom + 8, // 8px spacing below button
        left: rect.left,
      });
    }
  }, [isLanguageDropdownOpen]);

  // Close dropdown when clicking outside or scrolling the page (not dropdown content)
  useEffect(() => {
    if (!isLanguageDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (
        languageDropdownRef.current && 
        !languageDropdownRef.current.contains(event.target) &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(event.target)
      ) {
        setIsLanguageDropdownOpen(false);
      }
    };
    
    // Handle scroll inside dropdown - set flag to prevent closing
    const dropdownElement = dropdownMenuRef.current;
    const handleDropdownScroll = () => {
      isScrollingDropdownRef.current = true;
      setTimeout(() => {
        isScrollingDropdownRef.current = false;
      }, 150);
    };
    
    // Handle window scroll (page scroll) - only close if not scrolling dropdown
    const handleWindowScroll = () => {
      if (!isScrollingDropdownRef.current) {
        setIsLanguageDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    
    // Add scroll listener to dropdown element
    if (dropdownElement) {
      dropdownElement.addEventListener("scroll", handleDropdownScroll, false);
    }
    
    // Add scroll listener to window (only fires on page scroll, not element scroll)
    window.addEventListener("scroll", handleWindowScroll, false);
    window.addEventListener("resize", () => {
      setIsLanguageDropdownOpen(false);
    });
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (dropdownElement) {
        dropdownElement.removeEventListener("scroll", handleDropdownScroll, false);
      }
      window.removeEventListener("scroll", handleWindowScroll, false);
      window.removeEventListener("resize", () => {});
    };
  }, [isLanguageDropdownOpen]);

  const clearRecognitionAttemptTimeout = () => {
    if (recognitionAttemptTimeoutRef.current) {
      clearTimeout(recognitionAttemptTimeoutRef.current);
      recognitionAttemptTimeoutRef.current = null;
    }
  };

  const resetRecognitionCycle = () => {
    recognitionLangCycleRef.current = [];
    recognitionLangIndexRef.current = 0;
    clearRecognitionAttemptTimeout();
  };

  const getRecognitionLanguageCycle = (preferredLang) => {
    const unique = [];
    const addLang = (langCode) => {
      if (!langCode) return;
      if (!unique.includes(langCode)) {
        unique.push(langCode);
      }
    };

    addLang(preferredLang || selectedLanguage || speechRecognitionLang || "en-US");
    commonLanguages.forEach((langItem) => addLang(langItem.code));
    addLang("en-US");
    return unique;
  };

  const prepareRecognitionCycle = (preferredLang) => {
    recognitionLangCycleRef.current = getRecognitionLanguageCycle(preferredLang);
    recognitionLangIndexRef.current = 0;
    clearRecognitionAttemptTimeout();
  };

  const moveToNextRecognitionLanguage = (recog) => {
    const cycle = recognitionLangCycleRef.current || [];
    if (!cycle.length) return false;
    if (recognitionLangIndexRef.current >= cycle.length - 1) return false;
    recognitionLangIndexRef.current += 1;
    recog.lang = cycle[recognitionLangIndexRef.current];
    return true;
  };

  const initRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      setSpeechError("Speech recognition is not supported in this browser.");
      return null;
    }

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 3;
    recog.lang = speechRecognitionLang || "en-US"; // Default to English
    recog.onstart = () => {
      setSpeechError("");
      setIsListening(true);
      clearRecognitionAttemptTimeout();
      if (listeningRequestedRef.current) {
        const isFirstAttempt = recognitionLangIndexRef.current === 0;
        const attemptWindowMs = isFirstAttempt ? 6000 : 2500;
        recognitionAttemptTimeoutRef.current = setTimeout(() => {
          if (listeningRequestedRef.current) {
            try {
              recog.stop();
            } catch {
              // ignore stop errors during auto-cycling
            }
          }
        }, attemptWindowMs);
      }
    };

    recog.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      if (finalTranscript.trim()) {
        clearRecognitionAttemptTimeout();
        setPrompt((prev) =>
          prev ? `${prev} ${finalTranscript.trim()}` : finalTranscript.trim()
        );
        const detectedFromSpeech = detectLanguage(finalTranscript.trim());
        if (detectedFromSpeech && detectedFromSpeech !== selectedLanguage) {
          setSelectedLanguage(detectedFromSpeech);
          setSpeechRecognitionLang(detectedFromSpeech);
        }
        listeningRequestedRef.current = false;
        resetRecognitionCycle();
        recog.stop();
      }
    };

    recog.onerror = (err) => {
      console.error("Speech recognition error: ", err);
      clearRecognitionAttemptTimeout();

      if (err.error === "no-speech" || err.error === "language-not-supported") {
        setSpeechError("Trying other languages... speak naturally.");
      } else if (err.error === "not-allowed" || err.error === "service-not-allowed") {
        listeningRequestedRef.current = false;
        resetRecognitionCycle();
        setIsListening(false);
        setSpeechError("Microphone access blocked. Please allow mic permissions.");
      } else {
        listeningRequestedRef.current = false;
        resetRecognitionCycle();
        setIsListening(false);
        setSpeechError("Speech recognition failed. Please try again.");
      }
    };

    recog.onend = () => {
      setIsListening(false);
      clearRecognitionAttemptTimeout();
      if (listeningRequestedRef.current) {
        const hasNextLanguage = moveToNextRecognitionLanguage(recog);
        if (!hasNextLanguage) {
          listeningRequestedRef.current = false;
          resetRecognitionCycle();
          setSpeechError("Could not recognize speech in available languages. Please try again.");
          return;
        }
        setSpeechError(`Listening... (${recog.lang})`);
        try {
          recog.start();
        } catch (error) {
          listeningRequestedRef.current = false;
          resetRecognitionCycle();
          setSpeechError("Could not restart speech recognition. Please try again.");
        }
      }
    };

    setSpeechError("");
    recognitionRef.current = recog;
    setRecognition(recog);
    return recog;
  };

  // Initialize speech recognition
  useEffect(() => {
    const recog = initRecognition();
    return () => {
      resetRecognitionCycle();
      if (recog) {
        recog.stop();
      }
    };
  }, [speechRecognitionLang]);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  // Toggle speech recognition
  const toggleListening = () => {
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setSpeechError("Speech recognition requires HTTPS or localhost.");
      return;
    }

    let recog = recognitionRef.current || recognition;
    if (!recog) {
      recog = initRecognition();
      if (!recog) return;
    }

    if (isListening) {
      listeningRequestedRef.current = false;
      resetRecognitionCycle();
      recog.stop();
      setIsListening(false);
    } else {
      listeningRequestedRef.current = true;
      prepareRecognitionCycle(selectedLanguage || speechRecognitionLang || "en-US");
      recog.lang = recognitionLangCycleRef.current[0] || "en-US";
      setSpeechError(`Listening... (${recog.lang})`);
      try {
        recog.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        listeningRequestedRef.current = false;
        resetRecognitionCycle();
        setIsListening(false);
        setSpeechError("Could not start speech recognition. Please try again.");
      }
    }
  };

  // Handle prompt submission
  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;
    if (isDocumentAnalyser) {
      setDocAnalysis("");
    }

    const userLang = resolveUserLang(prompt);
    const activeChatUserId = isGuidedAssistanceService
      ? `${userId || "default_user"}::${chatSessionId}`
      : isSelfLawyerGuide
      ? `${userId || "default_user"}::selflawyer::${selfLawyerSessionId}`
      : userId;
    
    const userMessage = { role: "user", content: prompt.trim(), lang: userLang };
    setConversation((prev) => [...prev, userMessage]);
    let userQuery = prompt.trim();

    if (isSelfLawyerGuide && evidenceText.trim()) {
      userQuery = `Here is my current question:\n${prompt.trim()}\n\nHere are my uploaded proofs and evidence (OCR text):\n${evidenceText.trim()}\n\nPlease use this evidence while guiding me as my self-lawyer mentor.`;
    }
    if (isGuidedAssistanceService) {
      // Keep the query natural to avoid repetitive template-like responses.
      // Language/simple wording behavior is already handled by backend prompts.
      userQuery = prompt.trim();
    }
    setPrompt("");

    if (userId && userId !== "default_user" && !caseSavedRef.current) {
      caseSavedRef.current = true;
      try {
        await fetch(`${backendUrl}/user/current-case`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-ID": userId,
          },
          body: JSON.stringify({
            summary: userQuery,
            service: decodedTitle,
            source: "service-chat",
          }),
        });
      } catch (error) {
        console.warn("Could not save current case:", error?.message || error);
        try {
          await supabase.from("user_cases").insert({
            user_id: userId,
            summary: userQuery,
            service: decodedTitle,
            source: "service-chat",
            updated_at: new Date().toISOString(),
          });
        } catch (fallbackError) {
          console.warn("Fallback case save failed:", fallbackError?.message || fallbackError);
        }
      }
    }

    try {
      const formattedServiceTitle = decodedTitle.toLowerCase().replace(/\s+/g, "-");
      console.log("Original title:", decodedTitle);
      console.log("Formatted service title:", formattedServiceTitle);
      console.log("API URL:", `${backendUrl}/${formattedServiceTitle}/chat`);
      const res = await fetch(`${backendUrl}/${formattedServiceTitle}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": activeChatUserId,
        },
        body: JSON.stringify({ 
          query: userQuery, 
          user_id: activeChatUserId,
          language: userLang,
          selected_language: selectedLanguage
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMsg = errorData.error || `HTTP error! status: ${res.status}`;
        if (errorData.available_services) {
          errorMsg += `\nAvailable services: ${errorData.available_services.join(', ')}`;
        }
        if (errorData.received_service) {
          errorMsg += `\nReceived service: '${errorData.received_service}'`;
        }
        console.error("Server error:", errorData);
        console.error("Service used:", formattedServiceTitle);
        console.error("Full error response:", JSON.stringify(errorData, null, 2));
        throw new Error(errorMsg);
      }

      const data = await res.json();

      if (data.response) {
        const botResponse = data.response;
        // Use the same language as the user's query for bot response
        // The backend should have responded in the same language
        const botLang = userMessage.lang;
        setConversation((prev) => [
          ...prev,
          { role: "bot", content: botResponse, lang: botLang },
        ]);
        if (isDocumentAnalyser) {
          setDocAnalysis(botResponse);
        }
      } else if (data.error) {
        setConversation((prev) => [
          ...prev,
          { role: "bot", content: `Error: ${data.error}`, lang: userMessage.lang },
        ]);
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = error.message || "Unable to connect to the server";
      setConversation((prev) => [
        ...prev,
        { role: "bot", content: `Error: ${errorMessage}`, lang: userMessage.lang },
      ]);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handlePromptSubmit();
    }
  };

  // Detect language
  const detectLanguage = (text) => {
    const langCode = franc(text);
    return languageMapping[langCode]?.speechLang || "en-US";
  };

  const resolveUserLang = (text) => {
    // Assistance services should always follow the explicit dropdown language choice.
    if (isGuidedAssistanceService || isSelfLawyerGuide) {
      return selectedLanguage || "en-US";
    }

    const detectedLang = detectLanguage(text.trim());
    let userLang;
    if (detectedLang !== "en-US") {
      userLang = detectedLang;
      if (detectedLang !== selectedLanguage) {
        setSelectedLanguage(detectedLang);
        setSpeechRecognitionLang(detectedLang);
        console.log(`Language automatically switched to: ${detectedLang}`);
      }
    } else {
      userLang = selectedLanguage || "en-US";
    }
    return userLang;
  };

  const resolveDocumentLang = () => {
    return selectedLanguage || "en-US";
  };

  // Clean text for better TTS (remove markdown, special characters that might interfere)
  const cleanTextForTTS = (text) => {
    if (!text) return "";
    
    // Create a temporary div to extract plain text if HTML is present
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    let cleaned = tempDiv.textContent || tempDiv.innerText || text;
    
    // Remove markdown syntax (comprehensive cleaning)
    cleaned = cleaned
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Inline code
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links [text](url) -> text
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/```[\s\S]*?```/g, '') // Code blocks
      .replace(/^\s*[-*•]\s+/gm, '') // Bullet markers
      .replace(/^\s*\d+\.\s+/gm, '') // Numbered list markers
      .replace(/---/g, '') // Horizontal rules
      .replace(/[*_~`]/g, ' ') // Leftover markdown characters
      .replace(/[|]/g, ' ') // Table separators
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
      .replace(/[ \t]{2,}/g, ' ') // Repeated spaces
      .replace(/&nbsp;/g, ' ') // Non-breaking spaces
      .replace(/&[a-z]+;/gi, ' ') // Other HTML entities
      .trim();
    
    return cleaned;
  };

  const normalizeTTSLang = (langCode) => {
    const code = (langCode || "").trim();
    if (!code) return "en-US";
    if (code === "ne-IN") return "ne-NP";
    return code;
  };

  const FAST_START_TTS_LANGS = new Set(["en-US", "hi-IN", "ta-IN"]);

  const hasBrowserVoiceForLanguage = (langCode) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return false;
    const normalizedLang = normalizeTTSLang(langCode).toLowerCase();
    const prefix = normalizedLang.split("-")[0];
    return voices.some((voice) => {
      const voiceLang = (voice.lang || "").toLowerCase();
      return voiceLang === normalizedLang || voiceLang.startsWith(`${prefix}-`);
    });
  };

  const shouldUseFastStartTTS = (langCode) => {
    if (FAST_START_TTS_LANGS.has(langCode)) return true;
    // Malayalam can use fast-start if a real Malayalam-capable browser voice exists.
    if (langCode === "ml-IN") return hasBrowserVoiceForLanguage("ml-IN");
    return false;
  };

  const speakWithBrowserTTS = async (text, langCode) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      throw new Error("Browser speech synthesis is not supported on this device.");
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new window.SpeechSynthesisUtterance(text);
      const normalizedLang = normalizeTTSLang(langCode);
      utterance.lang = normalizedLang;
      utterance.rate = 0.95;
      utterance.pitch = 1;

      const selectVoiceAndSpeak = () => {
        const voices = synth.getVoices() || [];
        if (voices.length > 0) {
          const primary = normalizedLang.toLowerCase();
          const prefix = primary.split("-")[0];
          const matchedVoice =
            voices.find((voice) => (voice.lang || "").toLowerCase() === primary) ||
            voices.find((voice) => (voice.lang || "").toLowerCase().startsWith(`${prefix}-`));
          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }
        }
        browserUtteranceRef.current = utterance;
        synth.speak(utterance);
      };

      utterance.onend = () => {
        browserUtteranceRef.current = null;
        resolve();
      };
      utterance.onerror = () => {
        browserUtteranceRef.current = null;
        reject(new Error(`Browser TTS could not speak in ${normalizedLang}.`));
      };

      // Fast-start: speak immediately without waiting for voiceschanged,
      // then browser picks best available voice for the language.
      selectVoiceAndSpeak();
    });
  };

  const stopCurrentSpeech = (invalidatePending = true) => {
    if (invalidatePending) {
      speechRequestIdRef.current += 1;
    }
    if (ttsFetchAbortRef.current) {
      ttsFetchAbortRef.current.abort();
      ttsFetchAbortRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current);
      ttsObjectUrlRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    browserUtteranceRef.current = null;
    setActiveSpeechKey(null);
  };

  // Speak text
  const speakText = async (text, lang, speechKey = null) => {
    if (!isTTSEnabled) {
      return;
    }
    const cleanedText = cleanTextForTTS(text);
    if (!cleanedText) return;

    stopCurrentSpeech(true);
    const requestId = speechRequestIdRef.current;
    const isLatestRequest = () => requestId === speechRequestIdRef.current;

    try {
      const langToUse = normalizeTTSLang(lang || selectedLanguage || "en-US");
      if (!isLatestRequest()) return;
      setActiveSpeechKey(speechKey || "global");
      if (shouldUseFastStartTTS(langToUse)) {
        try {
          await speakWithBrowserTTS(cleanedText, langToUse);
          if (!isLatestRequest()) return;
          setActiveSpeechKey(null);
          setSpeechError("");
          return;
        } catch (browserFastErr) {
          console.warn("Fast-start browser TTS failed, falling back to backend TTS:", browserFastErr);
        }
      }

      const fetchController = new AbortController();
      ttsFetchAbortRef.current = fetchController;
      const response = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: fetchController.signal,
        body: JSON.stringify({
          text: cleanedText,
          language: langToUse,
        }),
      });
      if (ttsFetchAbortRef.current === fetchController) {
        ttsFetchAbortRef.current = null;
      }
      if (!isLatestRequest()) return;

      if (!response.ok) {
        let err = "Failed to generate speech audio.";
        try {
          const data = await response.json();
          if (data?.error) err = data.error;
        } catch {
          // keep default
        }
        throw new Error(err);
      }

      const blob = await response.blob();
      if (!isLatestRequest()) return;
      const objectUrl = URL.createObjectURL(blob);
      if (!isLatestRequest()) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      const audio = new Audio(objectUrl);
      ttsObjectUrlRef.current = objectUrl;
      ttsAudioRef.current = audio;
      audio.onended = () => {
        if (!isLatestRequest()) return;
        if (ttsObjectUrlRef.current) {
          URL.revokeObjectURL(ttsObjectUrlRef.current);
          ttsObjectUrlRef.current = null;
        }
        ttsAudioRef.current = null;
        setActiveSpeechKey(null);
      };
      audio.onerror = () => {
        if (!isLatestRequest()) return;
        if (ttsObjectUrlRef.current) {
          URL.revokeObjectURL(ttsObjectUrlRef.current);
          ttsObjectUrlRef.current = null;
        }
        ttsAudioRef.current = null;
        setActiveSpeechKey(null);
      };
      if (!isLatestRequest()) {
        audio.pause();
        if (ttsObjectUrlRef.current) {
          URL.revokeObjectURL(ttsObjectUrlRef.current);
          ttsObjectUrlRef.current = null;
        }
        ttsAudioRef.current = null;
        return;
      }
      await audio.play();
    } catch (err) {
      if (err?.name === "AbortError") {
        return;
      }
      if (!isLatestRequest()) return;
      console.warn("Cloud TTS failed, using browser speech fallback:", err);
      try {
        const fallbackLang = normalizeTTSLang(lang || selectedLanguage || "en-US");
        // Malayalam should rely on backend gTTS and avoid browser-voice dependency errors.
        if (fallbackLang === "ml-IN") {
          throw err;
        }
        await speakWithBrowserTTS(cleanedText, fallbackLang);
        if (!isLatestRequest()) return;
        setActiveSpeechKey(null);
        setSpeechError("");
      } catch (fallbackErr) {
        if (!isLatestRequest()) return;
        console.error("Browser TTS fallback failed:", fallbackErr);
        setActiveSpeechKey(null);
        setSpeechError(
          fallbackErr?.message ||
            err?.message ||
            "Unable to play speech audio."
        );
      }
    }
  };

  // Toggle TTS
  const toggleTTS = () => {
    if (isTTSEnabled) {
      stopCurrentSpeech();
    }
    setIsTTSEnabled((prev) => !prev);
  };

  // Check if this is the virtual courtroom experience
  const normalizedServiceSlug = normalizeServiceSlug(decodedTitle);
  const isCourtroomExperience =
    decodedTitle.toLowerCase().includes("virtual courtroom experience") ||
    normalizedServiceSlug === "virtual-courtroom-experience";
  const isDocumentAnalyser =
    decodedTitle.toLowerCase() === "document analyser" ||
    normalizedServiceSlug === "document-analyser";
  const isSelfLawyerGuide =
    decodedTitle.toLowerCase() === "self lawyer guide" ||
    normalizedServiceSlug === "self-lawyer-guide";
  const isPersonalFamilyAssistance =
    decodedTitle.toLowerCase() === "personal and family legal assistance" ||
    normalizedServiceSlug === "personal-and-family-legal-assistance";
  const isConsumerAssistance =
    decodedTitle.toLowerCase() === "business consumer and criminal legal assistance" ||
    normalizedServiceSlug === "business-consumer-and-criminal-legal-assistance" ||
    normalizedServiceSlug === "consumer-rights";
  const isGuidedAssistanceService = isPersonalFamilyAssistance || isConsumerAssistance;
  const selfLawyerUi = SELF_LAWYER_UI[selectedLanguage] || SELF_LAWYER_UI["en-US"];
  const selfLawyerOptionLabels = SELF_LAWYER_OPTION_LABELS[selectedLanguage] || SELF_LAWYER_OPTION_LABELS["en-US"];
  const assistUi = ASSIST_UI[selectedLanguage] || ASSIST_UI["en-US"];
  const selfLawyerLanguageName =
    Object.values(languageMapping).find((lang) => lang.speechLang === selectedLanguage)?.name ||
    "English";
  const selectedLanguageName = selfLawyerLanguageName;

  useEffect(() => {
    if (!isDocumentAnalyser) return;
    // Clear stale upload/network errors when entering Document Analyser.
    setUploadError("");
    setUploadStatus("");
  }, [isDocumentAnalyser, decodedTitle]);

  const serviceSlug = decodedTitle.toLowerCase().replace(/\s+/g, "-");
  const getAssistHistoryKey = () => {
    if (!userId || userId === "default_user") return null;
    return `assist-history:${userId}:${serviceSlug}`;
  };

  const readAssistHistory = () => {
    if (typeof window === "undefined") return [];
    const key = getAssistHistoryKey();
    if (!key) return [];
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeAssistHistory = (items) => {
    if (typeof window === "undefined") return;
    const key = getAssistHistoryKey();
    if (!key) return;
    window.localStorage.setItem(key, JSON.stringify(items));
  };

  const getSelfLawyerHistoryKey = () => {
    if (!userId || userId === "default_user") return null;
    return `self-lawyer-history:${userId}:${serviceSlug}`;
  };

  const readSelfLawyerHistory = () => {
    if (typeof window === "undefined") return [];
    const key = getSelfLawyerHistoryKey();
    if (!key) return [];
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeSelfLawyerHistory = (items) => {
    if (typeof window === "undefined") return;
    const key = getSelfLawyerHistoryKey();
    if (!key) return;
    window.localStorage.setItem(key, JSON.stringify(items));
  };

  const archiveCurrentAssistConversation = () => {
    if (!isGuidedAssistanceService) return;
    const cleaned = (conversation || []).filter((msg) => (msg?.content || "").trim());
    if (cleaned.length === 0) return;

    const existing = readAssistHistory();
    const latest = existing[0];
    if (latest && JSON.stringify(latest.messages) === JSON.stringify(cleaned)) {
      return;
    }

    const firstUser = cleaned.find((msg) => msg.role === "user")?.content || "Conversation";
    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: chatSessionId,
      savedAt: new Date().toISOString(),
      title: firstUser.slice(0, 80),
      messages: cleaned,
    };
    const next = [snapshot, ...existing].slice(0, 30);
    writeAssistHistory(next);
    setAssistHistory(next);
  };

  const loadAssistConversation = (sessionId) => {
    const existing = readAssistHistory();
    const selected = existing.find((item) => item.id === sessionId);
    if (!selected || !Array.isArray(selected.messages)) return;
    setConversation(selected.messages);
    setChatSessionId(selected.sessionId || createChatSessionId());
  };

  const deleteAssistConversation = (sessionId) => {
    const existing = readAssistHistory();
    const next = existing.filter((item) => item.id !== sessionId);
    writeAssistHistory(next);
    setAssistHistory(next);
  };

  const clearAllAssistHistory = () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete all previous chat histories?");
      if (!confirmed) return;
    }
    writeAssistHistory([]);
    setAssistHistory([]);
  };

  const archiveCurrentSelfLawyerConversation = () => {
    if (!isSelfLawyerGuide) return;
    const cleaned = (conversation || []).filter((msg) => (msg?.content || "").trim());
    if (cleaned.length === 0) return;

    const existing = readSelfLawyerHistory();
    const latest = existing[0];
    if (latest && JSON.stringify(latest.messages) === JSON.stringify(cleaned)) {
      return;
    }

    const firstUser = cleaned.find((msg) => msg.role === "user")?.content || "Self Lawyer Conversation";
    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: selfLawyerSessionId,
      savedAt: new Date().toISOString(),
      title: firstUser.slice(0, 80),
      messages: cleaned,
    };
    const next = [snapshot, ...existing].slice(0, 30);
    writeSelfLawyerHistory(next);
    setSelfLawyerHistory(next);
  };

  const loadSelfLawyerConversation = (sessionId) => {
    const existing = readSelfLawyerHistory();
    const selected = existing.find((item) => item.id === sessionId);
    if (!selected || !Array.isArray(selected.messages)) return;
    setConversation(selected.messages);
    setSelfLawyerSessionId(selected.sessionId || createChatSessionId());
  };

  const startNewAssistChat = () => {
    archiveCurrentAssistConversation();
    setConversation([]);
    setPrompt("");
    setChatSessionId(createChatSessionId());
    caseSavedRef.current = false;
  };

  const startNewSelfLawyerChat = () => {
    archiveCurrentSelfLawyerConversation();
    setConversation([]);
    setPrompt("");
    setSelfLawyerSessionId(createChatSessionId());
    setIsSelfLawyerHistoryOpen(false);
    caseSavedRef.current = false;
  };

  const guidedQuickActions = isPersonalFamilyAssistance
    ? (ASSIST_QUICK_ACTIONS.personal[selectedLanguage] || ASSIST_QUICK_ACTIONS.personal["en-US"])
    : (ASSIST_QUICK_ACTIONS.consumer[selectedLanguage] || ASSIST_QUICK_ACTIONS.consumer["en-US"]);

  const selfLawyerQuickActions = [
    {
      id: "timeline",
      label: selfLawyerOptionLabels.quick.timeline,
      prompt:
        `Build a practical case timeline from my facts with what I should do now, this week, and before next hearing. Respond entirely in ${selfLawyerLanguageName}.`,
    },
    {
      id: "evidence",
      label: selfLawyerOptionLabels.quick.evidence,
      prompt:
        `Create an evidence checklist for my case with documents, witnesses, and digital proofs. Mention relevance and admissibility basics under BSA. Respond entirely in ${selfLawyerLanguageName}.`,
    },
    {
      id: "opening",
      label: selfLawyerOptionLabels.quick.opening,
      prompt:
        `Draft a simple opening statement for court in plain language, with clear facts, legal points, and relief sought. Respond entirely in ${selfLawyerLanguageName}.`,
    },
    {
      id: "cross",
      label: selfLawyerOptionLabels.quick.cross,
      prompt:
        `Prepare focused cross-examination questions for the opposite side witness with objective and expected admission for each. Respond entirely in ${selfLawyerLanguageName}.`,
    },
    {
      id: "hearing-day",
      label: selfLawyerOptionLabels.quick.hearingDay,
      prompt:
        `Give me a hearing-day playbook: what to carry, what to say first, what to avoid, and a courtroom etiquette checklist. Respond entirely in ${selfLawyerLanguageName}.`,
    },
  ];

  const attachSelfLawyerPrompt = (draft) => {
    setPrompt((prev) => {
      const current = (prev || "").trim();
      const nextDraft = (draft || "").trim();
      if (!nextDraft) return current;
      return current ? `${current}\n\n${nextDraft}` : nextDraft;
    });
  };

  const attachGuidedAssistancePrompt = (draft) => {
    setPrompt((prev) => {
      const current = (prev || "").trim();
      const nextDraft = (draft || "").trim();
      if (!nextDraft) return current;
      return current ? `${current}\n\n${nextDraft}` : nextDraft;
    });
  };

  const buildSelfLawyerGuidedPrompt = () => {
    const details = [];
    if (selfLawyerCase.caseType) details.push(`${selfLawyerUi.caseType}: ${selfLawyerOptionLabels.caseType[selfLawyerCase.caseType]}`);
    if (selfLawyerCase.stage) details.push(`${selfLawyerUi.stage}: ${selfLawyerOptionLabels.stage[selfLawyerCase.stage]}`);
    if (selfLawyerCase.courtLevel) details.push(`${selfLawyerUi.courtLevel}: ${selfLawyerOptionLabels.courtLevel[selfLawyerCase.courtLevel]}`);
    if (selfLawyerCase.opponentType.trim()) details.push(`${selfLawyerUi.oppositeParty}: ${selfLawyerCase.opponentType.trim()}`);
    if (selfLawyerCase.upcomingDate) details.push(`${selfLawyerUi.hearingDate}: ${selfLawyerCase.upcomingDate}`);
    if (selfLawyerCase.reliefWanted.trim()) details.push(`${selfLawyerUi.reliefWanted}: ${selfLawyerCase.reliefWanted.trim()}`);
    if (selfLawyerCase.keyFacts.trim()) details.push(`${selfLawyerUi.keyFacts}:\n${selfLawyerCase.keyFacts.trim()}`);

    const guided = `Act as my Self-Lawyer Coach for India. Respond in ${selfLawyerLanguageName}.

Use this case profile:
${details.join("\n")}

Please give:
1) A prioritized action plan (today / this week / before hearing),
2) Required documents + evidence checklist,
3) What to say in court (opening + key submissions),
4) Likely objections from opposite side and how to respond,
5) Risks, mistakes to avoid, and when I should consult a licensed advocate urgently.`;
    setSelfLawyerDraftPrompt(guided);
    attachSelfLawyerPrompt(guided);
  };

  const handleEvidenceUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEvidenceUploadError("");
    setEvidenceUploadStatus("");
    setIsEvidenceUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const ocrLang = tesseractLangMap[selectedLanguage] || "eng";
      formData.append("ocr_lang", ocrLang);
      const res = await fetch(`${backendUrl}/document-analyser/upload`, {
        method: "POST",
        body: formData,
      });
      let data = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      const newText = data.text || "";
      setEvidenceText((prev) =>
        prev ? `${prev}\n\n---\n\n${newText}` : newText
      );
      setEvidenceUploadStatus(selfLawyerUi.evidenceUploaded);
    } catch (error) {
      const raw = error?.message || "Upload failed";
      const friendly = /failed to fetch/i.test(raw)
        ? `Unable to reach backend at ${backendUrl}. Please ensure the backend server is running.`
        : raw;
      setEvidenceUploadError(friendly);
    } finally {
      setIsEvidenceUploading(false);
      event.target.value = "";
    }
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedDocName(file.name || "");
    setUploadError("");
    setUploadStatus("");
    setDocAnalysis("");
    setConversation([]);
    setIsDocHistoryOpen(false);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const ocrLang = tesseractLangMap[selectedLanguage] || "eng";
      formData.append("ocr_lang", ocrLang);
      const res = await fetch(`${backendUrl}/document-analyser/upload`, {
        method: "POST",
        body: formData,
      });
      let data = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      setDocText(data.text || "");
      setUploadStatus("Extracted text loaded. You can edit and send.");
    } catch (error) {
      setUploadedDocName("");
      const raw = error?.message || "Upload failed";
      const friendly = /failed to fetch/i.test(raw)
        ? `Unable to reach backend at ${backendUrl}. Please ensure the backend server is running.`
        : raw;
      setUploadError(friendly);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const extractDocumentTextFromQuery = (content) => {
    const raw = String(content || "");
    if (!raw) return "";
    const match = raw.match(/Document text:\s*([\s\S]*?)\n\s*User question:/i);
    if (!match || !match[1]) return "";
    return match[1].trim();
  };

  const resolveDocumentContextText = () => {
    const directDoc = String(docText || "").trim();
    if (directDoc) return directDoc;
    if (!Array.isArray(conversation) || conversation.length === 0) return "";
    for (let i = conversation.length - 1; i >= 0; i -= 1) {
      const item = conversation[i];
      if (item?.role !== "user") continue;
      const extracted = extractDocumentTextFromQuery(item?.content);
      if (extracted) return extracted;
    }
    return "";
  };

  const getRecentDocumentFollowupAnswers = () => {
    if (!Array.isArray(conversation) || conversation.length === 0) return [];
    return conversation
      .filter((item) => item?.role === "user")
      .map((item) => String(item?.content || "").trim())
      .filter((text) => text && text.toLowerCase() !== "analyse the document")
      .slice(-8);
  };

  const buildDocumentQuery = (question) => {
    const cleanedDoc = resolveDocumentContextText();
    const cleanedQuestion = (question || "").trim();
    const followupAnswers = getRecentDocumentFollowupAnswers();
    const MAX_DOC_CHARS = 12000;
    const MAX_QUESTION_CHARS = 1200;
    const limitedDoc = cleanedDoc.length > MAX_DOC_CHARS
      ? `${cleanedDoc.slice(0, MAX_DOC_CHARS)}\n\n[Truncated: document preview limited for analysis quality]`
      : cleanedDoc;
    const limitedQuestion = cleanedQuestion.length > MAX_QUESTION_CHARS
      ? cleanedQuestion.slice(0, MAX_QUESTION_CHARS)
      : cleanedQuestion;
    const followupBlock = followupAnswers.length
      ? `\n\nFollow-up answers already provided by user:\n${followupAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
      : "";
    if (cleanedQuestion) {
      return `Document text:\n${limitedDoc}${followupBlock}\n\nUser question:\n${limitedQuestion}`;
    }
    return `Document text:\n${limitedDoc}${followupBlock}\n\nUser question:\nPlease analyze the document and tell me if it is a form and what fields are missing.`;
  };

  const formatDocumentAnalysis = (raw) => {
    try {
      const isMalayalamDoc = selectedLanguage === "ml-IN";
      const docCopy = isMalayalamDoc
        ? {
            whatDoc: "ഈ രേഖ എന്താണ്",
            simple: "ലളിതമായി പറഞ്ഞാൽ",
            fill: "നിറയ്ക്കേണ്ട വിവരങ്ങൾ",
            missing: "കുറവുള്ള വിവരങ്ങൾ",
            consequences: "ഇത് ഒഴിഞ്ഞാൽ എന്ത് പ്രശ്നം വരാം",
            parties: "ഇതിൽ ഉൾപ്പെടുന്നവർ",
            dates: "പ്രധാന തീയതികൾ",
            next: "ഇപ്പോൾ ചെയ്യേണ്ടത്",
            obligations: "ആരാണ് എന്ത് ചെയ്യേണ്ടത്",
            rights: "നിങ്ങളുടെ അവകാശങ്ങൾ",
            risk: "ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ",
            moneyTerms: "പണവുമായി ബന്ധപ്പെട്ട കാര്യങ്ങൾ",
            endWhen: "കരാർ അവസാനിക്കുന്ന സാഹചര്യം",
            caseDetails: "കേസ് വിശദാംശങ്ങൾ",
            claims: "നിങ്ങളെതിരെ അവർ പറയുന്നത്",
            requiredNow: "ഇപ്പോൾ നിങ്ങൾ ചെയ്യേണ്ടത്",
            hearingDates: "ഹിയറിംഗ് തീയതികൾ",
            ignored: "ഇത് അവഗണിച്ചാൽ എന്ത് സംഭവിക്കും",
            mainPoints: "പ്രധാന കാര്യങ്ങൾ",
            urgency: "അടിയന്തിരത",
            liability: "ഉത്തരവാദിത്വ അപകടനില",
            lawApplied: "പ്രയോഗിക്കുന്ന നിയമം",
            courtArea: "കോടതി പരിധി",
            riskScore: "റിസ്‌ക് സ്കോർ",
            criticalRisk: "വളരെ പ്രധാന അപകട ക്ലോസുകൾ",
            ambiguous: "അവ്യക്തമായ ക്ലോസുകൾ",
            negotiation: "ചർച്ച ചെയ്യേണ്ട പോയിന്റുകൾ",
            unfair: "അനീതിയായ ക്ലോസുകൾ",
            formHelp: "ഫോം നിറയ്ക്കാൻ സഹായം",
            filledData: "ഇപ്പോൾ പൂരിപ്പിച്ച ഫോം ഡാറ്റ",
            nextQuestions: "അടുത്തതായി ഞാൻ നിങ്ങളോട് ചോദിക്കേണ്ട ചോദ്യങ്ങൾ",
            foreignerHelp: "വിദേശ ഉപയോക്താവിന് പ്രത്യേക സഹായം",
            onDocument: "രേഖയിൽ എഴുതിയിരിക്കുന്നത്",
            meaning: "അർത്ഥം",
            example: "ഉദാഹരണം",
            legalReview: "നിയമ വിദഗ്ധന്റെ പരിശോധന ആവശ്യമുണ്ടോ",
            startLabel: "തുടക്കം",
            endLabel: "അവസാനം",
            renewalLabel: "പുതുക്കൽ",
            party1: "പാർട്ടി 1",
            party2: "പാർട്ടി 2",
            issuingAuthority: "നോട്ടീസ് നൽകിയ സ്ഥാപനം",
            caseNumber: "കേസ് നമ്പർ",
            legalReason: "ഇങ്ങനെ തിരിച്ചറിഞ്ഞ കാരണം",
            confidence: "വിശ്വാസ സ്കോർ",
            field: "വിവരം",
            type: "തരം",
            required: "നിറയ്ക്കണം",
            notFound: "ഈ രേഖയിൽ കണ്ടെത്താനായില്ല.",
            yes: "അതെ",
            no: "അല്ല",
            unknown: "അറിയില്ല",
            docTypeMap: {
              form: "ഫോം",
              contract: "കരാർ രേഖ",
              legal_notice: "നിയമ നോട്ടീസ്",
              other: "മറ്റ് രേഖ",
            },
          }
        : selectedLanguage === "ta-IN"
        ? {
            whatDoc: "இந்த ஆவணம் என்ன?",
            simple: "எளிமையாக சொன்னால்",
            fill: "நீங்கள் நிரப்ப வேண்டியது",
            missing: "குறைந்த தகவல்கள்",
            consequences: "காலியாக விட்டால் என்ன பிரச்சனை வரும்",
            parties: "இதில் உள்ளவர்கள்",
            dates: "முக்கிய தேதிகள்",
            next: "இப்போது நீங்கள் செய்ய வேண்டியது",
            obligations: "யார் என்ன செய்ய வேண்டும்",
            rights: "உங்கள் உரிமைகள்",
            risk: "கவனிக்க வேண்டிய அபாயங்கள்",
            moneyTerms: "பண தொடர்பான நிபந்தனைகள்",
            endWhen: "ஒப்பந்தம் முடியும் நிலை",
            caseDetails: "வழக்கு விவரங்கள்",
            claims: "உங்கள்மீது கூறப்படும் குற்றச்சாட்டுகள்",
            requiredNow: "இப்போது நீங்கள் செய்ய வேண்டியது",
            hearingDates: "விசாரணை தேதிகள்",
            ignored: "இதை புறக்கணித்தால் என்ன நடக்கும்",
            mainPoints: "முக்கிய அம்சங்கள்",
            urgency: "அவசர நிலை",
            liability: "பொறுப்பு ஆபத்து நிலை",
            lawApplied: "பயன்படும் சட்டம்",
            courtArea: "நீதிமன்ற எல்லை",
            riskScore: "அபாய மதிப்பெண்",
            criticalRisk: "மிகவும் முக்கிய அபாய பிரிவுகள்",
            ambiguous: "தெளிவில்லாத பிரிவுகள்",
            negotiation: "பேச்சுவார்த்தை அம்சங்கள்",
            unfair: "அநியாயமான பிரிவுகள்",
            formHelp: "படிவம் நிரப்ப உதவி",
            filledData: "இப்போது நிரப்பப்பட்ட படிவத் தகவல்",
            nextQuestions: "அடுத்து நான் கேட்க வேண்டிய கேள்விகள்",
            foreignerHelp: "வெளிநாட்டு பயனாளருக்கான சிறப்பு உதவி",
            onDocument: "ஆவணத்தில் எழுதப்பட்டுள்ளது",
            meaning: "பொருள்",
            example: "உதாரணம்",
            legalReview: "சட்ட நிபுணர் பரிசீலனை தேவைதா",
            startLabel: "தொடக்கம்",
            endLabel: "முடிவு",
            renewalLabel: "புதுப்பிப்பு",
            party1: "கட்சி 1",
            party2: "கட்சி 2",
            issuingAuthority: "அறிவிப்பு அனுப்பிய அதிகாரம்",
            caseNumber: "வழக்கு எண்",
            legalReason: "இவ்வாறு வகைப்படுத்திய காரணம்",
            confidence: "நம்பிக்கை மதிப்பெண்",
            field: "புலம்",
            type: "வகை",
            required: "கட்டாயம் நிரப்ப வேண்டும்",
            notFound: "இந்த ஆவணத்தில் இந்த தகவல் இல்லை.",
            yes: "ஆம்",
            no: "இல்லை",
            unknown: "தெரியாது",
            docTypeMap: {
              form: "படிவம்",
              contract: "ஒப்பந்த ஆவணம்",
              legal_notice: "சட்ட நோட்டீஸ்",
              other: "மற்ற ஆவணம்",
            },
          }
        : {
            whatDoc: "What This Document Is",
            simple: "In Simple Words",
            fill: "What You Need To Fill",
            missing: "Missing Information",
            consequences: "What Can Go Wrong If Left Empty",
            parties: "Who Is Involved",
            dates: "Important Dates",
            next: "What To Do Now",
            obligations: "Who Must Do What",
            rights: "Your Rights",
            risk: "Risk Warnings",
            moneyTerms: "Money Terms",
            endWhen: "When It Can End",
            caseDetails: "Case Details",
            claims: "What They Are Saying Against You",
            requiredNow: "What You Should Do Now",
            hearingDates: "Hearing Dates",
            ignored: "What Can Happen If Ignored",
            mainPoints: "Main Points",
            urgency: "Urgency",
            liability: "Liability Exposure",
            lawApplied: "Law Applied",
            courtArea: "Court Area",
            riskScore: "Risk Score",
            criticalRisk: "Critical Risk Clauses",
            ambiguous: "Ambiguous Clauses",
            negotiation: "Negotiation Points",
            unfair: "Unfair Clauses",
            formHelp: "Form Filling Help",
            filledData: "Current Filled Form Data",
            nextQuestions: "Next Questions To Complete Form",
            foreignerHelp: "Foreigner-Specific Help",
            onDocument: "On the document this says",
            meaning: "Meaning",
            example: "Example",
            legalReview: "Legal Review Recommended",
            startLabel: "Start",
            endLabel: "End",
            renewalLabel: "Renewal",
            party1: "Party 1",
            party2: "Party 2",
            issuingAuthority: "Issuing Authority",
            caseNumber: "Case Number",
            legalReason: "Why We Classified It This Way",
            confidence: "Confidence Score",
            field: "Field",
            type: "Type",
            required: "Must fill",
            notFound: "Not found in this document.",
            yes: "true",
            no: "false",
            unknown: "unknown",
            docTypeMap: {
              form: "Form",
              contract: "Contract/Agreement",
              legal_notice: "Legal Notice",
              other: "Other Document",
            },
          };

      const cleanedRaw = String(raw || "").trim();
      let jsonCandidate = cleanedRaw;
      if (cleanedRaw.startsWith("```")) {
        const withoutFenceStart = cleanedRaw.replace(/^```(?:json)?\s*/i, "");
        jsonCandidate = withoutFenceStart.replace(/\s*```$/, "");
      }
      const firstBrace = jsonCandidate.indexOf("{");
      if (firstBrace > 0) {
        jsonCandidate = jsonCandidate.slice(firstBrace);
      } else if (firstBrace === -1) {
        return raw;
      }

      const parseLooseJson = (text) => {
        try {
          return JSON.parse(text);
        } catch (_) {
        }
        try {
          const lastBrace = text.lastIndexOf("}");
          if (lastBrace > 0) {
            return JSON.parse(text.slice(0, lastBrace + 1));
          }
        } catch (_) {
        }
        let lastSafeIdx = -1;
        const stack = [];
        let inString = false;
        let escape = false;
        for (let i = 0; i < text.length; i += 1) {
          const ch = text[i];
          if (escape) { escape = false; continue; }
          if (ch === "\\") { escape = true; continue; }
          if (inString) {
            if (ch === '"') inString = false;
            continue;
          }
          if (ch === '"') { inString = true; continue; }
          if (ch === "{" || ch === "[") stack.push(ch);
          else if (ch === "}" || ch === "]") stack.pop();
          else if (ch === "," && stack.length === 1) {
            lastSafeIdx = i;
          }
        }
        let candidate = lastSafeIdx > 0 ? text.slice(0, lastSafeIdx) : text;
        const openStack = [];
        let inStr2 = false;
        let esc2 = false;
        for (let i = 0; i < candidate.length; i += 1) {
          const ch = candidate[i];
          if (esc2) { esc2 = false; continue; }
          if (ch === "\\") { esc2 = true; continue; }
          if (inStr2) {
            if (ch === '"') inStr2 = false;
            continue;
          }
          if (ch === '"') { inStr2 = true; continue; }
          if (ch === "{" || ch === "[") openStack.push(ch);
          else if (ch === "}" || ch === "]") openStack.pop();
        }
        if (inStr2) candidate += '"';
        while (openStack.length) {
          const opener = openStack.pop();
          candidate += opener === "{" ? "}" : "]";
        }
        try {
          return JSON.parse(candidate);
        } catch (_) {
          return null;
        }
      };

      const parsed = parseLooseJson(jsonCandidate);
      if (!parsed || typeof parsed !== "object") return raw;
      const toList = (value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        return [String(value)];
      };
      const normalizeSimple = (value) => {
        let text = String(value || "").trim();
        if (!text) return "";
        if (/not mentioned in the document/i.test(text)) return docCopy.notFound;
        if (isMalayalamDoc) {
          const replacements = [
            [/\bലെണ്ടർ\b/gi, "കടം കൊടുക്കുന്നയാൾ"],
            [/\bലൻഡർ\b/gi, "കടം കൊടുക്കുന്നയാൾ"],
            [/\bLender\b/g, "കടം കൊടുക്കുന്നയാൾ"],
            [/\bborrower\b/gi, "കടം വാങ്ങുന്നയാൾ"],
            [/\bBorrower\b/g, "കടം വാങ്ങുന്നയാൾ"],
            [/\bബോറോവർ\b/gi, "കടം വാങ്ങുന്നയാൾ"],
            [/\bബോറോയർ\b/gi, "കടം വാങ്ങുന്നയാൾ"],
            [/\bബാക്കിയുടെ പേര്\b/gi, "കടം വാങ്ങുന്നയാളുടെ പേര്"],
            [/\bലോൺ\b/gi, "കടം"],
            [/\bLoan\b/g, "കടം"],
            [/\bagreement\b/gi, "കരാർ"],
            [/\bcontract\b/gi, "കരാർ"],
            [/\breviewed by a lawyer\b/gi, "അഭിഭാഷകൻ പരിശോധിക്കുക"],
            [/\bto have the\b/gi, ""],
            [/\bto fill in the missing information\b/gi, "കുറവുള്ള വിവരങ്ങൾ പൂരിപ്പിക്കുക"],
            [/\bഡെഡ്‌ലൈൻ\b/gi, "അവസാന തീയതി"],
          ];
          for (const [pattern, replacement] of replacements) {
            text = text.replace(pattern, replacement);
          }
        }
        return text;
      };
      const prettyDocType = (value) => {
        return docCopy.docTypeMap[value] || String(value || "Unknown");
      };
      const canonicalDocType = (value, sourceObj) => {
        const raw = String(value || "").toLowerCase().trim();
        if (["form", "contract", "legal_notice", "other"].includes(raw)) return raw;
        if (
          raw.includes("form") ||
          raw.includes("application") ||
          raw.includes("फॉर्म") ||
          raw.includes("ফর্ম") ||
          raw.includes("ફોર્મ")
        ) return "form";
        if (
          raw.includes("notice") ||
          raw.includes("नोटिस") ||
          raw.includes("നോട്ടീസ്") ||
          raw.includes("નોટિસ")
        ) return "legal_notice";
        if (
          raw.includes("contract") ||
          raw.includes("agreement") ||
          raw.includes("കരാർ") ||
          raw.includes("करार") ||
          raw.includes("করার") ||
          raw.includes("કરાર")
        ) return "contract";
        if (Array.isArray(sourceObj?.fields) && sourceObj.fields.length > 0) return "form";
        if (sourceObj?.claims_against_user || sourceObj?.deadlines || sourceObj?.hearing_dates) return "legal_notice";
        if (sourceObj?.financial_terms || sourceObj?.obligations || sourceObj?.termination_conditions) return "contract";
        return "other";
      };
      const prettyFieldType = (value) => {
        const key = String(value || "").toLowerCase().trim();
        if (!isMalayalamDoc) return key || String(value || "");
        const map = {
          text: "വാചകം",
          date: "തീയതി",
          number: "സംഖ്യ",
          checkbox: "തിരഞ്ഞെടുപ്പ് ബോക്സ്",
          signature: "ഒപ്പ്",
          other: "മറ്റ്",
        };
        return map[key] || normalizeSimple(value);
      };
      const pushSection = (sections, title, value) => {
        const items = toList(value);
        if (items.length === 0) return;
        const body = items.map((item) => `- ${normalizeSimple(item)}`).join("\n");
        sections.push(`**${title}**\n${body}`);
      };
      const pushFilledDataSection = (sections, title, value) => {
        if (!Array.isArray(value) || value.length === 0) return;
        const rows = value
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const field = normalizeSimple(row.field || row.label || "");
            const fieldValue = normalizeSimple(row.value || "");
            const status = normalizeSimple(row.status || "");
            const source = normalizeSimple(row.source || "");
            const parts = [
              field ? `${docCopy.field}: ${field}` : null,
              fieldValue ? `Value: ${fieldValue}` : null,
              status ? `Status: ${status}` : null,
              source ? `Source: ${source}` : null,
            ].filter(Boolean);
            return parts.length ? `- ${parts.join(" | ")}` : null;
          })
          .filter(Boolean);
        if (rows.length) {
          sections.push(`**${title}**\n${rows.join("\n")}`);
        }
      };

      const docType = canonicalDocType(parsed.document_type, parsed);
      const sections = [];
      if (parsed.document_type || docType) {
        sections.push(`**${docCopy.whatDoc}**\n- ${prettyDocType(docType || parsed.document_type)}`);
      }
      if (isIntenseAnalysis && parsed.confidence_score !== undefined) {
        sections.push(`**${docCopy.confidence}**\n- ${parsed.confidence_score}`);
      }
      if (isIntenseAnalysis && parsed.reasoning) {
        sections.push(`**${docCopy.legalReason}**\n- ${normalizeSimple(parsed.reasoning)}`);
      }

      if (docType === "form") {
        pushSection(sections, docCopy.simple, parsed.form_purpose);
        pushSection(sections, docCopy.simple, parsed.summary_simple);
        pushSection(sections, docCopy.formHelp, parsed.form_fill_guidance);
        pushFilledDataSection(sections, docCopy.filledData, parsed.filled_form_data);
        pushSection(sections, docCopy.nextQuestions, parsed.next_questions);
        pushSection(sections, docCopy.foreignerHelp, parsed.foreigner_guidance);
        if (Array.isArray(parsed.fields)) {
          const fieldBlocks = parsed.fields.map((f) => {
            const requiredValue =
              f?.required === true
                ? docCopy.yes
                : f?.required === false
                ? docCopy.no
                : docCopy.unknown;
            const originalLabel = String(f?.label || "").trim();
            const translation = String(f?.label_translation || "").trim();
            const example = String(f?.example_value || "").trim();
            if (!originalLabel && !translation) return null;

            const headerLine = originalLabel
              ? `- **${docCopy.onDocument}:** \`${originalLabel}\``
              : `- **${docCopy.onDocument}:** _${docCopy.notFound}_`;

            const subLines = [];
            if (translation && translation.toLowerCase() !== originalLabel.toLowerCase()) {
              subLines.push(`    - ${docCopy.meaning}: ${normalizeSimple(translation)}`);
            }
            if (example) {
              subLines.push(`    - ${docCopy.example}: ${normalizeSimple(example)}`);
            }
            const meta = [
              f?.field_type ? `${docCopy.type}: ${prettyFieldType(f.field_type)}` : null,
              `${docCopy.required}: ${requiredValue}`,
            ].filter(Boolean);
            if (meta.length) {
              subLines.push(`    - ${meta.join(" | ")}`);
            }

            return [headerLine, ...subLines].join("\n");
          }).filter(Boolean);
          if (fieldBlocks.length) {
            sections.push(`**${docCopy.fill}**\n${fieldBlocks.join("\n")}`);
          }
        }
        pushSection(sections, docCopy.missing, parsed.missing_info);
        pushSection(sections, docCopy.consequences, parsed.consequences_if_incomplete);
      } else if (docType === "contract") {
        pushSection(sections, docCopy.simple, parsed.summary_simple);
        pushSection(sections, docCopy.parties, parsed.parties);
        if (parsed.duration) {
          const durationLines = [];
          if (parsed.duration.start_date) durationLines.push(`- ${docCopy.startLabel}: ${parsed.duration.start_date}`);
          if (parsed.duration.end_date) durationLines.push(`- ${docCopy.endLabel}: ${parsed.duration.end_date}`);
          if (parsed.duration.renewal) durationLines.push(`- ${docCopy.renewalLabel}: ${parsed.duration.renewal}`);
          if (durationLines.length) sections.push(`**${docCopy.dates}**\n${durationLines.join("\n")}`);
        }
        pushSection(sections, docCopy.moneyTerms, parsed.financial_terms);
        if (parsed.obligations) {
          const obLines = [];
          if (parsed.obligations.party_1) {
            obLines.push(`- ${docCopy.party1}: ${toList(parsed.obligations.party_1).map(normalizeSimple).join("; ")}`);
          }
          if (parsed.obligations.party_2) {
            obLines.push(`- ${docCopy.party2}: ${toList(parsed.obligations.party_2).map(normalizeSimple).join("; ")}`);
          }
          if (obLines.length) sections.push(`**${docCopy.obligations}**\n${obLines.join("\n")}`);
        }
        pushSection(sections, docCopy.rights, parsed.rights);
        pushSection(sections, docCopy.endWhen, parsed.termination_conditions);
        pushSection(sections, docCopy.risk, parsed.risk_flags);
        if (parsed.liability_exposure_level) {
          sections.push(`**${docCopy.liability}**\n- ${parsed.liability_exposure_level}`);
        }
        pushSection(sections, docCopy.lawApplied, parsed.governing_law);
        pushSection(sections, docCopy.courtArea, parsed.jurisdiction);
        pushSection(sections, docCopy.next, parsed.recommended_actions);
      } else if (docType === "legal_notice") {
        pushSection(sections, docCopy.simple, parsed.summary_simple);
        if (parsed.case_details) {
          const caseLines = [];
          if (parsed.case_details.issuing_authority) caseLines.push(`- ${docCopy.issuingAuthority}: ${normalizeSimple(parsed.case_details.issuing_authority)}`);
          if (parsed.case_details.case_number) caseLines.push(`- ${docCopy.caseNumber}: ${normalizeSimple(parsed.case_details.case_number)}`);
          if (caseLines.length) sections.push(`**${docCopy.caseDetails}**\n${caseLines.join("\n")}`);
        }
        pushSection(sections, docCopy.parties, parsed.parties);
        pushSection(sections, docCopy.claims, parsed.claims_against_user);
        pushSection(sections, docCopy.requiredNow, parsed.required_actions);
        pushSection(sections, docCopy.dates, parsed.deadlines);
        pushSection(sections, docCopy.hearingDates, parsed.hearing_dates);
        pushSection(sections, docCopy.ignored, parsed.consequences_if_ignored);
        if (parsed.urgency_level) {
          sections.push(`**${docCopy.urgency}**\n- ${normalizeSimple(parsed.urgency_level)}`);
        }
      } else {
        pushSection(sections, docCopy.simple, parsed.summary_simple);
        pushSection(sections, docCopy.mainPoints, parsed.key_points);
        pushSection(sections, docCopy.dates, parsed.dates_and_deadlines);
        pushSection(sections, docCopy.obligations, parsed.obligations);
        pushSection(sections, docCopy.next, parsed.next_steps);
      }

      pushSection(sections, docCopy.unfair, parsed.unfair_clauses);
      if (parsed.risk_score !== undefined) {
        sections.push(`**${docCopy.riskScore}**\n- ${parsed.risk_score}`);
      }
      pushSection(sections, docCopy.criticalRisk, parsed.critical_risk_clauses);
      pushSection(sections, docCopy.ambiguous, parsed.ambiguous_clauses);
      pushSection(sections, docCopy.negotiation, parsed.negotiation_points);
      if (parsed.legal_review_recommended !== undefined) {
        sections.push(`**${docCopy.legalReview}**\n- ${parsed.legal_review_recommended}`);
      }

      const result = sections.filter(Boolean).join("\n\n").trim();
      if (result) return result;
      return renderPlainFromJsonObject(parsed, docCopy);
    } catch {
      return renderPlainFromRawText(raw);
    }
  };

  const renderPlainFromJsonObject = (obj, docCopy) => {
    if (!obj || typeof obj !== "object") return "";
    const lines = [];
    const labelMap = {
      summary_simple: docCopy?.simple || "Summary",
      form_purpose: docCopy?.simple || "Purpose",
      form_fill_guidance: docCopy?.formHelp || "Form Filling Help",
      next_questions: docCopy?.nextQuestions || "Next Questions",
      foreigner_guidance: docCopy?.foreignerHelp || "Foreigner Help",
      missing_info: docCopy?.missing || "Missing Information",
      consequences_if_incomplete: docCopy?.consequences || "If Left Empty",
      unfair_clauses: docCopy?.unfair || "Unfair Clauses",
      key_points: docCopy?.mainPoints || "Main Points",
      next_steps: docCopy?.next || "What To Do Now",
      required_actions: docCopy?.requiredNow || "Required Actions",
      deadlines: docCopy?.dates || "Deadlines",
    };
    Object.keys(labelMap).forEach((key) => {
      const val = obj[key];
      if (!val) return;
      const items = Array.isArray(val) ? val : [val];
      const cleaned = items.map((x) => String(x || "").trim()).filter(Boolean);
      if (!cleaned.length) return;
      lines.push(`**${labelMap[key]}**\n${cleaned.map((c) => `- ${c}`).join("\n")}`);
    });
    return lines.join("\n\n").trim();
  };

  const renderPlainFromRawText = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return "";
    if (!text.includes("{") && !text.includes('"')) return text;
    return text
      .replace(/```(?:json)?/gi, "")
      .replace(/[{}\[\]]/g, "")
      .replace(/^"([^"]+)"\s*:\s*/gm, "**$1:** ")
      .replace(/,\s*$/gm, "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
  };

  const sendDocumentQuery = async (question, displayMessage) => {
    const contentForLang = (question || "").trim() || docText.trim();
    if (!contentForLang) return;
    setDocFollowupError("");
    setDocFollowupStatus("Sending...");
    setIsDocSending(true);
    const userLang = resolveDocumentLang();
    const userMessage = { role: "user", content: displayMessage, lang: userLang };
    setConversation((prev) => [...prev, userMessage]);
    const userQuery = buildDocumentQuery(question);

    try {
      const formattedServiceTitle = "document-analyser";
      const res = await fetch(`${backendUrl}/${formattedServiceTitle}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
        },
        body: JSON.stringify({
          query: userQuery,
          user_id: userId,
          language: userLang,
          selected_language: selectedLanguage,
          intense: isIntenseAnalysis,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMsg = errorData.error || `HTTP error! status: ${res.status}`;
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.response) {
        const botResponse = data.response;
        const formatted = formatDocumentAnalysis(botResponse);
        setConversation((prev) => [
          ...prev,
          { role: "bot", content: formatted, lang: userLang },
        ]);
        setDocAnalysis(formatted);
        setDocFollowupStatus("");
      } else if (data.error) {
        const errorMsg = data.error || "Unable to get a response";
        setConversation((prev) => [
          ...prev,
          { role: "bot", content: `Error: ${errorMsg}`, lang: userLang },
        ]);
        setDocAnalysis(`Error: ${errorMsg}`);
        setDocFollowupError(errorMsg);
      }
    } catch (error) {
      const errorMessage = error.message || "Unable to connect to the server";
      setConversation((prev) => [
        ...prev,
        { role: "bot", content: `Error: ${errorMessage}`, lang: userLang },
      ]);
      setDocAnalysis(`Error: ${errorMessage}`);
      setDocFollowupError(errorMessage);
    } finally {
      setIsDocSending(false);
    }
  };

  const handleDocumentAnalyse = async () => {
    if (!docText.trim()) {
      setUploadError("Please upload or paste a document first.");
      setDocAnalysis("Please upload or paste a document first.");
      return;
    }
    setUploadError("");
    setDocAnalysis("");
    setConversation([]);
    setIsDocHistoryOpen(false);
    await sendDocumentQuery("", "Analyse the document");
  };

  const handleDocumentFollowup = async () => {
    if (isDocSending) return;
    if (!docFollowup.trim()) {
      setDocFollowupError("Please enter a follow-up message.");
      return;
    }
    if (!resolveDocumentContextText()) {
      setUploadError("Please upload or paste a document first, or open a previous analysis with document context.");
      setDocFollowupError("Please upload or paste a document first, or open a previous analysis with document context.");
      setDocAnalysis("Please upload or paste a document first.");
      return;
    }
    const followupText = docFollowup.trim();
    setDocFollowup("");
    setIsDocHistoryOpen(false);
    await sendDocumentQuery(followupText, followupText);
  };

  const loadDocumentHistory = async () => {
    if (!userId || userId === "default_user") {
      setDocHistoryError("Please log in to view analysis history.");
      return;
    }
    setIsDocHistoryLoading(true);
    setDocHistoryError("");
    try {
      const res = await fetch(`${backendUrl}/document-analyser/history`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
        },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      const historyItems = Array.isArray(data.history) ? data.history : [];
      const isValidDocAnalysis = (text) => {
        const value = (text || "").trim();
        if (!value) return false;
        const lower = value.toLowerCase();
        if (lower.startsWith("error:")) return false;
        const blockedSnippets = [
          "i'm sorry, but i encountered an issue generating a response",
          "i apologize, but i couldn't generate a response",
          "i apologize, but i couldn't generate a proper response",
          "api connection error",
          "request timed out",
          "request too long",
          "ai quota/rate limit was reached",
          "temporary failure while generating response",
          "encoding failed on server",
        ];
        return !blockedSnippets.some((snippet) => lower.includes(snippet));
      };
      const botAnalyses = [];
      for (let idx = 0; idx < historyItems.length; idx += 1) {
        const item = historyItems[idx];
        if (item?.role !== "bot" || !isValidDocAnalysis(item?.content)) continue;
        let sourceDocText = "";
        for (let back = idx - 1; back >= 0; back -= 1) {
          const previous = historyItems[back];
          if (previous?.role !== "user") continue;
          const extractedDoc = extractDocumentTextFromQuery(previous?.content);
          if (extractedDoc) {
            sourceDocText = extractedDoc;
            break;
          }
        }
        botAnalyses.push({
          ...item,
          documentText: sourceDocText,
        });
      }
      const formattedHistory = botAnalyses
        .slice(-10)
        .reverse()
        .map((item) => ({
          ...item,
          formatted: formatDocumentAnalysis(item?.content || ""),
        }));
      setDocHistory(formattedHistory);
      if (botAnalyses.length === 0) {
        setDocHistoryError("No previous successful analysis found.");
      }
    } catch (error) {
      setDocHistoryError(error.message || "Unable to load analysis history.");
    } finally {
      setIsDocHistoryLoading(false);
    }
  };

  // Parse courtroom response into two sections (Judge and Defense Counsel only)
  const parseCourtroomResponse = (content) => {
    const sections = {
      judge: "",
      defense: "",
      isFinalJudgment: false
    };

    // Check for final judgment
    if (content.includes("=== FINAL JUDGMENT ===")) {
      sections.isFinalJudgment = true;
      const finalJudgmentMatch = content.match(/=== FINAL JUDGMENT ===\s*\n([\s\S]*?)(?=\n===|$)/);
      if (finalJudgmentMatch) {
        sections.judge = finalJudgmentMatch[1].trim();
      }
    } else {
      const judgeMatch = content.match(/=== JUDGE ===\s*\n([\s\S]*?)(?=\n===|$)/);
      if (judgeMatch) {
        sections.judge = judgeMatch[1].trim();
      }
    }

    const defenseMatch = content.match(/=== DEFENSE COUNSEL ===\s*\n([\s\S]*?)(?=\n===|$)/);
    if (defenseMatch) {
      sections.defense = defenseMatch[1].trim();
    }

    return sections;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center text-white px-6 py-8 relative overflow-hidden">
      {/* Background glass shapes */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none"></div>
      <div className="absolute top-10 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>
      
      {/* Content container with backdrop filter */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center pointer-events-auto">
        <br />
        <h2 className="text-4xl font-bold mt-12 mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-pink-200">
          {isCourtroomExperience
            ? "Virtual Courtroom Experience"
            : isDocumentAnalyser
            ? "Document Analyser"
            : "What can I help with?"}
        </h2>

        {/* Virtual Courtroom Layout - Professional Courtroom Design */}
        {isCourtroomExperience ? (
          <div className="w-full h-[calc(100vh-280px)] bg-gradient-to-b from-amber-50 to-stone-100 rounded-2xl p-6 overflow-y-auto shadow-2xl border-4 border-amber-800">
            {/* Courtroom Header */}
            <div className="text-center mb-6 pb-4 border-b-4 border-amber-800">
              <h3 className="text-2xl font-bold text-amber-900 mb-2">🏛️ INDIAN COURT OF LAW</h3>
              <p className="text-amber-700 text-sm">Virtual Courtroom Experience</p>
            </div>

            {/* Main Courtroom Content */}
            <div className="space-y-6">
              {conversation.length === 0 ? (
                <div className="text-center py-12 text-amber-800">
                  <p className="text-lg font-semibold mb-2">Court is ready for session</p>
                  <p className="text-sm">Begin by describing your case to start the trial</p>
                </div>
              ) : (
                conversation.map((msg, index) => {
                  if (msg.role === "user") {
                    return (
                      <div key={index} className="flex justify-end mb-6">
                        <div className="max-w-[75%] bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-5 shadow-lg border-l-4 border-green-700">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-400/30">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-white">U</div>
                            <div className="font-bold text-sm uppercase tracking-wide text-white">You (Petitioner)</div>
                          </div>
                          <div className="text-white leading-relaxed">
                            <ReactMarkdown className="prose prose-invert prose-sm max-w-none">{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (msg.role === "bot") {
                    const sections = parseCourtroomResponse(msg.content);
                    
                    // If sections are empty, show the raw content (fallback)
                    if (!sections.judge && !sections.defense) {
                      return (
                        <div key={index} className="bg-white/80 rounded-lg p-4 border-2 border-amber-600">
                          <div className="prose max-w-none text-amber-900 leading-loose">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={index} className="space-y-4">
                        {/* Judge Section - Top Position (Like Judge's Bench) */}
                        {sections.judge && (
                          <div className="bg-gradient-to-br from-amber-100 to-yellow-50 rounded-lg p-5 shadow-xl border-4 border-amber-600 relative">
                            <div className="absolute -top-3 left-6 bg-amber-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg">
                              {sections.isFinalJudgment ? "⚖️ FINAL JUDGMENT" : "⚖️ HON'BLE JUDGE"}
                            </div>
                            <div className="mt-4 text-amber-900 leading-relaxed">
                              <ReactMarkdown className="prose prose-amber max-w-none text-amber-900 leading-loose">{sections.judge}</ReactMarkdown>
                            </div>
                          </div>
                        )}

                        {/* Defense Counsel Section - Right Side */}
                        {sections.defense && (
                          <div className="flex justify-end">
                            <div className="max-w-[80%] bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-5 shadow-lg border-r-4 border-red-600">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-300 justify-end">
                                <div className="font-bold text-sm uppercase tracking-wide text-red-900">Defense Counsel</div>
                                <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center font-bold text-red-900">⚔️</div>
                              </div>
                              <div className="text-red-900 leading-relaxed">
                                <ReactMarkdown className="prose prose-red max-w-none text-red-900 leading-loose">{sections.defense}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })
              )}
            </div>
          </div>
        ) : isDocumentAnalyser ? (
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            <div className="bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-6 shadow-xl min-h-0">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-xl font-semibold text-white">Upload your document</h3>
                <LanguageSelect
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  commonLanguages={commonLanguages}
                  languageMapping={languageMapping}
                  wrapperClassName="rounded-full px-5 py-2.5"
                  ariaLabel="Select document analyser language"
                />
              </div>
              <p className="text-sm text-white/70 mb-6">
                Upload a court document or form to get a simple explanation in your preferred language.
              </p>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/25 rounded-2xl p-8 text-center cursor-pointer hover:border-white/40 transition">
                <div className="text-3xl mb-2">📄</div>
                <div className="text-sm font-semibold">Drop your file here</div>
                <div className="text-xs text-white/60 mt-1">or click to select</div>
                <div className="text-xs text-white/50 mt-3">Supported: PDF, PNG/JPG, DOCX</div>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={handleDocumentUpload}
                  className="hidden"
                />
              </label>
              {isUploading && <div className="text-xs text-amber-200 mt-3">Uploading...</div>}
              {uploadStatus && <div className="text-xs text-emerald-200 mt-3">{uploadStatus}</div>}
              {uploadError && <div className="text-xs text-amber-200 mt-3">{uploadError}</div>}
              <div className="text-xs text-white/70 mt-2">
                Uploaded file: <span className="text-white/90 font-medium">{uploadedDocName || "None"}</span>
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold text-white mb-2">Or paste document text</div>
                <textarea
                  rows={6}
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Paste the court notice or form text here..."
                  value={docText}
                  onChange={(e) => setDocText(e.target.value)}
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDocumentAnalyse}
                    className="px-5 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-indigo-700 transition"
                  >
                    Analyse document
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsIntenseAnalysis((prev) => !prev)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                      isIntenseAnalysis
                        ? "bg-amber-500/20 border-amber-400 text-amber-200"
                        : "bg-white/5 border-white/15 text-white/70 hover:text-white"
                    }`}
                  >
                    Intense analysis {isIntenseAnalysis ? "On" : "Off"}
                  </button>
                  <span className="text-xs text-white/60">We’ll respond in your selected language.</span>
                </div>
              </div>
            </div>

            <div className="relative bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-6 shadow-xl min-h-[420px] h-[calc(100vh-280px)] overflow-hidden pointer-events-auto min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-3 relative z-20 pointer-events-auto">
                <h3 className="text-xl font-semibold text-white">Analysis results</h3>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isDocHistoryOpen;
                    setIsDocHistoryOpen(nextState);
                    if (nextState && !isDocHistoryLoading) {
                      loadDocumentHistory();
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition cursor-pointer pointer-events-auto"
                >
                  History
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1">
              {isDocHistoryOpen ? (
                <div className="min-h-[200px]">
                  {isDocHistoryLoading && (
                    <div className="text-xs text-white/60">Loading history...</div>
                  )}
                  {docHistoryError && !isDocHistoryLoading && (
                    <div className="text-xs text-amber-200">{docHistoryError}</div>
                  )}
                  {!isDocHistoryLoading && !docHistoryError && docHistory.length === 0 && (
                    <div className="text-xs text-white/60">No previous analysis found.</div>
                  )}
                  <div className="mt-3 space-y-3">
                    {docHistory.map((item, idx) => (
                      <div
                        key={`${idx}-${item.content?.slice(0, 12) || "history"}`}
                        className="text-xs text-white/80 bg-white/5 border border-white/10 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition"
                        onClick={() => {
                          if (item.documentText) {
                            setDocText(item.documentText);
                            setUploadStatus("Loaded document text from history.");
                            setUploadError("");
                          }
                          setDocAnalysis(item.formatted || item.content || "");
                          setIsDocHistoryOpen(false);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            if (item.documentText) {
                              setDocText(item.documentText);
                              setUploadStatus("Loaded document text from history.");
                              setUploadError("");
                            }
                            setDocAnalysis(item.formatted || item.content || "");
                            setIsDocHistoryOpen(false);
                          }
                        }}
                      >
                        <ReactMarkdown>{item.formatted || item.content || ""}</ReactMarkdown>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !docAnalysis ? (
                <div className="text-sm text-white/60">Upload a document to see the analysis.</div>
              ) : (
                <div className="prose prose-invert max-w-none text-sm leading-loose">
                  <ReactMarkdown>{docAnalysis}</ReactMarkdown>
                </div>
              )}
              </div>

              <div className="mt-4 relative z-30 pointer-events-auto">
                <div className="text-sm font-semibold text-white mb-2">Ask a follow-up</div>
                <div className="flex items-center gap-3 relative z-30 pointer-events-auto">
                  <input
                    type="text"
                    className="flex-1 bg-white/5 border border-white/15 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400 pointer-events-auto"
                    placeholder="Ask about missing fields or how to fill the form..."
                    value={docFollowup}
                    onChange={(e) => setDocFollowup(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleDocumentFollowup();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleDocumentFollowup}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition cursor-pointer pointer-events-auto relative z-50 ${
                      isDocSending || !docFollowup.trim()
                        ? "bg-white/30 text-white/60"
                        : "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
                    }`}
                  >
                    {isDocSending ? "Sending..." : "Send"}
                  </button>
                </div>
                {docFollowupStatus && (
                  <p className="text-xs text-white/70 mt-2">{docFollowupStatus}</p>
                )}
                {docFollowupError && (
                  <p className="text-xs text-amber-200 mt-2">{docFollowupError}</p>
                )}
                <p className="text-xs text-white/60 mt-2">
                  Follow-up questions use the current document only.
                </p>
              </div>

              {isDocHistoryOpen && (
                <div className="mt-4 text-xs text-white/60">
                  Showing analysis history. Close History to view the current analysis.
                </div>
              )}
            </div>
          </div>
        ) : isGuidedAssistanceService ? (
          <div className="w-full h-[calc(100vh-220px)] grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
            <aside className="bg-slate-950/70 border border-white/10 rounded-2xl p-3 flex flex-col min-h-0">
              <button
                type="button"
                onClick={startNewAssistChat}
                className="w-full py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 transition"
              >
                + {assistUi.newChatButton}
              </button>
              <p className="text-xs text-white/60 mt-4 mb-2">{assistUi.historyTitle}</p>
              {assistHistory.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllAssistHistory}
                  className="mb-2 text-[11px] text-rose-300 hover:text-rose-200 transition self-end flex items-center gap-1"
                >
                  <FiTrash2 size={12} />
                  Clear history
                </button>
              )}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                {assistHistory.length === 0 ? (
                  <p className="text-xs text-white/50">{assistUi.noHistory}</p>
                ) : (
                  assistHistory.map((item) => (
                    <div
                      key={item.id}
                      className="w-full rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => loadAssistConversation(item.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-xs text-white/85 truncate">{item.title || "Conversation"}</p>
                          <p className="text-[11px] text-white/50">{new Date(item.savedAt).toLocaleString("en-IN")}</p>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteAssistConversation(item.id);
                          }}
                          className="text-white/50 hover:text-rose-300 transition p-1 rounded"
                          title="Delete chat history"
                          aria-label="Delete chat history"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-white/60 mb-2">{assistUi.quickActionsLabel}</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {guidedQuickActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => attachGuidedAssistancePrompt(action)}
                      className="w-full text-left text-xs rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {isPersonalFamilyAssistance ? assistUi.personalTitle : assistUi.consumerTitle}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="bg-white/10 border border-white/20 rounded-full px-3 py-1.5 flex items-center shadow-inner shadow-black/20">
                    <FiGlobe size={13} className="mr-1 text-white/80" />
                    <select
                      value={selectedLanguage}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="lexassist-select appearance-none bg-transparent text-xs text-white pr-2 focus:outline-none"
                    >
                      {commonLanguages.map((langItem) => {
                        const langInfo = languageMapping[langItem.mappingKey];
                        return (
                          <option key={langItem.code} value={langItem.code}>
                            {langInfo.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <button
                    onClick={toggleTTS}
                    className="bg-white/10 text-white px-3 py-1.5 rounded-full hover:bg-white/20 transition text-xs flex items-center border border-white/20"
                  >
                    {isTTSEnabled ? <FiVolume2 size={14} className="mr-1" /> : <FiVolumeX size={14} className="mr-1" />}
                    {isTTSEnabled ? (assistUi.ttsOn || "TTS On") : (assistUi.ttsOff || "TTS Off")}
                  </button>
                </div>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1"
              >
                {conversation.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-white/60 text-sm">
                    <p>{assistUi.description}</p>
                  </div>
                ) : (
                  conversation.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[82%] flex items-center gap-2">
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm ${
                            msg.role === "user"
                              ? "bg-indigo-600/80 text-white"
                              : "bg-white/10 border border-white/15 text-white"
                          }`}
                        >
                          {msg.role === "bot" ? (
                            <div className="prose prose-invert max-w-none leading-relaxed">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p>{msg.content}</p>
                          )}
                        </div>
                        {msg.role === "bot" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                let textToSpeak = msg.content;
                                if (textToSpeak) {
                                  const tempDiv = document.createElement("div");
                                  tempDiv.innerHTML = textToSpeak;
                                  textToSpeak = tempDiv.textContent || tempDiv.innerText || textToSpeak;
                                  textToSpeak = textToSpeak
                                    .replace(/\*\*(.*?)\*\*/g, "$1")
                                    .replace(/\*(.*?)\*/g, "$1")
                                    .replace(/`(.*?)`/g, "$1")
                                    .replace(/#{1,6}\s+/g, "")
                                    .trim();
                                }
                                speakText(textToSpeak, msg.lang || selectedLanguage, `guided-${index}`);
                              }}
                              className="text-white/70 hover:text-white transition-colors duration-200"
                              title="Speak response"
                            >
                              <FiVolume2 size={18} />
                            </button>
                            <button
                              onClick={stopCurrentSpeech}
                              className={`transition-colors duration-200 ${
                                activeSpeechKey === `guided-${index}`
                                  ? "text-red-300 hover:text-red-200"
                                  : "text-white/45 hover:text-white/75"
                              }`}
                              title="Stop speaking"
                            >
                              <FiVolumeX size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3">
                <div className="bg-white/10 rounded-2xl flex items-center px-4 py-2 border border-white/20">
                  <input
                    type="text"
                    className="bg-transparent flex-1 focus:outline-none text-white placeholder-white/50 text-sm"
                    placeholder={assistUi.chatPlaceholder}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`mr-3 ${isListening ? "text-red-400 animate-pulse" : "text-white/70 hover:text-white"}`}
                    title={isListening ? "Stop listening" : "Start listening"}
                  >
                    <FiMic size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handlePromptSubmit}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-2 rounded-full hover:from-blue-600 hover:to-indigo-700 transition"
                  >
                    <FiSend size={16} />
                  </button>
                </div>
                {isListening && <p className="text-xs text-white/70 mt-2">Listening...</p>}
                {speechError && <p className="text-xs text-amber-200 mt-2">{speechError}</p>}
              </div>
            </section>
          </div>
        ) : (
          /* Regular Chat Layout */
          <>
            {isSelfLawyerGuide && (
              <>
                <SelfLawyerTopBar
                  decodedTitle={decodedTitle}
                  selectedLanguage={selectedLanguage}
                  handleLanguageChange={handleLanguageChange}
                  commonLanguages={commonLanguages}
                  languageMapping={languageMapping}
                  isTTSEnabled={isTTSEnabled}
                  toggleTTS={toggleTTS}
                  startNewSelfLawyerChat={startNewSelfLawyerChat}
                  onToggleHistory={() => setIsSelfLawyerHistoryOpen((prev) => !prev)}
                  assistUi={assistUi}
                  selfLawyerUi={selfLawyerUi}
                />

                <div className="w-full grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-5 items-start mb-5">
                  <aside className="space-y-4">
                    {isSelfLawyerHistoryOpen && (
                      <SelfLawyerHistoryPanel
                        assistUi={assistUi}
                        selfLawyerHistory={selfLawyerHistory}
                        loadSelfLawyerConversation={loadSelfLawyerConversation}
                      />
                    )}

                    <SelfLawyerToolkitPanel
                      selfLawyerUi={selfLawyerUi}
                      selfLawyerOptionLabels={selfLawyerOptionLabels}
                      selfLawyerCase={selfLawyerCase}
                      setSelfLawyerCase={setSelfLawyerCase}
                      buildSelfLawyerGuidedPrompt={buildSelfLawyerGuidedPrompt}
                      setSelfLawyerDraftPrompt={setSelfLawyerDraftPrompt}
                      selfLawyerDraftPrompt={selfLawyerDraftPrompt}
                      selfLawyerQuickActions={selfLawyerQuickActions}
                      attachSelfLawyerPrompt={attachSelfLawyerPrompt}
                    />

                    <SelfLawyerEvidencePanel
                      selfLawyerUi={selfLawyerUi}
                      handleEvidenceUpload={handleEvidenceUpload}
                      isEvidenceUploading={isEvidenceUploading}
                      evidenceUploadStatus={evidenceUploadStatus}
                      evidenceUploadError={evidenceUploadError}
                      evidenceText={evidenceText}
                      setEvidenceText={setEvidenceText}
                    />
                  </aside>

                  <SelfLawyerChatPanel
                    chatContainerRef={chatContainerRef}
                    conversation={conversation}
                    selfLawyerUi={selfLawyerUi}
                    speakText={speakText}
                    prompt={prompt}
                    setPrompt={setPrompt}
                    handleKeyDown={handleKeyDown}
                    toggleListening={toggleListening}
                    isListening={isListening}
                    handlePromptSubmit={handlePromptSubmit}
                    speechError={speechError}
                  />
                </div>
              </>
            )}
            {isGuidedAssistanceService && (
              <div className="w-full mb-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-lg">
                <h3 className="text-lg font-semibold mb-2">
                  {isPersonalFamilyAssistance ? assistUi.personalTitle : assistUi.consumerTitle}
                </h3>
                <p className="text-sm text-white/70 mb-3">
                  {assistUi.description}
                </p>
                <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-3">
                  <div className="rounded-xl border border-white/15 bg-white/5 p-3 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs text-white/70">{assistUi.historyButton} · {assistUi.historyTitle}</p>
                      <div className="flex items-center gap-2">
                        {assistHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={clearAllAssistHistory}
                            className="px-2 py-1 rounded-md text-[11px] bg-rose-500/20 border border-rose-400/30 text-rose-200 hover:bg-rose-500/30 transition"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={startNewAssistChat}
                          className="px-2 py-1 rounded-md text-[11px] bg-white/10 border border-white/20 hover:bg-white/20 transition"
                        >
                          {assistUi.newChatButton}
                        </button>
                      </div>
                    </div>
                    {assistHistory.length === 0 ? (
                      <p className="text-xs text-white/60">{assistUi.noHistory}</p>
                    ) : (
                      <div className="space-y-2">
                        {assistHistory.map((item) => (
                          <div
                            key={item.id}
                            className="w-full rounded-lg border border-white/10 bg-black/10 p-2 text-xs text-white/80 hover:bg-white/10 transition"
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => loadAssistConversation(item.id)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <p className="truncate">{item.title || "Conversation"}</p>
                                <p className="text-white/50 text-[11px]">
                                  {new Date(item.savedAt).toLocaleString("en-IN")}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteAssistConversation(item.id);
                                }}
                                className="text-white/50 hover:text-rose-300 transition p-1 rounded"
                                title="Delete chat history"
                                aria-label="Delete chat history"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-2">{assistUi.quickActionsLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {guidedQuickActions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => attachGuidedAssistancePrompt(action)}
                          className="px-3 py-1.5 rounded-full text-xs bg-white/10 border border-white/20 hover:bg-white/20 transition"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-white/60 mb-2">{selfLawyerUi.quickActions}</p>
                    <div className="flex flex-wrap gap-2">
                      {selfLawyerQuickActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => attachSelfLawyerPrompt(action.prompt)}
                          className="px-3 py-1.5 rounded-full text-xs bg-white/10 border border-white/20 hover:bg-white/20 transition"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isSelfLawyerGuide && (
            <div 
              ref={chatContainerRef}
              className="w-full h-[calc(100vh-280px)] bg-white/10 backdrop-blur-lg rounded-2xl p-6 overflow-y-auto flex flex-col space-y-4 shadow-xl border border-white/20"
            >
              {conversation.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl flex items-center space-x-3 backdrop-blur-sm shadow-lg ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-indigo-600/90 to-blue-500/90 text-white"
                      : "bg-white/15 border border-white/20 text-white"
                  }`}
                >
                  <div className="flex-1 overflow-hidden">
                    {msg.role === "bot" ? (
                      <div className="prose prose-invert max-w-none leading-loose">
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                    {evidenceUploadStatus && !isEvidenceUploading && (
                      <span className="text-xs text-emerald-200">{evidenceUploadStatus}</span>
                    )}
                    {evidenceUploadError && !isEvidenceUploading && (
                      <span className="text-xs text-amber-200">{evidenceUploadError}</span>
                    )}
                  </div>
                  {msg.role === "bot" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          let textToSpeak = msg.content;
                          if (textToSpeak) {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = textToSpeak;
                            textToSpeak = tempDiv.textContent || tempDiv.innerText || textToSpeak;
                            textToSpeak = textToSpeak
                              .replace(/\*\*(.*?)\*\*/g, '$1')
                              .replace(/\*(.*?)\*/g, '$1')
                              .replace(/`(.*?)`/g, '$1')
                              .replace(/#{1,6}\s+/g, '')
                              .trim();
                          }
                          speakText(textToSpeak, msg.lang, `default-${index}`);
                        }}
                        className="text-white/70 hover:text-white transition-colors duration-200"
                        title="Speak response"
                      >
                        <FiVolume2 size={18} />
                      </button>
                      <button
                        onClick={stopCurrentSpeech}
                        className={`transition-colors duration-200 ${
                          activeSpeechKey === `default-${index}`
                            ? "text-red-300 hover:text-red-200"
                            : "text-white/45 hover:text-white/75"
                        }`}
                        title="Stop speaking"
                      >
                        <FiVolumeX size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
            )}
          </>
        )}

        {!isDocumentAnalyser && !isGuidedAssistanceService && !isSelfLawyerGuide && (
          <>
            {/* Input container */}
            <div className="w-full mt-6 relative z-20">
              <div className="bg-white/15 backdrop-blur-lg rounded-full flex items-center px-6 py-3 border border-white/20 shadow-lg pointer-events-auto">
                <input
                  type="text"
                  className="bg-transparent flex-1 focus:outline-none text-white placeholder-white/50"
                  placeholder={
                    isSelfLawyerGuide
                      ? selfLawyerUi.chatPlaceholder
                      : isGuidedAssistanceService
                      ? assistUi.chatPlaceholder
                      : "Ask anything..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <button
                  type="button"
                  onClick={toggleListening}
                  className={`mr-4 transition-all duration-300 cursor-pointer pointer-events-auto relative z-30 ${
                    isListening ? "text-red-400 animate-pulse" : "text-white/70 hover:text-white"
                  }`}
                  title={isListening ? "Stop listening" : "Start listening"}
                >
                  <FiMic size={20} />
                </button>

                <button
                  type="button"
                  onClick={handlePromptSubmit}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 rounded-full hover:from-blue-600 hover:to-indigo-700 transition duration-300 shadow-lg cursor-pointer pointer-events-auto relative z-30"
                >
                  <FiSend size={18} />
                </button>
              </div>
            </div>

            {isListening && (
              <p className="text-sm text-white/80 mt-3 animate-pulse">Listening...</p>
            )}
            {speechError && (
              <p className="text-sm text-amber-200 mt-2">{speechError}</p>
            )}
          </>
        )}

        {/* Controls */}
        {!isGuidedAssistanceService && !isSelfLawyerGuide && !isDocumentAnalyser && (
        <div className="flex flex-col sm:flex-row items-center justify-between w-full mt-6 mb-4 gap-4">
          <p className="text-white/70 text-center sm:text-right w-full">
            Chatting with:{" "}
            <span className="text-white font-medium">{decodedTitle}</span>
          </p>
        </div>
        )}
      </div>
    </div>
  );
};

export default ServiceChatPage;
