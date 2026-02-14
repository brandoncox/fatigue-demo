# ATC Transcript Analyzer – Backend API

FastAPI backend for the ATC Transcript Analyzer. It runs analysis jobs (transcription → fatigue/safety agents → reports) and uses **Ollama** with the **llama3.2:3b** model for AI analysis.

## Features

- **POST /analyze-shift** – Start an analysis job for a shift (runs in background).
- **GET /report/{shift_id}** – Return the analysis report for a shift.
- **Agents** – Fatigue detection, safety analysis, and shift summarization (all via Ollama).

## Local development

### Prerequisites

- **Python 3.10+**
- **Ollama** with the `llama3.2:3b` model
- (Optional) AWS credentials and S3 access if you use real S3/transcribe logic

### 1. Ollama

Install [Ollama](https://ollama.com) and pull the model:

```bash
ollama pull llama3.2:3b
ollama run llama3.2:3b   # optional: verify it runs
```

Keep Ollama running so the API can reach it at `http://localhost:11434`.

### 2. Virtual environment and dependencies

From the `backend-api` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run the API

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: **http://localhost:8000**
- Docs: **http://localhost:8000/docs**

### Environment variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL (set in `agents.py` or override via code) |
| AWS credentials | — | For S3 / transcription if you implement those calls |

---

## Deploy on OpenShift

You need a container image and OpenShift manifests (Deployment, Service, Route). The steps below assume you add a **Dockerfile** and an **openshift/** folder (e.g. with `deployment.yaml`, `service.yaml`, `route.yaml`) similar to the frontend.

### 1. Build the image

With a Dockerfile in `backend-api`:

```bash
cd backend-api
docker build -t atc-backend:latest .
```

From the repo root:

```bash
docker build -t atc-backend:latest -f backend-api/Dockerfile backend-api
```

### 2. Push to the OpenShift registry

```bash
# Log in and push (replace with your cluster registry and namespace)
oc whoami
docker tag atc-backend:latest image-registry.openshift-image-registry.svc:5000/atc-transcript-analyzer/atc-backend:latest
docker push image-registry.openshift-image-registry.svc:5000/atc-transcript-analyzer/atc-backend:latest
```

Or use a binary build:

```bash
oc new-build --name atc-backend --binary --strategy=docker
oc start-build atc-backend --from-dir=backend-api --follow
```

### 3. Create namespace and deploy

```bash
oc create namespace atc-transcript-analyzer
oc apply -f openshift/deployment.yaml -n atc-transcript-analyzer
oc apply -f openshift/service.yaml -n atc-transcript-analyzer
oc apply -f openshift/route.yaml -n atc-transcript-analyzer
```

### 4. Configure Ollama for the backend

The backend calls Ollama over HTTP. On OpenShift you can:

- **Option A** – Run Ollama elsewhere (e.g. another service or cluster) and set the backend’s `OLLAMA_BASE_URL` to that URL (e.g. via ConfigMap/Secret and env in the Deployment).
- **Option B** – Run Ollama as a separate Deployment/Service in the same namespace and set `OLLAMA_BASE_URL` to the Ollama Service URL (e.g. `http://ollama:11434`).

### 5. Get the API URL

```bash
oc get route atc-backend -n atc-transcript-analyzer
```

Use the Route host in the frontend (e.g. `VITE_API_URL` or proxy) so the UI talks to this API.

### Notes for OpenShift

- Expose the API on a single port (e.g. **8000**) and point the Deployment/Service/Route at it.
- Set **liveness/readiness** probes to an HTTP path (e.g. `/docs` or a small `/health` endpoint if you add one).
- Provide **OLLAMA_BASE_URL** (and any AWS credentials) via environment or ConfigMap/Secret in the Deployment.
