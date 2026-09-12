import React from "react";
import { FiVolume2, FiVolumeX } from "react-icons/fi";
import LanguageSelect from "../LanguageSelect";
import { uiButton } from "../ui/designTokens";

const SelfLawyerTopBar = ({
  decodedTitle,
  selectedLanguage,
  handleLanguageChange,
  commonLanguages,
  languageMapping,
  isTTSEnabled,
  toggleTTS,
  startNewSelfLawyerChat,
  onToggleHistory,
  assistUi,
  selfLawyerUi,
}) => {
  return (
    <div className="w-full mb-4 rounded-2xl border border-white/20 bg-gradient-to-r from-slate-900/90 via-indigo-950/75 to-slate-900/90 p-4 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">
            {selfLawyerUi?.toolkitTitle || decodedTitle}
          </h2>
          <p className="text-sm text-white/65 mt-1">
            {selfLawyerUi?.toolkitDesc || "Your courtroom prep partner - clear strategy, confident hearings."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSelect
            value={selectedLanguage}
            onChange={handleLanguageChange}
            commonLanguages={commonLanguages}
            languageMapping={languageMapping}
            ariaLabel="Select self lawyer language"
          />
          <button
            onClick={toggleTTS}
            className={`${uiButton.ghost} ${uiButton.ghostPill} flex items-center`}
            aria-label={isTTSEnabled ? "Turn text to speech off" : "Turn text to speech on"}
          >
            {isTTSEnabled ? (
              <>
                <FiVolume2 size={15} className="mr-2" />
                {assistUi?.ttsOn || "TTS On"}
              </>
            ) : (
              <>
                <FiVolumeX size={15} className="mr-2" />
                {assistUi?.ttsOff || "TTS Off"}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={startNewSelfLawyerChat}
            className={`${uiButton.ghost} ${uiButton.ghostPill}`}
          >
            + {assistUi.newChatButton}
          </button>
          <button
            type="button"
            onClick={onToggleHistory}
            className={`${uiButton.ghost} ${uiButton.ghostPill}`}
          >
            {assistUi.historyButton}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelfLawyerTopBar;
