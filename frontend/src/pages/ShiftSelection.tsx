import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Search, CheckCircle2, Circle, Play, Upload, Loader, AlertCircle, Zap } from 'lucide-react'
import { Shift } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface BackendShift {
  shift_id: string
  controller_id: string
  facility: string
  position: string
  schedule_type: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  start_time: string
  end_time: string
  fatigue_analysis?: { score: number }
  safety_analysis?: { score: number }
  requires_attention?: boolean
  [key: string]: any
}

export default function ShiftSelection() {
  const navigate = useNavigate()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzingShiftId, setAnalyzingShiftId] = useState<string | null>(null)

  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedFacility, setSelectedFacility] = useState<string>('all')
  const [selectedController, setSelectedController] = useState<string>('all')
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set())

  // Fetch shifts from backend
  useEffect(() => {
    const fetchShifts = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE_URL}/shifts`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch shifts: ${response.statusText}`)
        }

        const data = await response.json()
        const shiftsData = (data.data || []) as BackendShift[]

        // Transform backend data to frontend Shift type
        const transformedShifts: Shift[] = shiftsData.map((s: BackendShift) => ({
          shiftId: s.shift_id,
          controllerId: s.controller_id,
          facility: s.facility,
          position: s.position,
          scheduleType: s.schedule_type,
          startTime: s.start_time,
          endTime: s.end_time,
          status: s.status,
          analyzed: s.status === 'completed',
          fatigueScore: s.fatigue_analysis?.score || 0,
          safetyScore: s.safety_analysis?.score || 0,
          requiresAttention: s.requires_attention || false,
        }))

        setShifts(transformedShifts)
      } catch (err) {
        console.error('Error fetching shifts:', err)
        setError(err instanceof Error ? err.message : 'Unknown error fetching shifts')
      } finally {
        setLoading(false)
      }
    }

    fetchShifts()
  }, [])

  const facilities = Array.from(new Set(shifts.map(s => s.facility))).sort()
  const controllers = Array.from(new Set(shifts.map(s => s.controllerId))).sort()

  const filteredShifts = shifts.filter(shift => {
    if (selectedStatus !== 'all' && shift.status !== selectedStatus) return false
    if (selectedFacility !== 'all' && shift.facility !== selectedFacility) return false
    if (selectedController !== 'all' && shift.controllerId !== selectedController) return false
    return true
  })

  const toggleShiftSelection = (shiftId: string) => {
    const newSelected = new Set(selectedShiftIds)
    if (newSelected.has(shiftId)) {
      newSelected.delete(shiftId)
    } else {
      newSelected.add(shiftId)
    }
    setSelectedShiftIds(newSelected)
  }

  // Handle queued shift analysis (POST /analyze-shift)
  const handleQueuedAnalyze = async (shiftId: string) => {
    try {
      setAnalyzingShiftId(shiftId)
      console.log(`Analyzing shift: ${shiftId}`)

      const response = await fetch(`${API_BASE_URL}/analyze-shift?shift_id=${shiftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Failed to analyze shift: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Analysis result:', result)

      // Update the shift status locally or refetch
      setShifts(prevShifts =>
        prevShifts.map(s =>
          s.shiftId === shiftId
            ? {
                ...s,
                status: 'completed',
                analyzed: true,
                fatigueScore: result.fatigue_analysis?.score || 0,
                safetyScore: result.safety_analysis?.score || 0,
              }
            : s
        )
      )

      // Navigate to results page
      navigate(`/shifts/${shiftId}`)
    } catch (err) {
      console.error('Error analyzing shift:', err)
      alert(`Error analyzing shift: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setAnalyzingShiftId(null)
    }
  }

  // Handle view analyzed shift (navigate to /shifts/{shift_id})
  const handleViewShift = (shiftId: string) => {
    navigate(`/shifts/${shiftId}`)
  }

  const handleBatchAnalyze = () => {
    if (selectedShiftIds.size > 0) {
      const firstShiftId = Array.from(selectedShiftIds)[0]
      const firstShift = shifts.find(s => s.shiftId === firstShiftId)
      
      if (firstShift?.status === 'queued') {
        handleQueuedAnalyze(firstShiftId)
      } else {
        navigate(`/shifts/${firstShiftId}`)
      }
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'queued':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">ATC Transcript Analyzer</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Audio</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Select Shift to Analyze</h2>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Facility</label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Facilities</option>
                {facilities.map(facility => (
                  <option key={facility} value={facility}>
                    {facility}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Controller</label>
              <select
                value={selectedController}
                onChange={(e) => setSelectedController(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Controllers</option>
                {controllers.map(controller => (
                  <option key={controller} value={controller}>
                    {controller}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
                <Search className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>
        </div>

        {/* Available Shifts */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Available Shifts {!loading && `(${filteredShifts.length})`}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="ml-2 text-gray-600">Loading shifts...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error loading shifts</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : filteredShifts.length === 0 ? (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
              <p>No shifts found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredShifts.map(shift => {
                const startDate = new Date(shift.startTime)
                const startTime = startDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const endTime = new Date(shift.endTime).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })

                const isAnalyzing = analyzingShiftId === shift.shiftId
                const isQueued = shift.status === 'queued'

                return (
                  <div
                    key={shift.shiftId}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2">
                        {shift.analyzed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                        <input
                          type="checkbox"
                          checked={selectedShiftIds.has(shift.shiftId)}
                          onChange={() => toggleShiftSelection(shift.shiftId)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{shift.controllerId}</span>
                          {shift.requiresAttention && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                              <AlertCircle className="w-3 h-3" />
                              Attention
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {shift.facility} • {shift.position} • {shift.scheduleType} • {startTime} - {endTime}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(shift.status)}`}>
                          {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                        </span>

                        {shift.fatigueScore > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            <Zap className="w-3 h-3" />
                            {shift.fatigueScore}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="ml-4">
                      {isQueued ? (
                        <button
                          onClick={() => handleQueuedAnalyze(shift.shiftId)}
                          disabled={isAnalyzing}
                          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              Analyze
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewShift(shift.shiftId)}
                          className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition whitespace-nowrap"
                        >
                          View Results
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mb-6 text-sm text-gray-600 space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>= Analyzed</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-gray-400" />
            <span>= Not analyzed</span>
          </div>
        </div>

        {/* Batch Actions */}
        {selectedShiftIds.size > 0 && (
          <button
            onClick={handleBatchAnalyze}
            className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Process Selected ({selectedShiftIds.size})
          </button>
        )}
      </main>
    </div>
  )
}
