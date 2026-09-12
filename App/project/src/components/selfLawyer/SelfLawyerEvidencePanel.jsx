import React from "react";
import { uiField, uiSurface, uiText } from "../ui/designTokens";

const SelfLawyerEvidencePanel = ({
  selfLawyerUi,
  handleEvidenceUpload,
  isEvidenceUploading,
  evidenceUploadStatus,
  evidenceUploadError,
  evidenceText,
  setEvidenceText,
}) => {
  return (
    <div className={`${uiSurface.glassCard} p-4`}>
      <h3 className={`${uiText.title} mb-2`}>{selfLawyerUi.evidenceTitle}</h3>
      <p className={`${uiText.body} mb-3`}>{selfLawyerUi.evidenceDesc}</p>
      <div className="flex flex-col gap-3 items-start">
        <label className="flex items-center justify-center px-4 py-2 rounded-full border border-dashed border-white/40 bg-white/5 text-sm cursor-pointer hover:bg-white/10 transition">
          <span className="mr-2">📎 {selfLawyerUi.uploadEvidence}</span>
          <span className={uiText.label}>{selfLawyerUi.uploadTypes}</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            onChange={handleEvidenceUpload}
            className="hidden"
          />
        </label>
        {isEvidenceUploading && <span className="text-xs text-amber-200">{selfLawyerUi.uploadingEvidence}</span>}
        {evidenceUploadStatus && !isEvidenceUploading && (
          <span className="text-xs text-emerald-200">{evidenceUploadStatus}</span>
        )}
        {evidenceUploadError && !isEvidenceUploading && (
          <span className="text-xs text-amber-200">{evidenceUploadError}</span>
        )}
      </div>
      {evidenceText && (
        <div className="mt-3">
          <p className={`${uiText.muted} mb-1`}>{selfLawyerUi.extractedEvidence}</p>
          <textarea
            rows={8}
            className={uiField.textarea}
            value={evidenceText}
            onChange={(e) => setEvidenceText(e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default SelfLawyerEvidencePanel;
