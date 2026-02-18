# AI Coding Instructions for ATC Transcript Analyzer

## Project Overview
**ATC Transcript Analyzer** is a prototype system for supervisors to analyze controller fatigue and safety from pre-recorded ATC-pilot communications. It consists of three key components: a React frontend dashboard, a FastAPI backend with agentic AI analysis, and an audio transcription processor.

### Architecture
```
Frontend (React/TypeScript) 
  → Backend API (FastAPI)
    → Ollama LLM (llama3.2:3b)
    → MongoDB (reports storage)
    → S3 (audio/transcript storage)
    → Audio Processor (Whisper)
```

---

## Essential Architecture Patterns

### Component Structure
- **Frontend** (`frontend/src/`): React 18 + TypeScript + Vite + Tailwind CSS
  - Routes: `/` (shift selection), `/shift/:shiftId` (analysis results), `/shift/:shiftId/transcript` (transcript viewer)
  - Pages use mock data from `mockData.ts` until API integration
  - Type definitions in `types/index.ts` define contracts for shifts, fatigue/safety analyses, and reports

- **Backend API** (`backend-api/main.py`): FastAPI + Motor (async MongoDB) + boto3
  - Entry point: `/analyze-shift` (POST, queues background job) and `/report/{shift_id}` (GET, retrieves analysis)
  - Processing chain: S3 audio → transcription → 3 agents → MongoDB storage
  - Uses environment variables: `MONGODB_URI`, `MONGODB_DB`, `MONGODB_COLLECTION`, `OLLAMA_BASE_URL`

- **AI Agents** (`backend-api/agents.py`): Ollama-based analysis
  - `FatigueAgent`: Scores fatigue (0-100) based on response times, hesitations, hours on duty
  - `SafetyAgent`: Flags safety violations (readback errors, phraseology, missed acks)
  - `SummarizerAgent`: Generates supervisor-ready reports with timeline and recommendations
  - Helper function `_extract_json()` robustly parses LLM output from markdown code blocks

- **Audio Processing** (`audio-processor/transcribe.py`): Whisper-based transcription
  - Parses filenames for metadata: `FACILITY-POSITION-Month-DD-YYYY-HHMMZ.mp3`
  - Outputs JSON with transcript entries (timestamp, speaker, text, response time)

### Data Flow
1. Supervisor selects shift → Frontend calls `/analyze-shift` with `shift_id`
2. Backend queues background task that downloads audio from S3, transcribes, runs agents
3. Each agent analyzes transcript independently (response times, hesitations, safety rules)
4. Results combined into `AnalysisReport` and stored in MongoDB keyed by `shift_id`
5. Frontend polls or receives callback to `/report/{shift_id}` for display

---

## Critical Developer Workflows

### Frontend Development
```bash
cd frontend
npm install
npm run dev  # Starts Vite dev server on http://localhost:3000
npm run build  # TypeScript + Vite production build
npm run lint  # ESLint check
```
- **Hot reload**: Edit `src/pages/*.tsx` or `src/components/*.tsx` for instant feedback
- **Mock data workflow**: Update `src/data/mockData.ts` to test UI without backend
- **Type safety**: Always update `src/types/index.ts` when changing API contracts

### Backend Development
```bash
cd backend-api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
ollama pull llama3.2:3b  # Must be running locally
docker run -d --name atc-mongo -p 27017:27017 mongo:7  # MongoDB container
uvicorn main:app --reload --host 0.0.0.0 --port 8000  # API at http://localhost:8000/docs
```
- **Ollama requirement**: Always ensure Ollama is running on `localhost:11434` with `llama3.2:3b` model
- **MongoDB requirement**: Must run MongoDB container for report persistence
- **Agent testing**: Agents are async; use `pytest` with `pytest-asyncio` for unit tests
- **JSON extraction**: Ollama outputs may include markdown formatting; use `_extract_json()` to parse robustly

### Audio Processing
```bash
cd audio-processor
pip install -r requirements.txt
# Place MP3 files in raw/ directory
python3 transcribe.py
# Outputs JSON transcripts to output/ directory
```
- **Dependencies**: Requires `openai-whisper` and `torch` (heavy download)
- **Model selection**: Default is `base` model; change in `WHISPER_MODEL` constant

