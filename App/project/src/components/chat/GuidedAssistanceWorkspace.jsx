import React from "react";
import { FiMic, FiSend, FiVolume2, FiVolumeX } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import LanguageSelect from "../LanguageSelect";
import { uiButton, uiChat, uiField, uiSurface, uiText } from "../ui/designTokens";

const GuidedAssistanceWorkspace = ({
  assistUi,
  isPersonalFamilyAssistance,
  assistHistory,
  startNewAssistChat,
  loadAssistConversation,
  guidedQuickActions,
  attachGuidedAssistancePrompt,
  selectedLanguage,
  handleLanguageChange,
  commonLanguages,
  languageMapping,
  isTTSEnabled,
  toggleTTS,
  chatContainerRef,
  conversation,
  prompt,
  setPrompt,
  handleKeyDown,
  toggleListening,
  isListening,
  handlePromptSubmit,
  speechError,
}) => {
  return (
    <div className="w-full min-h-[560px] lg:h-[calc(100vh-220px)] grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
      <aside className={`${uiSurface.sidebarCard} p-3 flex flex-col min-h-0`}>
        <button
          type="button"
          onClick={startNewAssistChat}
          className={`w-full py-2.5 rounded-xl text-sm font-medium ${uiButton.ghost}`}
        >
          + {assistUi.newChatButton}
        </button>
        <p className={`${uiText.muted} mt-4 mb-2`}>{assistUi.historyTitle}</p>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
          {assistHistory.length === 0 ? (
            <p className={uiText.subtle}>{assistUi.noHistory}</p>
          ) : (
            assistHistory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadAssistConversation(item.id)}
                className="w-full text-left rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
              >
                <p className="text-xs text-white/85 truncate">{item.title || "Conversation"}</p>
                <p className="text-[11px] text-white/50">{new Date(item.savedAt).toLocaleString("en-IN")}</p>
              </button>
            ))
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className={`${uiText.muted} mb-2`}>{assistUi.quickActionsLabel}</p>
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

      <section className={`${uiSurface.panelCard} p-4 flex flex-col min-h-0`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className={uiText.sectionTitle}>
            {isPersonalFamilyAssistance ? assistUi.personalTitle : assistUi.consumerTitle}
          </h3>
          <div className="flex items-center gap-2">
            <LanguageSelect
              value={selectedLanguage}
              onChange={handleLanguageChange}
              commonLanguages={commonLanguages}
              languageMapping={languageMapping}
              wrapperClassName="rounded-full px-2 py-1 text-xs"
              selectClassName="text-xs pr-1"
              ariaLabel="Select assistance language"
            />
            <button
              onClick={toggleTTS}
              className={`${uiButton.ghost} px-3 py-1.5 rounded-full text-xs flex items-center`}
              aria-label={isTTSEnabled ? "Turn text to speech off" : "Turn text to speech on"}
            >
              {isTTSEnabled ? <FiVolume2 size={14} className="mr-1" /> : <FiVolumeX size={14} className="mr-1" />}
              {isTTSEnabled ? "TTS On" : "TTS Off"}
            </button>
          </div>
        </div>

        <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1" aria-live="polite">
          {conversation.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-white/60 text-sm">
              <p>{assistUi.description}</p>
            </div>
          ) : (
            conversation.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? uiChat.userBubbleAssist
                      : uiChat.botBubbleAssist
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
              </div>
            ))
          )}
        </div>

        <div className="mt-3">
          <div className={`${uiSurface.glassCard} rounded-2xl flex items-center px-4 py-2`}>
            <input
              type="text"
              className={uiField.composerInput}
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
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
            >
              <FiMic size={18} />
            </button>
            <button
              type="button"
              onClick={handlePromptSubmit}
              className={`${uiButton.primary} p-2 rounded-full`}
              aria-label="Send message"
            >
              <FiSend size={16} />
            </button>
          </div>
          {isListening && <p className="text-xs text-white/70 mt-2" aria-live="polite">Listening...</p>}
          {speechError && <p className="text-xs text-amber-200 mt-2">{speechError}</p>}
        </div>
      </section>
    </div>
  );
};

export default GuidedAssistanceWorkspace;
