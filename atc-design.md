# ATC Transcript Analyzer - Simplified Prototype Design

## Executive Summary

A streamlined prototype for supervisors to analyze pre-recorded ATC-pilot communications stored in S3. This system uses agentic AI and LLMs to identify fatigue indicators, safety risks, and communication patterns without requiring real-time infrastructure.

---

## 1. Prototype Overview

### 1.1 Simplified Scope
**What this prototype does:**
- Batch analysis of audio files from S3
- Automated transcription and fatigue detection
- Generate supervisor reports with actionable insights
- Interactive web dashboard for reviewing results
- Pattern analysis across multiple shifts

**What we're NOT building (for prototype):**
- Real-time streaming analysis
- Complex multi-facility coordination
- Production-grade scalability
- Mobile apps
- Predictive analytics (focus on descriptive analysis)

### 1.2 Core User Flow

```
1. Supervisor selects shift/controller → 
2. System retrieves audio from S3 → 
3. Transcribes audio to text →
4. AI agents analyze transcripts →
5. Generate report with findings →
6. Display in dashboard
```

---

## 2. Simplified Architecture

```
┌─────────────────────────────────────────────────────┐
│              Web Dashboard (React)                   │
│  - Select shifts to analyze                          │
│  - View reports                                       │
│  - Browse fatigue indicators                          │
└─────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────┐
│         Backend API (FastAPI + Python)               │
│  - Job management                                    │
│  - Report generation                                 │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                  │
┌───────────────┐              ┌──────────────────────┐
│  S3 Storage   │              │   AI Processing      │
│  - Audio      │              │   - Transcription    │
│    files      │              │   - Agent Analysis   │
│  - Reports    │              │   - Claude LLM       │
└───────────────┘              └──────────────────────┘
                                          │
                               ┌──────────────────────┐
                               │   Simple Database    │
                               │   - SQLite or        │
                               │   - PostgreSQL       │
                               └──────────────────────┘
```

---

## 3. Simplified Agent System

Instead of 5 complex agents, we'll use **3 focused agents**:

### Agent 1: Fatigue Detector
**Purpose:** Identify signs of controller fatigue
**Key metrics:**
- Response time delays
- Hesitations in speech
- Simplified communications
- Time-on-duty correlation

### Agent 2: Safety Analyzer  
**Purpose:** Flag potential safety issues
**Key metrics:**
- Readback errors
- Unclear instructions
- Phraseology violations
- Missed acknowledgments

### Agent 3: Shift Summarizer
**Purpose:** Create readable reports for supervisors
**Outputs:**
- Executive summary
- Timeline of key events
- Prioritized recommendations
- Fatigue score trend

---

## 4. Data Flow

### 4.1 Input Data Structure

```
S3 Bucket: atc-recordings/
├── facility_001/
│   ├── 2024-01-15/
│   │   ├── controller_123_shift_morning.wav
│   │   ├── controller_123_shift_morning.json  # metadata
│   │   ├── controller_456_shift_afternoon.wav
│   │   └── ...
│   └── 2024-01-16/
└── ...

Metadata JSON format:
{
  "shift_id": "shift_20240115_001",
  "controller_id": "CTR_123",
  "facility": "facility_001",
  "start_time": "2024-01-15T06:00:00Z",
  "end_time": "2024-01-15T14:00:00Z",
  "position": "tower",
  "schedule_type": "2-2-1",
  "traffic_count_avg": 8
}
```

### 4.2 Processing Pipeline

```python
# Simplified processing flow

async def analyze_shift(shift_id: str):
    """Main processing function"""
    
    # Step 1: Get audio from S3
    audio_file = await s3_client.download(shift_id)
    metadata = await s3_client.get_metadata(shift_id)
    
    # Step 2: Transcribe
    transcript = await transcribe_audio(audio_file)
    # Returns: List of {timestamp, speaker, text, confidence}
    
    # Step 3: Run 3 agents in parallel
    results = await asyncio.gather(
        fatigue_agent.analyze(transcript, metadata),
        safety_agent.analyze(transcript, metadata),
        summarizer_agent.analyze(transcript, metadata, fatigue_result, safety_result)
    )
    
    # Step 4: Combine results
    final_report = {
        "shift_id": shift_id,
        "fatigue_analysis": results[0],
        "safety_analysis": results[1],
        "summary": results[2],
        "generated_at": datetime.now()
    }
    
    # Step 5: Save to database
    await db.save_report(final_report)
    
    # Step 6: Upload report to S3
    await s3_client.upload_report(final_report)
    
    return final_report
```

