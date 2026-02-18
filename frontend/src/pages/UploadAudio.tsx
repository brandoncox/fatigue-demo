import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'

interface UploadFormData {
  shiftId: string
  controllerId: string
  facility: string
  startTime: string
  endTime: string
  position: string
  scheduleType: string
  trafficCountAvg: number
}

export default function UploadAudio() {
  const navigate = useNavigate()
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const [formData, setFormData] = useState<UploadFormData>({
    shiftId: '',
    controllerId: '',
    facility: '',
    startTime: '',
    endTime: '',
    position: 'tower',
    scheduleType: '2-2-1',
    trafficCountAvg: 8,
  })

  // Calculate duration of audio file in seconds
  const getAudioDuration = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const audio = new Audio()
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(audio.duration)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(0)
      }
      audio.src = url
    })
  }

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const newErrors: Record<string, string> = {}

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/flac']
    if (!validTypes.includes(file.type)) {
      newErrors.audioFile = 'Invalid audio format. Please upload MP3, WAV, M4A, OGG, or FLAC.'
      setErrors(newErrors)
      setAudioFile(null)
      return
    }

    // Check audio duration
    const duration = await getAudioDuration(file)
    const maxDurationSeconds = 30 * 60 // 30 minutes

    if (duration > maxDurationSeconds) {
      newErrors.audioFile = `Audio file is too long. Maximum duration is 30 minutes (${(duration / 60).toFixed(1)} minutes provided).`
      setAudioFile(null)
      setErrors(newErrors)
      return
    }

    setAudioFile(file)
    setErrors((prev) => {
      const updated = { ...prev }
      delete updated.audioFile
      return updated
    })
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    const numericFields = ['trafficCountAvg']

    setFormData({
      ...formData,
      [name]: numericFields.includes(name) ? Number(value) : value,
    })

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev }
        delete updated[name]
        return updated
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!audioFile) {
      newErrors.audioFile = 'Please select an audio file'
    }

    if (!formData.shiftId.trim()) {
      newErrors.shiftId = 'Shift ID is required'
    }

    if (!formData.controllerId.trim()) {
      newErrors.controllerId = 'Controller ID is required'
    }

    if (!formData.facility.trim()) {
      newErrors.facility = 'Facility is required'
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required'
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required'
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(formData.startTime).getTime()
      const end = new Date(formData.endTime).getTime()
      if (end <= start) {
        newErrors.endTime = 'End time must be after start time'
      }
    }

    if (!formData.position.trim()) {
      newErrors.position = 'Position is required'
    }

    if (!formData.scheduleType.trim()) {
      newErrors.scheduleType = 'Schedule type is required'
    }

    if (formData.trafficCountAvg < 0) {
      newErrors.trafficCountAvg = 'Traffic count must be non-negative'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // In a real app, this would upload to backend API
      // For now, we'll simulate the upload
      const formDataToSend = new FormData()
      formDataToSend.append('file', audioFile!)
      formDataToSend.append('metadata', JSON.stringify(formData))

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Show success message
      setSuccessMessage(`Successfully queued analysis for shift ${formData.shiftId}`)

      // Reset form
      setAudioFile(null)
      setFormData({
        shiftId: '',
        controllerId: '',
        facility: '',
        startTime: '',
        endTime: '',
        position: 'tower',
        scheduleType: '2-2-1',
        trafficCountAvg: 8,
      })

      // Redirect to shift selection after 2 seconds
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (error) {
      setErrors({ submit: 'Failed to upload audio. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Audio</h1>
            <p className="text-sm text-gray-600 mt-1">
              Upload an ATC recording and provide shift metadata for analysis
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Upload Successful</h3>
              <p className="text-sm text-green-700">{successMessage}</p>
              <p className="text-xs text-green-600 mt-2">Redirecting...</p>
            </div>
          </div>
        )}

        {/* General Error */}
        {errors.submit && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Upload Failed</h3>
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Audio Upload Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Audio File</h2>

            <div className="relative">
              <input
                type="file"
                id="audioFile"
                accept="audio/*"
                onChange={handleAudioChange}
                className="hidden"
                disabled={isSubmitting}
              />
              <label
                htmlFor="audioFile"
                className={`flex items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-lg cursor-pointer transition ${
                  errors.audioFile
                    ? 'border-red-300 bg-red-50 hover:bg-red-100'
                    : audioFile
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="text-center">
                  <Upload
                    className={`w-12 h-12 mx-auto mb-2 ${
                      errors.audioFile
                        ? 'text-red-400'
                        : audioFile
                          ? 'text-green-400'
                          : 'text-gray-400'
                    }`}
                  />
                  {audioFile ? (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{audioFile.name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        MP3, WAV, M4A, OGG, or FLAC up to 30 minutes
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>

            {errors.audioFile && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errors.audioFile}
              </p>
            )}
          </div>

          {/* Shift Metadata Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shift Metadata</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shift ID */}
              <div>
                <label htmlFor="shiftId" className="block text-sm font-medium text-gray-700 mb-2">
                  Shift ID <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="shiftId"
                  name="shiftId"
                  value={formData.shiftId}
                  onChange={handleInputChange}
                  placeholder="shift_20260215_001"
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg font-mono text-sm transition ${
                    errors.shiftId
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                />
                {errors.shiftId && (
                  <p className="mt-1 text-xs text-red-600">{errors.shiftId}</p>
                )}
              </div>

              {/* Controller ID */}
              <div>
                <label htmlFor="controllerId" className="block text-sm font-medium text-gray-700 mb-2">
                  Controller ID <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="controllerId"
                  name="controllerId"
                  value={formData.controllerId}
                  onChange={handleInputChange}
                  placeholder="CTR_000"
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg font-mono text-sm transition ${
                    errors.controllerId
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                />
                {errors.controllerId && (
                  <p className="mt-1 text-xs text-red-600">{errors.controllerId}</p>
                )}
              </div>

              {/* Facility */}
              <div>
                <label htmlFor="facility" className="block text-sm font-medium text-gray-700 mb-2">
                  Facility <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="facility"
                  name="facility"
                  value={formData.facility}
                  onChange={handleInputChange}
                  placeholder="KORD Tower 1"
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg text-sm transition ${
                    errors.facility
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                />
                {errors.facility && (
                  <p className="mt-1 text-xs text-red-600">{errors.facility}</p>
                )}
              </div>

              {/* Position */}
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
                  Position <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  placeholder="tower"
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg text-sm transition ${
                    errors.position
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                />
                {errors.position && (
                  <p className="mt-1 text-xs text-red-600">{errors.position}</p>
                )}
              </div>

              {/* Start Time */}
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time <span className="text-red-600">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg text-sm transition ${
                    errors.startTime
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                />
                {errors.startTime && (
                  <p className="mt-1 text-xs text-red-600">{errors.startTime}</p>
                )}
              </div>

              {/* End Time */}
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                  End Time <span className="text-red-600">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg text-sm transition ${
                    errors.endTime
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                />
                {errors.endTime && (
                  <p className="mt-1 text-xs text-red-600">{errors.endTime}</p>
                )}
              </div>

              {/* Schedule Type */}
              <div>
                <label htmlFor="scheduleType" className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Type <span className="text-red-600">*</span>
                </label>
                <select
                  id="scheduleType"
                  name="scheduleType"
                  value={formData.scheduleType}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg text-sm transition ${
                    errors.scheduleType
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  <option value="2-2-1">2-2-1</option>
                  <option value="2-3">2-3</option>
                  <option value="standard">Standard</option>
                  <option value="night">Night</option>
                  <option value="mixed">Mixed</option>
                </select>
                {errors.scheduleType && (
                  <p className="mt-1 text-xs text-red-600">{errors.scheduleType}</p>
                )}
              </div>

              {/* Traffic Count Average */}
              <div>
                <label htmlFor="trafficCountAvg" className="block text-sm font-medium text-gray-700 mb-2">
                  Traffic Count (Average) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  id="trafficCountAvg"
                  name="trafficCountAvg"
                  value={formData.trafficCountAvg}
                  onChange={handleInputChange}
                  min="0"
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border rounded-lg text-sm transition ${
                    errors.trafficCountAvg
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                />
                {errors.trafficCountAvg && (
                  <p className="mt-1 text-xs text-red-600">{errors.trafficCountAvg}</p>
                )}
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => navigate('/')}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isSubmitting ? 'Uploading...' : 'Upload and Analyze'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
