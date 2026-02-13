import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Clock } from 'lucide-react'
import { TranscriptEntry } from '../types'
import { mockTranscript } from '../data/mockData'

export default function TranscriptViewer() {
  const { shiftId } = useParams<{ shiftId: string }>()
  const navigate = useNavigate()
  const transcript: TranscriptEntry[] = mockTranscript

  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'hesitation': return '🟡'
      case 'response_time': return '⏱️'
      case 'fatigue': return '🟠'
      case 'safety': return '🔴'
      default: return 'ℹ️'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'border-l-green-500'
      case 'medium': return 'border-l-yellow-500'
      case 'high': return 'border-l-orange-500'
      default: return 'border-l-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(`/shift/${shiftId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Report
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            Full Transcript - Shift {shiftId}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="card">
          <div className="space-y-6">
            {transcript.map((entry, index) => {
              const hasAnnotations = entry.annotations && entry.annotations.length > 0
              const isController = entry.speaker === 'controller'
              
              return (
                <div
                  key={index}
                  className={`border-l-4 pl-4 py-2 ${
                    hasAnnotations ? getSeverityColor(entry.annotations![0].severity) : 'border-l-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">
                        [{entry.timestamp}]
                      </span>
                      <span className={`font-semibold ${
                        isController ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {entry.speaker.toUpperCase()}
                      </span>
                      {isController && entry.responseTime && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {entry.responseTime.toFixed(1)}s response
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-800 mb-2 whitespace-pre-wrap">
                    {entry.text}
                  </p>

                  {isController && (
                    <div className="text-xs text-green-600 mb-2">
                      ✓ Standard phraseology
                    </div>
                  )}

                  {hasAnnotations && (
                    <div className="mt-2 space-y-1">
                      {entry.annotations!.map((annotation, annIndex) => (
                        <div
                          key={annIndex}
                          className={`text-sm flex items-start gap-2 ${
                            annotation.severity === 'high' ? 'text-orange-600' :
                            annotation.severity === 'medium' ? 'text-yellow-600' :
                            'text-gray-600'
                          }`}
                        >
                          <span>{getAnnotationIcon(annotation.type)}</span>
                          <span>{annotation.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasAnnotations && entry.annotations!.some(a => a.type === 'fatigue') && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-900 mb-1">AI Analysis:</p>
                          <p>
                            {entry.annotations!.find(a => a.type === 'fatigue')?.message ||
                             'This transmission shows signs of fatigue - hesitations and delayed response after 6+ hours on duty. Traffic complexity was moderate.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