---

## 5. Core Implementation

### 5.1 Fatigue Detection Agent (Simplified)

```python
from anthropic import Anthropic

class FatigueAgent:
    """Simple fatigue detection agent"""
    
    def __init__(self):
        self.client = Anthropic()
        
    async def analyze(self, transcript: List[Dict], metadata: Dict) -> Dict:
        """Analyze transcript for fatigue indicators"""
        
        # Calculate basic metrics
        response_times = self._calculate_response_times(transcript)
        hesitation_count = self._count_hesitations(transcript)
        hours_on_duty = self._get_hours_on_duty(metadata)
        
        # Build simple prompt for Claude
        prompt = f"""Analyze this air traffic controller shift for fatigue:

SHIFT CONTEXT:
- Duration: {hours_on_duty} hours
- Time started: {metadata['start_time']}
- Schedule: {metadata['schedule_type']}
- Position: {metadata['position']}

PERFORMANCE METRICS:
- Average response time: {response_times['avg']:.1f} seconds
- Hesitations detected: {hesitation_count}
- Total transmissions: {len(transcript)}

SAMPLE TRANSMISSIONS:
{self._format_samples(transcript, num_samples=10)}

Provide a fatigue assessment with:
1. Fatigue score (0-100)
2. Top 3 concerning indicators with evidence
3. Whether this requires supervisor attention

Format as JSON:
{{
  "fatigue_score": <number>,
  "severity": "low|medium|high|critical",
  "indicators": [
    {{"type": "...", "evidence": "...", "timestamp": "..."}}
  ],
  "requires_attention": <boolean>,
  "summary": "brief explanation"
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Parse response
        result = self._extract_json(response.content[0].text)
        
        # Add calculated metrics
        result['metrics'] = {
            'avg_response_time': response_times['avg'],
            'max_response_time': response_times['max'],
            'hesitation_count': hesitation_count,
            'hours_on_duty': hours_on_duty
        }
        
        return result
    
    def _calculate_response_times(self, transcript: List[Dict]) -> Dict:
        """Calculate controller response times"""
        times = []
        for i in range(len(transcript) - 1):
            if transcript[i]['speaker'] == 'pilot':
                if transcript[i+1]['speaker'] == 'controller':
                    delta = transcript[i+1]['timestamp'] - transcript[i]['timestamp']
                    times.append(delta)
        
        return {
            'avg': sum(times) / len(times) if times else 0,
            'max': max(times) if times else 0,
            'min': min(times) if times else 0
        }
    
    def _count_hesitations(self, transcript: List[Dict]) -> int:
        """Count filler words and pauses"""
        fillers = ['uh', 'um', 'er', 'ah', '...']
        count = 0
        
        for item in transcript:
            if item['speaker'] == 'controller':
                text = item['text'].lower()
                count += sum(text.count(filler) for filler in fillers)
        
        return count
    
    def _format_samples(self, transcript: List[Dict], num_samples: int = 10) -> str:
        """Format sample transmissions for prompt"""
        # Take evenly spaced samples across shift
        interval = len(transcript) // num_samples
        samples = transcript[::interval][:num_samples]
        
        formatted = []
        for s in samples:
            formatted.append(
                f"[{s['timestamp']}] {s['speaker'].upper()}: {s['text']}"
            )
        
        return "\n".join(formatted)
```

### 5.2 Safety Analysis Agent (Simplified)

```python
class SafetyAgent:
    """Simple safety risk detection"""
    
    def __init__(self):
        self.client = Anthropic()
    
    async def analyze(self, transcript: List[Dict], metadata: Dict) -> Dict:
        """Identify safety concerns"""
        
        prompt = f"""Analyze these ATC communications for safety issues:

FACILITY: {metadata['facility']}
POSITION: {metadata['position']}

FULL TRANSCRIPT:
{self._format_full_transcript(transcript)}

Identify any:
1. Readback errors (pilot reads back wrong, controller doesn't correct)
2. Unclear or ambiguous instructions
3. Missing standard phraseology
4. Potential separation issues
5. Missed acknowledgments

For each issue found, provide:
- Type of issue
- Exact quote from transcript
- Timestamp
- Severity (low/medium/high)
- Why it's concerning

Output as JSON:
{{
  "safety_score": <0-100, where 100=critical>,
  "issues_found": [
    {{
      "type": "...",
      "severity": "...",
      "timestamp": "...",
      "evidence": "exact quote",
      "concern": "explanation"
    }}
  ],
  "requires_immediate_review": <boolean>,
  "summary": "overall assessment"
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return self._extract_json(response.content[0].text)
```

