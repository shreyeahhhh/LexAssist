import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  "en-US": {
    translation: {
      welcome: "Welcome to LexAssist",
      help: "What can I help with?",
      // Add more translations here
    },
  },
  "hi-IN": {
    translation: {
      welcome: "लेक्स असिस्ट में आपका स्वागत है",
      help: "मैं आपकी किस प्रकार मदद कर सकता हूँ?",
    },
  },
  "mr-IN": {
    translation: {
      welcome: "LexAssist मध्ये स्वागत आहे",
      help: "मी कशी मदत करू शकतो?",
    },
  },
  "gu-IN": {
    translation: {
      welcome: "LexAssist માં સ્વાગત છે",
      help: "હું શેની મદદ કરી શકું?",
    },
  },
  "sa-IN": {
    translation: {
      welcome: "LexAssist इति सस्वागतम्",
      help: "कथं साहाय्यं करोमि?",
    },
  },
  "ta-IN": {
    translation: {
      welcome: "LexAssist-க்கு வரவேற்கிறோம்",
      help: "நான் எப்படி உதவ முடியும்?",
    },
  },
  "kn-IN": {
    translation: {
      welcome: "LexAssist ಗೆ ಸ್ವಾಗತ",
      help: "ನಾನು ಏನು ಸಹಾಯ ಮಾಡಬಹುದು?",
    },
  },
  "ur-IN": {
    translation: {
      welcome: "LexAssist میں خوش آمدید",
      help: "میں کس طرح مدد کر سکتا ہوں؟",
    },
  },
  "pa-IN": {
    translation: {
      welcome: "LexAssist ਵਿੱਚ ਸੁਆਗਤ ਹੈ",
      help: "ਮੈਂ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
    },
  },
  "or-IN": {
    translation: {
      welcome: "LexAssist କୁ ସ୍ୱାଗତ",
      help: "ମୁଁ କେଉଁପରି ସାହାଯ୍ୟ କରିପାରେ?",
    },
  },
  "bn-IN": {
    translation: {
      welcome: "LexAssist-এ স্বাগতম",
      help: "আমি কীভাবে সাহায্য করতে পারি?",
    },
  },
  "mai-IN": {
    translation: {
      welcome: "LexAssist मे मैथिली स्वागत",
      help: "हम की तरह मदद कर सकीले?",
    },
  },
  "bh-IN": {
    translation: {
      welcome: "LexAssist में भोजपुरी स्वागत बा",
      help: "हम कइसे मदद कर सकीले?",
    },
  },
  "ml-IN": {
    translation: {
      welcome: "LexAssist-ലേയ്ക്ക് സ്വാഗതം",
      help: "ഞാൻ എങ്ങനെ സഹായിക്കാം?",
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en-US", // Default language
  fallbackLng: "en-US",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
