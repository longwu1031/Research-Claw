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
command -v git &>/dev/null || {
  [ "$OSTYPE" = linux ] && { sudo apt-get update -qq && sudo apt-get install -y -qq git; } \
    || die "git not found. Run: xcode-select --install"
}
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
  [ "$NODE_V" -ge "$NODE_MIN" ] && ok "Node.js $(node -v)" || install_node
else
  install_node
fi
ok "Node.js $(node -v)"

# --- pnpm ---
command -v pnpm &>/dev/null || npm install -g pnpm@latest 2>/dev/null
ok "pnpm $(pnpm -v)"

# --- Build tools (Linux) ---
[ "$OSTYPE" = linux ] && ! (command -v make &>/dev/null && command -v g++ &>/dev/null) && {
  info "Installing build-essential..."
  sudo apt-get update -qq && sudo apt-get install -y -qq build-essential python3
}

# --- Clone or update ---
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation..."
  cd "$INSTALL_DIR" && git pull --rebase --autostash 2>/dev/null || git pull
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

[ ! -f config/openclaw.json ] && [ -f config/openclaw.example.json ] && \
  cp config/openclaw.example.json config/openclaw.json && ok "Config created"

info "Building..."
pnpm build 2>&1 | tail -3
ok "Build complete"

# --- Register plugins ---
node ./node_modules/openclaw/dist/entry.js plugins install @wentorai/research-plugins 2>/dev/null || true
ok "Research-plugins (487 skills)"

# --- Done ---
printf "\n  ${G}${B}Ready!${N}\n\n"
printf "  ${B}Dashboard:${N}  ${C}http://127.0.0.1:$PORT${N}\n"
printf "  ${B}Location:${N}   $INSTALL_DIR\n"
printf "  ${B}Start:${N}      cd $INSTALL_DIR && pnpm start\n"
printf "  ${B}Update:${N}     curl -fsSL https://wentor.ai/install.sh | bash\n\n"

[ "${SKIP_START:-0}" = "1" ] && exit 0

# --- Launch ---
info "Starting gateway..."

# Open browser when ready (background)
(for _ in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$PORT/healthz" &>/dev/null && {
    [ "$OSTYPE" = mac ] && open "http://127.0.0.1:$PORT" 2>/dev/null
    [ "$OSTYPE" = linux ] && (xdg-open "http://127.0.0.1:$PORT" 2>/dev/null || true)
    exit 0
  }
  sleep 1
done) &

# Start gateway (foreground, Ctrl+C to stop)
cd "$INSTALL_DIR"
exec env OPENCLAW_CONFIG_PATH=./config/openclaw.json \
  node ./node_modules/openclaw/dist/entry.js \
  gateway run --allow-unconfigured --auth none --port "$PORT" --force
