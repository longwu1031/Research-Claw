#!/usr/bin/env bash
# Research-Claw One-Click Install (macOS/Linux)
# Usage: curl -fsSL https://wentor.ai/install-claw.sh | bash
#        or: ./scripts/install.sh
set -euo pipefail

echo "=== Research-Claw Installer ==="
echo ""

# 1. Detect OS/arch
OS="$(uname -s)"
ARCH="$(uname -m)"
echo "Platform: $OS/$ARCH"

# 2. Check Node.js >= 22
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install Node.js >= 22.12 first."
  echo "  Visit: https://nodejs.org/"
  exit 1
fi

NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
echo "Node.js: v$NODE_VERSION"

if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "ERROR: Node.js >= 22.12 required, found v$NODE_VERSION"
  echo "  Visit: https://nodejs.org/"
  exit 1
fi

# 3. Check/install pnpm
if ! command -v pnpm &>/dev/null; then
  echo "pnpm not found. Installing..."
  npm install -g pnpm@latest
fi
echo "pnpm: $(pnpm -v)"

# 4. Check git
if ! command -v git &>/dev/null; then
  echo "ERROR: git is required but not found."
  exit 1
fi

# 5. Clone repo (if running from curl pipe)
INSTALL_DIR="research-claw"
if [ ! -f "package.json" ] || ! grep -q '"research-claw"' package.json 2>/dev/null; then
  if [ -d "$INSTALL_DIR" ]; then
    echo "Directory '$INSTALL_DIR' already exists. Updating..."
    cd "$INSTALL_DIR"
    git pull --rebase
  else
    echo "Cloning research-claw..."
    git clone https://github.com/wentorai/research-claw.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
fi

# 6. Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install

# 7. Copy config template if needed
if [ ! -f "config/openclaw.json" ] && [ -f "config/openclaw.example.json" ]; then
  cp config/openclaw.example.json config/openclaw.json
  echo "Created config/openclaw.json from template."
fi

# 8. Build dashboard
echo ""
echo "Building dashboard..."
pnpm --filter @research-claw/dashboard build 2>/dev/null || pnpm --filter dashboard build 2>/dev/null || true

echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Run 'pnpm setup' to configure your API key"
echo "  2. Run 'pnpm start' to launch Research-Claw"
echo "  3. Dashboard: http://127.0.0.1:18789"
