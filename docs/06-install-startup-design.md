# C6 — Install & Startup Design

> **Scope**: Shell scripts, daemon configuration, startup sequence, and lifecycle management
> **Status**: Draft v1.0
> **Last Updated**: 2026-03-11
> **Depends On**: C2 (Engineering Architecture), C4 (Bootstrap Files)

---

## Table of Contents

1. [Overview](#1-overview)
2. [install.sh Flowchart](#2-installsh-flowchart)
3. [setup.sh — Interactive First-Run](#3-setupsh--interactive-first-run)
4. [sync-upstream.sh](#4-sync-upstreamsh)
5. [apply-branding.sh](#5-apply-brandingsh)
6. [Startup Command](#6-startup-command)
7. [Daemon Setup](#7-daemon-setup)
8. [build-dashboard.sh](#8-build-dashboardsh)
9. [backup.sh](#9-backupsh)
10. [health.sh](#10-healthsh)
11. [Uninstall Procedure](#11-uninstall-procedure)
12. [Troubleshooting Guide](#12-troubleshooting-guide)

---

## 1. Overview

Research-Claw is installed as a standalone project that consumes OpenClaw as an npm
dependency. It is **not** a fork. The satellite architecture means all customisation
happens through configuration overlays, plugin SDK extensions, and a minimal pnpm
patch (~20 lines across 7 files).

**Target platforms**: macOS (darwin arm64/x64), Windows (x64/arm64).
**Runtime**: Node.js >= 22.12, pnpm >= 9.15.

> **Note:** `install.sh` and the daemon scripts also accept Linux for OpenClaw compatibility, but Linux is not an officially supported product platform. The product targets macOS and Windows only.

### File Map

```
scripts/
  install.sh          # One-click install (curl-pipe-bash or manual)
  setup.sh            # Interactive first-run configuration
  sync-upstream.sh    # Update OpenClaw dependency
  apply-branding.sh   # Generate/regenerate pnpm branding patch
  build-dashboard.sh  # Build dashboard SPA
  backup.sh           # Backup workspace, config, database
  health.sh           # Gateway health check
config/
  openclaw.json           # Active configuration
  openclaw.example.json   # Annotated reference template
patches/
  openclaw@2026.3.8.patch # pnpm patch file (branding overrides)
```

All scripts use `set -euo pipefail` and are designed to be idempotent: running them
twice produces the same result without damage.

---

## 2. install.sh Flowchart

### Flow Diagram

```
Start
  │
  ├─ Detect OS and architecture (uname -s, uname -m)
  │    ├─ darwin (arm64 | x64) → OK
  │    ├─ Linux  (x86_64 | aarch64) → OK
  │    └─ Other → ERROR: unsupported platform
  │
  ├─ Check Node.js >= 22.12
  │    ├─ node not found → ERROR: install Node.js first
  │    ├─ major < 22 → ERROR: upgrade required
  │    ├─ major == 22, minor < 12 → ERROR: upgrade required
  │    └─ OK
  │
  ├─ Check pnpm
  │    ├─ pnpm not found → npm install -g pnpm@latest
  │    └─ OK
  │
  ├─ Clone repository
  │    └─ git clone https://github.com/wentorai/research-claw.git
  │
  ├─ pnpm install (applies patch automatically)
  │
  ├─ Install research-plugins
  │    └─ pnpm add @wentorai/research-plugins
  │
  ├─ Copy config template
  │    └─ cp config/openclaw.example.json config/openclaw.json
  │
  └─ Print success + next steps
       └─ "Run 'pnpm setup' to configure your API key."
```

### Complete Script

```bash
#!/usr/bin/env bash
# Research-Claw One-Click Install (macOS / Linux)
# Usage: curl -fsSL https://wentor.ai/install-claw.sh | bash
#    or: git clone ... && cd research-claw && bash scripts/install.sh
set -euo pipefail

REPO_URL="https://github.com/wentorai/research-claw.git"
MIN_NODE_MAJOR=22
MIN_NODE_MINOR=12

# ── Helpers ──────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[install]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }

die() { err "$@"; exit 1; }

# ── 1. Detect OS / architecture ─────────────────────────────────────

OS="$(uname -s)"
ARCH="$(uname -m)"
log "Platform: ${OS}/${ARCH}"

case "$OS" in
  Darwin) ;;
  Linux)  ;;
  *)      die "Unsupported operating system: ${OS}. Only macOS and Linux are supported." ;;
esac

case "$ARCH" in
  x86_64|amd64|arm64|aarch64) ;;
  *) die "Unsupported architecture: ${ARCH}." ;;
esac

# ── 2. Check Node.js >= 22.12 ───────────────────────────────────────

if ! command -v node &>/dev/null; then
  die "Node.js not found. Install Node.js >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} first.
       https://nodejs.org/ or use nvm/fnm."
fi

NODE_RAW="$(node -v)"                          # e.g. v22.12.1
NODE_VERSION="${NODE_RAW#v}"                    # strip leading 'v'
NODE_MAJOR="${NODE_VERSION%%.*}"                # 22
NODE_REST="${NODE_VERSION#*.}"                  # 12.1
NODE_MINOR="${NODE_REST%%.*}"                   # 12

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  die "Node.js ${NODE_VERSION} is too old. Upgrade to >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}."
fi

if [ "$NODE_MAJOR" -eq "$MIN_NODE_MAJOR" ] && [ "$NODE_MINOR" -lt "$MIN_NODE_MINOR" ]; then
  die "Node.js ${NODE_VERSION} is too old. Upgrade to >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}."
fi

ok "Node.js ${NODE_VERSION}"

# ── 3. Check pnpm ───────────────────────────────────────────────────

if ! command -v pnpm &>/dev/null; then
  log "pnpm not found. Installing via npm..."
  npm install -g pnpm@latest
fi

ok "pnpm $(pnpm -v)"

# ── 4. Clone repository ─────────────────────────────────────────────

INSTALL_DIR="research-claw"

if [ -d "$INSTALL_DIR" ]; then
  log "Directory '${INSTALL_DIR}' already exists. Skipping clone."
else
  log "Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── 5. Install dependencies (pnpm applies patch automatically) ──────

log "Installing dependencies..."
pnpm install

# ── 6. Install research-plugins ─────────────────────────────────────

if ! node -e "require.resolve('@wentorai/research-plugins')" &>/dev/null; then
  log "Installing @wentorai/research-plugins..."
  pnpm add @wentorai/research-plugins
else
  ok "@wentorai/research-plugins already installed"
fi

# ── 7. Copy config template ─────────────────────────────────────────

if [ ! -f config/openclaw.json ]; then
  cp config/openclaw.example.json config/openclaw.json
  ok "Created config/openclaw.json from template"
else
  ok "config/openclaw.json already exists"
fi

# ── 8. Create data directory ────────────────────────────────────────

mkdir -p .research-claw
ok "Data directory ready: .research-claw/"

# ── Done ─────────────────────────────────────────────────────────────

echo ""
echo "============================================="
echo "  Research-Claw installed successfully."
echo "============================================="
echo ""
echo "  Next steps:"
echo "    cd ${INSTALL_DIR}"
echo "    pnpm setup          # Configure API key"
echo "    pnpm start          # Start gateway"
echo ""
echo "  Dashboard: http://127.0.0.1:28789"
echo ""
```

### Version Comparison Logic

The Node.js version check uses integer comparison on split major.minor components.
This avoids lexicographic pitfalls (e.g., "9" > "22" in string comparison). The
`NODE_VERSION` is parsed by stripping the leading `v`, then extracting the portion
before the first `.` (major) and the portion between the first and second `.` (minor).

---

## 3. setup.sh — Interactive First-Run

### Purpose

Guides users through API provider selection, key entry, optional proxy configuration,
and config validation. Writes `.env` and ensures `config/openclaw.json` exists.

### Flow Diagram

```
Start
  │
  ├─ Provider selection menu
  │    ├─ 1) Anthropic (Claude)  — default
  │    ├─ 2) OpenAI (GPT)
  │    └─ 3) Other (manual)
  │
  ├─ API key input (masked with -s)
  │
  ├─ Model selection (optional)
  │    ├─ Anthropic default: claude-sonnet-4-20250514
  │    ├─ OpenAI default: gpt-4o
  │    └─ Other: user enters model identifier
  │
  ├─ Proxy configuration (optional)
  │    └─ Default suggestion: http://127.0.0.1:7890 (common in China)
  │
  ├─ Write .env file
  │
  ├─ Write/update config/openclaw.json
  │
  ├─ Validate API key (test connection)
  │
  └─ Print success + start command
```

### Complete Script

```bash
#!/usr/bin/env bash
# Research-Claw First-Run Setup
# Interactive prompts for API provider, key, model, proxy.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Helpers ──────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }

echo ""
echo "============================================="
echo "  Research-Claw First-Run Setup"
echo "============================================="
echo ""

# ── 1. Provider selection ───────────────────────────────────────────

echo "Select your API provider:"
echo "  1) Anthropic (Claude)  [default]"
echo "  2) OpenAI (GPT)"
echo "  3) Other (manual config)"
echo ""
read -rp "Choice [1]: " PROVIDER_CHOICE
PROVIDER_CHOICE="${PROVIDER_CHOICE:-1}"

PROVIDER_NAME=""
ENV_VAR_NAME=""
DEFAULT_MODEL=""

case "$PROVIDER_CHOICE" in
  1)
    PROVIDER_NAME="Anthropic"
    ENV_VAR_NAME="ANTHROPIC_API_KEY"
    DEFAULT_MODEL="claude-sonnet-4-20250514"
    ;;
  2)
    PROVIDER_NAME="OpenAI"
    ENV_VAR_NAME="OPENAI_API_KEY"
    DEFAULT_MODEL="gpt-4o"
    ;;
  3)
    PROVIDER_NAME="Other"
    read -rp "Environment variable name for API key: " ENV_VAR_NAME
    read -rp "Default model identifier: " DEFAULT_MODEL
    ;;
  *)
    err "Invalid choice: ${PROVIDER_CHOICE}"
    exit 1
    ;;
esac

ok "Provider: ${PROVIDER_NAME}"

# ── 2. API key input (masked) ──────────────────────────────────────

echo ""
read -rsp "${PROVIDER_NAME} API Key: " API_KEY
echo ""

if [ -z "$API_KEY" ]; then
  err "API key cannot be empty."
  exit 1
fi

# Show last 4 characters for confirmation
KEY_TAIL="${API_KEY: -4}"
ok "Key ending in ...${KEY_TAIL}"

# ── 3. Model selection (optional) ──────────────────────────────────

echo ""
read -rp "Model [${DEFAULT_MODEL}]: " MODEL_CHOICE
MODEL_CHOICE="${MODEL_CHOICE:-$DEFAULT_MODEL}"
ok "Model: ${MODEL_CHOICE}"

# ── 4. Proxy configuration (optional) ──────────────────────────────

echo ""
echo "HTTP proxy configuration (for users behind a firewall)."
echo "Common value for China users: http://127.0.0.1:7890"
read -rp "HTTP Proxy (blank to skip): " PROXY

# ── 5. Write .env file ─────────────────────────────────────────────

log "Writing .env..."

{
  echo "# Research-Claw environment — generated by setup.sh"
  echo "# $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo ""
  echo "# API Provider: ${PROVIDER_NAME}"
  echo "${ENV_VAR_NAME}=${API_KEY}"
  echo ""
  echo "# Model override (leave empty to use provider default)"
  echo "RC_DEFAULT_MODEL=${MODEL_CHOICE}"
} > .env

if [ -n "$PROXY" ]; then
  {
    echo ""
    echo "# Proxy"
    echo "HTTP_PROXY=${PROXY}"
    echo "HTTPS_PROXY=${PROXY}"
  } >> .env
fi

chmod 600 .env
ok ".env written (permissions: 600)"

# ── 6. Ensure config/openclaw.json exists ──────────────────────────

if [ ! -f config/openclaw.json ]; then
  cp config/openclaw.example.json config/openclaw.json
  ok "Created config/openclaw.json from template"
else
  ok "config/openclaw.json already exists"
fi

# ── 7. Validate API key (test connection) ──────────────────────────

echo ""
log "Validating API key..."

VALIDATION_OK=false

case "$PROVIDER_CHOICE" in
  1)
    # Anthropic: send a minimal messages request
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      ${PROXY:+--proxy "$PROXY"} \
      -X POST "https://api.anthropic.com/v1/messages" \
      -H "x-api-key: ${API_KEY}" \
      -H "anthropic-version: 2023-06-01" \
      -H "content-type: application/json" \
      -d '{"model":"'"${MODEL_CHOICE}"'","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}' \
      --connect-timeout 10 \
      --max-time 30 \
      2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
      VALIDATION_OK=true
    elif [ "$HTTP_STATUS" = "401" ]; then
      err "API key rejected (HTTP 401). Check that the key is correct."
    elif [ "$HTTP_STATUS" = "000" ]; then
      err "Connection failed. Check your network/proxy settings."
    else
      log "Received HTTP ${HTTP_STATUS}. Key might be valid (non-401). Continuing."
      VALIDATION_OK=true
    fi
    ;;
  2)
    # OpenAI: list models endpoint
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      ${PROXY:+--proxy "$PROXY"} \
      "https://api.openai.com/v1/models" \
      -H "Authorization: Bearer ${API_KEY}" \
      --connect-timeout 10 \
      --max-time 30 \
      2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
      VALIDATION_OK=true
    elif [ "$HTTP_STATUS" = "401" ]; then
      err "API key rejected (HTTP 401). Check that the key is correct."
    elif [ "$HTTP_STATUS" = "000" ]; then
      err "Connection failed. Check your network/proxy settings."
    else
      log "Received HTTP ${HTTP_STATUS}. Key might be valid (non-401). Continuing."
      VALIDATION_OK=true
    fi
    ;;
  3)
    log "Skipping validation for custom provider. Test manually."
    VALIDATION_OK=true
    ;;
esac

if [ "$VALIDATION_OK" = true ]; then
  ok "API key validated"
else
  echo ""
  err "Validation failed. Your .env has been written — you can edit it manually."
  echo "  File: ${PROJECT_ROOT}/.env"
  echo "  Re-run: pnpm setup"
  echo ""
  exit 1
fi

# ── Done ─────────────────────────────────────────────────────────────

echo ""
echo "============================================="
echo "  Setup complete."
echo "============================================="
echo ""
echo "  Start Research-Claw:"
echo "    pnpm start"
echo ""
echo "  Dashboard: http://127.0.0.1:28789"
echo ""
echo "  Other commands:"
echo "    pnpm health     # Check gateway status"
echo "    pnpm backup     # Backup workspace & config"
echo ""
```

### Security Notes

- The API key is read with `-s` (silent mode) so it does not echo to the terminal.
- `.env` is created with `chmod 600` (owner read/write only).
- `.env` is listed in `.gitignore` and must never be committed.
- The validation step sends a minimal request; it does not persist any response data.

---

## 4. sync-upstream.sh

### Purpose

Updates the OpenClaw npm dependency to the latest version, checks patch compatibility,
rebuilds all derived artifacts, and runs tests.

### Flow Diagram

```
Start
  │
  ├─ Record current OpenClaw version
  │
  ├─ pnpm update openclaw
  │
  ├─ Record new version
  │
  ├─ Compare versions
  │    ├─ Same → "Already up to date"
  │    └─ Different → Check if patch applies cleanly
  │         ├─ Patch OK → Continue
  │         └─ Patch FAILED → Warn: regenerate with apply-branding.sh
  │
  ├─ pnpm build:extensions
  │
  ├─ pnpm build:dashboard
  │
  ├─ pnpm test
  │
  └─ Print summary (old → new version)
```

### Complete Script

```bash
#!/usr/bin/env bash
# Update OpenClaw dependency and re-apply branding patch
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Helpers ──────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[sync]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }

echo ""
log "Syncing upstream OpenClaw..."

# ── 1. Record current version ──────────────────────────────────────

OLD_VERSION=$(node -e "console.log(require('./node_modules/openclaw/package.json').version)" 2>/dev/null || echo "unknown")
log "Current OpenClaw version: ${OLD_VERSION}"

OLD_PATCH="patches/openclaw@${OLD_VERSION}.patch"

# ── 2. Update openclaw ─────────────────────────────────────────────

log "Running pnpm update openclaw..."
pnpm update openclaw

# ── 3. Record new version ──────────────────────────────────────────

NEW_VERSION=$(node -e "console.log(require('./node_modules/openclaw/package.json').version)")
log "New OpenClaw version: ${NEW_VERSION}"

# ── 4. Version comparison ──────────────────────────────────────────

if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
  ok "Already at latest version: ${NEW_VERSION}"
else
  log "Version changed: ${OLD_VERSION} -> ${NEW_VERSION}"

  # Check if old patch file exists and warn about version mismatch
  NEW_PATCH="patches/openclaw@${NEW_VERSION}.patch"

  if [ -f "$OLD_PATCH" ] && [ ! -f "$NEW_PATCH" ]; then
    warn "Patch file exists for old version (${OLD_VERSION}) but not for new (${NEW_VERSION})."
    warn "The branding patch may not apply correctly."
    warn ""
    warn "  Regenerate the patch:"
    warn "    bash scripts/apply-branding.sh"
    warn ""
    warn "  Then update package.json patchedDependencies:"
    warn "    \"openclaw@${NEW_VERSION}\": \"patches/openclaw@${NEW_VERSION}.patch\""
    warn ""

    read -rp "Continue anyway? [y/N]: " CONTINUE
    if [ "${CONTINUE,,}" != "y" ]; then
      err "Aborted. Run apply-branding.sh first."
      exit 1
    fi
  fi
fi

# ── 5. Rebuild extensions ──────────────────────────────────────────

log "Building extensions..."
pnpm build:extensions
ok "Extensions built"

# ── 6. Rebuild dashboard ──────────────────────────────────────────

log "Building dashboard..."
pnpm build:dashboard
ok "Dashboard built"

# ── 7. Run tests ───────────────────────────────────────────────────

log "Running tests..."
if pnpm test; then
  ok "All tests passed"
else
  warn "Some tests failed. Review output above."
fi

# ── Summary ─────────────────────────────────────────────────────────

echo ""
echo "============================================="
echo "  Upstream sync complete"
echo "============================================="
echo "  Old version: ${OLD_VERSION}"
echo "  New version: ${NEW_VERSION}"
echo ""
if [ "$OLD_VERSION" != "$NEW_VERSION" ]; then
  echo "  IMPORTANT: Test thoroughly after a version change."
  echo "  If branding is broken, run: bash scripts/apply-branding.sh"
fi
echo ""
```

### When to Run

- After OpenClaw publishes a new release.
- Periodically (e.g., weekly) to pick up security patches.
- Before tagging a Research-Claw release.

---

## 5. apply-branding.sh

### Purpose

Generates the pnpm patch that transforms OpenClaw into Research-Claw. The patch
modifies exactly 7 files with approximately 20 lines of changes total.

### Patch Scope

| # | File Path (in node_modules/openclaw) | Change |
|---|--------------------------------------|--------|
| 1 | `src/cli/index.ts` | CLI command name: `openclaw` -> `research-claw` |
| 2 | `src/cli/version.ts` | Product name in `--version` output |
| 3 | `src/runtime.ts` | `process.title` set to `research-claw` |
| 4 | `src/agents/system.ts` | Product name injected into system prompt |
| 5 | `src/update/check.ts` | Disable or redirect update check URL |
| 6 | `src/daemon/launchd.ts` | macOS service label: `ai.wentor.research-claw` |
| 7 | `src/daemon/systemd.ts` | Linux service name: `research-claw.service` |

### Complete Script

```bash
#!/usr/bin/env bash
# Regenerate pnpm patch for Research-Claw branding
#
# This script:
#   1. Starts a pnpm patch session on the openclaw package
#   2. Applies branding substitutions using sed
#   3. Commits the patch via pnpm patch-commit
#
# The resulting patch file is stored in patches/ and referenced
# from package.json under pnpm.patchedDependencies.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Helpers ──────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[brand]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }

# ── Resolve version ─────────────────────────────────────────────────

VERSION=$(node -e "console.log(require('./node_modules/openclaw/package.json').version)")
PATCH_FILE="patches/openclaw@${VERSION}.patch"

log "OpenClaw version: ${VERSION}"
log "Target patch: ${PATCH_FILE}"

# ── Prepare patch directory ─────────────────────────────────────────

PATCH_DIR=$(mktemp -d)
log "Patch workspace: ${PATCH_DIR}"

# Copy the installed openclaw package to the temp directory for editing
cp -R node_modules/openclaw "${PATCH_DIR}/openclaw"
OPENCLAW_DIR="${PATCH_DIR}/openclaw"

# ── Apply branding substitutions ────────────────────────────────────

log "Applying branding changes..."

# 1. CLI command name: openclaw -> research-claw
if [ -f "${OPENCLAW_DIR}/dist/cli/index.js" ]; then
  sed -i.bak 's/\.command("openclaw")/.command("research-claw")/g' \
    "${OPENCLAW_DIR}/dist/cli/index.js"
  ok "CLI command name"
fi

# 2. Product name in version output
if [ -f "${OPENCLAW_DIR}/dist/cli/version.js" ]; then
  sed -i.bak 's/OpenClaw/Research-Claw/g' \
    "${OPENCLAW_DIR}/dist/cli/version.js"
  ok "Version output"
fi

# 3. Process title
if [ -f "${OPENCLAW_DIR}/dist/runtime.js" ]; then
  sed -i.bak 's/process\.title = "openclaw"/process.title = "research-claw"/g' \
    "${OPENCLAW_DIR}/dist/runtime.js"
  ok "Process title"
fi

# 4. Product name in system prompt
if [ -f "${OPENCLAW_DIR}/dist/agents/system.js" ]; then
  sed -i.bak 's/You are OpenClaw/You are Research-Claw/g' \
    "${OPENCLAW_DIR}/dist/agents/system.js"
  ok "System prompt"
fi

# 5. Update check URL — disable by pointing to localhost
if [ -f "${OPENCLAW_DIR}/dist/update/check.js" ]; then
  sed -i.bak 's|https://api\.openclaw\.ai/v1/updates|http://localhost:0/disabled|g' \
    "${OPENCLAW_DIR}/dist/update/check.js"
  ok "Update check disabled"
fi

# 6. macOS launchd service label
if [ -f "${OPENCLAW_DIR}/dist/daemon/launchd.js" ]; then
  sed -i.bak 's/com\.openclaw\.gateway/ai.wentor.research-claw/g' \
    "${OPENCLAW_DIR}/dist/daemon/launchd.js"
  ok "launchd service label"
fi

# 7. Linux systemd service name
if [ -f "${OPENCLAW_DIR}/dist/daemon/systemd.js" ]; then
  sed -i.bak 's/openclaw\.service/research-claw.service/g' \
    "${OPENCLAW_DIR}/dist/daemon/systemd.js"
  ok "systemd service name"
fi

# Clean up .bak files created by sed -i
find "${OPENCLAW_DIR}" -name '*.bak' -delete

# ── Generate patch ──────────────────────────────────────────────────

log "Generating patch file..."
mkdir -p patches

# Use pnpm patch-commit to produce the patch
# pnpm patch-commit expects the modified directory
pnpm patch-commit "${OPENCLAW_DIR}" --patch-dir patches

ok "Patch written: ${PATCH_FILE}"

# ── Verify package.json reference ───────────────────────────────────

EXPECTED_KEY="openclaw@${VERSION}"
if node -e "
  const pkg = require('./package.json');
  const deps = pkg.pnpm?.patchedDependencies || {};
  if (!deps['${EXPECTED_KEY}']) {
    console.error('WARNING: package.json pnpm.patchedDependencies missing entry for ${EXPECTED_KEY}');
    process.exit(1);
  }
" 2>/dev/null; then
  ok "package.json references patch correctly"
else
  echo ""
  echo "  Add to package.json -> pnpm.patchedDependencies:"
  echo "    \"${EXPECTED_KEY}\": \"${PATCH_FILE}\""
  echo ""
fi

# ── Cleanup ──────────────────────────────────────────────────────────

rm -rf "${PATCH_DIR}"

echo ""
echo "============================================="
echo "  Branding patch generated successfully"
echo "============================================="
echo "  Run 'pnpm install' to apply the patch."
echo ""
```

### Patch Lifecycle

1. **Initial creation**: Run `apply-branding.sh` after first `pnpm install`.
2. **After upstream update**: If `sync-upstream.sh` warns about version mismatch,
   run `apply-branding.sh` to regenerate the patch for the new version.
3. **Patch file is committed to git**: The `patches/` directory is version-controlled
   so that `pnpm install` on a fresh clone applies the branding automatically.

---

## 6. Startup Command

### Primary Command

The gateway is started via `scripts/run.sh`, an auto-restart wrapper that detects the correct Node binary (conda `openclaw` env preferred), sets the config path via `OPENCLAW_CONFIG_PATH`, and relaunches the gateway on exit (SIGUSR1 self-restart for config changes).

```bash
# Actual gateway invocation inside scripts/run.sh:
"$GW_NODE" ./node_modules/openclaw/dist/entry.js \
  gateway run --allow-unconfigured --auth token --port 28789 --force
```

Flags:
- `--allow-unconfigured` — starts even if no API key is set (setup wizard handles it)
- `--auth token` — uses `OPENCLAW_GATEWAY_TOKEN` for dashboard auth (default: `research-claw`)
- `--port 28789` — explicit port (matches config)
- `--force` — starts even if another gateway is running

This is registered as `pnpm start` / `pnpm serve` in `package.json`:

```json
{
  "scripts": {
    "start": "bash scripts/run.sh",
    "serve": "bash scripts/run.sh",
    "dev": "concurrently \"pnpm --filter dashboard dev\" \"bash scripts/run.sh\""
  }
}
```

### What Happens at Startup

```
scripts/run.sh → node entry.js gateway run --allow-unconfigured --auth token --port 28789 --force
  │
  ├─ Load config/openclaw.json
  │    ├─ gateway.mode = "local"       → bind to 127.0.0.1 only
  │    ├─ gateway.port = 28789         → HTTP + WebSocket server
  │    └─ gateway.controlUi.root       → dashboard/dist/
  │
  ├─ Apply .env variables
  │    ├─ ANTHROPIC_API_KEY or OPENAI_API_KEY
  │    ├─ HTTP_PROXY / HTTPS_PROXY (if set)
  │    └─ RC_DEFAULT_MODEL (if set)
  │
  ├─ Load bootstrap files from ./workspace/
  │    ├─ SOUL.md          → agent identity
  │    ├─ AGENTS.md         → agent behavior rules
  │    ├─ HEARTBEAT.md      → periodic check-in template
  │    ├─ MEMORY.md         → persistent cross-session memory
  │    └─ (others as defined in C4)
  │
  ├─ Load skills
  │    ├─ ./node_modules/@wentorai/research-plugins/skills/  (431 skills)
  │    └─ ./skills/                                           (local custom skills)
  │
  ├─ Load plugins
  │    ├─ research-claw-core   → literature, tasks, workspace tools
  │    └─ wentor-connect       → (disabled by default)
  │
  ├─ Initialize SQLite database
  │    └─ .research-claw/library.db
  │
  ├─ Start cron scheduler (if enabled)
  │
  ├─ Start heartbeat timer (30-minute interval)
  │
  └─ Gateway ready
       ├─ HTTP:  http://127.0.0.1:28789
       ├─ WS:    ws://127.0.0.1:28789
       └─ Dashboard: http://127.0.0.1:28789 (serves dashboard/dist/)
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (if Anthropic) | Anthropic API key |
| `OPENAI_API_KEY` | Yes (if OpenAI) | OpenAI API key |
| `RC_DEFAULT_MODEL` | No | Override default model selection |
| `HTTP_PROXY` | No | HTTP proxy URL |
| `HTTPS_PROXY` | No | HTTPS proxy URL |

### Network Binding

The gateway binds to `127.0.0.1:28789` (loopback only). It is **never** exposed to
the network. This is enforced by `gateway.mode = "local"` in the config. There is no
authentication layer on the local gateway — loopback access is implicitly trusted.

### Development Mode

```bash
pnpm dev
```

Runs two processes concurrently:
1. Dashboard Vite dev server with hot reload (`pnpm --filter dashboard dev`)
2. Gateway (`pnpm start`)

---

## 7. Daemon Setup

Running Research-Claw as a background daemon ensures it starts automatically on login
and restarts after crashes. Two daemon managers are supported: **launchd** (macOS) and
**systemd** (Linux).

### 7.1 macOS — launchd

#### Plist Template

File: `ai.wentor.research-claw.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>

  <key>Label</key>
  <string>ai.wentor.research-claw</string>

  <key>ProgramArguments</key>
  <array>
    <!-- Absolute path to node binary -->
    <string>/usr/local/bin/node</string>
    <!-- Relative paths resolve from WorkingDirectory -->
    <string>./node_modules/openclaw/dist/entry.js</string>
    <string>gateway</string>
    <string>run</string>
    <string>--allow-unconfigured</string>
    <string>--auth</string>
    <string>token</string>
    <string>--port</string>
    <string>28789</string>
    <string>--force</string>
  </array>

  <key>WorkingDirectory</key>
  <string>/Users/USERNAME/research-claw</string>

  <key>EnvironmentVariables</key>
  <dict>
    <!-- Set PATH so node can find pnpm, git, etc. -->
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin</string>
    <!-- Project config (run.sh sets this; daemon needs it explicitly) -->
    <key>OPENCLAW_CONFIG_PATH</key>
    <string>./config/openclaw.json</string>
    <!-- Token auth — matches Dashboard's DEFAULT_TOKEN -->
    <key>OPENCLAW_GATEWAY_TOKEN</key>
    <string>research-claw</string>
  </dict>

  <key>KeepAlive</key>
  <true/>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/Users/USERNAME/research-claw/.research-claw/daemon-stdout.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/USERNAME/research-claw/.research-claw/daemon-stderr.log</string>

  <key>ThrottleInterval</key>
  <integer>10</integer>

</dict>
</plist>
```

#### Installation Commands

```bash
# 1. Copy plist (replace USERNAME with actual username)
PLIST_SRC="ai.wentor.research-claw.plist"
PLIST_DST="$HOME/Library/LaunchAgents/ai.wentor.research-claw.plist"

# Generate plist with correct paths
NODE_PATH="$(which node)"
PROJECT_DIR="$(pwd)"

sed \
  -e "s|/usr/local/bin/node|${NODE_PATH}|g" \
  -e "s|/Users/USERNAME/research-claw|${PROJECT_DIR}|g" \
  "$PLIST_SRC" > "$PLIST_DST"

# 2. Load the agent (starts immediately and on every login)
launchctl load -w "$PLIST_DST"

# 3. Verify
launchctl list | grep research-claw
```

#### Management Commands

```bash
# Stop the daemon
launchctl unload "$HOME/Library/LaunchAgents/ai.wentor.research-claw.plist"

# Start the daemon
launchctl load -w "$HOME/Library/LaunchAgents/ai.wentor.research-claw.plist"

# View logs
tail -f ~/.research-claw/daemon-stdout.log
tail -f ~/.research-claw/daemon-stderr.log

# Check status
launchctl list ai.wentor.research-claw
```

#### Plist Key Explanations

| Key | Value | Purpose |
|-----|-------|---------|
| `Label` | `ai.wentor.research-claw` | Unique reverse-DNS identifier |
| `KeepAlive` | `true` | Restart if process exits for any reason |
| `RunAtLoad` | `true` | Start when the plist is loaded (at login) |
| `ThrottleInterval` | `10` | Minimum 10 seconds between restart attempts |
| `WorkingDirectory` | project root | Ensures relative config paths resolve |

### 7.2 Linux — systemd

#### Unit File Template

File: `research-claw.service`

```ini
[Unit]
Description=Research-Claw Gateway (AI Research Assistant)
Documentation=https://github.com/wentorai/research-claw
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/USERNAME/research-claw
ExecStart=/usr/bin/node ./node_modules/openclaw/dist/entry.js gateway run --allow-unconfigured --auth token --port 28789 --force
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=research-claw

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/USERNAME/research-claw/.research-claw
ReadWritePaths=/home/USERNAME/research-claw/workspace
PrivateTmp=yes

# Environment
EnvironmentFile=/home/USERNAME/research-claw/.env
Environment=OPENCLAW_CONFIG_PATH=./config/openclaw.json
Environment=OPENCLAW_GATEWAY_TOKEN=research-claw

[Install]
WantedBy=default.target
```

#### Installation Commands (User Service)

User-level systemd services do not require root. They run as the current user and
start on login.

```bash
# 1. Create user systemd directory
mkdir -p "$HOME/.config/systemd/user"

# 2. Generate unit file with correct paths
NODE_PATH="$(which node)"
PROJECT_DIR="$(pwd)"
USERNAME="$(whoami)"

sed \
  -e "s|/usr/bin/node|${NODE_PATH}|g" \
  -e "s|/home/USERNAME/research-claw|${PROJECT_DIR}|g" \
  -e "s|USERNAME|${USERNAME}|g" \
  research-claw.service > "$HOME/.config/systemd/user/research-claw.service"

# 3. Reload systemd to pick up the new unit
systemctl --user daemon-reload

# 4. Enable (start on login) and start now
systemctl --user enable --now research-claw.service

# 5. Verify
systemctl --user status research-claw.service
```

#### Management Commands

```bash
# Stop
systemctl --user stop research-claw.service

# Start
systemctl --user start research-claw.service

# Restart (e.g., after config change)
systemctl --user restart research-claw.service

# View logs
journalctl --user -u research-claw.service -f

# Disable auto-start
systemctl --user disable research-claw.service
```

#### Unit File Key Explanations

| Key | Value | Purpose |
|-----|-------|---------|
| `Restart=always` | | Restart on any exit (clean or crash) |
| `RestartSec=10` | | Wait 10 seconds before restarting |
| `NoNewPrivileges=yes` | | Prevent privilege escalation |
| `ProtectSystem=strict` | | Mount `/` read-only except explicit paths |
| `ReadWritePaths` | `.research-claw`, `workspace` | Only directories the process needs to write |
| `EnvironmentFile` | `.env` | Loads API keys and proxy settings |
| `WantedBy=default.target` | | Starts when user session begins |

### 7.3 Enabling Lingering (Linux — Headless Servers)

By default, user services only run while the user is logged in. On headless servers
where Research-Claw should run continuously:

```bash
# Enable lingering — services start at boot, persist after logout
sudo loginctl enable-linger "$USER"
```

---

## 8. build-dashboard.sh

### Purpose

Builds the Research-Claw dashboard SPA. The output is served by the gateway via the
`gateway.controlUi.root` config key.

### Complete Script

```bash
#!/usr/bin/env bash
# Build the Research-Claw dashboard
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

log()  { printf '\033[1;34m[build]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }

log "Building dashboard..."

# Run the Vite production build via pnpm workspace filter
pnpm --filter dashboard build

# Verify output exists
if [ -d dashboard/dist ] && [ -f dashboard/dist/index.html ]; then
  ok "Dashboard built to dashboard/dist/"
  SIZE=$(du -sh dashboard/dist | cut -f1)
  echo "  Total size: ${SIZE}"
else
  echo "ERROR: Build output not found at dashboard/dist/"
  exit 1
fi

echo ""
echo "The gateway serves this directory via config:"
echo "  gateway.controlUi.root = \"./dashboard/dist\""
echo ""
```

### Build Pipeline

```
dashboard/src/**/*.{ts,tsx,css}
  │
  ├─ TypeScript compilation (tsc)
  ├─ Vite bundling + tree-shaking
  ├─ CSS extraction + minification
  ├─ Asset hashing
  │
  └─ dashboard/dist/
       ├─ index.html          (entry point)
       ├─ assets/
       │    ├─ *.js            (hashed bundles)
       │    └─ *.css           (hashed stylesheets)
       └─ i18n/
            ├─ en.json         (English strings)
            └─ zh-CN.json      (Chinese strings)
```

The gateway serves `dashboard/dist/` as a static SPA with a catch-all fallback to
`index.html` for client-side routing.

---

## 9. backup.sh

### Purpose

Creates a timestamped backup of all user data: workspace files (bootstrap documents),
configuration, environment file, and the SQLite database.

### Complete Script

```bash
#!/usr/bin/env bash
# Backup Research-Claw workspace, config, sessions, and database
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Helpers ──────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[backup]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/research-claw-${TIMESTAMP}"

echo ""
log "Research-Claw Backup"
log "Target: ${BACKUP_DIR}/"
echo ""

mkdir -p "$BACKUP_DIR"

# ── Backup items ────────────────────────────────────────────────────

ITEM_COUNT=0

# 1. Workspace (bootstrap files: SOUL.md, AGENTS.md, MEMORY.md, etc.)
if [ -d workspace ]; then
  cp -r workspace "$BACKUP_DIR/workspace"
  ok "workspace/"
  ITEM_COUNT=$((ITEM_COUNT + 1))
else
  warn "workspace/ not found — skipping"
fi

# 2. Config directory
if [ -d config ]; then
  cp -r config "$BACKUP_DIR/config"
  ok "config/"
  ITEM_COUNT=$((ITEM_COUNT + 1))
else
  warn "config/ not found — skipping"
fi

# 3. Environment file (contains API keys)
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/.env"
  chmod 600 "$BACKUP_DIR/.env"
  ok ".env (permissions preserved)"
  ITEM_COUNT=$((ITEM_COUNT + 1))
else
  warn ".env not found — skipping"
fi

# 4. SQLite database
DB_PATH=".research-claw/library.db"
if [ -f "$DB_PATH" ]; then
  # Use SQLite backup command if available for consistency
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_PATH" ".backup '${BACKUP_DIR}/library.db'"
    ok "library.db (via sqlite3 .backup — transaction-safe)"
  else
    cp "$DB_PATH" "$BACKUP_DIR/library.db"
    ok "library.db (file copy)"
  fi
  ITEM_COUNT=$((ITEM_COUNT + 1))
else
  warn "library.db not found — skipping (first run?)"
fi

# 5. Custom skills
if [ -d skills ] && [ "$(ls -A skills 2>/dev/null)" ]; then
  cp -r skills "$BACKUP_DIR/skills"
  ok "skills/"
  ITEM_COUNT=$((ITEM_COUNT + 1))
fi

# ── Summary ─────────────────────────────────────────────────────────

echo ""
echo "============================================="
echo "  Backup complete: ${BACKUP_DIR}/"
echo "============================================="
echo ""

# List contents with sizes
du -sh "$BACKUP_DIR"/* 2>/dev/null | while read -r SIZE NAME; do
  printf "  %-8s %s\n" "$SIZE" "$(basename "$NAME")"
done

TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo "  Total: ${TOTAL_SIZE} (${ITEM_COUNT} items)"
echo ""
echo "  Retention: manual. Delete old backups when no longer needed."
echo "  Restore:   cp -r ${BACKUP_DIR}/* . (selective copy recommended)"
echo ""
```

### Backup Contents

| Item | Source Path | Contains |
|------|-----------|----------|
| `workspace/` | `./workspace/` | SOUL.md, AGENTS.md, MEMORY.md, HEARTBEAT.md, etc. |
| `config/` | `./config/` | openclaw.json, openclaw.example.json |
| `.env` | `./.env` | API keys, proxy settings |
| `library.db` | `.research-claw/library.db` | Papers, tags, tasks, reading sessions, citations |
| `skills/` | `./skills/` | User-created custom SKILL.md files |

### Retention Policy

Backups are stored in `backups/` (gitignored). There is no automatic cleanup. Users
manage retention manually. A typical strategy:

- Keep daily backups for the past week.
- Keep weekly backups for the past month.
- Delete older backups.

### SQLite Backup Safety

When `sqlite3` is available, the script uses the `.backup` command, which creates a
consistent snapshot even if the gateway is writing to the database concurrently. When
`sqlite3` is not available, a plain `cp` is used — this is safe only if the gateway
is stopped.

---

## 10. health.sh

### Purpose

Verifies that the Research-Claw gateway is running and responsive. Used by monitoring
scripts, CI, and manual debugging.

### Complete Script

```bash
#!/usr/bin/env bash
# Research-Claw health check — verify gateway HTTP + TCP connectivity
set -euo pipefail

PORT="${1:-28789}"
BASE="http://127.0.0.1:${PORT}"
EXIT_CODE=0

# ── Helpers ──────────────────────────────────────────────────────────

pass() { printf '\033[1;32m[PASS]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*"; EXIT_CODE=1; }
info() { printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }

echo ""
info "Research-Claw Health Check"
info "Gateway: ${BASE}"
echo ""

# ── 1. TCP port check ──────────────────────────────────────────────

if command -v nc &>/dev/null; then
  if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
    pass "TCP port ${PORT} is open"
  else
    fail "TCP port ${PORT} is closed — gateway not running?"
    echo ""
    echo "  Start the gateway: pnpm start"
    echo ""
    exit 1
  fi
else
  info "nc not available — skipping TCP check"
fi

# ── 2. HTTP endpoint check ─────────────────────────────────────────

CONFIG_URL="${BASE}/socket.io/config.json"

if RESPONSE=$(curl -sf --connect-timeout 5 --max-time 10 "$CONFIG_URL" 2>/dev/null); then
  pass "HTTP endpoint responsive"

  # ── 3. Parse response ────────────────────────────────────────────

  # Extract server version (if present)
  if command -v python3 &>/dev/null; then
    VERSION=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('version', 'unknown'))
except:
    print('unknown')
" 2>/dev/null)
    info "Server version: ${VERSION}"

    # Extract assistant name
    ASSISTANT=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('assistant', {}).get('name', 'unknown'))
except:
    print('unknown')
" 2>/dev/null)
    info "Assistant name: ${ASSISTANT}"
  else
    info "python3 not available — skipping response parsing"
    info "Raw response: ${RESPONSE}"
  fi
else
  fail "HTTP endpoint not responding at ${CONFIG_URL}"
  EXIT_CODE=1
fi

# ── 4. Process check ───────────────────────────────────────────────

GATEWAY_PID=$(pgrep -f "openclaw.*gateway run" 2>/dev/null || true)
if [ -n "$GATEWAY_PID" ]; then
  pass "Gateway process running (PID: ${GATEWAY_PID})"
else
  fail "No gateway process found"
fi

# ── Summary ─────────────────────────────────────────────────────────

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "Gateway is healthy."
else
  echo "Gateway has issues. See failures above."
fi

exit "$EXIT_CODE"
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Healthy — all checks passed |
| `1` | Unhealthy — one or more checks failed |

### Usage

```bash
# Default port (28789)
bash scripts/health.sh

# Custom port
bash scripts/health.sh 19000

# Use in scripts / cron
if bash scripts/health.sh > /dev/null 2>&1; then
  echo "Gateway OK"
else
  echo "Gateway DOWN — restarting..."
  pnpm start &
fi
```

---

## 11. Uninstall Procedure

### Step-by-Step

```bash
# ── 1. Stop the daemon ──────────────────────────────────────────────

# macOS
launchctl unload "$HOME/Library/LaunchAgents/ai.wentor.research-claw.plist"
rm "$HOME/Library/LaunchAgents/ai.wentor.research-claw.plist"

# Linux
systemctl --user stop research-claw.service
systemctl --user disable research-claw.service
rm "$HOME/.config/systemd/user/research-claw.service"
systemctl --user daemon-reload

# ── 2. (Optional) Backup data first ─────────────────────────────────

cd /path/to/research-claw
bash scripts/backup.sh

# ── 3. Remove the installation ──────────────────────────────────────

cd ..
rm -rf research-claw/

# ── 4. Remove global pnpm if no longer needed ───────────────────────

# Only if nothing else uses pnpm:
# npm uninstall -g pnpm

# ── 5. Clean shell profile (if install added PATH entries) ──────────

# Check and remove any lines referencing research-claw from:
#   ~/.bashrc
#   ~/.zshrc
#   ~/.profile
# For example:
#   export PATH="/path/to/research-claw/bin:$PATH"
```

### What Gets Removed

| Item | Path | Contains |
|------|------|----------|
| Project directory | `research-claw/` | All code, node_modules, config, workspace, database |
| launchd plist | `~/Library/LaunchAgents/ai.wentor.research-claw.plist` | macOS daemon config |
| systemd unit | `~/.config/systemd/user/research-claw.service` | Linux daemon config |

### What Is NOT Removed

- Node.js itself (shared runtime, user manages independently)
- pnpm (shared tool, user manages independently)
- Git (shared tool)
- Any backups previously created in `backups/` (inside the project directory, so
  they ARE removed if the project directory is deleted — backup externally first)

---

## 12. Troubleshooting Guide

### Port 28789 Already in Use

**Symptom**: Gateway fails to start with `EADDRINUSE` or similar error.

**Diagnosis**:
```bash
# Find what is using the port
lsof -i :28789

# On Linux:
ss -tlnp | grep 28789
```

**Resolution**:
```bash
# If it is a stale Research-Claw process, kill it
kill $(lsof -ti :28789)

# Then restart
pnpm start

# If another application uses 28789, change the port in config:
# config/openclaw.json → gateway.port = 18790
# Update daemon configs (plist/unit) if using a daemon
```

---

### Patch Failed to Apply

**Symptom**: `pnpm install` warns that the patch for `openclaw@X.Y.Z` could not be
applied. Branding reverts to "OpenClaw".

**Cause**: OpenClaw was updated to a new version but the patch was generated for an
older version.

**Resolution**:
```bash
# 1. Regenerate the patch for the current version
bash scripts/apply-branding.sh

# 2. Update the version reference in package.json if needed
# The script will print instructions if the reference is stale.

# 3. Reinstall to apply the new patch
pnpm install
```

---

### Dashboard Blank Page

**Symptom**: Navigating to `http://127.0.0.1:28789` shows a white screen or a
"Cannot GET /" error.

**Diagnosis**:
```bash
# Check if dashboard/dist/ exists and has content
ls -la dashboard/dist/

# Check if index.html exists
cat dashboard/dist/index.html | head -5
```

**Resolution**:
```bash
# Rebuild the dashboard
bash scripts/build-dashboard.sh

# Restart the gateway to pick up the new build
# (if running as daemon)
# macOS:
launchctl unload ~/Library/LaunchAgents/ai.wentor.research-claw.plist
launchctl load -w ~/Library/LaunchAgents/ai.wentor.research-claw.plist

# Linux:
systemctl --user restart research-claw.service
```

---

### API Key Invalid

**Symptom**: Agent responds with authentication errors. Chat messages fail with
"invalid API key" or "401 Unauthorized" from the provider.

**Resolution**:
```bash
# Re-run setup to enter a new key
pnpm setup

# Or edit .env manually
nano .env

# Restart the gateway to pick up the new key
# (Ctrl+C if running in foreground, or restart daemon)
```

**Verification**:
```bash
# Quick test for Anthropic
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://api.anthropic.com/v1/messages" \
  -H "x-api-key: $(grep ANTHROPIC_API_KEY .env | cut -d= -f2)" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}'
# Should print 200
```

---

### Node.js Too Old

**Symptom**: Startup fails with syntax errors, missing APIs, or an explicit version
check error.

**Diagnosis**:
```bash
node -v
# If output is < v22.12.0, upgrade is needed
```

**Resolution**:
```bash
# Using nvm
nvm install 22
nvm use 22

# Using fnm
fnm install 22
fnm use 22

# Using system package manager (macOS)
brew install node@22

# Using system package manager (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v   # Should print v22.12.x or higher
```

After upgrading Node.js, reinstall dependencies:
```bash
pnpm install
```

---

### Permission Denied

**Symptom**: `EACCES` errors when starting the gateway, writing to the database, or
installing packages.

**Diagnosis**:
```bash
# Check file ownership
ls -la .research-claw/
ls -la config/
ls -la workspace/

# Check if running as wrong user
whoami
```

**Resolution**:
```bash
# Fix ownership (replace $USER with your username)
chown -R "$USER" .research-claw/ config/ workspace/ skills/

# Never run Research-Claw with sudo. The gateway binds to a
# non-privileged port (28789) and does not need elevated permissions.
```

---

### Gateway Starts but Dashboard Does Not Load

**Symptom**: `health.sh` shows the gateway is healthy, but the browser shows
connection refused or a blank page at port 28789.

**Diagnosis**:
```bash
# Check that the controlUi.root path is correct
node -e "const c = require('./config/openclaw.json'); console.log(c.gateway.controlUi.root)"

# Check that the directory exists and has files
ls -la "$(node -e "const c = require('./config/openclaw.json'); console.log(c.gateway.controlUi.root)")"
```

**Resolution**:
```bash
# If controlUi.root points to the wrong path, fix config/openclaw.json:
# "controlUi": { "root": "./dashboard/dist" }

# If the directory is empty, rebuild:
bash scripts/build-dashboard.sh
```

---

### Skills Not Loading

**Symptom**: Agent does not have access to research skills. Skill commands return
"unknown skill" errors.

**Diagnosis**:
```bash
# Check that research-plugins is installed
node -e "console.log(require.resolve('@wentorai/research-plugins'))"

# Check skill directories exist
ls ./node_modules/@wentorai/research-plugins/skills/ | head -10
ls ./skills/
```

**Resolution**:
```bash
# Reinstall research-plugins
pnpm add @wentorai/research-plugins

# Verify config points to the correct directories
node -e "
  const c = require('./config/openclaw.json');
  console.log('Skill dirs:', c.skills.load.extraDirs);
"
```

---

### Proxy Connection Issues (China Users)

**Symptom**: API calls time out. `setup.sh` validation fails with "Connection failed".

**Resolution**:
```bash
# 1. Verify proxy is running
curl -x http://127.0.0.1:7890 https://httpbin.org/ip

# 2. Set proxy in .env
echo "HTTP_PROXY=http://127.0.0.1:7890" >> .env
echo "HTTPS_PROXY=http://127.0.0.1:7890" >> .env

# 3. Or set in config/openclaw.json under env.vars:
# "env": {
#   "vars": {
#     "HTTP_PROXY": "http://127.0.0.1:7890",
#     "HTTPS_PROXY": "http://127.0.0.1:7890"
#   }
# }

# 4. Restart gateway
```

---

### Database Locked

**Symptom**: `SQLITE_BUSY` errors in logs. Multiple gateway processes may be running.

**Diagnosis**:
```bash
# Check for multiple gateway processes
pgrep -fa "openclaw.*gateway"

# Check database lock status
if command -v fuser &>/dev/null; then
  fuser .research-claw/library.db
fi
```

**Resolution**:
```bash
# Kill all gateway processes
pkill -f "openclaw.*gateway"

# Wait a moment, then start fresh
sleep 2
pnpm start
```

---

## Cross-References

| Document | Relevance |
|----------|-----------|
| C2 — Engineering Architecture | Build pipeline, pnpm workspace structure, patch scope definition |
| C4 — Prompt Design Framework | Bootstrap files loaded from `workspace/` at startup |
| C5 — Plugin Integration Guide | Plugin loading mechanism and `openclaw.plugin.json` manifest |
| C3f — Plugin Aggregation | `research-claw-core` plugin structure and tool registration |
| C3e — Dashboard UI | Dashboard build output consumed by `gateway.controlUi.root` |

---

*End of document.*
