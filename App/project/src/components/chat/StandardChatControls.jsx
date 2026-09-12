import React from "react";
import { FiVolume2, FiVolumeX } from "react-icons/fi";
import LanguageSelect from "../LanguageSelect";
import { uiButton } from "../ui/designTokens";

const StandardChatControls = ({
  selectedLanguage,
  handleLanguageChange,
  commonLanguages,
  languageMapping,
  isTTSEnabled,
  toggleTTS,
  decodedTitle,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between w-full mt-6 mb-4 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <LanguageSelect
          value={selectedLanguage}
          onChange={handleLanguageChange}
          commonLanguages={commonLanguages}
          languageMapping={languageMapping}
          wrapperClassName="rounded-full px-5 py-2.5 backdrop-blur-sm bg-white/15 hover:bg-white/25 transition duration-300"
          ariaLabel="Select chat language"
        />

        <button
          onClick={toggleTTS}
          className={`${uiButton.ghost} ${uiButton.ghostRound} flex items-center`}
          aria-label={isTTSEnabled ? "Turn text to speech off" : "Turn text to speech on"}
        >
          {isTTSEnabled ? (
            <>
              <FiVolume2 size={16} className="mr-2" />
              Text-to-Speech On
            </>
          ) : (
            <>
              <FiVolumeX size={16} className="mr-2" />
              Text-to-Speech Off
            </>
          )}
        </button>
      </div>

      <p className="text-white/70 text-center sm:text-right">
        Chatting with: <span className="text-white font-medium">{decodedTitle}</span>
      </p>
    </div>
  );
};

export default StandardChatControls;
