import React from "react";
import { FiChevronDown } from "react-icons/fi";
import { uiButton, uiField, uiSurface, uiText } from "../ui/designTokens";

const SelfLawyerToolkitPanel = ({
  selfLawyerUi,
  selfLawyerOptionLabels,
  selfLawyerCase,
  setSelfLawyerCase,
  buildSelfLawyerGuidedPrompt,
  setSelfLawyerDraftPrompt,
  selfLawyerDraftPrompt,
  selfLawyerQuickActions,
  attachSelfLawyerPrompt,
}) => {
  return (
    <div className={`${uiSurface.glassCard} p-4`}>
      <h3 className={`${uiText.title} mb-2`}>{selfLawyerUi.toolkitTitle}</h3>
      <p className={`${uiText.body} mb-3`}>{selfLawyerUi.toolkitDesc}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={uiText.label}>{selfLawyerUi.caseType}</label>
          <div className="relative mt-1">
            <select
              value={selfLawyerCase.caseType}
              onChange={(e) => setSelfLawyerCase((prev) => ({ ...prev, caseType: e.target.value }))}
              className={uiField.select}
            >
              <option value="criminal">{selfLawyerOptionLabels.caseType.criminal}</option>
              <option value="civil">{selfLawyerOptionLabels.caseType.civil}</option>
              <option value="family">{selfLawyerOptionLabels.caseType.family}</option>
              <option value="consumer">{selfLawyerOptionLabels.caseType.consumer}</option>
              <option value="labour">{selfLawyerOptionLabels.caseType.labour}</option>
            </select>
            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65 pointer-events-none" size={14} />
          </div>
        </div>
        <div>
          <label className={uiText.label}>{selfLawyerUi.stage}</label>
          <div className="relative mt-1">
            <select
              value={selfLawyerCase.stage}
              onChange={(e) => setSelfLawyerCase((prev) => ({ ...prev, stage: e.target.value }))}
              className={uiField.select}
            >
              <option value="pre-filing">{selfLawyerOptionLabels.stage["pre-filing"]}</option>
              <option value="filing">{selfLawyerOptionLabels.stage.filing}</option>
              <option value="notice-reply">{selfLawyerOptionLabels.stage["notice-reply"]}</option>
              <option value="evidence">{selfLawyerOptionLabels.stage.evidence}</option>
              <option value="arguments">{selfLawyerOptionLabels.stage.arguments}</option>
              <option value="appeal">{selfLawyerOptionLabels.stage.appeal}</option>
            </select>
            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65 pointer-events-none" size={14} />
          </div>
        </div>
        <div>
          <label className={uiText.label}>{selfLawyerUi.courtLevel}</label>
          <div className="relative mt-1">
            <select
              value={selfLawyerCase.courtLevel}
              onChange={(e) => setSelfLawyerCase((prev) => ({ ...prev, courtLevel: e.target.value }))}
              className={uiField.select}
            >
              <option value="magistrate">{selfLawyerOptionLabels.courtLevel.magistrate}</option>
              <option value="district">{selfLawyerOptionLabels.courtLevel.district}</option>
              <option value="sessions">{selfLawyerOptionLabels.courtLevel.sessions}</option>
              <option value="high-court">{selfLawyerOptionLabels.courtLevel["high-court"]}</option>
            </select>
            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className={uiText.label}>{selfLawyerUi.oppositeParty}</label>
          <input
            value={selfLawyerCase.opponentType}
            onChange={(e) => setSelfLawyerCase((prev) => ({ ...prev, opponentType: e.target.value }))}
            className={`mt-1 ${uiField.input}`}
            placeholder={selfLawyerUi.opponentPlaceholder}
          />
        </div>
        <div>
          <label className={uiText.label}>{selfLawyerUi.hearingDate}</label>
          <input
            type="date"
            value={selfLawyerCase.upcomingDate}
            onChange={(e) => setSelfLawyerCase((prev) => ({ ...prev, upcomingDate: e.target.value }))}
            className={`mt-1 ${uiField.input}`}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className={uiText.label}>{selfLawyerUi.reliefWanted}</label>
        <input
          value={selfLawyerCase.reliefWanted}
          onChange={(e) => setSelfLawyerCase((prev) => ({ ...prev, reliefWanted: e.target.value }))}
          className={`mt-1 ${uiField.input}`}
          placeholder={selfLawyerUi.reliefPlaceholder}
        />
      </div>

      <div className="mt-3">
        <label className={uiText.label}>{selfLawyerUi.keyFacts}</label>
        <textarea
          rows={3}
          value={selfLawyerCase.keyFacts}
          onChange={(e) => setSelfLawyerCase((prev) => ({ ...prev, keyFacts: e.target.value }))}
          className={`mt-1 ${uiField.textarea}`}
          placeholder={selfLawyerUi.factsPlaceholder}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={buildSelfLawyerGuidedPrompt}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${uiButton.warmPrimary}`}
        >
          {selfLawyerUi.generatePrompt}
        </button>
        <button
          type="button"
          onClick={() => setSelfLawyerDraftPrompt("")}
          className={`px-4 py-2 rounded-full text-sm ${uiButton.ghost}`}
        >
          {selfLawyerUi.clearDraft}
        </button>
      </div>

      {selfLawyerDraftPrompt && (
        <div className="mt-3">
          <p className={`${uiText.muted} mb-1`}>{selfLawyerUi.draftAdded}</p>
          <textarea
            rows={4}
            value={selfLawyerDraftPrompt}
            onChange={(e) => setSelfLawyerDraftPrompt(e.target.value)}
            className={uiField.textarea}
          />
        </div>
      )}

      <div className="mt-3">
        <p className={`${uiText.muted} mb-2`}>{selfLawyerUi.quickActions}</p>
        <div className="flex flex-wrap gap-2">
          {selfLawyerQuickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => attachSelfLawyerPrompt(action.prompt)}
              className={uiButton.chip}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelfLawyerToolkitPanel;
