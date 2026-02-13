# OpenShift / Kubernetes Deployment

Build, deploy, and run the ATC Transcript Analyzer frontend on OpenShift or Kubernetes.

## Prerequisites

- Docker (or Podman) for building the image
- OpenShift CLI (`oc`) or Kubernetes CLI (`kubectl`)
- Access to an OpenShift cluster or Kubernetes cluster

## Build the image

From the **frontend** directory (same directory as this `openshift/` folder and the `Dockerfile`):

```bash
cd frontend
docker build -t atc-frontend:latest .
```

Or from the repository root:

```bash
docker build -t atc-frontend:latest -f frontend/Dockerfile frontend
```

With an internal OpenShift registry (replace with your registry and namespace):

```bash
docker build -t image-registry.openshift-image-registry.svc:5000/atc-transcript-analyzer/atc-frontend:latest .
docker push image-registry.openshift-image-registry.svc:5000/atc-transcript-analyzer/atc-frontend:latest
```

Or use OpenShift BuildConfig for in-cluster builds (from frontend directory):

```bash
oc new-build --name atc-frontend --binary --strategy=docker
oc start-build atc-frontend --from-dir=. --follow
```

## Deploy on OpenShift

### 1. Create namespace (if needed)

```bash
oc create namespace atc-transcript-analyzer
```

### 2. Apply manifests

**Option A – Apply files directly**

From the frontend directory:

```bash
oc apply -f openshift/deployment.yaml -n atc-transcript-analyzer
oc apply -f openshift/service.yaml -n atc-transcript-analyzer
oc apply -f openshift/route.yaml -n atc-transcript-analyzer
```

From the repository root:

```bash
oc apply -f frontend/openshift/deployment.yaml -n atc-transcript-analyzer
oc apply -f frontend/openshift/service.yaml -n atc-transcript-analyzer
oc apply -f frontend/openshift/route.yaml -n atc-transcript-analyzer
```

**Option B – Use Kustomize**

From the frontend directory:

```bash
kubectl apply -k openshift/ -n atc-transcript-analyzer
# or
oc apply -k openshift/ -n atc-transcript-analyzer
```

From the repository root:

```bash
kubectl apply -k frontend/openshift/ -n atc-transcript-analyzer
```

**Option C – Standalone Pod (development only)**

```bash
oc apply -f openshift/pod.yaml -n atc-transcript-analyzer
```

### 3. Set image (if not using in-cluster build)

If the Deployment uses `atc-frontend:latest` and the image is in the cluster registry:

```bash
oc set image deployment/atc-frontend frontend=image-registry.openshift-image-registry.svc:5000/atc-transcript-analyzer/atc-frontend:latest -n atc-transcript-analyzer
```

### 4. Get the Route URL

```bash
oc get route atc-frontend -n atc-transcript-analyzer
```

Open the `HOST/PORT` URL in a browser.

## Deploy on Kubernetes (no Route)

Kubernetes does not have the `Route` type. Use a Service and optionally an Ingress:

```bash
kubectl create namespace atc-transcript-analyzer
kubectl apply -f openshift/deployment.yaml -n atc-transcript-analyzer
kubectl apply -f openshift/service.yaml -n atc-transcript-analyzer
```

Then expose the service (examples):

```bash
# LoadBalancer (cloud)
kubectl patch svc atc-frontend -n atc-transcript-analyzer -p '{"spec": {"type": "LoadBalancer"}}'

# Or add an Ingress resource for your ingress controller
```

## Artifacts

| File               | Description |
|--------------------|-------------|
| `deployment.yaml`  | Deployment (manages Pods and ReplicaSet) |
| `service.yaml`     | ClusterIP Service (in-cluster access) |
| `route.yaml`       | OpenShift Route (external HTTPS URL) |
| `pod.yaml`         | Standalone Pod (optional, e.g. for dev/debug) |
| `kustomization.yaml` | Kustomize wiring for deployment + service + route |

## Health check

Liveness and readiness probes use the root path `/` on port 3000. The app is considered healthy when the main page responds.

## Notes

- The app listens on port **3000**.
- Route uses edge TLS; adjust `route.yaml` if you need passthrough or different TLS.
- For production, use a specific image tag and pull policy (e.g. `imagePullPolicy: Always`).