### 5.3 Shift Summarizer Agent

```python
class SummarizerAgent:
    """Create readable supervisor reports"""
    
    def __init__(self):
        self.client = Anthropic()
    
    async def analyze(
        self, 
        transcript: List[Dict], 
        metadata: Dict,
        fatigue_result: Dict,
        safety_result: Dict
    ) -> Dict:
        """Generate comprehensive shift summary"""
        
        prompt = f"""Create a supervisor report for this ATC shift:

SHIFT INFO:
Controller: {metadata['controller_id']}
Date: {metadata['start_time']}
Duration: {self._get_hours(metadata)} hours
Position: {metadata['position']}
Schedule: {metadata['schedule_type']}

FATIGUE ANALYSIS:
Score: {fatigue_result['fatigue_score']}/100
Severity: {fatigue_result['severity']}
Key indicators: {fatigue_result['indicators']}

SAFETY ANALYSIS:
Score: {safety_result['safety_score']}/100
Issues found: {len(safety_result['issues_found'])}
Requires review: {safety_result['requires_immediate_review']}

Create a clear, actionable report with:

1. EXECUTIVE SUMMARY (2-3 sentences)
2. KEY FINDINGS (bullet points)
3. TIMELINE OF CONCERNS (if any critical moments)
4. RECOMMENDATIONS (specific actions for supervisor)
5. PRIORITY LEVEL (low/medium/high/urgent)

Make it practical and supervisor-friendly. Focus on what actions to take.

Output as JSON with these sections."""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2500,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return self._extract_json(response.content[0].text)
```

---

## 6. Simple Database Schema

```sql
-- SQLite is fine for prototype
-- Could upgrade to PostgreSQL later

CREATE TABLE shifts (
    shift_id TEXT PRIMARY KEY,
    controller_id TEXT NOT NULL,
    facility TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    position TEXT,
    schedule_type TEXT,
    audio_s3_path TEXT NOT NULL,
    processed_at TIMESTAMP,
    INDEX idx_controller (controller_id),
    INDEX idx_date (start_time)
);

CREATE TABLE transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    speaker TEXT NOT NULL,  -- 'controller' or 'pilot'
    text TEXT NOT NULL,
    confidence REAL,
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
);

CREATE TABLE analysis_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id TEXT NOT NULL,
    fatigue_score INTEGER,
    safety_score INTEGER,
    severity TEXT,
    requires_attention BOOLEAN,
    report_json TEXT,  -- Full JSON report
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
);

CREATE TABLE findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'fatigue' or 'safety'
    severity TEXT,
    timestamp REAL,
    evidence TEXT,
    description TEXT,
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
);
```

---

## 7. Simple Web Dashboard

### 7.1 Main Screen - Shift Selection

