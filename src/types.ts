export type RoleId =
  | "st-01"
  | "st-02"
  | "st-03"
  | "st-04"
  | "st-05"
  | "st-06"
  | "cu-01"
  | "cu-02"
  | "irs-exam";

export type View =
  | "now"
  | "return"
  | "area"
  | "docs"
  | "people"
  | "filing"
  | "firm"
  | "notice"
  | "next"
  | "search";

export type AreaId =
  | "identity"
  | "wages"
  | "business"
  | "investments"
  | "crypto"
  | "foreign"
  | "rentals"
  | "passthroughs"
  | "retirement"
  | "deductions"
  | "credits"
  | "california"
  | "payments"
  | "completeness";

export interface Extracted {
  id: string;
  document_id: string;
  page: number;
  field: string;
  label: string;
  value: unknown;
  value_type: string;
  text_as_read: string;
  position: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface Doc {
  id: string;
  title: string;
  document_type: string;
  issuer: string;
  belongs_to: string;
  tax_year: number;
  received_at: string;
  uploaded_by: string;
  file_name: string;
  page_count: number;
  pages: { page: number; printed_content: string }[];
  marked_corrected?: boolean;
  extraction: { status: string; values: number | null; reason: string | null };
}

export interface Line {
  key: string;
  jurisdiction: string;
  form: string;
  line: string;
  label: string;
  value: unknown;
  rule: string;
  inputs: string[];
  sources: string[];
  note: string | null;
}

export interface Asset {
  asset_id: string;
  description: string;
  activity: string;
  cost: number;
  land_value_not_depreciated?: number;
  placed_in_service: string;
  method: string;
  life_years: number;
  federal: Record<string, number>;
  california: Record<string, number>;
  amt: Record<string, number>;
  disposed: unknown;
  sources: string[];
}

export interface Diagnostic {
  code: string;
  severity: string;
  message: string;
  refs?: string[];
}

export interface ReturnVersion {
  version: string;
  computed_at: string;
  trigger: string;
  documents_used: string[];
  documents_superseded: string[];
  summary: {
    federal: Record<string, number>;
    california: Record<string, number>;
  };
  tax_effect_rates: Record<
    string,
    { federal_per_dollar: number; california_per_dollar: number }
  >;
  carryovers_out: Record<string, unknown>;
  assets: Asset[];
  diagnostics: Diagnostic[];
  changes_from_previous: {
    key: string;
    change: string;
    old: unknown;
    new: unknown;
  }[];
  lines: Line[];
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  credential: string | null;
  sensitive_data_clearance: boolean;
  active_from: string;
  note?: string;
}

export interface Packet {
  packet: { name: string; version: string; generated: string; client_id: string };
  readme: Record<string, unknown>;
  household: {
    filing_status: string;
    tax_year: number;
    people: Record<string, unknown>[];
    addresses: Record<string, unknown>[];
    residency: Record<string, unknown>[];
    bank_account_for_refund_or_payment: Record<string, string>;
    prior_year_agi_for_esignature: number;
    related_returns: Record<string, unknown>[];
  };
  documents: Doc[];
  extracted_values: Extracted[];
  client: {
    questionnaire: {
      id: string;
      question: string;
      answer: string;
      answered_by: string;
      answered_at: string;
    }[];
    messages: {
      id: string;
      sent_at: string;
      from: string;
      to: string;
      text: string;
    }[];
    call_notes: {
      id: string;
      date: string;
      participants: string[];
      notes: string[];
    }[];
  };
  firm: {
    name: string;
    staff: Staff[];
    firm_identity: Record<string, unknown>;
    client_users: { id: string; name: string; role: string }[];
    assignment_at_start: Record<string, string>;
    deadlines: { what: string; date: string }[];
    budget_hours: Record<string, number>;
    starter_standards: {
      note: string;
      verification_types: string[];
      variance_review: {
        compare_to: string;
        flag_if_change_over_percent: number;
        and_over_amount: number;
      };
      review_levels: string[];
      rules: string[];
      required_steps: string[];
    };
  };
  prior_years: {
    return_2024: {
      lines: Record<string, unknown>;
      line_labels?: Record<string, string>;
      notes?: unknown;
    };
    prior_preparer_workpaper: unknown;
    asset_records: unknown[];
    basis_records: unknown;
    carryovers_into_2025: Record<string, unknown>;
  };
  tax_agency_records: {
    irs_account_transcript_2025: unknown;
    ftb_account: unknown;
    notices: Record<string, unknown>[];
    efile: Record<string, unknown>[];
  };
  timeline: {
    id: string;
    at: string;
    event: string;
    actor: string | null;
    detail?: string;
    refs?: string[];
  }[];
  engine_reference: {
    parameters: Record<string, unknown>;
    rules: Record<string, string>;
  };
  return_versions: ReturnVersion[];
  what_if: {
    alternatives: Record<string, unknown>[];
    extension: unknown;
  };
  planning_reference_2026: Record<string, unknown>;
  post_filing_rates: Record<string, unknown>;
  fx_rates: Record<string, unknown>;
}

export interface Finding {
  id: string;
  title: string;
  severity: "block" | "warn" | "info";
  area: AreaId;
  summary: string;
  howSurfaced: string;
  refs: string[];
  claimKeys: string[];
  taxHint?: string;
}

export interface Adjustment {
  id: string;
  claimKey: string;
  from: unknown;
  to: unknown;
  who: string;
  why: string;
  at: string;
  category: string;
  federalEffect: number;
  californiaEffect: number;
}

export interface Verification {
  id: string;
  claimKey: string;
  type: string;
  who: string;
  at: string;
  note: string;
}

export interface ReviewNote {
  id: string;
  area: AreaId | "return";
  text: string;
  who: string;
  at: string;
  blocking: boolean;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface Question {
  id: string;
  to: "client" | "colleague";
  toName: string;
  text: string;
  who: string;
  at: string;
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
  evidence: boolean;
  refs: string[];
}

export interface Signoff {
  id: string;
  area: AreaId | "return";
  level: "preparer" | "reviewer" | "partner" | "client";
  who: string;
  at: string;
  snapshot: string;
  open: boolean;
  reopenReason?: string;
}

export interface Judgment {
  id: string;
  title: string;
  area: AreaId;
  decision: string;
  authority: string;
  who: string;
  at: string;
}

export interface TimeEntry {
  id: string;
  who: string;
  area: string;
  hours: number;
  at: string;
  note: string;
}

export interface ViewLog {
  at: string;
  who: string;
  what: string;
}

export interface Attachment {
  id: string;
  name: string;
  note: string;
  who: string;
  at: string;
  refs: string[];
}

// Browser-only audit record. This is a snapshot, not a submitted IRS return.
// Historical records remain in the array when an amendment is frozen.
export interface FiledSnapshot {
  id: string;
  filedAt: string;
  kind: "original" | "amended";
  origin: "recorded" | "legacy-reconstructed";
  recordedBy: RoleId;
  seasonClock: string;
  engineVersion: string;
  engineComputedAt: string;
  lineValues: Record<string, unknown>;
  summary: ReturnVersion["summary"];
  evidenceDocumentIds: string[];
  adjustments: Adjustment[];
  verifications: Verification[];
  signoffs: Signoff[];
  resolvedFindings: WorkState["resolvedFindings"];
  approvalTimes: { ngozi?: string; erik?: string };
}

export interface WorkState {
  roleId: RoleId;
  clock: string;
  lastSeen: Record<string, string>;
  adjustments: Adjustment[];
  verifications: Verification[];
  reviewNotes: ReviewNote[];
  questions: Question[];
  signoffs: Signoff[];
  judgments: Judgment[];
  timeEntries: TimeEntry[];
  viewLogs: ViewLog[];
  attachments: Attachment[];
  dispositions: Record<string, { status: string; why: string }>;
  resolvedFindings: Record<string, { who: string; at: string; how: string }>;
  selectedWhatIf: string | null;
  frozenAt: string | null;
  filedSnapshots: FiledSnapshot[];
  amendMode: boolean;
  clientApproval: {
    ngozi?: { at: string; pin: string };
    erik?: { at: string; pin: string };
  };
  standards: string[];
  assignments: Record<string, string>;
  notifications: { id: string; at: string; text: string; read: boolean }[];
  undo: Adjustment[];
}

export interface Index {
  packet: Packet;
  docs: Map<string, Doc>;
  ev: Map<string, Extracted>;
  evByDoc: Map<string, Extracted[]>;
  versions: Map<string, ReturnVersion>;
  current: ReturnVersion;
  lines: Map<string, Line>;
  linesByForm: Map<string, Line[]>;
  landings: Map<string, Line[]>;
  docToLines: Map<string, Line[]>;
  prior: Map<string, unknown>;
  findings: Finding[];
}
