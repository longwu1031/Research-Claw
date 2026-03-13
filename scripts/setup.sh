#!/usr/bin/env bash
# Research-Claw First-Run Setup
# Creates config from template and launches Setup Wizard in browser.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT=28789

echo "=== Research-Claw Setup ==="

# 1. Ensure config exists
if [ ! -f config/openclaw.json ]; then
  if [ -f config/openclaw.example.json ]; then
    cp config/openclaw.example.json config/openclaw.json
    echo "[OK] Config created from template"
  else
    echo "[ERROR] config/openclaw.example.json not found. Is the project intact?"
    exit 1
  fi
else
  echo "[OK] Config already exists"
fi

# 2. Proxy (optional)
read -rp "HTTP Proxy (leave blank to skip, e.g. http://127.0.0.1:7890): " PROXY
if [ -n "$PROXY" ]; then
  echo "To apply proxy, edit config/openclaw.json and add:"
  echo "  \"env\": { \"vars\": { \"HTTP_PROXY\": \"$PROXY\", \"HTTPS_PROXY\": \"$PROXY\" } }"
  echo ""
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Run: pnpm start"
echo "  2. Open: http://127.0.0.1:$PORT"
echo "  3. Follow the Setup Wizard to configure your LLM API Key"
echo ""
echo "All settings are managed in the browser — no config files to edit."
