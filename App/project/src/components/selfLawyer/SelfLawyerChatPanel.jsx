import React from "react";
import { FiMic, FiSend, FiVolume2 } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import { uiButton, uiChat, uiField, uiSurface, uiText } from "../ui/designTokens";

const cleanSpeechText = (rawText = "") => {
  if (!rawText) return rawText;
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = rawText;
  return (tempDiv.textContent || tempDiv.innerText || rawText)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .trim();
};

const SelfLawyerChatPanel = ({
  chatContainerRef,
  conversation,
  selfLawyerUi,
  speakText,
  prompt,
  setPrompt,
  handleKeyDown,
  toggleListening,
  isListening,
  handlePromptSubmit,
  speechError,
}) => {
  return (
    <section className={`${uiSurface.glassCardStrong} p-4 min-h-[640px] xl:sticky xl:top-24 xl:h-[calc(100vh-8.5rem)] flex flex-col`}>
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
        <div>
          <p className={uiText.sectionTitle}>{selfLawyerUi?.toolkitTitle || "Strategy Chat Workspace"}</p>
          <p className={uiText.muted}>{selfLawyerUi?.chatPlaceholder || "Ask questions, refine drafts, and rehearse arguments."}</p>
        </div>
      </div>

      <div ref={chatContainerRef} className="flex-1 min-h-[420px] overflow-y-auto space-y-4 pr-1" aria-live="polite">
        {conversation.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-white/60 text-sm">
            <p>{selfLawyerUi.chatPlaceholder}</p>
          </div>
        ) : (
          conversation.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] p-4 rounded-2xl flex items-center space-x-3 backdrop-blur-sm shadow-lg ${
                  msg.role === "user"
                    ? uiChat.userBubble
                    : uiChat.botBubble
                }`}
              >
                <div className="flex-1 overflow-hidden">
                  {msg.role === "bot" ? (
                    <div className="prose prose-invert max-w-none leading-loose">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === "bot" && (
                  <button
                    onClick={() => speakText(cleanSpeechText(msg.content), msg.lang)}
                    className="text-white/70 hover:text-white transition-colors duration-200"
                    title="Speak response"
                    aria-label="Speak this response"
                  >
                    <FiVolume2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/10">
        <div className={`${uiSurface.glassCardStrong} rounded-full flex items-center px-4 py-2`}>
          <input
            type="text"
            className={uiField.composerInput}
            placeholder={selfLawyerUi.chatPlaceholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            type="button"
            onClick={toggleListening}
            className={`mr-3 transition-all duration-300 ${
              isListening ? "text-red-400 animate-pulse" : "text-white/70 hover:text-white"
            }`}
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
  );
};

export default SelfLawyerChatPanel;
