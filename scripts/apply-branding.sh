#!/usr/bin/env bash
# Regenerate pnpm patch for Research-Claw branding
#
# This script modifies the installed openclaw package in node_modules
# and generates a pnpm patch file.
#
# Branding scope (per docs/02-engineering-architecture.md Section 14):
#   - Process title: openclaw -> research-claw
#   - Version output: OpenClaw -> Research-Claw
#   - Error prefixes: [openclaw] -> [research-claw]
#   - Legacy daemon CLI messages: OpenClaw -> Research-Claw
#
# Usage:
#   ./scripts/apply-branding.sh
#
# Prerequisites:
#   - pnpm install must have been run first
#   - openclaw must be in node_modules/
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Generating Research-Claw branding patch ==="

# 1. Check openclaw is installed
if [ ! -d "node_modules/openclaw" ]; then
  echo "ERROR: node_modules/openclaw not found. Run 'pnpm install' first."
  exit 1
fi

VERSION=$(node -e "console.log(require('./node_modules/openclaw/package.json').version)")
PATCH_DIR="patches"
PATCH_FILE="${PATCH_DIR}/openclaw@${VERSION}.patch"

echo "OpenClaw version: $VERSION"
echo "Patch target: $PATCH_FILE"

# 2. Check if patch already exists
if [ -f "$PATCH_FILE" ]; then
  echo "Patch file already exists: $PATCH_FILE"
  echo "To regenerate, delete it first, then re-run this script."
  echo "Applying existing patch via pnpm install..."
  pnpm install
  echo "=== Done (existing patch applied) ==="
  exit 0
fi

# 3. Create patches directory if needed
mkdir -p "$PATCH_DIR"

# 4. Apply branding replacements to installed package
OC_DIR="node_modules/openclaw"
ENTRY_FILE="$OC_DIR/dist/entry.js"
DAEMON_FILE="$OC_DIR/dist/cli/daemon-cli.js"

if [ ! -f "$ENTRY_FILE" ]; then
  echo "ERROR: $ENTRY_FILE not found. OpenClaw package structure may have changed."
  exit 1
fi

echo "Applying branding to $ENTRY_FILE ..."

# Process title
sed -i.bak 's/process\$1\.title = "openclaw"/process$1.title = "research-claw"/' "$ENTRY_FILE"

# Version output: OpenClaw -> Research-Claw
sed -i.bak 's/`OpenClaw /`Research-Claw /g' "$ENTRY_FILE"

# Error prefixes: [openclaw] -> [research-claw]
sed -i.bak 's/\[openclaw\]/[research-claw]/g' "$ENTRY_FILE"

# Clean up sed backup files
find "$OC_DIR/dist" -name '*.bak' -delete 2>/dev/null || true

# Daemon CLI messages
if [ -f "$DAEMON_FILE" ]; then
  echo "Applying branding to $DAEMON_FILE ..."
  sed -i.bak 's/Please upgrade OpenClaw/Please upgrade Research-Claw/g' "$DAEMON_FILE"
  find "$OC_DIR/dist/cli" -name '*.bak' -delete 2>/dev/null || true
fi

# 5. Generate patch via pnpm
echo "Generating patch..."
pnpm patch-commit "$OC_DIR" --patch-dir "$PATCH_DIR"

echo ""
echo "=== Patch generated: $PATCH_FILE ==="
echo "The patch will be auto-applied on 'pnpm install'."
echo "Commit the patch file to version control."
