/**
 * API Service for ATC Transcript Analyzer
 * Provides functions to interact with the FastAPI backend
 */

// Get API URL from environment variable or use default
// For Vite, use import.meta.env.VITE_API_URL (must be prefixed with VITE_)
// But we'll also support REACT_APP_API_URL for compatibility
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') as string

export interface AnalyzeShiftRequest {
  shift_id: string
  controller_id: string
  facility: string
  start_time: string
  end_time: string
  position: string
  schedule_type: string
  traffic_count_avg: number
  audio_file?: File
}

export interface AnalyzeShiftResponse {
  status: 'processing' | 'complete' | 'failed'
  shift_id: string
  error?: string
}

/**
 * API response from backend - maps to backend agent outputs
 */
export interface BackendAnalysisReport {
  shift_id: string
  controller_id: string
  facility: string
  start_time: string
  end_time: string
  position: string
  schedule_type: string
  traffic_count_avg: number
  fatigue?: {
    fatigue_score: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    indicators: Array<{
      type: string
      evidence: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      timestamp?: string
    }>
    requires_attention: boolean
    summary: string
    metrics: {
      avg_response_time: number
      max_response_time: number
      hesitation_count: number
      hours_on_duty: number
    }
  }
  safety?: {
    safety_score: number
    issues_found: Array<{
      type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      timestamp: string
      evidence: string
      concern: string
    }>
    requires_immediate_review: boolean
    summary: string
  }
  summary?: {
    executive_summary: string
    key_findings: string[]
    timeline?: Array<{
      timestamp: string
      type: string
      description: string
      severity?: string
    }>
    recommendations: Array<{
      priority: number
      action: string
      rationale: string
    }>
    priority_level: 'low' | 'medium' | 'high' | 'urgent'
  }
}

/**
 * Upload audio file and shift metadata to start analysis
 */
export async function uploadAndAnalyzeShift(
  metadata: Omit<AnalyzeShiftRequest, 'audio_file'>,
  audioFile: File
): Promise<AnalyzeShiftResponse> {
  const formData = new FormData()

  // Add metadata fields
  formData.append('shift_id', metadata.shift_id)
  formData.append('controller_id', metadata.controller_id)
  formData.append('facility', metadata.facility)
  formData.append('start_time', metadata.start_time)
  formData.append('end_time', metadata.end_time)
  formData.append('position', metadata.position)
  formData.append('schedule_type', metadata.schedule_type)
  formData.append('traffic_count_avg', metadata.traffic_count_avg.toString())

  // Add audio file
  formData.append('file', audioFile, audioFile.name)

  const response = await fetch(`${API_BASE_URL}/analyze-transcript`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Failed to upload audio: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch analysis report for a specific shift
 */
export async function fetchAnalysisReport(shiftId: string): Promise<BackendAnalysisReport> {
  const response = await fetch(`${API_BASE_URL}/shifts/${shiftId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Report not found - analysis may still be processing')
    }
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Failed to fetch report: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Poll for report availability with exponential backoff
 */
export async function pollReportWithBackoff(
  shiftId: string,
  maxAttempts: number = 30,
  initialDelayMs: number = 1000
): Promise<BackendAnalysisReport> {
  let delayMs = initialDelayMs
  let attempt = 0

  while (attempt < maxAttempts) {
    try {
      const report = await fetchAnalysisReport(shiftId)
      return report
    } catch (error) {
      attempt++

      if (attempt >= maxAttempts) {
        throw new Error('Report generation timeout - analysis is taking longer than expected')
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      // Exponential backoff: double delay each time, cap at 5 seconds
      delayMs = Math.min(delayMs * 1.5, 5000)
    }
  }

  throw new Error('Failed to fetch report')
}

/**
 * Check if analysis is complete
 */
export async function isAnalysisComplete(shiftId: string): Promise<boolean> {
  try {
    await fetchAnalysisReport(shiftId)
    return true
  } catch {
    return false
  }
}

/**
 * Convert backend API response to frontend AnalysisReport format
 */
export function convertBackendReportToFrontend(backendReport: BackendAnalysisReport): any {
  const start = new Date(backendReport.start_time)
  const date = start.toISOString().split('T')[0]
  const shiftTime = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return {
    shiftId: backendReport.shift_id,
    controllerId: backendReport.controller_id,
    date,
    shiftTime,
    position: backendReport.position,
    executiveSummary:
      backendReport.summary?.executive_summary ||
      'No summary available',
    fatigueAnalysis: {
      score: backendReport.fatigue?.fatigue_score || 0,
      severity: backendReport.fatigue?.severity || 'low',
      trend: 'stable',
      indicators: (backendReport.fatigue?.indicators || []).map((ind: any) => ({
        type: ind.type,
        evidence: ind.evidence,
        severity: ind.severity,
        timestamp: ind.timestamp,
      })),
      metrics: {
        avgResponseTime: backendReport.fatigue?.metrics?.avg_response_time || 0,
        maxResponseTime: backendReport.fatigue?.metrics?.max_response_time || 0,
        hesitationCount: backendReport.fatigue?.metrics?.hesitation_count || 0,
        hoursOnDuty: backendReport.fatigue?.metrics?.hours_on_duty || 8,
      },
      requiresAttention: backendReport.fatigue?.requires_attention || false,
      summary: backendReport.fatigue?.summary || '',
    },
    safetyAnalysis: {
      score: backendReport.safety?.safety_score || 0,
      severity: backendReport.safety ? (backendReport.safety.safety_score > 50 ? 'high' : 'low') : 'low',
      issuesFound: (backendReport.safety?.issues_found || []).map((issue: any) => ({
        type: issue.type,
        severity: issue.severity,
        timestamp: issue.timestamp,
        evidence: issue.evidence,
        concern: issue.concern,
      })),
      requiresImmediateReview: backendReport.safety?.requires_immediate_review || false,
      summary: backendReport.safety?.summary || '',
    },
    summary: {
      executiveSummary: backendReport.summary?.executive_summary || '',
      keyFindings: backendReport.summary?.key_findings || [],
      timeline: backendReport.summary?.timeline || [],
      recommendations: backendReport.summary?.recommendations || [],
      priorityLevel: backendReport.summary?.priority_level || 'low',
    },
    requiresAttention: 
      (backendReport.fatigue?.requires_attention || false) ||
      (backendReport.safety?.requires_immediate_review || false),
    priorityLevel: backendReport.summary?.priority_level || 'low',
  }
}
