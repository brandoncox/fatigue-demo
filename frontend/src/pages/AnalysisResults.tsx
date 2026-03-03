import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, Download, Loader, AlertCircle, AlertTriangle } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface FatigueIndicator {
  type: string
  evidence: string
  timestamp?: string | number | null
}

interface SafetyIssue {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp?: string | null
  evidence: string
  concern: string
}

interface ShiftData {
  _id: string
  shift_id: string
  controller_id: string
  facility: string
  start_time: string
  end_time: string
  position: string
  schedule_type: string
  traffic_count_avg: number
  status: string
  created_at: string
  updated_at: string
  executive_summary?: {
    report?: {
      title: string
      shift_info?: any
      fatigue_analysis?: any
      safety_analysis?: any
    }
    executive_summary?: string
    key_findings?: string[]
    timeline?: any
    recommendations?: string[]
    priority_level?: string
  }
  fatigue_analysis?: {
    fatigue_score: number
    severity: string
    indicators: FatigueIndicator[]
    requires_attention: boolean
    summary: string
    metrics: {
      avg_response_time: number
      max_response_time: number
      hesitation_count: number
      hours_on_duty: number
    }
  }
  safety_analysis?: {
    safety_score: number
    issues_found: SafetyIssue[]
    requires_immediate_review: boolean
    summary: string
  }
}

