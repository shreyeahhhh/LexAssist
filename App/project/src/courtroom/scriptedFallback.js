// Hardcoded courtroom scenario for the
// "Misuse of a Disability Welfare Training Application" case.
//
// Activates only when:
//   1. The case title/summary matches the keyword set below, AND
//   2. The AI/WebSocket backend is unreachable, times out, rate-limits,
//      or otherwise fails to deliver a response.
//
// In that situation the courtroom switches to OFFLINE SCRIPT MODE and runs
// entirely client-side using the predefined dialogues below.
//
// Stages map onto the existing Virtual Courtroom UI stage codes so the
// progress bar, role boxes, transcript, and stage-control buttons keep
// working without any UI changes:
//   COURT_OPENING        -> Opening Stage
//   OPENING_ARGUMENT     -> Argument Stage
//   EVIDENCE_SUBMISSION  -> Evidence Submission Stage
//   COUNTER_ARGUMENT     -> Counter Argument Stage
//   CLOSING_ARGUMENT     -> Closing Statements
//   EDUCATIONAL_JUDGMENT -> Judgment Stage

const KEYWORDS = [
  'misuse of a disability welfare training application',
  'misuse of disability welfare training application',
  'disability welfare training application',
  'disability welfare',
  'differently abled training',
  'differently abled training application',
  'fake disability application',
  'misuse of welfare training scheme',
  'misuse of welfare training',
  'thiruvananthapuram corporation disability',
  'thiruvananthapuram corporation disability project',
  'corporation disability welfare',
  'disability welfare training',
];

export function matchesScriptedFallback(...inputs) {
  const haystack = inputs
    .map((value) => String(value || '').toLowerCase())
    .join(' \n ')
    .trim();
  if (!haystack) return false;
  return KEYWORDS.some((kw) => haystack.includes(kw));
}

export const SCRIPTED_CASE_TITLE = 'Misuse of a Disability Welfare Training Application';

export const EVIDENCE_ACK = 'Exhibit A has been submitted to the court record.';

export const SYSTEM_NOTES = {
  activated: 'Offline scripted demo mode is active. The court will continue using a predefined flow.',
  awaitingUser: 'Prosecutor, you may now address the court (speak or type).',
  uploadHint: 'Prosecutor, upload the disability welfare application to mark Exhibit A.',
  judgmentDelivered: 'Judgment delivered. Court is adjourned.',
};