```
┌─────────────────────────────────────────────────────────┐
│  ATC Transcript Analyzer                    [Settings]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Select Shift to Analyze:                               │
│                                                          │
│  Facility: [Tower 001 ▼]                                │
│  Date:     [2024-01-15 📅]                              │
│  Controller: [All Controllers ▼]                        │
│                                                          │
│  [Search Shifts]                                         │
│                                                          │
│  Available Shifts:                                       │
│  ┌────────────────────────────────────────────────┐    │
│  │ ✓ CTR-123 | Morning  | 06:00-14:00 | [Analyze]│    │
│  │ ✓ CTR-123 | Evening  | 14:00-22:00 | [Analyze]│    │
│  │ ○ CTR-456 | Night    | 22:00-06:00 | [Analyze]│    │
│  │ ✓ CTR-789 | Morning  | 06:00-14:00 | [View]   │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ✓ = Already analyzed    ○ = Not yet analyzed          │
│                                                          │
│  [Batch Analyze Selected (3)]                           │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Analysis Results Screen

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Shifts      Shift Report: CTR-123 Morning    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 SUMMARY                                              │
│  ┌────────────────────────────────────────────────┐    │
│  │ Controller: CTR-123                             │    │
│  │ Date: Jan 15, 2024  |  06:00 - 14:00 (8 hours) │    │
│  │ Position: Tower     |  Schedule: 2-2-1         │    │
│  │                                                 │    │
│  │ Fatigue Score:  🟡 58/100  (Moderate)          │    │
│  │ Safety Score:   🟢 15/100  (Good)              │    │
│  │ Priority:       ⚠️  MEDIUM - Monitor Closely   │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  📋 EXECUTIVE SUMMARY                                    │
│  Controller showed increasing fatigue in final 2 hours  │
│  of shift. Response times elevated but no safety        │
│  issues detected. Recommend standard break protocol.    │
│                                                          │
│  🎯 KEY FINDINGS                                         │
│  • Response time increased 40% in hours 6-8             │
│  • 12 hesitations detected (above baseline)             │
│  • All readbacks correct, no safety violations          │
│  • Fatigue consistent with 7th consecutive day          │
│                                                          │
│  ⏱️  TIMELINE                                            │
│  [=====|=====|=====|==*==|==*==|**===]                  │
│   06:00      08:00      10:00      12:00      14:00     │
│                                ^ Fatigue increase        │
│                                                          │
│  💡 RECOMMENDATIONS                                      │
│  1. Standard break schedule adequate                    │
│  2. Consider day off before next 2-2-1 rotation         │
│  3. Monitor next shift for continued fatigue            │
│                                                          │
│  [View Full Transcript] [Export Report PDF]             │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Transcript Viewer (with annotations)

```
┌─────────────────────────────────────────────────────────┐
│  Full Transcript - CTR-123 Morning Shift                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [06:15:23] PILOT → CONTROLLER                          │
│  UAL429: "Tower, United four two niner ready for        │
│  departure runway two seven"                             │
│                                                          │
│  [06:15:25] CONTROLLER → PILOT    ⏱️ 2.0s response     │
│  CTR: "United four two niner, runway two seven,         │
│  cleared for takeoff"                                    │
│  ✓ Standard phraseology                                  │
│                                                          │
│  ...                                                     │
│                                                          │
│  [12:34:18] PILOT → CONTROLLER                          │
│  DAL892: "Tower, Delta eight nine two, ten miles        │
│  south, inbound with information Charlie"                │
│                                                          │
│  [12:34:23] CONTROLLER → PILOT    ⚠️ 5.2s response     │
│  CTR: "Delta eight... uh... nine two, tower, um,        │
│  make straight in runway two... two seven, report       │
│  three mile final"                                       │
│  🟡 Hesitations detected                                 │
│  🟡 Longer than normal response                          │
│                                                          │
│  [AI Analysis: This transmission shows signs of         │
│  fatigue - hesitations and delayed response after       │
│  6+ hours on duty. Traffic complexity was moderate.]    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Prototype Implementation Steps

### Phase 1: Core Pipeline (Week 1-2)

```python
# File: main.py - Minimal working prototype

from fastapi import FastAPI, BackgroundTasks
from anthropic import Anthropic
import boto3
import json

app = FastAPI()
anthropic_client = Anthropic()
s3_client = boto3.client('s3')

@app.post("/analyze-shift")
async def analyze_shift(shift_id: str, background_tasks: BackgroundTasks):
    """Start analysis job"""
    background_tasks.add_task(process_shift, shift_id)
    return {"status": "processing", "shift_id": shift_id}

async def process_shift(shift_id: str):
    """Main processing function"""
    try:
        # 1. Download from S3
        audio_data = download_from_s3(shift_id)
        metadata = get_shift_metadata(shift_id)
        
        # 2. Transcribe (using Deepgram or similar)
        transcript = await transcribe(audio_data)
        
        # 3. Run agents
        fatigue = await FatigueAgent().analyze(transcript, metadata)
        safety = await SafetyAgent().analyze(transcript, metadata)
        summary = await SummarizerAgent().analyze(
            transcript, metadata, fatigue, safety
        )
        
        # 4. Save results
        save_to_database({
            'shift_id': shift_id,
            'fatigue': fatigue,
            'safety': safety,
            'summary': summary
        })
        
        # 5. Upload report to S3
        upload_report_to_s3(shift_id, summary)
        
        return {"status": "complete"}
        
    except Exception as e:
        log_error(shift_id, e)
        return {"status": "failed", "error": str(e)}

@app.get("/report/{shift_id}")
async def get_report(shift_id: str):
    """Retrieve analysis report"""
    report = get_from_database(shift_id)
    return report
```

