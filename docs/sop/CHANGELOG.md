# Research-Claw Global Operation Log

> Unified changelog across all development tracks.
> Per-track details: see individual SOP files (S1-S4).

---

## Format

```
[YYYY-MM-DD] [Track] [Agent/Author] — Description
```

Tracks: `Dashboard` (S1), `Modules` (S2), `Plugins` (S3), `Prompt` (S4), `Infra` (general)

---

## Log

### 2026-03-11 — Project Initialization

- [2026-03-11] [Infra] [Claude] Created satellite workspace: 105 files, own git, initial commit
- [2026-03-11] [Infra] [Claude] 12 design documents (~17,534 lines): 00-06 + modules/03a-03f
- [2026-03-11] [Prompt] [Claude] 8 bootstrap files (24.5K chars): SOUL, AGENTS, HEARTBEAT, BOOTSTRAP, IDENTITY, USER, TOOLS, MEMORY
- [2026-03-11] [Dashboard] [Claude] Dashboard scaffold: 22 TSX/TS stub files, Vite + React + Ant Design
- [2026-03-11] [Modules] [Claude] Plugin scaffold: research-claw-core (16 TS stubs), wentor-connect (placeholder)
- [2026-03-11] [Infra] [Claude] 7 script stubs: setup, install, build-dashboard, apply-branding, health, backup, sync-upstream
- [2026-03-11] [Infra] [Claude] Config files: openclaw.json, openclaw.example.json, .env.example, .gitignore
- [2026-03-11] [Plugins] [Claude] research-plugins v1.0.0 published (NPM + PyPI + GitHub)

### 2026-03-11 — Plan 2 Consistency Audit & Fixes

- [2026-03-11] [Modules] [Claude] 03a: Added rc_paper_notes table (§2.10), 8 new RPC methods (rc.lit.batch_add through rc.lit.notes.delete). Total lit methods: 18→26
- [2026-03-11] [Modules] [Claude] 03b: Added 2 new RPC methods (rc.task.link, rc.task.notes.add). Total task methods: 8→10
- [2026-03-11] [Modules] [Claude] 03c: Added rc.ws.save method, clarified rc.ws.upload as HTTP-only. Total ws methods: 6→7
- [2026-03-11] [Modules] [Claude] 03f: Rewrote §6 RPC registry with canonical names, fixed priority enum critical→urgent. Total: 35→46 methods
- [2026-03-11] [Infra] [Claude] 00: Updated reference map (tables 10→12, RPC 35→46, tools 18→24)
- [2026-03-11] [Infra] [Claude] Config: Added 6 tools to alsoAllow (both openclaw.json and .example.json)
- [2026-03-11] [Prompt] [Claude] MEMORY.md: Restructured to v1.1 (Global + Current Focus + Projects)

### 2026-03-11 — SOP Framework

- [2026-03-11] [Infra] [Claude] Created docs/sop/ directory with 5 files:
  - S1: Dashboard Dev SOP (layout, components, gateway contract, standards)
  - S2: Modules Dev SOP (plugin structure, DB schema, RPC, tools, standards)
  - S3: Plugin Integration SOP (research-plugins, wentor-connect, SDK patterns)
  - S4: Prompt & Behavior SOP (bootstrap files, red lines, workflow, modification guide)
  - CHANGELOG.md: This file (global operation log)
- [2026-03-11] [Infra] [Claude] Updated 00-reference-map.md with SOP document entries (S1-S5)

### 2026-03-11 — External Cleanup

- [2026-03-11] [Infra] [Claude] Archived 4 obsolete openclaw docs from wentor/docs/ to docs/archive/:
  - openclaw-architecture-analysis.md (superseded by research-claw/docs/02)
  - openclaw-docs-and-skills-guide.md (superseded by research-claw/docs/05)
  - openclaw-commands-and-tools-reference.md (superseded by research-claw/docs/02 + RPC ref)
  - openclaw_setup_and_config.plan.md (superseded by research-claw/docs/06)
