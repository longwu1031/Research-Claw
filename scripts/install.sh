#!/usr/bin/env bash
# ============================================================================
# Research-Claw (科研龙虾) — Install / Update / Start
# Hosted at: https://wentor.ai/install.sh
#
# Usage:
#   curl -fsSL https://wentor.ai/install.sh | bash
#
# Idempotent: first run = install, subsequent runs = update + start.
# All configuration is handled in the browser via Setup Wizard.
#
# Options (environment variables):
#   INSTALL_DIR  — where to install (default: ~/research-claw)
#   SKIP_START   — set to 1 to install only, don't launch gateway
# ============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/research-claw}"
PORT=28789
REPO="https://github.com/wentorai/Research-Claw.git"
NODE_MIN=22
PNPM_VERSION=9

# --- Colors (disabled in pipes) ---
if [ -t 1 ] && [ -t 2 ]; then
  R='\033[38;2;239;68;68m' G='\033[38;2;34;197;94m' C='\033[38;2;34;211;238m'
  B='\033[1m' D='\033[2m' N='\033[0m'
else
  R='' G='' C='' B='' D='' N=''
fi
ok()   { printf "${G}  ✓${N} %s\n" "$1"; }
info() { printf "${C}  ▸${N} %s\n" "$1"; }
die()  { printf "${R}  ✗ %s${N}\n" "$1" >&2; exit 1; }

# --- Banner ---
printf "\n${R}"
cat <<'ART'
    ____                              _        ____ _
   |  _ \ ___  ___  ___  __ _ _ __ ___| |__    / ___| | __ ___      __
   | |_) / _ \/ __|/ _ \/ _` | '__/ __| '_ \  | |   | |/ _` \ \ /\ / /
   |  _ <  __/\__ \  __/ (_| | | | (__| | | | | |___| | (_| |\ V  V /
   |_| \_\___||___/\___|\__,_|_|  \___|_| |_|  \____|_|\__,_| \_/\_/
ART
printf "${N}\n  ${B}科研龙虾 — AI-Powered Local Research Assistant${N}\n"
printf "  ${D}https://wentor.ai${N}\n\n"

# --- Platform ---
OS="$(uname -s)"
case "$OS" in
  Darwin) OSTYPE=mac ;;
  Linux)  OSTYPE=linux ;;
  *)      die "Unsupported OS: $OS. Use macOS or Linux." ;;
esac
info "Platform: $OS / $(uname -m)"

# --- Git ---
if ! command -v git &>/dev/null; then
  if [ "$OSTYPE" = linux ]; then
    sudo apt-get update -qq && sudo apt-get install -y -qq git
  else
    die "git not found. Run: xcode-select --install"
  fi
fi
ok "git"

# --- Node.js 22+ ---
install_node() {
  info "Installing Node.js $NODE_MIN via fnm..."
  if ! command -v fnm &>/dev/null; then
    local tmp; tmp="$(mktemp)"
    curl -fsSL https://fnm.vercel.app/install -o "$tmp"
    bash "$tmp" --install-dir "$HOME/.local/share/fnm" --skip-shell
    rm -f "$tmp"
    export PATH="$HOME/.local/share/fnm:$PATH"
  fi
  eval "$(fnm env --shell bash 2>/dev/null || true)"
  fnm install "$NODE_MIN" --progress=never && fnm use "$NODE_MIN" && fnm default "$NODE_MIN"

  # Persist to shell profile
  for p in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
    if [ -f "$p" ] && ! grep -q 'fnm env' "$p" 2>/dev/null; then
      printf '\n# fnm (added by Research-Claw)\nexport PATH="$HOME/.local/share/fnm:$PATH"\neval "$(fnm env --use-on-cd --shell bash)"\n' >> "$p"
      break
    fi
  done
}

if command -v node &>/dev/null; then
  NODE_V="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [ "$NODE_V" -ge "$NODE_MIN" ] 2>/dev/null; then
    ok "Node.js $(node -v)"
  else
    install_node
  fi
else
  install_node
fi
ok "Node.js $(node -v)"

# --- pnpm ---
if ! command -v pnpm &>/dev/null; then
  npm install -g "pnpm@$PNPM_VERSION" 2>/dev/null
fi
ok "pnpm $(pnpm -v)"

# --- Build tools (Linux) ---
if [ "$OSTYPE" = linux ]; then
  if ! (command -v make &>/dev/null && command -v g++ &>/dev/null); then
    info "Installing build-essential..."
    sudo apt-get update -qq && sudo apt-get install -y -qq build-essential python3
  fi
fi

# --- Clone or update ---
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --rebase --autostash 2>/dev/null || git pull
  ok "Updated"
else
  info "Cloning to $INSTALL_DIR ..."
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  ok "Cloned"
fi

# --- Install + build ---
info "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
ok "Dependencies installed"

if [ ! -f config/openclaw.json ]; then
  if [ -f config/openclaw.example.json ]; then
    cp config/openclaw.example.json config/openclaw.json
    ok "Config created"
  fi
fi

info "Building..."
pnpm build 2>&1 | tail -3
ok "Build complete"