### Docker & OpenShift Deployment
- **Frontend**: `frontend/Dockerfile` builds a production Node.js image; deploy via `hack/deploy_openshift.sh`
- **Backend**: Create `backend-api/Dockerfile` and manifests following `frontend/openshift/` pattern
- **Environment variables**: Pass via ConfigMaps in Kubernetes/OpenShift

---

## Project-Specific Conventions

### Type Definitions
All types in `frontend/src/types/index.ts` must match backend agent outputs exactly:
```typescript
// Severity levels everywhere: 'low' | 'medium' | 'high' | 'critical'
// Priority levels: 'low' | 'medium' | 'high' | 'urgent'
// Analysis reports always have: score, severity, summary, requiresAttention fields
```

### Agent Prompt Structure
Agents expect consistent metadata and transcript format from backend:
```python
# Metadata: start_time, hours_on_duty, position, facility, schedule_type
# Transcript: list of dicts with timestamp, speaker, text, response_time (seconds)
# Output: Always return JSON with score (0-100), summary, list of indicators/issues
```

### Frontend Styling
- **Tailwind CSS only** (see `tailwind.config.js` and `postcss.config.js`)
- Color scheme: Use `text-*-600 bg-*-100` pairs for severity badges (green/yellow/orange/red)
- Icons from `lucide-react` (e.g., `ArrowLeft`, `FileText`, `Download`)

### API Contracts
- **Async operations**: `/analyze-shift` returns immediately with `{"status": "processing", "shift_id": ...}`
- **Report retrieval**: `/report/{shift_id}` returns `AnalysisReport` object or HTTP 404 if not found
- **Error handling**: FastAPI auto-validates with Pydantic; agents return structured JSON wrapped in try/except

---

## Integration Points & External Dependencies

### Ollama LLM Integration
- **Model**: `llama3.2:3b` (small, runs locally on CPU/GPU)
- **Endpoint**: `http://localhost:11434/api/chat`
- **Async call**: Use `httpx.AsyncClient` in `agents.py`
- **Known issue**: Ollama sometimes includes markdown around JSON; always use `_extract_json()`

### MongoDB Async Access
- **Library**: `motor` (async MongoDB driver)
- **Connection**: Lazy-initialized in `get_mongo_client()`, keyed by `shift_id`
- **Collections**: Single collection `reports` with Shift-level granularity

### S3 & AWS Services
- **Library**: `boto3` client initialized in `main.py`
- **Not yet used**: Download/upload logic stubbed; implement with `s3_client.get_object()` and `.put_object()`
- **Credentials**: Via AWS environment variables or IAM role (OpenShift)

### Transcription
- **Current**: Whisper model (`transcribe.py`); outputs JSON to local `output/` dir
- **Real data source**: Will be replaced with Deepgram/AWS Transcribe API in production
- **Filename convention**: Metadata extracted from filename; strict format expected

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Frontend won't start | Clear `node_modules/`, run `npm install`, ensure port 3000 is free |
| Backend 500 error | Check Ollama running (`ollama list`), MongoDB container up (`docker ps`), model available |
| Agent timeout | Increase `OLLAMA_TIMEOUT` (default 120s); llama3.2:3b is slow on CPU |
| JSON parse error | Ollama output may have markdown; `_extract_json()` handles `​\`\`\`json...​\`\`\`` wrapping |
| Type mismatch in frontend | Verify response from `/report/{shift_id}` matches `AnalysisReport` in `types/index.ts` |
| Audio file not transcribed | Check filename format `FACILITY-POSITION-Month-DD-YYYY-HHMMZ.mp3` and file is in `raw/` dir |

---

## File Reference Guide

| File | Purpose | Key Pattern |
|------|---------|-------------|
| `frontend/src/App.tsx` | Route definitions | React Router setup with 3 main routes |
| `frontend/src/pages/*.tsx` | Page components | Mock data, styled with Tailwind, no API calls yet |
| `frontend/src/types/index.ts` | Type contracts | Single source of truth for all interfaces |
| `backend-api/main.py` | FastAPI entry | `/analyze-shift`, `/report/{shift_id}`, background task pattern |
| `backend-api/agents.py` | AI logic | 3 agent classes, Ollama integration, JSON extraction |
| `audio-processor/transcribe.py` | Transcription | Filename parsing, Whisper model wrapping |

