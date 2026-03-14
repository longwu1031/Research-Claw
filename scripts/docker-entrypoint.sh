#!/bin/sh
# Research-Claw Docker entrypoint with auto-restart.
# Gateway exits on SIGUSR1 after config save — this loop restarts it.

# Seed config on first run
if [ ! -f /app/config/openclaw.json ]; then
  mkdir -p /app/config
  cp /defaults/openclaw.example.json /app/config/openclaw.json
  echo "[research-claw] Config initialized from template — open http://localhost:28789 to complete setup"
fi

STOP=false
trap 'STOP=true' INT TERM

while true; do
  OPENCLAW_CONFIG_PATH=/app/config/openclaw.json \
    node /app/node_modules/openclaw/dist/entry.js \
    gateway run --allow-unconfigured --auth none --port 28789 --host 0.0.0.0 --force
  CODE=$?

  if [ "$STOP" = "true" ]; then
    exit 0
  fi

  echo "[research-claw] Gateway exited (code $CODE) — restarting in 1s..."
  sleep 1
done
