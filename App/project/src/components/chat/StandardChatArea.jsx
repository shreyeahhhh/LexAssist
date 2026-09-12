import React from "react";
import { FiVolume2 } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import { uiChat, uiSurface } from "../ui/designTokens";

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

const StandardChatArea = ({ chatContainerRef, conversation, speakText }) => {
  return (
    <div
      ref={chatContainerRef}
      className={`w-full h-[calc(100vh-280px)] p-6 overflow-y-auto flex flex-col space-y-4 ${uiSurface.glassCardStrong}`}
      aria-live="polite"
    >
      {conversation.map((msg, index) => (
        <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[80%] p-4 rounded-2xl flex items-center space-x-3 backdrop-blur-sm shadow-lg ${
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
      ))}
    </div>
  );
};

export default StandardChatArea;
