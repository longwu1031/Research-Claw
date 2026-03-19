# ============================================================
# Research-Claw (科研龙虾)
# ============================================================
FROM node:22-slim

# ── Mirror configuration ──────────────────────────────────────────────
# Defaults: China mainland mirrors (TUNA + npmmirror).
# Overseas: docker build --build-arg APT_MIRROR=deb.debian.org --build-arg NPM_REGISTRY=https://registry.npmjs.org .
ARG APT_MIRROR=mirrors.tuna.tsinghua.edu.cn
ARG NPM_REGISTRY=https://registry.npmmirror.com

# Debian apt mirror
RUN sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources

# npm + pnpm registry
RUN npm config set registry ${NPM_REGISTRY}

# ── 系统依赖 ─────────────────────────────────────────────────────────
# python3/make/g++: better-sqlite3 原生编译
# git/curl/ca-certificates: git+https 依赖拉取
# psmisc: fuser（--force 端口释放需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ git curl ca-certificates psmisc \
    && rm -rf /var/lib/apt/lists/*

# pnpm — match version in package.json
RUN npm install -g pnpm@9.15.0

WORKDIR /app

# GitHub HTTPS 代替 SSH（Docker 内无 SSH key）
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
# 构建时代理（如需翻墙，取消注释）
# RUN git config --global http.proxy http://host.docker.internal:7890

# ── 依赖层（package 文件不变则缓存命中）──────────────────────────────
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY patches/ ./patches/
COPY dashboard/package.json                          ./dashboard/
COPY extensions/research-claw-core/package.json     ./extensions/research-claw-core/
COPY extensions/wentor-connect/package.json          ./extensions/wentor-connect/

# --node-linker=hoisted: Required in Docker to avoid pnpm symlink issues
# with better-sqlite3 native module resolution. Native install uses the
# default (symlinked) linker which works fine outside containers.
RUN pnpm install --node-linker=hoisted

# ── 源码 + 构建 ──────────────────────────────────────────────────────
COPY . .

RUN pnpm build

# ── research-plugins (skills + indexes + agent tools via OC plugin) ───
# Installed to ~/.openclaw/extensions/ (not node_modules).
# Use a minimal temp config to avoid chicken-and-egg issues with OC
# plugin validation during install.
RUN echo '{}' > /tmp/oc-install.json && \
    OPENCLAW_CONFIG_PATH=/tmp/oc-install.json \
    node ./node_modules/openclaw/dist/entry.js \
    plugins install @wentorai/research-plugins && \
    rm /tmp/oc-install.json

# Save baked plugin version for entrypoint to sync on upgrade.
# Must run AFTER plugins install and BEFORE /defaults/ copy block.
RUN mkdir -p /defaults && \
    node -e "process.stdout.write(require('/root/.openclaw/extensions/research-plugins/package.json').version)" \
    > /defaults/rp-version.txt 2>/dev/null || echo "unknown" > /defaults/rp-version.txt

# 烘焙配置模板 + 系统提示词到 /defaults/，entrypoint 会同步到 volume
RUN mkdir -p /defaults/bootstrap-prompts && \
    cp config/openclaw.example.json /defaults/openclaw.example.json && \
    cp workspace/.ResearchClaw/AGENTS.md workspace/.ResearchClaw/SOUL.md \
       workspace/.ResearchClaw/TOOLS.md workspace/.ResearchClaw/IDENTITY.md \
       workspace/.ResearchClaw/HEARTBEAT.md /defaults/bootstrap-prompts/ && \
    cp workspace/.ResearchClaw/BOOTSTRAP.md.example \
       workspace/.ResearchClaw/USER.md.example /defaults/bootstrap-prompts/ && \
    cp workspace/MEMORY.md.example /defaults/bootstrap-prompts/ && \
    cp workspace/USER.md.example /defaults/bootstrap-prompts/ws-USER.md.example

# ── 运行时 ───────────────────────────────────────────────────────────
# CLI wrapper: 让 `openclaw` 命令在容器内直接可用
# (openclaw 是 local dependency，不在 PATH；用户 docker exec 时需要)
RUN printf '#!/bin/sh\nexec node /app/node_modules/openclaw/dist/entry.js "$@"\n' > /usr/local/bin/openclaw \
    && chmod +x /usr/local/bin/openclaw

COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 28789

ENTRYPOINT ["/entrypoint.sh"]
