# ATC Transcript Analyzer — Fatigue Demo

A prototype system for supervisors to analyze pre-recorded Air Traffic Controller (ATC) audio communications, automatically detecting fatigue indicators and safety issues using local AI models.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [OpenShift Deployment](#openshift-deployment)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌──────────────────────────────────┐
│   React Frontend (port 3000)     │
│   Vite + TypeScript + Tailwind   │
└────────────────┬─────────────────┘
                 │ VITE_API_URL
┌────────────────▼─────────────────┐
│   FastAPI Backend (port 8001)    │
│   shift-api/                     │
│   ├── Audio transcription        │
│   │   (OpenAI Whisper, local)    │
│   └── AI analysis agents         │
│       (Ollama llama3.2:3b)       │
└─────────┬───────────┬────────────┘
          │           │
  ┌───────▼──┐   ┌───▼──────────┐
  │ MongoDB  │   │ Ollama       │
  │ (atc DB) │   │ llama3.2:3b  │
  └──────────┘   └──────────────┘
```

**Three components:**

| Component | Directory | Description |
|---|---|---|
| Frontend | `frontend/` | React SPA — shift browser, analysis dashboard, transcript viewer |
| Backend API | `shift-api/` | FastAPI service — audio transcription (Whisper), AI agents (Ollama), MongoDB CRUD |
| Audio Processor | `audio-processor/` | Standalone script — batch-transcribe audio files to JSON (local use only) |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker or Podman | Latest | Required to build images |
| OpenShift CLI (`oc`) | 4.x | Required for cluster deployment |
| Node.js | 20+ | Frontend local development only |
| Python | 3.11+ | Backend local development only |
| MongoDB | 6+ | Database — deploy to cluster or use an external instance |
| Ollama | Latest | Runs the local LLM for AI analysis agents |

**Ollama model:** The backend agents require the `llama3.2:3b` model. Pull it once before running:

```bash
ollama pull llama3.2:3b
```

---

## Local Development

### 1. Start supporting services

```bash
# MongoDB (Docker)
docker run -d --name mongo -p 27017:27017 mongo:6

# Ollama (if not already running as a service)
ollama serve &
ollama pull llama3.2:3b
```

### 2. Backend (shift-api)

```bash
cd shift-api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start the API on port 8001
MONGO_URI="mongodb://localhost:27017/atc" uvicorn api:app --reload --port 8001
```

The API will be available at `http://localhost:8001`. Swagger UI: `http://localhost:8001/docs`.

### 3. Frontend

```bash
cd frontend
npm install

# Point the frontend at the running backend
echo "VITE_API_URL=http://localhost:8001" > .env

npm run dev
```

The app will be available at `http://localhost:3000`.

### 4. Audio Processor (optional — batch transcription)

```bash
cd audio-processor
pip install -r requirements.txt

# Place audio files in audio-processor/raw/
# Supported formats: mp3, wav, m4a, flac, ogg, aac, wma
python transcribe.py
# JSON output is written to audio-processor/output/
```

---

## OpenShift Deployment

### Overview

The `frontend/openshift/` directory contains production-ready Kubernetes/OpenShift manifests for the React frontend. The backend requires a Dockerfile and manifests (see [Backend Deployment](#backend-deployment-shift-api) below).

**Namespace used throughout:** `atc-transcript-analyzer`

---

### Frontend Deployment

#### Option A — OpenShift Binary Build (recommended)

This builds the image inside the cluster using OpenShift's build system — no local registry required.

```bash
# 1. Log in and create the project
oc login <your-cluster-url>
oc new-project atc-transcript-analyzer

# 2. Create a BuildConfig and trigger a build from local source
cd frontend
oc new-build --name atc-frontend --binary --strategy=docker -n atc-transcript-analyzer
oc start-build atc-frontend --from-dir=. --follow -n atc-transcript-analyzer

# 3. Apply the manifests
oc apply -f openshift/deployment.yaml -n atc-transcript-analyzer
oc apply -f openshift/service.yaml    -n atc-transcript-analyzer
oc apply -f openshift/route.yaml      -n atc-transcript-analyzer

# 4. Get the public URL
oc get route atc-frontend -n atc-transcript-analyzer
```

> **Set the backend URL at build time.** Before running `oc start-build`, create a `.env` file in the `frontend/` directory:
> ```
> VITE_API_URL=https://<your-backend-route>
> ```
> Vite bakes the value into the static bundle at build time — it cannot be changed at runtime without rebuilding.

#### Option B — External registry

```bash
# Build locally and push to your registry
docker build -t <registry>/atc-frontend:latest -f frontend/Dockerfile frontend
docker push <registry>/atc-frontend:latest

# Update the image reference in the deployment manifest
# frontend/openshift/deployment.yaml -> spec.template.spec.containers[0].image

oc apply -f frontend/openshift/ -n atc-transcript-analyzer
```

#### Deploy / Undeploy scripts

Convenience scripts are provided in `frontend/hack/`:

```bash
# Deploy (run from the frontend/ directory)
NAMESPACE=atc-transcript-analyzer ./hack/deploy_openshift.sh

# Remove the application
NAMESPACE=atc-transcript-analyzer ./hack/undeploy_openshift.sh
```

#### Kustomize

```bash
kubectl apply -k frontend/openshift/
# or
oc apply -k frontend/openshift/
```

---

### Backend Deployment (shift-api)

The backend does not yet have a Dockerfile. Create `shift-api/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for Whisper/torch
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]
```

> **Note on image size:** The `torch` and `openai-whisper` dependencies are large (~3 GB). Consider using a multi-stage build or a pre-built PyTorch base image for faster builds.

Then build and deploy following the same pattern as the frontend (binary build or external registry), creating equivalent `openshift/deployment.yaml`, `openshift/service.yaml`, and `openshift/route.yaml` manifests for the backend on port `8001`.

**Required Secrets and ConfigMaps for the backend:**

```bash
# MongoDB connection
oc create secret generic mongo-credentials \
  --from-literal=uri="mongodb://<user>:<pass>@<host>:27017/atc" \
  -n atc-transcript-analyzer

# Ollama endpoint (if Ollama is deployed as a separate service)
oc create configmap shift-api-config \
  --from-literal=OLLAMA_BASE_URL="http://ollama-service:11434" \
  -n atc-transcript-analyzer
```

Reference these in the backend Deployment:

```yaml
env:
  - name: MONGO_URI
    valueFrom:
      secretKeyRef:
        name: mongo-credentials
        key: uri
  - name: OLLAMA_BASE_URL
    valueFrom:
      configMapKeyRef:
        name: shift-api-config
        key: OLLAMA_BASE_URL
```

---

### MongoDB on OpenShift

For a quick single-instance MongoDB deployment:

```bash
oc new-app mongo:6 \
  -e MONGO_INITDB_DATABASE=atc \
  --name=mongodb \
  -n atc-transcript-analyzer

oc set volume deployment/mongodb \
  --add --name=mongo-storage \
  --mount-path=/data/db \
  --claim-size=10Gi \
  -n atc-transcript-analyzer
```

The backend should then use `MONGO_URI=mongodb://mongodb:27017/atc`.

---

### Ollama on OpenShift

Ollama must be accessible to the backend. Deploy it as a service in the same namespace:

```bash
oc new-app ollama/ollama \
  --name=ollama \
  -n atc-transcript-analyzer

# Expose internally (ClusterIP only — no external route needed)
oc expose deployment/ollama --port=11434 --name=ollama-service -n atc-transcript-analyzer
```

After Ollama is running, pull the required model (exec into the pod):

```bash
oc exec -n atc-transcript-analyzer deployment/ollama -- ollama pull llama3.2:3b
```

Set `OLLAMA_BASE_URL=http://ollama-service:11434` in the backend Deployment (see above).

> **GPU note:** Ollama benefits significantly from GPU acceleration. If your cluster has GPU nodes, schedule the Ollama pod on a GPU node using nodeSelector/tolerations and the appropriate NVIDIA device plugin.

---

## Environment Variables

### Frontend (`frontend/`)

Set in a `.env` file for local dev, or baked in at build time for production.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Full URL of the backend API. **Must match the backend port (8001).** |

### Backend (`shift-api/`)

Set as environment variables or via OpenShift Secrets/ConfigMaps.

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection URI. The `atc` database is used. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL of the Ollama server. Hardcoded in `agents.py` — override requires code change or env var wiring. |
| `OLLAMA_MODEL` | `llama3.2:3b` | Ollama model to use for AI agents. Hardcoded in `agents.py`. |

> **Port note:** The backend starts on port **8001** (see `api.py`). The frontend's `VITE_API_URL` default is `http://localhost:8000` — make sure to set it to port `8001` (or whichever port the backend is exposed on).

---

## API Reference

The FastAPI backend exposes a Swagger UI at `/docs` when running.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/analyze-transcript` | Upload audio file + metadata; queues Whisper transcription |
| `POST` | `/analyze-shift` | Run AI fatigue/safety analysis on an already-transcribed shift |
| `GET` | `/shifts` | List all shifts (filterable by controller, status, priority) |
| `GET` | `/shifts/{shift_id}` | Get a single shift with analysis results |
| `GET` | `/shifts/high-risk` | Shifts with fatigue score above threshold |
| `GET` | `/shifts/attention/required` | Shifts flagged for supervisor attention |
| `GET` | `/transcriptions/{shift_id}` | Get transcription for a shift |
| `GET` | `/stats/shifts` | Shift collection statistics |
| `GET` | `/stats/transcriptions` | Transcription collection statistics |

### Analysis workflow

```
POST /analyze-transcript   (audio file + metadata)
  → Whisper transcribes in background
  → Shift document created with status: "queued"

POST /analyze-shift?shift_id=<id>
  → Reads transcription from MongoDB
  → Runs FatigueAgent + SafetyAgent + SummarizerAgent (via Ollama)
  → Updates shift document with results (status: "completed")

GET /shifts/<id>
  → Returns full shift report including AI analysis
```

---

## Troubleshooting

**Backend cannot connect to MongoDB**
Confirm `MONGO_URI` is set and MongoDB is reachable. On OpenShift, verify the service name resolves: `oc get svc -n atc-transcript-analyzer`.

**AI agents time out or return errors**
Ollama must be running and the `llama3.2:3b` model must be pulled. Check `OLLAMA_BASE_URL` points to the correct host. The default timeout in `agents.py` is 120 seconds — large transcripts may exceed this.

**Frontend shows no data / API errors**
Confirm `VITE_API_URL` is set to the correct backend address and port (`8001` by default). Because this value is baked in at Vite build time, changing the env var requires a rebuild and redeployment.

**OpenShift Route not reachable**
Verify TLS termination. The route manifest uses `edge` termination (HTTPS at the router, HTTP to the pod). Ensure your cluster's default router certificate is trusted, or configure a custom cert in the Route spec.

**Whisper transcription is slow**
Whisper runs CPU-only by default. The `base` model is used in production code. Switching to `tiny` (`model_name="tiny"` in `api.py`) reduces accuracy but improves speed significantly on CPU-only nodes.

**Image pull errors on OpenShift**
If using `imagePullPolicy: IfNotPresent` with a locally-built image, the image must exist on the node or be pushed to a registry the cluster can reach. For OpenShift builds (`oc new-build`), the image is stored in the internal registry automatically.