# --- Rebuild native modules if ABI mismatch ---
# better-sqlite3 is a C++ addon compiled against a specific Node ABI.
# The gateway may run under a different Node (e.g. conda) than system node,
# so we detect the actual Node that openclaw uses and rebuild with THAT one.
SQLITE_NODE="node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if ls $SQLITE_NODE &>/dev/null; then
  # Detect which Node the gateway actually uses
  GW_NODE="node"
  if command -v openclaw &>/dev/null; then
    OC_PATH="$(command -v openclaw)"
    # Follow shims/symlinks to find the real interpreter
    if [ -L "$OC_PATH" ]; then OC_PATH="$(readlink -f "$OC_PATH")"; fi
    OC_DIR="$(dirname "$OC_PATH")"
    if [ -x "$OC_DIR/node" ]; then
      GW_NODE="$OC_DIR/node"
    fi
  fi
  if ! "$GW_NODE" -e "require('better-sqlite3')" 2>/dev/null; then
    info "Rebuilding native modules for $("$GW_NODE" -v) (gateway Node)..."
    SQLITE_DIR=$(dirname "$(dirname "$(ls $SQLITE_NODE | head -1)")")
    # Use node-gyp from the gateway Node's npm to ensure ABI match
    GW_NPM_ROOT="$("$GW_NODE" -e "console.log(require('child_process').execSync('npm root -g', {env:{...process.env,PATH:process.env.PATH}}).toString().trim())" 2>/dev/null || echo "")"
    GW_NODEGYP=""
    if [ -n "$GW_NPM_ROOT" ] && [ -f "$GW_NPM_ROOT/npm/node_modules/node-gyp/bin/node-gyp.js" ]; then
      GW_NODEGYP="$GW_NPM_ROOT/npm/node_modules/node-gyp/bin/node-gyp.js"
    fi
    if [ -n "$GW_NODEGYP" ]; then
      (cd "$SQLITE_DIR" && "$GW_NODE" "$GW_NODEGYP" rebuild 2>&1 | tail -1)
    else
      (cd "$SQLITE_DIR" && npx --yes node-gyp rebuild 2>&1 | tail -1)
    fi
    ok "Native modules rebuilt"
  fi
fi

# --- Register research-plugins (skills + agent tools) ---
# Installed via OpenClaw's plugin system (npm pack → ~/.openclaw/extensions/).
# NOT loaded from node_modules — avoids pnpm hardlink rejection.
OPENCLAW="node ./node_modules/openclaw/dist/entry.js"
PLUGIN_DIR="$HOME/.openclaw/extensions/research-plugins"
info "Installing research-plugins..."
if [ -d "$PLUGIN_DIR" ]; then
  # Update existing: remove old version, install latest
  CURRENT_VER=$(node -e "console.log(require('$PLUGIN_DIR/package.json').version)" 2>/dev/null || echo "unknown")
  rm -rf "$PLUGIN_DIR"
  if $OPENCLAW plugins install @wentorai/research-plugins 2>&1; then
    NEW_VER=$(node -e "console.log(require('$PLUGIN_DIR/package.json').version)" 2>/dev/null || echo "unknown")
    if [ "$CURRENT_VER" = "$NEW_VER" ]; then
      ok "Research-plugins v${NEW_VER} (431 skills, 13 tools)"
    else
      ok "Research-plugins updated: v${CURRENT_VER} → v${NEW_VER}"
    fi
  else
    printf "  ${R}  ⚠${N} research-plugins update failed. You can retry later:\n"
    printf "    openclaw plugins install @wentorai/research-plugins\n"
  fi
else
  # Fresh install
  if $OPENCLAW plugins install @wentorai/research-plugins 2>&1; then
    NEW_VER=$(node -e "console.log(require('$PLUGIN_DIR/package.json').version)" 2>/dev/null || echo "unknown")
    ok "Research-plugins v${NEW_VER} (431 skills, 13 tools)"
  else
    printf "  ${R}  ⚠${N} research-plugins install failed (offline?). You can retry later:\n"
    printf "    openclaw plugins install @wentorai/research-plugins\n"
  fi
fi

# --- Done ---
printf "\n  ${G}${B}Ready!${N}\n\n"
printf "  ${B}Dashboard:${N}  ${C}http://127.0.0.1:$PORT${N}\n"
printf "  ${B}Location:${N}   $INSTALL_DIR\n"
printf "  ${B}Start:${N}      cd $INSTALL_DIR && pnpm serve\n"
printf "  ${B}Update:${N}     curl -fsSL https://wentor.ai/install.sh | bash\n\n"

if [ "${SKIP_START:-0}" = "1" ]; then
  exit 0
fi

# --- Launch with auto-restart ---
# The gateway exits on SIGUSR1 after config save (API key, model, etc.),
# expecting an external supervisor to restart it. This loop handles that.
info "Starting gateway (auto-restart on config change)..."

# Open browser when ready (background)
(for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/healthz" &>/dev/null; then
    if [ "$OSTYPE" = mac ]; then
      open "http://127.0.0.1:$PORT" 2>/dev/null || true
    else
      xdg-open "http://127.0.0.1:$PORT" 2>/dev/null || true
    fi
    exit 0
  fi
  sleep 1
done) &

STOP=false
trap 'STOP=true' INT TERM
set +e

cd "$INSTALL_DIR"
while true; do
  env OPENCLAW_CONFIG_PATH=./config/openclaw.json \
    node ./node_modules/openclaw/dist/entry.js \
    gateway run --allow-unconfigured --auth none --port "$PORT" --force
  CODE=$?

  if $STOP; then
    printf "\n  ${G}Stopped.${N}\n"
    exit 0
  fi

  printf "  ${C}▸${N} Gateway exited (code $CODE) — restarting in 1s...\n"
  sleep 1
done