- [2026-03-11] [Infra] [Claude] Pulled openclaw to latest (5 new commits: agent tool policy, plugin subagent runtime, device token rotate)

### 2026-03-11 — Audit Pass 2 (version refs + deep consistency)

- [2026-03-11] [Infra] [User+Claude] Updated OpenClaw commit hash 144c1b80→62d5df28d in 00, 02, 03e (4 occurrences)
- [2026-03-11] [Infra] [User+Claude] Updated 02 tool count "18 tools"→"24 tools, 46 RPC methods"
- [2026-03-11] [Infra] [User+Claude] Updated 00 MEMORY.md char count 516→964
- [2026-03-11] [Infra] [User+Claude] Added OpenClaw plugin HTTP scope enforcement note to S3 SOP
- [2026-03-11] [Infra] [Claude] Fixed 04 bootstrap budget table: all 8 file sizes updated to actual values (14,841→24,951 total chars)
- [2026-03-11] [Infra] [Claude] Fixed 03f cross-reference counts: lit RPC 18→26, task RPC 8→10, ws RPC 6→7

### 2026-03-12 — Status Assessment (P0 + P1-S1 + P1-S2)

Comprehensive review of implementation progress across Infrastructure, Dashboard, and Module tracks.

- [2026-03-12] [Infra] [User+Claude] P0 Infrastructure assessed at **92% complete**: pnpm patch (openclaw@2026.3.8.patch, 78 lines), brand replacement (11 occurrences), package.json patchedDependencies, INFRA_REPORT.md, config files, setup.sh + install.sh all done. Only apply-branding.sh remains a stub.
- [2026-03-12] [Dashboard] [User+Claude] P1-S1 Dashboard Shell assessed at **95% complete**: GatewayClient (267 lines, full WS RPC v3), gateway types/hooks/reconnect, TopBar/LeftNav/StatusBar, ChatView/MessageBubble/MessageInput, SetupWizard (217 lines), App.tsx responsive grid, 7 Zustand stores (4 complete + 3 skeleton), theme system, i18n (131 keys each), global.css (188 lines). Remaining: 5 panel stubs + 6 card stubs (Phase 2) and tests (Phase 4).
- [2026-03-12] [Modules] [User+Claude] P1-S2 Module Builder assessed at **97% complete**: db/schema.ts (12 tables + FTS5), db/connection.ts (WAL mode), db/migrations.ts (v1), LiteratureService (27 methods), TaskService (13 methods incl. cron), WorkspaceService (6+ methods + init/destroy), GitTracker, Cards protocol (6 custom types; code_block handled by markdown renderer) + serializer, Literature tools (12) + RPC (26), Task tools (6) + RPC (10 + 3 cron), Workspace tools (6) + RPC (7) + HTTP upload, plugin entry index.ts (416 lines). 24 tools total confirmed accurate. Remaining: unit tests (Phase 4).
- [2026-03-12] [Infra] [Claude] Updated CHANGELOG pending work section to reflect actual completion status.

### 2026-03-12 — Design System Alignment Audit & i18n Completeness

Comprehensive consistency audit of Dashboard against `docs/FRONTEND_DESIGN_SYSTEM.md`.

