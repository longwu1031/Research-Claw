#!/usr/bin/env bash
# Auto-restart wrapper for Research-Claw gateway.
# The gateway sends itself SIGUSR1 after config changes (API key, model, etc.)
# and exits, expecting an external supervisor to restart it.
#
# Usage:  ./scripts/run.sh          (or: pnpm serve)
# Stop:   Ctrl+C

cd "$(dirname "$0")/.."

# --- Ensure project config exists ---
# RC project config contains plugin paths, tool whitelist, dashboard root, port 28789.
# Global ~/.openclaw/openclaw.json is vanilla OpenClaw and MUST NOT override these.
if [ ! -f config/openclaw.json ]; then
  if [ -f config/openclaw.example.json ]; then
    cp config/openclaw.example.json config/openclaw.json
    echo "[run] Config bootstrapped from template"
  else
    echo "[run] ERROR: config/openclaw.example.json not found" >&2
    exit 1
  fi
fi

# Always point OpenClaw to the project config.
# Without this, it reads ~/.openclaw/openclaw.json which has no RC settings.
export OPENCLAW_CONFIG_PATH=./config/openclaw.json

# --- Detect the correct Node for the gateway ---
# Priority: conda openclaw env (has matching ABI for better-sqlite3) → system node
GW_NODE="node"
if command -v conda &>/dev/null; then
  CONDA_OC_PREFIX="$(conda env list 2>/dev/null | grep "^openclaw " | awk '{print $NF}')"
  if [ -n "$CONDA_OC_PREFIX" ] && [ -x "$CONDA_OC_PREFIX/bin/node" ]; then
    GW_NODE="$CONDA_OC_PREFIX/bin/node"
  fi
fi

echo "[run] Using Node: $GW_NODE ($("$GW_NODE" -v))"
echo "[run] Config: $OPENCLAW_CONFIG_PATH"

# Sync RC settings → ~/.openclaw/openclaw.json so `openclaw gateway --force` also works.
"$GW_NODE" "$(dirname "$0")/sync-global-config.cjs" 2>/dev/null || true

STOP=false
trap 'STOP=true' INT TERM

while true; do
  echo "[run] Starting Research-Claw gateway..."
  "$GW_NODE" ./node_modules/openclaw/dist/entry.js \
    gateway run --allow-unconfigured --auth none --port 28789 --force
  CODE=$?

  if $STOP; then
    echo "[run] Stopped."
    exit 0
  fi

  echo "[run] Gateway exited (code $CODE) — restarting in 1s..."
  sleep 1
done
