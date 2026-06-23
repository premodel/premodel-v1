// Shared shape of an intake submission. The frontend computes all display values
// (labels, formatted prices) so the backend stays decoupled from the estimator's
// pricing logic — it only formats and forwards what it receives.

export interface LeadContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  zip: string;
}

export interface LeadProject {
  rooms: string[];          // room keys, e.g. ["kitchen","primaryBath"]
  roomLabels: string[];     // human labels, e.g. ["Kitchen","Primary bath"]
  tier: string | null;      // e.g. "reconfigure"
  tierLabel: string | null; // e.g. "Reconfigure"
  budget: string | null;    // raw chip value, e.g. "100k_200k"
  budgetLabel: string | null;
  note: string;             // Q2 optional free-text note
  smsConsent: boolean;      // checked the "I agree to receive texts" box
}

export interface LeadEstimate {
  pmTotal: number | null;             // Premodel service total (number)
  pmTotalFormatted: string | null;    // e.g. "$3,200"
  constructionLo: number | null;
  constructionHi: number | null;
  constructionRangeFormatted: string | null; // e.g. "$60,000 – $90,000"
  designFeeRangeFormatted: string | null;
}

export interface LeadMeta {
  layout: string | null;        // "a" | "b" — which prototype layout produced it
  pageUrl: string | null;
  utm: Record<string, string>;
  submittedAt: string | null;   // client ISO timestamp (advisory)
}

export interface Lead {
  contact: LeadContact;
  project: LeadProject;
  estimate: LeadEstimate;
  meta: LeadMeta;
}

// Slack message metadata wrapper — carries the structured lead on the posted
// message so the interactivity handler can read it back on button click without
// a database round-trip.
export const LEAD_EVENT_TYPE = 'premodel_lead';
