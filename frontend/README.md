# ATC Transcript Analyzer - Frontend

React-based web dashboard for the ATC Transcript Analyzer prototype.

## Features

- **Shift Selection**: Browse and filter available shifts by facility, date, and controller
- **Analysis Results**: View detailed fatigue and safety analysis reports
- **Transcript Viewer**: Review full transcripts with AI-annotated fatigue indicators
- **Timeline Visualization**: See fatigue trends over the course of a shift

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Recharts for data visualization
- Lucide React for icons

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/          # Page components (routes)
│   ├── types/          # TypeScript type definitions
│   ├── data/           # Mock data (replace with API calls)
│   ├── App.tsx         # Main app component with routing
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── hack/               # Scripts: deploy_openshift.sh, undeploy_openshift.sh
├── openshift/          # OpenShift/Kubernetes manifests (Deployment, Service, Route)
├── public/             # Static assets
├── Dockerfile          # Container build (build + serve with Node)
└── package.json        # Dependencies and scripts
```

## Docker and OpenShift

The **Dockerfile** is in this directory. OpenShift/Kubernetes manifests (Deployment, Service, Route, Pod) are in the **openshift/** folder. Use the **hack/** scripts to deploy or remove the app from OpenShift:

```bash
./hack/deploy_openshift.sh    # deploy (run from frontend directory)
./hack/undeploy_openshift.sh  # remove from cluster
```

### Prerequisites

- Docker (or Podman) for building the image
- OpenShift CLI (`oc`) or Kubernetes CLI (`kubectl`)
- Access to an OpenShift or Kubernetes cluster

### Build the image

From the **frontend** directory:

```bash
docker build -t atc-frontend:latest .
```

From the repository root:

```bash
docker build -t atc-frontend:latest -f frontend/Dockerfile frontend
```

### Deploy on OpenShift

1. **Create namespace** (if needed):

   ```bash
   oc create namespace atc-transcript-analyzer
   ```

2. **Create and Start builds**

   ```bash
   oc new-build --name atc-frontend --binary --strategy=docker
   oc start-build atc-frontend --from-dir=. --follow
   ```

2. **Apply manifests** from the frontend directory:

   ```bash
   oc apply -f openshift/deployment.yaml -n atc-transcript-analyzer
   oc apply -f openshift/service.yaml -n atc-transcript-analyzer
   oc apply -f openshift/route.yaml -n atc-transcript-analyzer
   ```
   
4. **Get the Route URL**:

   ```bash
   oc get route atc-frontend -n atc-transcript-analyzer
   ```

The app listens on port **3000**. Liveness and readiness probes use path `/`.

## Pages

- `/` - Shift Selection screen
- `/shift/:shiftId` - Analysis Results screen
- `/shift/:shiftId/transcript` - Transcript Viewer

## API Integration

Currently uses mock data. To integrate with the backend API:

1. Update `src/data/mockData.ts` to fetch from API endpoints
2. Replace mock data imports in components with API calls
3. Add error handling and loading states

Expected API endpoints:
- `GET /api/shifts` - List available shifts
- `GET /api/shifts/:shiftId` - Get shift analysis report
- `GET /api/shifts/:shiftId/transcript` - Get full transcript
- `POST /api/shifts/:shiftId/analyze` - Trigger analysis

## Environment Variables

Create a `.env` file for API configuration:

```
VITE_API_URL=http://localhost:8000
```
