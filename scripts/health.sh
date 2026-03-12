#!/usr/bin/env bash
# Research-Claw health check — verify gateway HTTP + WS connectivity
#
# Full logic defined in docs/06-install-startup-design.md
set -euo pipefail

PORT="${1:-28789}"
BASE="http://127.0.0.1:${PORT}"

echo "=== Research-Claw Health Check ==="
echo "Gateway: $BASE"

# HTTP check
if curl -sf "$BASE/socket.io/config.json" > /dev/null 2>&1; then
  echo "[OK] HTTP endpoint responsive"
  curl -sf "$BASE/socket.io/config.json" | python3 -m json.tool 2>/dev/null || true
else
  echo "[FAIL] HTTP endpoint not responding"
  exit 1
fi

# WS check (basic TCP)
if command -v nc &>/dev/null; then
  if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
    echo "[OK] TCP port $PORT open"
  else
    echo "[FAIL] TCP port $PORT closed"
    exit 1
  fi
fi

echo ""
echo "Gateway is healthy."
