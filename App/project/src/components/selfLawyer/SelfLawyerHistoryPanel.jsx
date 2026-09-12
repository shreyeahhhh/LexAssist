import React from "react";
import { uiSurface, uiText } from "../ui/designTokens";

const SelfLawyerHistoryPanel = ({ assistUi, selfLawyerHistory, loadSelfLawyerConversation }) => {
  return (
    <div className={`${uiSurface.glassCard} p-4`}>
      <p className={`${uiText.sectionTitle} mb-3`}>{assistUi.historyTitle}</p>
      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {selfLawyerHistory.length === 0 ? (
          <p className={uiText.muted}>{assistUi.noHistory}</p>
        ) : (
          selfLawyerHistory.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => loadSelfLawyerConversation(item.id)}
              className="w-full text-left rounded-lg border border-white/10 bg-black/10 p-2 text-xs text-white/80 hover:bg-white/10 transition"
            >
              <p className="truncate">{item.title || "Conversation"}</p>
              <p className="text-white/50 text-[11px]">{new Date(item.savedAt).toLocaleString("en-IN")}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default SelfLawyerHistoryPanel;