// Each stage has a list of `pre` lines (played before the prosecutor speaks)
// and `post` lines (played after the prosecutor's address before advancing).
// When `final` is true, the courtroom auto-ends after `pre` finishes.
export const SCRIPTED_FLOW = [
  {
    stage: 'COURT_OPENING',
    label: 'Opening Stage',
    waitsForUser: true,
    pre: [
      {
        role: 'JUDGE',
        text:
          "This virtual court is now in session regarding the case titled 'Misuse of a Disability Welfare Training Application.'",
      },
      {
        role: 'JUDGE',
        text:
          'The court reminds all parties that this matter concerns a welfare initiative intended to support differently abled individuals through training and empowerment programs.',
      },
      {
        role: 'JUDGE',
        text:
          'Any misuse of such initiatives is considered a serious matter because it may affect deserving beneficiaries.',
      },
      {
        role: 'JUDGE',
        text:
          'At the same time, the court will not assume guilt without proper examination of evidence and intent.',
      },
      { role: 'JUDGE', text: 'Prosecutor, you may begin your opening statement.' },
    ],
    post: [
      {
        role: 'OPPOSING_LAWYER',
        text: 'Your Honor, the defense maintains that the accused had no criminal intention.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'Any inconsistencies in the submitted disability welfare application were procedural in nature and not part of a deliberate attempt to commit fraud.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'The accused believed the submitted details were acceptable and acted without malicious intent.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'We request the court to carefully evaluate the circumstances before arriving at conclusions.',
      },
    ],
  },
  {
    stage: 'OPENING_ARGUMENT',
    label: 'Argument Stage',
    waitsForUser: true,
    pre: [
      { role: 'JUDGE', text: 'The court will now proceed to the argument stage.' },
      {
        role: 'JUDGE',
        text: 'Prosecutor, present your arguments and observations before the court.',
      },
    ],
    post: [
      {
        role: 'OPPOSING_LAWYER',
        text:
          'The prosecution assumes intent without presenting direct proof of fraudulent behavior.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'Mere inconsistencies or incomplete documentation cannot automatically establish criminal intent.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'The application process involved multiple procedural requirements that may have caused confusion for the applicant.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'The accused was attempting to access a welfare opportunity and did not knowingly attempt to exploit the system.',
      },
      { role: 'ACCUSED', text: 'I never intended to misuse the scheme.' },
      {
        role: 'ACCUSED',
        text: 'I only wanted support and training opportunities through the project.',
      },
      {
        role: 'ACCUSED',
        text:
          'I was confused during the submission process and did not understand some of the documentation requirements.',
      },
      { role: 'JUDGE', text: 'The court acknowledges the statements made by both parties.' },
      {
        role: 'JUDGE',
        text: 'However, this court must determine whether the discrepancies were accidental or intentional.',
      },
    ],
  },
  {
    stage: 'EVIDENCE_SUBMISSION',
    label: 'Evidence Submission Stage',
    waitsForUser: true,
    triggersOnExhibit: true,
    pre: [
      { role: 'JUDGE', text: 'The court will now proceed to evidence submission.' },
      {
        role: 'JUDGE',
        text:
          'Prosecutor, upload and present the relevant supporting documents before the court.',
      },
    ],
    post: [
      { role: 'JUDGE', text: 'The submitted document has been marked as Exhibit A.' },
      {
        role: 'JUDGE',
        text:
          'The court will examine the uploaded disability welfare application and associated details.',
      },
      {
        role: 'WITNESS',
        text:
          'During verification, discrepancies were found between the submitted application and official disability verification records.',
      },
      {
        role: 'WITNESS',
        text:
          'Certain supporting documents were either incomplete or unavailable during the verification process.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text: 'Incomplete documents alone do not prove criminal intent.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text: 'There is a significant difference between procedural error and deliberate deception.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text: 'The prosecution must prove intentional misuse beyond reasonable doubt.',
      },
      { role: 'JUDGE', text: 'The court accepts the submitted evidence for examination.' },
      {
        role: 'JUDGE',
        text:
          'The evidentiary value and authenticity of the uploaded form will be considered during judgment.',
      },
    ],
  },
  {
    stage: 'COUNTER_ARGUMENT',
    label: 'Counter Argument Stage',
    waitsForUser: true,
    pre: [
      { role: 'JUDGE', text: 'The court will now hear counter arguments from the defense.' },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'The applicant cooperated during verification and responded to clarification requests.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text: 'This behavior is inconsistent with someone attempting intentional fraud.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'If the accused truly intended deception, there would have been deliberate concealment or refusal to cooperate.',
      },
      {
        role: 'WITNESS',
        text: 'Yes, clarification responses were later received from the applicant.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text: 'This demonstrates willingness to comply with the process rather than criminal intent.',
      },
      { role: 'JUDGE', text: 'The court notes the cooperation mentioned during verification.' },
      {
        role: 'JUDGE',
        text: 'Both procedural negligence and intentional misuse must be separately evaluated.',
      },
    ],
    post: [],
  },
  {
    stage: 'CLOSING_ARGUMENT',
    label: 'Closing Statements',
    waitsForUser: true,
    pre: [
      { role: 'JUDGE', text: 'The court will now proceed to final closing statements.' },
      {
        role: 'OPPOSING_LAWYER',
        text: 'There is insufficient evidence proving deliberate fraud.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text:
          'The inconsistencies identified in the form appear to be procedural misunderstandings rather than intentional misuse.',
      },
      {
        role: 'OPPOSING_LAWYER',
        text: 'The defense respectfully requests the court to consider the absence of malicious intent.',
      },
      {
        role: 'JUDGE',
        text: 'Prosecutor, present your final statement before the court proceeds to judgment.',
      },
    ],
    post: [],
  },
  {
    stage: 'EDUCATIONAL_JUDGMENT',
    label: 'Judgment Stage',
    waitsForUser: false,
    final: true,
    pre: [
      {
        role: 'JUDGE',
        text:
          'After reviewing the submitted evidence, witness statements, and arguments presented by both sides, the court finds that inconsistencies existed within the submitted disability welfare application.',
      },
      {
        role: 'JUDGE',
        text: 'However, the prosecution has not conclusively established deliberate criminal intent beyond reasonable doubt.',
      },
      {
        role: 'JUDGE',
        text: 'The court recognizes that procedural irregularities were present during the application process.',
      },
      {
        role: 'JUDGE',
        text: 'At the same time, welfare initiatives intended for differently abled individuals must be protected from misuse.',
      },
      {
        role: 'JUDGE',
        text:
          'Therefore, the court orders re-verification of the submitted disability documentation before any further approval or rejection of benefits.',
      },
      {
        role: 'JUDGE',
        text:
          'The concerned authorities are also advised to improve document verification and applicant guidance procedures for future submissions.',
      },
      { role: 'JUDGE', text: 'This matter is hereby concluded. Court is adjourned.' },
    ],
    post: [],
  },
];

export const SCRIPTED_STAGES = SCRIPTED_FLOW.map((stage) => stage.stage);