### Phase 2: Dashboard (Week 3)
- Simple React app
- Display shift list
- Show analysis results
- Basic transcript viewer

### Phase 3: Refinement (Week 4)
- Improve prompts based on testing
- Add export functionality
- Performance optimization

---

## 9. Simplified Tech Stack

### Backend
- **Python 3.11** with FastAPI
- **SQLite** for database (upgrade to PostgreSQL if needed)
- **Boto3** for S3 access
- **Anthropic Python SDK** for Claude
- **Deepgram SDK** for transcription (or AssemblyAI)

### Frontend  
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Recharts** for simple graphs
- **shadcn/ui** for components

### Infrastructure
- **AWS S3** for audio storage
- **Docker** for containerization
- **OpenShift/Kubernetes** for orchestration and deployment
- **Helm charts** for application deployment
- **ConfigMaps/Secrets** for configuration management

---

## 10. OpenShift/Kubernetes Deployment

### 10.1 Container Architecture

```yaml
# Deployment structure on OpenShift

Namespace: atc-transcript-analyzer
├── Deployments:
│   ├── api-backend (FastAPI)
│   ├── frontend (React app via nginx)
│   ├── worker (Background job processor)
│   └── database (PostgreSQL/SQLite)
├── Services:
│   ├── api-service (ClusterIP)
│   ├── frontend-service (LoadBalancer/Route)
│   └── db-service (ClusterIP)
├── ConfigMaps:
│   ├── app-config (API endpoints, settings)
│   └── agent-prompts (LLM prompt templates)
├── Secrets:
│   ├── anthropic-api-key
│   ├── aws-s3-credentials
│   └── transcription-api-key
└── PersistentVolumeClaims:
    └── database-storage
```

### 10.2 Sample Kubernetes Manifests

**Backend Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atc-api-backend
  namespace: atc-transcript-analyzer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: atc-backend
  template:
    metadata:
      labels:
        app: atc-backend
    spec:
      containers:
      - name: api
        image: atc-analyzer-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: anthropic-api-key
              key: api-key
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: aws-s3-credentials
              key: access-key
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: aws-s3-credentials
              key: secret-key
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Worker Deployment (for background processing):**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atc-worker
  namespace: atc-transcript-analyzer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: atc-worker
  template:
    metadata:
      labels:
        app: atc-worker
    spec:
      containers:
      - name: worker
        image: atc-analyzer-worker:latest
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: anthropic-api-key
              key: api-key
        - name: JOB_QUEUE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: queue-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
```

**Service & Route:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: atc-api-service
  namespace: atc-transcript-analyzer
spec:
  selector:
    app: atc-backend
  ports:
  - protocol: TCP
    port: 8000
    targetPort: 8000
  type: ClusterIP

---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: atc-api-route
  namespace: atc-transcript-analyzer
spec:
  to:
    kind: Service
    name: atc-api-service
  port:
    targetPort: 8000
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

### 10.3 Helm Chart Structure

```
atc-analyzer/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment-api.yaml
│   ├── deployment-worker.yaml
│   ├── deployment-frontend.yaml
│   ├── service-api.yaml
│   ├── service-frontend.yaml
│   ├── route-frontend.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   └── pvc.yaml
└── values/
    ├── dev.yaml
    ├── staging.yaml
    └── production.yaml
```

**Sample values.yaml:**
```yaml
# values.yaml
global:
  namespace: atc-transcript-analyzer
  
api:
  replicas: 2
  image:
    repository: your-registry/atc-api
    tag: latest
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "2Gi"
      cpu: "1000m"

worker:
  replicas: 1
  image:
    repository: your-registry/atc-worker
    tag: latest
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "4Gi"
      cpu: "2000m"

frontend:
  replicas: 2
  image:
    repository: your-registry/atc-frontend
    tag: latest

