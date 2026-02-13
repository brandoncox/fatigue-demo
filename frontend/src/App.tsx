import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ShiftSelection from './pages/ShiftSelection'
import AnalysisResults from './pages/AnalysisResults'
import TranscriptViewer from './pages/TranscriptViewer'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ShiftSelection />} />
        <Route path="/shift/:shiftId" element={<AnalysisResults />} />
        <Route path="/shift/:shiftId/transcript" element={<TranscriptViewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
