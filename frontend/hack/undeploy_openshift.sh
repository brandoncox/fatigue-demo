#!/usr/bin/env bash
set -euo pipefail

# Remove the ATC Transcript Analyzer frontend from an OpenShift cluster.
# Run from the frontend directory or from the frontend/hack/ directory.
# Prerequisites: oc CLI, logged into the OpenShift cluster.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NAMESPACE="${NAMESPACE:-atc-transcript-analyzer}"

if ! command -v oc &>/dev/null; then
  echo "Error: oc CLI not found. Install the OpenShift CLI and try again." >&2
  exit 1
fi

echo "Removing application from namespace: $NAMESPACE"

# Delete Route, Service, and Deployment (order not required; OpenShift will cascade)
if oc get route atc-frontend -n "$NAMESPACE" &>/dev/null; then
  echo "Deleting Route atc-frontend ..."
  oc delete route atc-frontend -n "$NAMESPACE"
fi

if oc get service atc-frontend -n "$NAMESPACE" &>/dev/null; then
  echo "Deleting Service atc-frontend ..."
  oc delete service atc-frontend -n "$NAMESPACE"
fi

if oc get deployment atc-frontend -n "$NAMESPACE" &>/dev/null; then
  echo "Deleting Deployment atc-frontend ..."
  oc delete deployment atc-frontend -n "$NAMESPACE"
fi

# Optional: delete standalone Pod if it exists (dev/debug)
if oc get pod atc-frontend-pod -n "$NAMESPACE" &>/dev/null; then
  echo "Deleting Pod atc-frontend-pod ..."
  oc delete pod atc-frontend-pod -n "$NAMESPACE"
fi

echo "Application removed from $NAMESPACE."
echo ""
echo "To delete the namespace as well, run:"
echo "  oc delete namespace $NAMESPACE"
