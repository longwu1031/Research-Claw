#!/usr/bin/env bash
#
# E2E Test Script for Research-Claw
#
# Waits for the gateway to be ready, then runs the full E2E test suite.
#
# Usage:
#   ./scripts/e2e-test.sh [--port 28789] [--timeout 30000] [--verbose]
#
# Prerequisites:
#   - Node.js >= 22
#   - Gateway running (pnpm start) OR this script will attempt to wait for it
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

PORT="${PORT:-28789}"
MAX_WAIT=60  # seconds to wait for gateway

echo "=== Research-Claw E2E Test ==="
echo "Project root: $PROJECT_ROOT"
echo "Gateway port: $PORT"
echo ""

# 1. Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "none")
echo "Node.js: $NODE_VERSION"

if [[ "$NODE_VERSION" == "none" ]]; then
  echo "ERROR: Node.js not found. Please install Node.js >= 22."
  exit 2
fi

# 2. Wait for gateway to be ready (poll with curl or WebSocket)
echo ""
echo "Checking gateway readiness at ws://127.0.0.1:$PORT ..."

WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  # Try a quick TCP connection check
  if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
    echo "Gateway is ready (port $PORT is open)."
    break
  fi

  echo "  Waiting... ($WAITED/${MAX_WAIT}s)"
  sleep 2
  WAITED=$((WAITED + 2))
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo ""
  echo "ERROR: Gateway not ready after ${MAX_WAIT}s."
  echo "  Start the gateway first: cd $PROJECT_ROOT && pnpm start"
  exit 2
fi

# 3. Run the E2E test suite
echo ""
echo "Running E2E tests..."
echo ""

node "$SCRIPT_DIR/e2e-test.mjs" "$@"
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "All E2E tests passed."
elif [ $EXIT_CODE -eq 1 ]; then
  echo "Some E2E tests failed."
elif [ $EXIT_CODE -eq 2 ]; then
  echo "E2E test runner could not connect to gateway."
fi

exit $EXIT_CODE
