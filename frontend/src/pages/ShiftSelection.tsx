import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Search, CheckCircle2, Circle, Play, Upload } from 'lucide-react'
import { Shift } from '../types'
import { mockShifts } from '../data/mockData'

export default function ShiftSelection() {
  const navigate = useNavigate()
  const [shifts] = useState<Shift[]>(mockShifts)
  const [selectedFacility, setSelectedFacility] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedController, setSelectedController] = useState<string>('all')
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set())

  const facilities = Array.from(new Set(shifts.map(s => s.facility)))
  const controllers = Array.from(new Set(shifts.map(s => s.controllerId)))

  const filteredShifts = shifts.filter(shift => {
    if (selectedFacility !== 'all' && shift.facility !== selectedFacility) return false
    if (selectedDate && !shift.startTime.startsWith(selectedDate)) return false
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

  const handleAnalyze = (shiftId: string) => {
    navigate(`/shift/${shiftId}`)
  }

  const handleBatchAnalyze = () => {
    if (selectedShiftIds.size > 0) {
      // Navigate to first selected shift
      const firstShiftId = Array.from(selectedShiftIds)[0]
      navigate(`/shift/${firstShiftId}`)
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Facility</label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="input-field"
              >
                <option value="all">All Facilities</option>
                {facilities.map(facility => (
                  <option key={facility} value={facility}>{facility}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Controller</label>
              <select
                value={selectedController}
                onChange={(e) => setSelectedController(e.target.value)}
                className="input-field"
              >
                <option value="all">All Controllers</option>
                {controllers.map(controller => (
                  <option key={controller} value={controller}>{controller}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search Shifts
          </button>
        </div>

        {/* Available Shifts */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Shifts</h3>
          <div className="space-y-3">
            {filteredShifts.map(shift => {
              const shiftDate = new Date(shift.startTime)
              const startTime = shiftDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              const endTime = new Date(shift.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              const shiftType = shift.startTime.includes('06:00') ? 'Morning' : 
                               shift.startTime.includes('14:00') ? 'Evening' : 'Night'
              
              return (
                <div
                  key={shift.shiftId}
                  className="card flex items-center justify-between hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => toggleShiftSelection(shift.shiftId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {shift.analyzed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="font-medium">{shift.controllerId}</span>
                    </div>
                    <span className="text-gray-600">{shiftType}</span>
                    <span className="text-gray-500">{startTime} - {endTime}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAnalyze(shift.shiftId)
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    {shift.analyzed ? 'View' : 'Analyze'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            = Already analyzed
          </span>
          <span className="flex items-center gap-2 ml-6">
            <Circle className="w-4 h-4 text-gray-400" />
            = Not yet analyzed
          </span>
        </div>

        {/* Batch Analyze Button */}
        {selectedShiftIds.size > 0 && (
          <button
            onClick={handleBatchAnalyze}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Batch Analyze Selected ({selectedShiftIds.size})
          </button>
        )}
      </main>
    </div>
  )
}
