#!/usr/bin/env bash
# Research-Claw First-Run Setup
# Interactive prompts for API provider, key, model, proxy.
#
# Full logic defined in docs/06-install-startup-design.md
set -euo pipefail

echo "=== Research-Claw Setup ==="

# 1. API Provider selection
echo "Select your API provider:"
echo "  1) Anthropic (Claude)"
echo "  2) OpenAI (GPT)"
echo "  3) Other (manual config)"
read -rp "Choice [1]: " PROVIDER_CHOICE
PROVIDER_CHOICE="${PROVIDER_CHOICE:-1}"

# 2. API Key
case "$PROVIDER_CHOICE" in
  1) read -rp "Anthropic API Key: " API_KEY
     echo "ANTHROPIC_API_KEY=$API_KEY" > .env
     ;;
  2) read -rp "OpenAI API Key: " API_KEY
     echo "OPENAI_API_KEY=$API_KEY" > .env
     ;;
  3) echo "Edit .env manually with your provider's key."
     cp .env.example .env
     ;;
esac

# 3. Proxy (optional)
read -rp "HTTP Proxy (blank to skip, e.g., http://127.0.0.1:7890): " PROXY
if [ -n "$PROXY" ]; then
  echo "HTTP_PROXY=$PROXY" >> .env
  echo "HTTPS_PROXY=$PROXY" >> .env
fi

# 4. Ensure config exists
if [ ! -f config/openclaw.json ]; then
  cp config/openclaw.example.json config/openclaw.json
  echo "Created config/openclaw.json from template."
fi

# 5. Validate connection
# TODO: Test API key validity

echo ""
echo "=== Setup complete ==="
echo "Start Research-Claw with: pnpm start"
echo "Dashboard will be at: http://127.0.0.1:28789"
