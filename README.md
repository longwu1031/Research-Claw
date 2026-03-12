# Research-Claw 科研龙虾

AI-powered local academic research assistant — an [OpenClaw](https://openclaw.ai) satellite.

## Quick Start

### Prerequisites

- Node.js >= 22.12
- pnpm >= 9.0
- git

### Install

```bash
git clone https://github.com/wentorai/research-claw.git
cd research-claw
pnpm install
```

### Setup

```bash
pnpm setup
# Follow prompts to configure your API key and preferences
```

### Start

```bash
pnpm start
# Dashboard: http://127.0.0.1:28789
```

### Build

```bash
pnpm install && pnpm build && pnpm start
```

### Development

```bash
pnpm dev
# Dashboard dev server: http://localhost:5175
# Gateway: http://127.0.0.1:28789
```

### Test

```bash
cd dashboard && npx vitest run      # Unit tests
cd dashboard && npx tsc --noEmit    # Type check
```

## Project Structure

```
research-claw/
├── config/                  # OpenClaw configuration overlay
│   ├── openclaw.json        # Active config (gitignored if contains secrets)
│   └── openclaw.example.json
├── dashboard/               # React + Vite + Ant Design 5 dashboard
│   ├── src/
│   │   ├── components/      # UI components (TopBar, LeftNav, ChatView, panels, cards)
│   │   ├── gateway/         # WebSocket RPC v3 client + hooks
│   │   ├── i18n/            # en.json + zh-CN.json locale files
│   │   ├── stores/          # Zustand stores (chat, config, ui, tasks, library, sessions)
│   │   ├── styles/          # Theme tokens + global CSS
│   │   └── types/           # Card type definitions
│   └── vite.config.ts
├── extensions/              # OpenClaw plugin scaffolds
├── patches/                 # pnpm patch for branding (~20 lines)
├── scripts/                 # install, setup, build, branding scripts
├── skills/                  # SKILL.md files
└── workspace/               # Bootstrap files (SOUL.md, AGENTS.md, etc.)
```

## Configuration

Edit `config/openclaw.json` to customize:

- **provider** / **model** / **apiKey** — LLM provider settings
- **gateway.port** — WebSocket gateway port (default: 28789)
- **proxy** — HTTP proxy for API calls
- **plugins** — Enabled plugin list

Copy from template: `cp config/openclaw.example.json config/openclaw.json`

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Research-Claw                     │
│                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Bootstrap │  │  Dashboard   │  │  Plugin    │ │
│  │  Files    │  │  React+Vite  │  │  research- │ │
│  │ (L0)      │  │  (L2)        │  │  claw-core │ │
│  └─────┬─────┘  └──────┬──────┘  │  (L1)      │ │
│        │               │         └──────┬─────┘ │
│        ▼               ▼                ▼       │
│  ┌──────────────────────────────────────────┐   │
│  │           OpenClaw (npm dep)             │   │
│  │     Gateway WS RPC v3 · Port 28789      │   │
│  └──────────────────────────────────────────┘   │
│        │                                         │
│  ┌─────┴─────┐                                  │
│  │ pnpm patch │  ~20 lines, 7 files (L3)       │
│  └───────────┘                                   │
└─────────────────────────────────────────────────┘
```

**Coupling Tiers:**
- **L0** — Filesystem: bootstrap files, skills, config overlay
- **L1** — Plugin SDK: tools, RPC methods, hooks, services
- **L2** — WS RPC: Dashboard communicates via gateway WebSocket
- **L3** — pnpm patch: minimal branding changes (~20 lines)

## Documentation

See [`docs/00-reference-map.md`](docs/00-reference-map.md) for the complete documentation index.

## License

[BSL 1.1](LICENSE) — Free for personal and academic research use.
Commercial use requires a separate license from [Wentor AI](https://wentor.ai).
Converts to Apache 2.0 on 2030-03-12.