export default function AnalysisResults() {
  const { shiftId } = useParams<{ shiftId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ShiftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!shiftId) {
          throw new Error('No shift ID provided')
        }

        // Fetch shift from backend
        const response = await fetch(`${API_BASE_URL}/shifts/${shiftId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch shift: ${response.statusText}`)
        }

        const shift = (await response.json()) as ShiftData

        // If shift hasn't been analyzed yet, start polling
        if (!shift.fatigue_analysis && shift.status !== 'completed') {
          setIsAnalyzing(true)
          let pollCount = 0
          const maxPolls = 60
          let pollInterval: NodeJS.Timeout

          const pollForCompletion = async () => {
            try {
              const pollResponse = await fetch(`${API_BASE_URL}/shifts/${shiftId}`)
              if (!pollResponse.ok) throw new Error('Failed to poll shift status')

              const pollShift = (await pollResponse.json()) as ShiftData

              if (pollShift.fatigue_analysis && pollShift.status === 'completed') {
                clearInterval(pollInterval)
                setData(pollShift)
                setIsAnalyzing(false)
                setLoading(false)
              } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval)
                setError('Analysis is taking longer than expected. Please try again in a moment.')
                setLoading(false)
              }
              pollCount++
            } catch (pollErr) {
              clearInterval(pollInterval)
              console.error('Polling error:', pollErr)
              setError('Error while waiting for analysis completion')
              setLoading(false)
            }
          }

          pollInterval = setInterval(pollForCompletion, 2000)
          await pollForCompletion()
        } else {
          setData(shift)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to fetch report:', err)
        setError('Failed to load analysis. Ensure the backend API is running.')
        setLoading(false)
      }
    }

    if (shiftId) {
      fetchReport()
    }
  }, [shiftId])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {isAnalyzing ? 'Analyzing Shift' : 'Loading Report'}
          </h2>
          <p className="text-gray-600">
            {isAnalyzing ? 'Running analysis. This may take a moment...' : 'Loading report...'}
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Shifts
            </button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-red-900 mb-2">Report Not Found</h2>
                <p className="text-red-700 mb-4">{error || 'Unable to load the analysis report.'}</p>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Back to Shifts
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getScoreColor = (score: number) => {
    if (score <= 30) return 'text-green-600'
    if (score <= 60) return 'text-yellow-600'
    if (score <= 80) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreEmoji = (score: number) => {
    if (score <= 30) return '🟢'
    if (score <= 60) return '🟡'
    if (score <= 80) return '🟠'
    return '🔴'
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const formatTime = (dateString: string) => {
    if (!dateString) return ''
    try {
      return new Date(dateString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const fatigueAnalysis = data.fatigue_analysis
  const safetyAnalysis = data.safety_analysis
  const execSummary = data.executive_summary
  const summaryText = execSummary?.executive_summary
  const priorityLevel = execSummary?.priority_level
  const keyFindings = execSummary?.key_findings || []
  const recommendations = execSummary?.recommendations || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{data.controller_id}</h1>
              <p className="text-sm text-gray-600">{data.facility} • {data.position}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">{formatDate(data.start_time)}</p>
            <p className="text-sm text-gray-600">{formatTime(data.start_time)} - {formatTime(data.end_time)}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Fatigue Score */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Fatigue Analysis</h3>
                <p className="text-sm text-gray-600 mt-1">Controller fatigue level assessment</p>
              </div>
            </div>
            {fatigueAnalysis && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{getScoreEmoji(fatigueAnalysis.fatigue_score)}</span>
                  <div>
                    <div className={`text-4xl font-bold ${getScoreColor(fatigueAnalysis.fatigue_score)}`}>
                      {fatigueAnalysis.fatigue_score}
                    </div>
                    <p className="text-sm text-gray-600">out of 100</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(fatigueAnalysis.severity)}`}>
                    {fatigueAnalysis.severity.charAt(0).toUpperCase() + fatigueAnalysis.severity.slice(1)}
                  </span>
                  {fatigueAnalysis.requires_attention && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      <AlertTriangle className="w-4 h-4" />
                      Requires Attention
                    </span>
                  )}
                </div>
                {fatigueAnalysis.summary && (
                  <p className="text-sm text-gray-700 mt-4">{fatigueAnalysis.summary}</p>
                )}
                {fatigueAnalysis.metrics && (
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600">Hesitations</p>
                      <p className="text-lg font-semibold text-gray-900">{fatigueAnalysis.metrics.hesitation_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Response Time</p>
                      <p className="text-lg font-semibold text-gray-900">{fatigueAnalysis.metrics.avg_response_time}s</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Max Response Time</p>
                      <p className="text-lg font-semibold text-gray-900">{fatigueAnalysis.metrics.max_response_time}s</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Hours on Duty</p>
                      <p className="text-lg font-semibold text-gray-900">{fatigueAnalysis.metrics.hours_on_duty.toFixed(1)}h</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Safety Score */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Safety Analysis</h3>
                <p className="text-sm text-gray-600 mt-1">Safety violations and concerns</p>
              </div>
            </div>
            {safetyAnalysis && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{getScoreEmoji(safetyAnalysis.safety_score)}</span>
                  <div>
                    <div className={`text-4xl font-bold ${getScoreColor(safetyAnalysis.safety_score)}`}>
                      {safetyAnalysis.safety_score}
                    </div>
                    <p className="text-sm text-gray-600">out of 100</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {safetyAnalysis.issues_found.length} {safetyAnalysis.issues_found.length === 1 ? 'Issue' : 'Issues'} Found
                  </span>
                  {safetyAnalysis.requires_immediate_review && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      <AlertTriangle className="w-4 h-4" />
                      Review Required
                    </span>
                  )}
                </div>
                {safetyAnalysis.summary && (
                  <p className="text-sm text-gray-700 mt-4">{safetyAnalysis.summary}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Executive Summary */}
        {summaryText && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-gray-900">📋 Executive Summary</h2>
              {priorityLevel && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(priorityLevel)}`}>
                  {priorityLevel.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-gray-700 leading-relaxed">{summaryText}</p>
          </div>
        )}

        {/* Fatigue Indicators */}
        {fatigueAnalysis && fatigueAnalysis.indicators && fatigueAnalysis.indicators.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">⚡ Fatigue Indicators</h2>
            <div className="space-y-3">
              {fatigueAnalysis.indicators.map((indicator, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-gray-900 capitalize">{indicator.type.replace(/_/g, ' ')}</p>
                      {indicator.timestamp !== null && indicator.timestamp !== undefined && (
                        <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                          {typeof indicator.timestamp === 'number' ? `${indicator.timestamp.toFixed(1)}s` : indicator.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{indicator.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety Issues */}
        {safetyAnalysis && safetyAnalysis.issues_found && safetyAnalysis.issues_found.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🛡️ Safety Issues</h2>
            <div className="space-y-3">
              {safetyAnalysis.issues_found.map((issue, idx) => (
                <div key={idx} className="border-l-4 border-current pl-4 py-3" 
                     style={{borderColor: issue.severity === 'critical' ? '#dc2626' : issue.severity === 'high' ? '#ea580c' : issue.severity === 'medium' ? '#eab308' : '#16a34a'}}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-gray-900 capitalize">{issue.type.replace(/_/g, ' ')}</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                        {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                      </span>
                    </div>
                    {issue.timestamp && (
                      <span className="text-xs text-gray-600 whitespace-nowrap">{issue.timestamp}</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Evidence:</p>
                      <p className="text-sm text-gray-700">{issue.evidence}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Concern:</p>
                      <p className="text-sm text-gray-700">{issue.concern}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Findings */}
        {keyFindings && keyFindings.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🎯 Key Findings</h2>
            <div className="space-y-4">
              {keyFindings.map((finding, idx) => (
                <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-700">{finding}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💡 Recommendations</h2>
            <ol className="space-y-4">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="font-bold text-blue-600 flex-shrink-0">{idx + 1}.</span>
                  <p className="text-gray-900">{rec}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Link
            to={`/shifts/${shiftId}/transcript`}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            View Full Transcript
          </Link>
          <button className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report PDF
          </button>
        </div>
      </main>
    </div>
  )
}
