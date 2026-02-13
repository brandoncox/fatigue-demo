#!/usr/bin/env bash
set -euo pipefail

# Deploy the ATC Transcript Analyzer frontend to OpenShift.
# Run from the frontend directory or from the frontend/hack/ directory.
# Prerequisites: oc CLI, logged into an OpenShift cluster.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENSHIFT_DIR="$FRONTEND_DIR/openshift"
NAMESPACE="${NAMESPACE:-atc-transcript-analyzer}"

if ! command -v oc &>/dev/null; then
  echo "Error: oc CLI not found. Install the OpenShift CLI and try again." >&2
  exit 1
fi

if [[ ! -d "$OPENSHIFT_DIR" ]]; then
  echo "Error: OpenShift manifests not found at $OPENSHIFT_DIR" >&2
  exit 1
fi

echo "Using namespace: $NAMESPACE"
echo "Manifests: $OPENSHIFT_DIR"

# Create namespace if it does not exist
if ! oc get namespace "$NAMESPACE" &>/dev/null; then
  echo "Creating namespace $NAMESPACE ..."
  oc create namespace "$NAMESPACE"
else
  echo "Namespace $NAMESPACE already exists."
fi

# Apply Deployment, Service, and Route
echo "Applying manifests ..."
oc apply -f "$OPENSHIFT_DIR/deployment.yaml" -n "$NAMESPACE"
oc apply -f "$OPENSHIFT_DIR/service.yaml" -n "$NAMESPACE"
oc apply -f "$OPENSHIFT_DIR/route.yaml" -n "$NAMESPACE"

echo "Deployment complete."
echo ""
echo "Get the Route URL with:"
echo "  oc get route atc-frontend -n $NAMESPACE"
