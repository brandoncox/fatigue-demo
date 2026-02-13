import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Download } from 'lucide-react'
import { AnalysisReport } from '../types'
import { mockReport } from '../data/mockData'
import TimelineChart from '../components/TimelineChart'

export default function AnalysisResults() {
  const { shiftId } = useParams<{ shiftId: string }>()
  const navigate = useNavigate()
  
  // In a real app, this would fetch from API
  const report: AnalysisReport = mockReport

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Shifts
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            Shift Report: {report.controllerId} {report.shiftTime}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Card */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 SUMMARY</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Controller</p>
              <p className="font-semibold">{report.controllerId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Date</p>
              <p className="font-semibold">{formatDate(report.date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Shift Time</p>
              <p className="font-semibold">{report.shiftTime} (8 hours)</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Position</p>
              <p className="font-semibold">{report.position}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Schedule</p>
              <p className="font-semibold">2-2-1</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-600 mb-2">Fatigue Score</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getScoreEmoji(report.fatigueAnalysis.score)}</span>
                <span className={`text-2xl font-bold ${getScoreColor(report.fatigueAnalysis.score)}`}>
                  {report.fatigueAnalysis.score}/100
                </span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${getSeverityColor(report.fatigueAnalysis.severity)}`}>
                  {report.fatigueAnalysis.severity.charAt(0).toUpperCase() + report.fatigueAnalysis.severity.slice(1)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Safety Score</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getScoreEmoji(report.safetyAnalysis.score)}</span>
                <span className={`text-2xl font-bold ${getScoreColor(report.safetyAnalysis.score)}`}>
                  {report.safetyAnalysis.score}/100
                </span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${getSeverityColor(report.safetyAnalysis.severity)}`}>
                  {report.safetyAnalysis.severity.charAt(0).toUpperCase() + report.safetyAnalysis.severity.slice(1)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Priority</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                <span className={`text-xl font-bold ${getSeverityColor(report.priorityLevel)} px-3 py-1 rounded`}>
                  {report.priorityLevel.toUpperCase()} - Monitor Closely
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📋 EXECUTIVE SUMMARY</h2>
          <p className="text-gray-700 leading-relaxed">{report.executiveSummary}</p>
        </div>

        {/* Key Findings */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🎯 KEY FINDINGS</h2>
          <ul className="space-y-2">
            {report.summary.keyFindings.map((finding, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary-600 mt-1">•</span>
                <span className="text-gray-700">{finding}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Timeline */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⏱️ TIMELINE</h2>
          <TimelineChart report={report} />
        </div>

        {/* Recommendations */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💡 RECOMMENDATIONS</h2>
          <ol className="space-y-4">
            {report.summary.recommendations.map((rec, index) => (
              <li key={index} className="flex gap-4">
                <span className="font-bold text-primary-600">{index + 1}.</span>
                <div>
                  <p className="font-medium text-gray-900 mb-1">{rec.action}</p>
                  <p className="text-sm text-gray-600">{rec.rationale}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            to={`/shift/${shiftId}/transcript`}
            className="btn-primary flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            View Full Transcript
          </Link>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report PDF
          </button>
        </div>
      </main>
    </div>
  )
}