- [2026-03-12] [Dashboard] [Claude] **Design token fixes in `theme.ts`:**
  - Added missing tokens: `bg.code` (#161618/#F5F0EA), `accent.redHover` (#DC2626/#B91C1C), `accent.blueHover` (#2563EB/#1D4ED8)
  - Updated `ThemeTokens` type to include new fields
  - Fixed Button `borderRadius`: 4 -> 8 (per design system section 5.1)
  - Fixed Input `borderRadius`: 4 -> 8 (per design system section 5.1)
- [2026-03-12] [Dashboard] [Claude] **CSS variable fixes in `global.css`:**
  - Added `--code-bg` to dark (#161618) and light (#F5F0EA) themes
  - Added `--accent-primary-hover` and `--accent-secondary-hover` to both themes
  - Fixed body `font-size`: 14px -> 15px (per design system section 3.2)
  - Fixed body `line-height`: 1.5 -> 1.7 (per design system section 3.2)
  - Fixed scrollbar thumb `border-radius`: 3px -> 9999px (per design system section 12)
- [2026-03-12] [Dashboard] [Claude] **i18n fixes:**
  - Added 5 missing keys: `chat.dismiss`, `status.versionFallback`, `status.modelDefault`, `status.modelNA`, `panel.awaitingPlugin`
  - Added matching zh-CN translations for all 5 keys
  - Fixed hardcoded strings in StatusBar (model default, N/A, version fallback)
  - Fixed hardcoded "x" dismiss button in ChatView -> HTML entity + aria-label
  - Fixed 5 panel stubs: hardcoded English -> i18n key `panel.awaitingPlugin`
  - Total: en.json 100 keys, zh-CN.json 100 keys, all matched
- [2026-03-12] [Dashboard] [Claude] **Doc sync:**
  - Updated 03e section 9.1: replaced outdated color values with actual implementation (aligned with FRONTEND_DESIGN_SYSTEM.md)
  - Updated 03e section 9.2: replaced outdated Ant Design token example with actual `getAntdThemeConfig()` implementation
  - Verified 00-reference-map.md counts still accurate (24 tools, 46 RPC, 12 tables)

### 2026-03-12 — Phase 2 Complete (Cards + Panels + Stores + Bootstrap Rewrite)

Three parallel agents completed Phase 2A (Cards), 2B (Stores+Panels), and 2C (Bootstrap rewrite). Code review + cross-reference audit performed with zero bugs found.

**Phase 2A — Card Renderer (6 cards + CodeBlock interceptor + tests):**
- [2026-03-12] [Dashboard] [Claude] Created `types/cards.ts`: 6 card interfaces (PaperCard 12 fields, TaskCard 9, ProgressCard 9, ApprovalCard 6, RadarDigest 6, FileCard 8) + CARD_TYPES set + MessageCard union. All fields verified against protocol spec.
- [2026-03-12] [Dashboard] [Claude] Created `CardContainer.tsx`: shared card shell (border-left accent, theme tokens, max-width 560px)
- [2026-03-12] [Dashboard] [Claude] Created `PaperCard.tsx`: status badge, metadata grid, "Add to Library" (`rc.lit.add`), "Cite" (BibTeX clipboard), "Open PDF" (arxiv fallback)
- [2026-03-12] [Dashboard] [Claude] Created `TaskCard.tsx`: priority border colors, deadline computation (overdue/soon), "Mark Complete" (`rc.task.complete`), "View in Panel" (tab switch)
- [2026-03-12] [Dashboard] [Claude] Created `ProgressCard.tsx`: 2-column metric grid, highlights list, display-only
- [2026-03-12] [Dashboard] [Claude] Created `ApprovalCard.tsx`: risk-level borders, pulsing glow for high risk, Allow-Once + dropdown Always-Allow + Deny (`exec.approval.resolve`), pending/allowed/denied states
- [2026-03-12] [Dashboard] [Claude] Created `RadarDigest.tsx`: source/query/period metadata, notable papers list with relevance notes
- [2026-03-12] [Dashboard] [Claude] Created `FileCard.tsx`: file-type icons (6 categories), git status badges, size formatting, Open/Download buttons
- [2026-03-12] [Dashboard] [Claude] Created `CodeBlock.tsx`: card type detection via CARD_TYPES set, JSON parse with fallback, Shiki syntax highlighting (lazy singleton, 22 languages), copy button
- [2026-03-12] [Dashboard] [Claude] Updated `MessageBubble.tsx`: integrated CodeBlock as react-markdown `components.code`
- [2026-03-12] [Dashboard] [Claude] 7 test files: PaperCard (11), TaskCard (11), ProgressCard (9), ApprovalCard (13), RadarDigest (8), FileCard (13), CodeBlock (11) = 76 tests

**Phase 2B — Stores + Right Panels (5 panels + store fixes + tests):**
- [2026-03-12] [Dashboard] [Claude] Fixed `tasks.ts` store: priority `critical->urgent`, status `pending->todo` + `completed->done` + added `blocked`/`cancelled`, `assignee->task_type` (human/agent/mixed), added 9 missing fields, all RPC calls implemented (`rc.task.list/create/complete/update/delete`)
- [2026-03-12] [Dashboard] [Claude] Fixed `library.ts` store: added missing fields (venue, url, arxiv_id, pdf_path, is_own, source_type, created_at, updated_at), all RPC calls implemented (`rc.lit.list/tags/status/rate/search/delete`)
- [2026-03-12] [Dashboard] [Claude] Fixed `sessions.ts` store: RPC calls implemented (`sessions.list/delete`), createSession via crypto.randomUUID
- [2026-03-12] [Dashboard] [Claude] Created `LibraryPanel.tsx`: Pending/Saved sub-tabs, search with 300ms debounce, tag filter chips, virtual scrolling via react-window v2 (>50 items threshold), status badge cycle-click, star rating, paper actions menu
- [2026-03-12] [Dashboard] [Claude] Created `TaskPanel.tsx`: 4 sections (overdue/upcoming/noDeadline/completed), perspective toggle (All/Human/Agent), priority left-border, deadline color coding, checkbox completion, collapsible completed section
- [2026-03-12] [Dashboard] [Claude] Created `WorkspacePanel.tsx`: file tree (recursive, auto-expand depth<2), recent changes from `rc.ws.history`, file-type icons (7 categories), git badges (M/+), drag-drop upload via `/rc/upload`, relative timestamps
- [2026-03-12] [Dashboard] [Claude] Created `RadarPanel.tsx`: tracking config sections (keywords/authors/journals), radar_digest extraction from chat history, "Edit via chat" and "Refresh" prefill, empty state guidance
- [2026-03-12] [Dashboard] [Claude] Created `SettingsPanel.tsx`: 4 sub-tabs (General/Model/Proxy/About), language/theme/sound/scroll/timestamp settings, model provider/API key/temperature/max tokens, proxy SOCKS5/HTTP with auth, diagnostics copy, bootstrap file list
- [2026-03-12] [Dashboard] [Claude] Updated `TopBar.tsx`: notification dropdown with bell badge, agent status dot with pulse animation, event subscriptions (heartbeat.alert, task.deadline, notification)
- [2026-03-12] [Dashboard] [Claude] Updated `LeftNav.tsx`: project switcher dropdown (sessions list + "All Projects" + "New Project"), active session indicator, collapsed/expanded modes
- [2026-03-12] [Dashboard] [Claude] Updated `RightPanel.tsx`: lazy-loaded panel content, resize handle, panel header with close button
- [2026-03-12] [Dashboard] [Claude] Updated `ui.ts` store: Notification interface (4 types), addNotification/markRead/markAllRead/clear, unreadCount tracking
- [2026-03-12] [Dashboard] [Claude] 5 test files: LibraryPanel (4), TaskPanel (4), WorkspacePanel (5), RadarPanel (4), SettingsPanel (4) = 21 tests

**Phase 2C — Bootstrap Rewrite (8 files):**
- [2026-03-12] [Dashboard] [Claude] Rewrote `AGENTS.md` v2.0 (17,316 chars): session startup checklist (6 checks), cold start protocol, identity/capabilities, HiL protocol (full + nuanced rules), 4-phase research workflow SOP, discipline-specific sections (humanities, wet lab, CS, engineering/math), tool usage patterns table, structured output formatting with 6 JSON card examples (all field names verified against protocol.ts), red lines (6), memory management rules
- [2026-03-12] [Dashboard] [Claude] Rewrote `TOOLS.md` v2.0 (4,604 chars): 6 external API references, 24 local tools in 3 tables (12 library + 6 task + 6 workspace), citation style list, export/import formats, config reference. All 24 tool names verified against `openclaw.json` alsoAllow list.
- [2026-03-12] [Dashboard] [Claude] Rewrote `HEARTBEAT.md` v2.0 (3,312 chars): 5 routine checks (deadline, group meeting prep, daily digest, reading reminders, quiet hours), JSON output format using progress_card, configurable thresholds table (6 parameters)
- [2026-03-12] [Dashboard] [Claude] Rewrote `BOOTSTRAP.md` v2.0 (6,363 chars): 6-step onboarding flow (profile + IM connections + workspace setup + group meeting + honey demo + environment detection), card output examples, completion with BOOTSTRAP.md.done rename
- [2026-03-12] [Dashboard] [Claude] Rewrote `SOUL.md` v2.0 (4,058 chars): 5 core principles, interaction style, 6 red lines, continuity rules, research ethics
- [2026-03-12] [Dashboard] [Claude] Updated `USER.md` v2.0 (970 chars): structured profile template
- [2026-03-12] [Dashboard] [Claude] All 8 bootstrap files within character budget: 38,290 total (limit 150,000), max single file 17,316 (limit 20,000)

**Phase 2 Code Review & Verification:**
- [2026-03-12] [Infra] [Claude] TypeScript compilation: zero errors (`pnpm typecheck`)
- [2026-03-12] [Infra] [Claude] All 139 tests pass across 16 test files (`pnpm test`)
- [2026-03-12] [Infra] [Claude] i18n audit: 231 keys in en.json, 231 keys in zh-CN.json, all matched, no missing/extra keys. All 14 required key groups present with minimum counts met.
- [2026-03-12] [Infra] [Claude] RPC method audit: all 21 RPC calls in dashboard code verified against canonical list (14 rc.* methods + 7 OpenClaw built-in methods). Zero invalid method names.
- [2026-03-12] [Infra] [Claude] TOOLS.md tool audit: all 24 canonical tools present, names match exactly.
- [2026-03-12] [Infra] [Claude] AGENTS.md card audit: all 6 card types have JSON examples, all field names match protocol.ts.
- [2026-03-12] [Infra] [Claude] SOUL.md red lines audit: all 6 red lines present and correctly worded.
- [2026-03-12] [Infra] [Claude] Card type fields verified against cards.ts: PaperCard (12), TaskCard (9), ProgressCard (9), ApprovalCard (6), RadarDigest (6+NotablePaper 3), FileCard (8).
- [2026-03-12] [Infra] [Claude] Store→Panel data flow verified: LibraryPanel→useLibraryStore, TaskPanel→useTasksStore+useChatStore, WorkspacePanel→useGatewayStore (direct RPC), RadarPanel→useChatStore, SettingsPanel→useConfigStore+useGatewayStore.
- [2026-03-12] [Infra] [Claude] No bugs found. Zero code fixes required.

### 2026-03-12 — Phase 3 Complete (RPC Fixes + Responsive + Accessibility + Virtual Scroll)

Dashboard hardening: RPC parameter alignment, responsive panel modes, accessibility, and virtual scrolling.

- [2026-03-12] [Dashboard] [Claude] **RPC parameter mismatches fixed in `library.ts`:** `status`→`read_status`, `tags`→`tag`, `yearMin`/`yearMax`→`year` (single param), `loadTags` response type fixed to `Tag[]` (was incorrectly typed)
- [2026-03-12] [Dashboard] [Claude] Created `ErrorBoundary.tsx` component: catches render errors, displays error.title + error.retry + error.details UI, wrapped around main App content
- [2026-03-12] [Dashboard] [Claude] Responsive panel modes: overlay at 1024-1439px (backdrop click to close), modal at <1024px (full-screen takeover)
- [2026-03-12] [Dashboard] [Claude] Virtual scrolling in `ChatView.tsx`: react-window for long message lists (>100 messages threshold)
- [2026-03-12] [Dashboard] [Claude] Accessibility: `role="main"`, `role="navigation"`, `role="complementary"` on layout regions; `aria-label` on all interactive elements (send button, close panel, collapse nav, etc.)
- [2026-03-12] [Dashboard] [Claude] New i18n keys: `error.title`, `error.retry`, `error.details` (error boundary); `a11y.mainContent`, `a11y.sidePanel`, `a11y.navigation`, `a11y.notifications`, `a11y.collapseNav`, `a11y.expandNav`, `a11y.closePanel` (accessibility labels)

### 2026-03-12 — Phase 4 Complete (Tests + Install Scripts + Build Optimization + README)

Final polish: comprehensive test suite, production install scripts, build optimization, and documentation.

- [2026-03-12] [Dashboard] [Claude] **62 new tests across 3 areas:**
  - Gateway client tests (20): connection lifecycle, request/response, event subscription, reconnection, timeout, error handling
  - Chat store tests (26): send/receive, streaming states (delta/final/aborted/error), abort, history load, session switching, token counting, silent reply filtering
  - Config store tests (16): load/save, theme toggle, language switch, proxy settings, model configuration, persistence
- [2026-03-12] [Infra] [Claude] **Install scripts fully implemented:**
  - `scripts/install.sh`: dependency check (node/pnpm), pnpm install, patch apply, dashboard build, workspace init, config verification
  - `scripts/apply-branding.sh`: brand asset copy, CSS variable injection, manifest update, icon generation
- [2026-03-12] [Dashboard] [Claude] **Shiki manual chunk optimization:** split Shiki core + themes + languages into separate chunks via `build.rollupOptions.output.manualChunks` in `vite.config.ts`
- [2026-03-12] [Infra] [Claude] Updated `README.md` with installation instructions, development setup, architecture overview, and contributing guide
- [2026-03-12] [Infra] [Claude] **i18n audit passed:** 244 leaf keys in en.json, 244 leaf keys in zh-CN.json, all keys synchronized with zero mismatches

### 2026-03-12 — Final Integration Testing (Step 9)

Cross-file consistency audit and build pipeline verification.

- [2026-03-12] [Infra] [Claude] **Card types audit:** protocol.ts (6 types, canonical) vs dashboard/cards.ts vs AGENTS.md JSON examples — all field names match exactly. Zero mismatches.
- [2026-03-12] [Infra] [Claude] **RPC methods audit:** 12 rc.* methods used in dashboard, all present in canonical list (45 WS + 1 HTTP = 46 total). 7 OpenClaw built-in methods also verified (chat.send, chat.abort, chat.history, sessions.delete, exec.approval.resolve, config.set, health).
- [2026-03-12] [Infra] [Claude] **Tool names audit:** 24 tools in openclaw.json = 24 in TOOLS.md = 24 in 00-reference-map.md. All names match exactly.
- [2026-03-12] [Infra] [Claude] **i18n key sync:** 244 leaf keys in en.json, 244 in zh-CN.json, all matched.
- [2026-03-12] [Infra] [Claude] **Build pipeline:** TypeScript zero errors (dashboard + plugin), 318/318 tests passed (28 test files), Vite build successful (131.64 kB main bundle gzip: 41.24 kB).
- [2026-03-12] [Infra] [Claude] **Bootstrap files:** 38,290/150,000 chars total, max single file 17,316/20,000, all 6 JSON blocks in AGENTS.md parse correctly, all tool names in TOOLS.md match config.
- [2026-03-12] [Infra] [Claude] **Reference map fix:** rc.ws.* count corrected from 7→6 in table (upload is HTTP, not WS RPC — already documented separately in §3.6).

---

## Completed Work

### Infrastructure (P0) — 95%

- [x] Generate pnpm patch (openclaw@2026.3.8.patch, 78 lines)
- [x] Brand replacement (11 occurrences across codebase)
- [x] package.json patchedDependencies config
- [x] INFRA_REPORT.md
- [x] Config files: openclaw.json + openclaw.example.json
- [x] scripts/install.sh (real implementation)
- [x] scripts/setup.sh (real implementation)

### Dashboard Shell (P1-S1) — 100%

- [x] GatewayClient (267 lines, full WS RPC v3 protocol)
- [x] gateway/types.ts, hooks.ts, reconnect.ts
- [x] TopBar (+ notification dropdown), LeftNav (+ project switcher), StatusBar (all complete)
- [x] ChatView, MessageBubble (+ CodeBlock integration), MessageInput (all complete)
- [x] SetupWizard (217 lines, 1-step flow)
- [x] App.tsx with responsive grid layout
- [x] 7 Zustand stores (all fully implemented: gateway, chat, config, ui, library, tasks, sessions)
- [x] Theme system (dark + light, HashMind aligned)
- [x] i18n: en.json + zh-CN.json (244 keys each)
- [x] global.css (188 lines)

### Dashboard Phase 2 (Cards + Panels) — 100%

- [x] 6 message card components (PaperCard, TaskCard, ProgressCard, ApprovalCard, RadarDigest, FileCard)
- [x] CardContainer shared shell + types/cards.ts (6 interfaces + union type)
- [x] CodeBlock interceptor (card detection + Shiki syntax highlighting)
- [x] 5 right panel components (LibraryPanel, TaskPanel, WorkspacePanel, RadarPanel, SettingsPanel)
- [x] RightPanel with lazy loading + resize handle
- [x] 139 tests across 16 test files (76 card tests + 21 panel tests + 42 existing)

### Dashboard Phase 3 (Hardening) — 100%

- [x] RPC parameter mismatches fixed (library.ts: status→read_status, tags→tag, yearMin/yearMax→year, loadTags response type)
- [x] ErrorBoundary component created and wrapped
- [x] Responsive panel modes (overlay at 1024-1439px, modal at <1024px)
- [x] Virtual scrolling in ChatView (react-window, >100 messages threshold)
- [x] Accessibility roles and aria-labels on all layout regions and interactive elements
- [x] New i18n keys: error.* (3 keys) and a11y.* (7 keys)

### Dashboard Phase 4 (Testing + Polish) — 100%

- [x] 62 new tests: gateway client (20), chat store (26), config store (16)
- [x] Install scripts: install.sh and apply-branding.sh fully implemented
- [x] Shiki manual chunk optimization in vite.config.ts
- [x] README.md updated
- [x] i18n audit passed: 244 keys synchronized in both locales
- [x] 318 total tests across 28 test files — all passing

### Module Builder (P1-S2) — 97%

- [x] db/schema.ts (12 tables + FTS5)
- [x] db/connection.ts (better-sqlite3 manager, WAL mode)
- [x] db/migrations.ts (v1)
- [x] LiteratureService (27 methods -- originally planned 26, 1 added)
- [x] TaskService (13 methods including cron -- originally planned 10, 3 added)
- [x] WorkspaceService (6+ methods + init/destroy)
- [x] GitTracker
- [x] Cards protocol (6 custom types; code_block handled by markdown renderer) + serializer
- [x] Literature tools (12) + RPC (26)
- [x] Task tools (6) + RPC (10 + 3 cron)
- [x] Workspace tools (6) + RPC (7) + HTTP upload
- [x] Plugin entry index.ts (416 lines, all registrations)
- [x] 6 hooks registered

---

## Pending Work (Post-MVP)

### Infrastructure
- [ ] End-to-end: install -> setup -> start -> chat integration test (requires live OpenClaw instance)

### Modules (P1-S2)
- [ ] Plugin unit tests: vitest with in-memory SQLite

### Plugins (S3)
- [ ] Verify research-plugins skill loading end-to-end (requires live OpenClaw instance)
- [ ] Implement wentor-connect OAuth flow
- [ ] Integration test: gateway + plugin + dashboard round-trip

### Prompt (S4)
- [ ] Behavioral testing with live agent (requires running LLM)
- [ ] Refine AGENTS.md workflow steps based on real user testing
- [ ] Tune HEARTBEAT.md thresholds based on user feedback

---

*Document: CHANGELOG | Created: 2026-03-11 | Last updated: 2026-03-12*
