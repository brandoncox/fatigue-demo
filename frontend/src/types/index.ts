export interface Shift {
  shiftId: string;
  controllerId: string;
  facility: string;
  startTime: string;
  endTime: string;
  position: string;
  scheduleType: string;
  trafficCountAvg?: number;
  analyzed: boolean;
}

export interface FatigueAnalysis {
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'increasing' | 'decreasing' | 'stable';
  indicators: FatigueIndicator[];
  metrics: {
    avgResponseTime: number;
    maxResponseTime: number;
    hesitationCount: number;
    hoursOnDuty: number;
  };
  requiresAttention: boolean;
  summary: string;
}

export interface FatigueIndicator {
  type: string;
  evidence: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: string;
}

export interface SafetyAnalysis {
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  issuesFound: SafetyIssue[];
  requiresImmediateReview: boolean;
  summary: string;
}

export interface SafetyIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  evidence: string;
  concern: string;
}

export interface ShiftSummary {
  executiveSummary: string;
  keyFindings: string[];
  timeline: TimelineEvent[];
  recommendations: Recommendation[];
  priorityLevel: 'low' | 'medium' | 'high' | 'urgent';
}

export interface TimelineEvent {
  timestamp: string;
  type: 'fatigue' | 'safety' | 'normal';
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface Recommendation {
  priority: number;
  action: string;
  rationale: string;
}

export interface AnalysisReport {
  shiftId: string;
  controllerId: string;
  date: string;
  shiftTime: string;
  position: string;
  executiveSummary: string;
  fatigueAnalysis: FatigueAnalysis;
  safetyAnalysis: SafetyAnalysis;
  summary: ShiftSummary;
  requiresAttention: boolean;
  priorityLevel: 'low' | 'medium' | 'high' | 'urgent';
}

export interface TranscriptEntry {
  timestamp: string;
  speaker: 'controller' | 'pilot';
  text: string;
  confidence?: number;
  responseTime?: number;
  annotations?: TranscriptAnnotation[];
}

export interface TranscriptAnnotation {
  type: 'fatigue' | 'safety' | 'hesitation' | 'response_time';
  severity: 'low' | 'medium' | 'high';
  message: string;
}
