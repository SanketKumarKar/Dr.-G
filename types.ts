export enum AppState {
  GREETING = 'GREETING',
  CHATTING = 'CHATTING',
  REVIEWING = 'REVIEWING',
  GENERATING_REPORT = 'GENERATING_REPORT',
  REPORTING = 'REPORTING',
}

export enum MessageRole {
    USER = 'user',
    MODEL = 'model',
}

export interface Message {
  role: MessageRole;
  content: string;
}

// APSA specific types
export interface APSASymptomEvidence {
  name: string;              // canonical symptom name
  qualifiers?: Record<string, string>; // OLDCART + other qualifiers
  presence: 'present' | 'absent' | 'uncertain';
  sourceMessageIndex: number; // index in conversation where confirmed
  confidence?: number;        // 0-1 internal confidence
}

export interface APSAHypothesis {
  condition: string;            // candidate condition label
  probability: number;          // 0-1 normalized
  supporting: string[];         // symptom names supporting
  contradicting: string[];      // symptom names contradicting
}

export interface APSAQuestionPlan {
  question: string;            // user facing question
  targetSymptom: string;       // symptom we are trying to discriminate
  rationale: string;           // internal rationale (not shown to user normally)
  expectedSplits: Record<string, number>; // info gain per hypothesis if positive
}

export interface APSAStateSnapshot {
  cycle: number;
  hypotheses: APSAHypothesis[];
  askedQuestions: APSAQuestionPlan[];
  evidence: APSASymptomEvidence[];
  terminated: boolean;
  terminationReason?: string;
}

export interface Symptom {
  name: string;
  severity: number;
  duration: string;
  notes: string;
}

export enum SymptomCategory {
  PROMINENT = 'prominent',
  MEDIUM = 'medium',
  LOW = 'low',
}

export type CategorizedSymptoms = {
  [SymptomCategory.PROMINENT]: Symptom[];
  [SymptomCategory.MEDIUM]: Symptom[];
  [SymptomCategory.LOW]: Symptom[];
};

export interface Report {
  userSummary: string;
  clinicianReport: string;
  professionalReportHtml: string;
}
