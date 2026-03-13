#!/usr/bin/env bash
# Auto-restart wrapper for Research-Claw gateway.
# The gateway sends itself SIGUSR1 after config changes (API key, model, etc.)
# and exits, expecting an external supervisor to restart it.
#
# Usage:  ./scripts/run.sh          (or: pnpm serve)
# Stop:   Ctrl+C

cd "$(dirname "$0")/.."

STOP=false
trap 'STOP=true' INT TERM

while true; do
  echo "[run] Starting Research-Claw gateway..."
  pnpm start
  CODE=$?

  if $STOP; then
    echo "[run] Stopped."
    exit 0
  fi

  echo "[run] Gateway exited (code $CODE) — restarting in 1s..."
  sleep 1
done