s3:
  bucket: atc-recordings
  region: us-east-1

database:
  type: postgresql  # or sqlite for prototype
  storageSize: 20Gi
```

### 10.4 CI/CD Pipeline Integration

```yaml
# Example OpenShift Pipeline (Tekton)
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: atc-analyzer-pipeline
spec:
  params:
    - name: git-url
    - name: git-revision
  workspaces:
    - name: shared-workspace
  tasks:
    - name: fetch-repository
      taskRef:
        name: git-clone
      params:
        - name: url
          value: $(params.git-url)
        - name: revision
          value: $(params.git-revision)
      workspaces:
        - name: output
          workspace: shared-workspace
    
    - name: build-api
      taskRef:
        name: buildah
      params:
        - name: IMAGE
          value: atc-analyzer-api:$(params.git-revision)
      workspaces:
        - name: source
          workspace: shared-workspace
      runAfter:
        - fetch-repository
    
    - name: deploy
      taskRef:
        name: helm-upgrade
      params:
        - name: release-name
          value: atc-analyzer
        - name: chart
          value: ./helm/atc-analyzer
      runAfter:
        - build-api
```

---

## 11. Sample Output Report

```json
{
  "shift_id": "shift_20240115_123",
  "controller_id": "CTR_123",
  "date": "2024-01-15",
  "shift_time": "06:00-14:00",
  "position": "tower",
  
  "executive_summary": "Controller demonstrated moderate fatigue in final 2 hours of 8-hour shift. Response times increased by 40% and hesitations were above baseline. No safety violations detected. Fatigue levels consistent with 7th consecutive working day on 2-2-1 schedule.",
  
  "fatigue_analysis": {
    "score": 58,
    "severity": "moderate",
    "trend": "increasing",
    "indicators": [
      {
        "type": "response_time",
        "evidence": "Average response increased from 2.1s to 3.5s in hours 6-8",
        "severity": "medium"
      },
      {
        "type": "hesitations",
        "evidence": "12 filler words detected vs baseline of 3-4",
        "severity": "medium"
      }
    ],
    "metrics": {
      "avg_response_time": 2.8,
      "hesitation_count": 12,
      "hours_on_duty": 8
    }
  },
  
  "safety_analysis": {
    "score": 15,
    "severity": "low",
    "issues_found": [],
    "requires_immediate_review": false,
    "summary": "No safety violations detected. All readbacks correct. Standard phraseology maintained throughout shift."
  },
  
  "recommendations": [
    {
      "priority": 1,
      "action": "Monitor next shift closely for continued fatigue",
      "rationale": "Fatigue increasing toward end of shift"
    },
    {
      "priority": 2,
      "action": "Consider scheduling day off before next 2-2-1 rotation",
      "rationale": "7 consecutive days may be contributing to fatigue"
    }
  ],
  
  "requires_attention": true,
  "priority_level": "medium"
}
```

---

## 12. Success Criteria for Prototype

✅ **Must Have:**
- Analyze shifts from S3 successfully
- Detect obvious fatigue indicators
- Generate readable reports
- Simple web interface to view results

✅ **Nice to Have:**
- Compare controller to their baseline
- Export reports as PDF
- Batch processing multiple shifts
- Timeline visualization

❌ **Not in Prototype:**
- Real-time analysis
- Predictive analytics
- Multi-facility coordination
- Mobile app
- Complex scheduling integration

---

## 13. Next Steps After Prototype

Once the prototype proves the concept:

1. **Gather feedback** from actual supervisors
2. **Refine prompts** based on real-world data
3. **Add baseline profiling** for controllers
4. **Build comparison features** (shift-to-shift, controller-to-controller)
5. **Consider real-time** if there's demand
6. **Scale infrastructure** for production use

---

## Conclusion

This simplified prototype focuses on **core value delivery**:
- Analyze pre-recorded shifts from S3
- Use 3 focused AI agents with Claude
- Generate actionable supervisor reports
- Simple, clean web interface
- Deploy on OpenShift/Kubernetes infrastructure

**Timeline: 4 weeks**

The prototype proves the AI analysis concept without the complexity of real-time systems, multiple facilities, or enterprise-scale features. It leverages OpenShift/Kubernetes for reliable deployment and scalability. Perfect for demonstrating value and gathering stakeholder feedback before building a full production system.
