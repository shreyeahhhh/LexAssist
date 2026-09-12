import React from "react";
import { FiMic, FiSend } from "react-icons/fi";
import { uiButton, uiField, uiSurface } from "../ui/designTokens";

const StandardChatComposer = ({
  placeholder,
  prompt,
  setPrompt,
  handleKeyDown,
  toggleListening,
  isListening,
  handlePromptSubmit,
  speechError,
}) => {
  return (
    <>
      <div className="w-full mt-6 relative z-20">
        <div className={`${uiSurface.glassCardStrong} rounded-full flex items-center px-6 py-3 pointer-events-auto`}>
          <input
            type="text"
            className={uiField.composerInput}
            placeholder={placeholder}
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
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            <FiMic size={20} />
          </button>

          <button
            type="button"
            onClick={handlePromptSubmit}
            className={`${uiButton.primary} p-3 rounded-full cursor-pointer pointer-events-auto relative z-30`}
            aria-label="Send message"
          >
            <FiSend size={18} />
          </button>
        </div>
      </div>

      {isListening && <p className="text-sm text-white/80 mt-3 animate-pulse" aria-live="polite">Listening...</p>}
      {speechError && <p className="text-sm text-amber-200 mt-2">{speechError}</p>}
    </>
  );
};

export default StandardChatComposer;
