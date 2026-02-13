import { Shift, AnalysisReport, TranscriptEntry } from '../types'

export const mockShifts: Shift[] = [
  {
    shiftId: 'shift_20240115_001',
    controllerId: 'CTR-123',
    facility: 'Tower 001',
    startTime: '2024-01-15T06:00:00Z',
    endTime: '2024-01-15T14:00:00Z',
    position: 'tower',
    scheduleType: '2-2-1',
    trafficCountAvg: 8,
    analyzed: true,
  },
  {
    shiftId: 'shift_20240115_002',
    controllerId: 'CTR-123',
    facility: 'Tower 001',
    startTime: '2024-01-15T14:00:00Z',
    endTime: '2024-01-15T22:00:00Z',
    position: 'tower',
    scheduleType: '2-2-1',
    trafficCountAvg: 8,
    analyzed: true,
  },
  {
    shiftId: 'shift_20240115_003',
    controllerId: 'CTR-456',
    facility: 'Tower 001',
    startTime: '2024-01-15T22:00:00Z',
    endTime: '2024-01-16T06:00:00Z',
    position: 'tower',
    scheduleType: '2-2-1',
    trafficCountAvg: 8,
    analyzed: false,
  },
  {
    shiftId: 'shift_20240115_004',
    controllerId: 'CTR-789',
    facility: 'Tower 001',
    startTime: '2024-01-15T06:00:00Z',
    endTime: '2024-01-15T14:00:00Z',
    position: 'tower',
    scheduleType: '2-2-1',
    trafficCountAvg: 8,
    analyzed: true,
  },
]

export const mockReport: AnalysisReport = {
  shiftId: 'shift_20240115_001',
  controllerId: 'CTR-123',
  date: '2024-01-15',
  shiftTime: '06:00 - 14:00',
  position: 'Tower',
  executiveSummary: 'Controller showed increasing fatigue in final 2 hours of shift. Response times elevated but no safety issues detected. Recommend standard break protocol.',
  fatigueAnalysis: {
    score: 58,
    severity: 'medium',
    trend: 'increasing',
    indicators: [
      {
        type: 'response_time',
        evidence: 'Average response increased from 2.1s to 3.5s in hours 6-8',
        severity: 'medium',
      },
      {
        type: 'hesitations',
        evidence: '12 filler words detected vs baseline of 3-4',
        severity: 'medium',
      },
    ],
    metrics: {
      avgResponseTime: 2.8,
      maxResponseTime: 5.2,
      hesitationCount: 12,
      hoursOnDuty: 8,
    },
    requiresAttention: true,
    summary: 'Moderate fatigue detected, increasing toward end of shift',
  },
  safetyAnalysis: {
    score: 15,
    severity: 'low',
    issuesFound: [],
    requiresImmediateReview: false,
    summary: 'No safety violations detected. All readbacks correct. Standard phraseology maintained throughout shift.',
  },
  summary: {
    executiveSummary: 'Controller demonstrated moderate fatigue in final 2 hours of 8-hour shift. Response times increased by 40% and hesitations were above baseline. No safety violations detected.',
    keyFindings: [
      'Response time increased 40% in hours 6-8',
      '12 hesitations detected (above baseline)',
      'All readbacks correct, no safety violations',
      'Fatigue consistent with 7th consecutive day',
    ],
    timeline: [
      {
        timestamp: '06:00',
        type: 'normal',
        description: 'Shift start',
      },
      {
        timestamp: '12:00',
        type: 'fatigue',
        description: 'Fatigue increase',
        severity: 'medium',
      },
      {
        timestamp: '13:00',
        type: 'fatigue',
        description: 'Continued fatigue',
        severity: 'medium',
      },
    ],
    recommendations: [
      {
        priority: 1,
        action: 'Standard break schedule adequate',
        rationale: 'Current breaks are sufficient for this level of fatigue',
      },
      {
        priority: 2,
        action: 'Consider day off before next 2-2-1 rotation',
        rationale: '7 consecutive days may be contributing to fatigue',
      },
      {
        priority: 3,
        action: 'Monitor next shift for continued fatigue',
        rationale: 'Fatigue increasing toward end of shift',
      },
    ],
    priorityLevel: 'medium',
  },
  requiresAttention: true,
  priorityLevel: 'medium',
}

export const mockTranscript: TranscriptEntry[] = [
  {
    timestamp: '06:15:23',
    speaker: 'pilot',
    text: 'UAL429: "Tower, United four two niner ready for departure runway two seven"',
  },
  {
    timestamp: '06:15:25',
    speaker: 'controller',
    text: 'CTR: "United four two niner, runway two seven, cleared for takeoff"',
    responseTime: 2.0,
  },
  {
    timestamp: '12:34:18',
    speaker: 'pilot',
    text: 'DAL892: "Tower, Delta eight nine two, ten miles south, inbound with information Charlie"',
  },
  {
    timestamp: '12:34:23',
    speaker: 'controller',
    text: 'CTR: "Delta eight... uh... nine two, tower, um, make straight in runway two... two seven, report three mile final"',
    responseTime: 5.2,
    annotations: [
      {
        type: 'hesitation',
        severity: 'medium',
        message: 'Hesitations detected',
      },
      {
        type: 'response_time',
        severity: 'medium',
        message: 'Longer than normal response',
      },
      {
        type: 'fatigue',
        severity: 'medium',
        message: 'This transmission shows signs of fatigue - hesitations and delayed response after 6+ hours on duty. Traffic complexity was moderate.',
      },
    ],
  },
]
