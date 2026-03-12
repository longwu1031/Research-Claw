# Research-Claw Phase 2-4 开发计划

> **文档状态**: DEFINITIVE
> **创建日期**: 2026-03-12
> **基于**: 代码库实际状态 (P0 + P1-S1 + P1-S2 PASS)
> **OpenClaw**: 2026.3.8 (commit `62d5df28d`) | Protocol v3

---

## 目录

1. [Phase 2A — 卡片渲染器 (Card Renderer)](#phase-2a--卡片渲染器)
2. [Phase 2B — 右侧面板 (Right Panel Tabs)](#phase-2b--右侧面板)
3. [Phase 2C — 提示词调优 (Prompt Behavior Tuning)](#phase-2c--提示词调优)
4. [Phase 3 — 生态集成 (Ecosystem Integration)](#phase-3--生态集成)
5. [Phase 4 — 收尾打磨 (Cleanup & Polish)](#phase-4--收尾打磨)

---

## 代码库现状摘要

### 已完成 (PASS)

| 项目 | 状态 | 测试 |
|------|------|------|
| pnpm patch + branding | PASS 8/8 | Gateway 启动正常 |
| GatewayClient + reconnect | 已实现 | `dashboard/src/gateway/client.ts` (266行) |
| 4 hooks: useGateway, useRpc, useEvent, useChat | 已实现 | `dashboard/src/gateway/hooks.ts` (129行) |
| 7 Zustand stores: gateway, chat, config, ui, library, tasks, sessions | 已实现 | chat/config/gateway/ui 功能完整; library/tasks/sessions 为骨架 |
| App shell + Layout + TopBar + LeftNav + StatusBar | 已实现 | 42 个测试通过 |
| SetupWizard (单步) | 已实现 | provider/endpoint/apiKey/proxy |
| Theme system (dark/light) | 已实现 | `dashboard/src/styles/theme.ts` 含完整 tokens |
| i18n (en + zh-CN) | 已实现 | 基础 keys 覆盖所有已实现组件 |
| research-claw-core plugin | PASS 15/18 | 24 tools, 46 custom methods (45 WS RPC + 1 HTTP endpoint), 12 tables + FTS5, 3 services |

### 待实现 (本计划范围)

| 模块 | 文件 | 当前状态 |
|------|------|---------|
| 6 Card 组件 | `dashboard/src/components/chat/cards/*.tsx` | 全部 TODO 占位 |
| 5 Panel 组件 | `dashboard/src/components/panels/*.tsx` | 全部占位 (仅显示图标+标题) |
| library store 方法 | `dashboard/src/stores/library.ts` | 骨架, RPC 调用为 TODO |
| tasks store 方法 | `dashboard/src/stores/tasks.ts` | 骨架, 类型与 spec 不一致 |
| sessions store 方法 | `dashboard/src/stores/sessions.ts` | 骨架, RPC 调用为 TODO |
| 8 bootstrap 文件 | `workspace/*.md` | 已写入, 需行为验证 |
| research-plugins 集成 | config 已声明 | 未端到端验证 |

---

## 并行执行策略

本计划的 5 个 Phase 并非严格串行。根据依赖关系, 可按以下并行布局执行:

```
Session 1 (并行):
  ├── 2A (Cards — 6 card components + CodeBlock interceptor)
  ├── 2B Steps 1-5 (Store type fixes + RPC method filling)
  └── 2C Steps 1-4 (Static verification: TOOLS.md, AGENTS.md, char budget, red lines)

Session 2 (并行, 需 Session 1 完成):
  ├── 2B Steps 6-12 (5 Panel components + integration tests)
  └── 2C Steps 5-6 (Live behavior testing — needs LLM)

Session 3: Phase 3 (Ecosystem integration round-trip)

Session 4: Phase 4 (Cleanup + additions — NotificationDropdown, Project Switcher, branding script, E2E smoke)
```

**依赖图**:
- **Session 1** 的三条路径互不依赖: 2A 卡片渲染只需 protocol spec; 2B Steps 1-5 只修 store types/RPC; 2C Steps 1-4 只做静态文件校验。
- **Session 2** 的 Panel 组件 (2B Steps 6-12) 依赖 2A 的卡片类型和 2B Steps 1-5 的 store 方法; 2C 行为测试 (Steps 5-6) 依赖卡片渲染和 tools 可用。
- **Session 3** (Phase 3) 需要 Dashboard + Prompt 全部就绪。
- **Session 4** (Phase 4) 是收尾, 包含所有 cleanup + 新增项。

---

## Phase 2A — 卡片渲染器

> **目标**: 实现 6 个 Message Card 组件 + Markdown CodeBlock 拦截器
> **预估工作量**: 1 session
> **依赖**: P1-S1 (shell), 03d (protocol)

### A. 开始前必读

| # | 文件路径 | 必读原因 |
|---|---------|---------|
| 1 | `docs/modules/03d-message-card-protocol.md` §3.1-3.7 | 6种卡片 TypeScript 接口 + JSON Schema 定义 — **每个字段名必须精确匹配** |
| 2 | `docs/modules/03d-message-card-protocol.md` §5-6 | Parser pipeline + Dashboard renderer mapping |
| 3 | `docs/01-interaction-design.md` §12.1-12.7 | 每种卡片的视觉规格 (布局、颜色、按钮行为) |
| 4 | `extensions/research-claw-core/dist/src/cards/protocol.d.ts` | 已编译的 TypeScript 接口 — **卡片组件 props 类型从此文件导出** |
| 5 | `extensions/research-claw-core/dist/src/cards/serializer.d.ts` | `parseMessageCards()` 函数签名 + `ParsedBlock` 接口 |
| 6 | `dashboard/src/styles/theme.ts` | `ThemeTokens` 类型 + `getThemeTokens()` — 禁止硬编码颜色 |
| 7 | `dashboard/src/gateway/hooks.ts` | `useRpc()` 签名 — 卡片交互 (如 Add to Library) 需调用 RPC |
| 8 | `dashboard/src/i18n/en.json` + `zh-CN.json` | 当前 i18n keys — 新增 keys 两个文件都要加 |
| 9 | `docs/modules/03e-dashboard-ui.md` §7 | Streaming message handling + card parsing in CodeBlock |

### B. 开发 TodoList

#### Step 1: 创建共享卡片类型文件

**文件**: `dashboard/src/types/cards.ts`

从 `extensions/research-claw-core/dist/src/cards/protocol.d.ts` 复制并导出以下接口 (字段名必须完全一致):

```typescript
// 从 protocol.d.ts 精确复制
export type CardType = 'paper_card' | 'task_card' | 'progress_card' | 'approval_card' | 'radar_digest' | 'file_card';

export const CARD_TYPES: ReadonlySet<string> = new Set([
  'paper_card', 'task_card', 'progress_card', 'approval_card', 'radar_digest', 'file_card',
]);

export interface PaperCard {
  type: 'paper_card';
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  doi?: string;
  url?: string;
  arxiv_id?: string;
  abstract_preview?: string;
  read_status?: 'unread' | 'reading' | 'read' | 'reviewed';
  library_id?: string;
  tags?: string[];
}

export interface TaskCard {
  type: 'task_card';
  id?: string;
  title: string;
  description?: string;
  task_type: 'human' | 'agent' | 'mixed';
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  deadline?: string;
  related_paper_title?: string;
}

export interface ProgressCard {
  type: 'progress_card';
  period: string;
  papers_read: number;
  papers_added: number;
  tasks_completed: number;
  tasks_created: number;
  writing_words?: number;
  reading_minutes?: number;
  highlights?: string[];
}

export interface ApprovalCard {
  type: 'approval_card';
  action: string;
  context: string;
  risk_level: 'low' | 'medium' | 'high';
  details?: Record<string, unknown>;
  approval_id?: string;
}

export interface NotablePaper {
  title: string;
  authors: string[];
  relevance_note: string;
}

export interface RadarDigest {
  type: 'radar_digest';
  source: string;
  query: string;
  period: string;
  total_found: number;
  notable_papers: NotablePaper[];
}

export interface FileCard {
  type: 'file_card';
  name: string;
  path: string;
  size_bytes?: number;
  mime_type?: string;
  created_at?: string;
  modified_at?: string;
  git_status?: 'new' | 'modified' | 'committed';
}

export type MessageCard = PaperCard | TaskCard | ProgressCard | ApprovalCard | RadarDigest | FileCard;
```

**验证**: 与 `protocol.d.ts` 逐字段比对。PaperCard = 12 fields, TaskCard = 9 fields, ProgressCard = 9 fields (8 data fields + type discriminator), ApprovalCard = 6 fields, RadarDigest = 6 fields (含 NotablePaper 子接口 3 fields), FileCard = 8 fields。

#### Step 2: 创建 CardContainer 共享壳组件

**文件**: `dashboard/src/components/chat/cards/CardContainer.tsx`

**实现**:
- 共享外壳, 所有 6 种卡片的容器
- Props: `{ children, borderColor?: string, maxWidth?: number }`
- 样式 (来自 01-interaction-design.md §12):
  - `background: var(--bg-surface)` -> 使用 `tokens.bg.surface`
  - `border: 1px solid` -> `tokens.border.default`
  - `border-radius: 8px`
  - `padding: 16px`
  - `max-width: 560px`
  - `margin: 8px 0`
  - `border-left: 3px solid {borderColor}`
  - `font-family: Inter` (UI), `JetBrains Mono` (metadata)

#### Step 3: 实现 PaperCard

**文件**: `dashboard/src/components/chat/cards/PaperCard.tsx`

**Props**: `PaperCard` 接口 (from Step 1)

**视觉规格** (01 §12.1):
- Status badge: 顶部左侧, 8px 圆圈, 颜色对应 `read_status`:
  - `unread` -> `tokens.text.muted` (gray, hollow)
  - `reading` -> `#3B82F6` (blue, half-filled)
  - `read` -> `#22C55E` (green, filled)
  - `reviewed` -> `#A855F7` (purple, filled + check)
- Title: Inter SemiBold 15px, `tokens.text.primary`
- Metadata labels: Inter Regular 12px, `tokens.text.muted`; values in `tokens.text.secondary`
- DOI: `tokens.accent.blue`, clickable 跳转 `https://doi.org/{doi}`
- Tags: Chip badges
- Actions:
  - "Add to Library": outlined button, `tokens.accent.blue`. 如果 `library_id` 存在则禁用显示 "In Library"。点击调用 `rc.lit.add` RPC
  - "Cite": outlined button, 点击复制 BibTeX 到剪贴板, toast "Citation copied"
  - "Open PDF": outlined button, 仅在 `url` 或 `arxiv_id` 存在时显示。构建 URL: `url ?? \`https://arxiv.org/pdf/${arxiv_id}\``
- border-left: 3px, 颜色与 read_status 一致

#### Step 4: 实现 TaskCard

**文件**: `dashboard/src/components/chat/cards/TaskCard.tsx`

**Props**: `TaskCard` 接口

**视觉规格** (01 §12.2):
- Priority indicator: left 3px border, 颜色 (01 §7.4.4):
  - `urgent` -> `#EF4444`
  - `high` -> `#F59E0B`
  - `medium` -> `#3B82F6`
  - `low` -> `#6B7280`
- Title: Inter SemiBold 15px
- Metadata: key-value pairs (Deadline, Priority, Status, Related Paper)
- Deadline: 红色 if overdue, 黄色 if within 3 days, 否则默认
- Status badge: inline badge — `todo` (gray), `in_progress` (blue), `done` (green), `blocked` (red), `cancelled` (gray strikethrough)
- Actions:
  - "View in Tasks Panel ->": text link, 点击 `uiStore.setRightPanelTab('tasks')`
  - "Mark Complete": 仅在 `id` 存在且 `status !== 'done'/'cancelled'` 时显示。点击调用 `rc.task.complete` RPC

#### Step 5: 实现 ProgressCard

**文件**: `dashboard/src/components/chat/cards/ProgressCard.tsx`

**Props**: `ProgressCard` 接口

**视觉规格** (01 §12.3):
- Header icon: Chart icon, 20px, `tokens.accent.blue`
- Title: Inter SemiBold 15px, "Research Progress" (i18n key: `card.progress.title`)
- Date range: `period` 字段, Inter Regular 12px, `tokens.text.muted`
- Metrics: key-value grid, 2 columns
  - keys: left-aligned, `tokens.text.muted`
  - values: right-aligned, JetBrains Mono, `tokens.text.primary`
  - 必须显示的 metrics: `papers_read`, `papers_added`, `tasks_completed`, `tasks_created`
  - 可选 metrics: `writing_words`, `reading_minutes`
- Highlights: bulleted list, Inter Regular 13px, `tokens.text.secondary`
- border-left: 3px `tokens.accent.blue`
- 无交互按钮 (display-only)

#### Step 6: 实现 ApprovalCard

**文件**: `dashboard/src/components/chat/cards/ApprovalCard.tsx`

**Props**: `ApprovalCard` 接口 + `{ onResolve?: (decision: 'allow-once' | 'allow-always' | 'deny') => void }`

**视觉规格** (01 §12.4):
- Header icon: Warning triangle, 20px, `#F59E0B`
- Title: Inter SemiBold 15px, "Approval Required" (i18n: `card.approval.title`), `#F59E0B`
- Context text: Inter Regular 14px
- Action/Context/Risk: key-value pairs
- Details: if present, render as JSON key-value summary
- Approve button: solid `#22C55E` bg, white text
- Reject button: outlined `#EF4444` border + text
- Risk level rendering:
  - `low`: green left border, no icon
  - `medium`: amber left border + caution icon
  - `high`: red left border + warning icon + pulsing glow
- States: pending (all buttons active), allowed (badge, disabled, green tint), denied (badge, disabled, red tint)
- 点击 "Allow Once": `gateway.request('exec.approval.resolve', { id: approval_id, decision: 'allow-once' })`
- 点击 "Always Allow": `gateway.request('exec.approval.resolve', { id: approval_id, decision: 'allow-always' })`
- 点击 Deny: `gateway.request('exec.approval.resolve', { id: approval_id, decision: 'deny' })`
- **OpenClaw 实际签名**: `exec.approval.resolve` 参数为 `{ id: string, decision: "allow-once" | "allow-always" | "deny" }`，返回 `{ ok: true }`。**不是 boolean**。
- **事件**: 订阅 `exec.approval.requested` 接收新审批，`exec.approval.resolved` 更新已处理状态
- Approve 按钮设计: 主按钮 "Allow Once" + 下拉 "Always Allow"；risk_level=high 时隐藏 "Always Allow"
- 内部 state: `status: 'pending' | 'allowed' | 'denied'`

#### Step 7: 实现 RadarDigest

**文件**: `dashboard/src/components/chat/cards/RadarDigest.tsx`

**Props**: `RadarDigest` 接口

**视觉规格** (01 §12.5):
- Header icon: Satellite dish, 20px, `tokens.accent.blue`
- Title: "Radar Update" (i18n: `card.radar.title`)
- Summary: `{total_found} new papers matching "{query}"` (i18n template)
- Notable papers: numbered list, 每条:
  - Title: Inter Medium 13px
  - Authors + relevance_note: Inter Regular 12px, `tokens.text.muted`
- Source: chip badge
- Period: Inter Regular 12px
- border-left: 3px `tokens.accent.blue`
- 无主要交互按钮

#### Step 8: 实现 FileCard

**文件**: `dashboard/src/components/chat/cards/FileCard.tsx`

**Props**: `FileCard` 接口

**视觉规格** (01 §12.6):
- File icon: type-specific, 24px (colors from 01 §7.3.2):
  - `.pdf` -> `#EF4444`
  - `.tex/.md/.txt` -> `tokens.text.secondary`
  - `.py/.r/.jl/.m` -> `#22C55E`
  - `.csv/.xlsx/.json` -> `#3B82F6`
  - `.png/.jpg/.svg` -> `#A855F7`
  - `.bib` -> `#F59E0B`
- Filename: Inter SemiBold 14px
- Metadata: Path, Size (human-readable), Type (mime_type)
- Git status: badge if present (`new` -> `+` green, `modified` -> `M` blue)
- Actions:
  - "Open": outlined button (功能取决于环境, 暂可用 `window.open` 或 noop)
  - "Download": outlined button
- border-left: 3px, color matches file type icon color

#### Step 9: 创建 CodeBlock 拦截器 + Card Renderer

**文件**: `dashboard/src/components/chat/CodeBlock.tsx`

**实现逻辑** (03d §5 + 03e §7.3):

```typescript
import { CARD_TYPES } from '../../types/cards';
// react-markdown 的 custom code component
export function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const language = className?.replace('language-', '');
  const codeString = String(children).replace(/\n$/, '');

  // 1) 检查是否为已知卡片类型
  if (language && CARD_TYPES.has(language)) {
    try {
      const data = JSON.parse(codeString);
      return renderCard(language, data);
    } catch {
      // JSON 解析失败 -> 降级为普通代码块
    }
  }

  // 2) 普通代码块 -> Shiki 语法高亮 + Copy/Save 按钮
  return <SyntaxHighlightedBlock language={language} code={codeString} />;
}

function renderCard(type: string, data: unknown): JSX.Element {
  switch (type) {
    case 'paper_card': return <PaperCard {...(data as PaperCard)} />;
    case 'task_card': return <TaskCard {...(data as TaskCard)} />;
    case 'progress_card': return <ProgressCard {...(data as ProgressCard)} />;
    case 'approval_card': return <ApprovalCard {...(data as ApprovalCard)} />;
    case 'radar_digest': return <RadarDigestComponent {...(data as RadarDigest)} />;
    case 'file_card': return <FileCard {...(data as FileCard)} />;
    default: return <FallbackCodeBlock code={JSON.stringify(data, null, 2)} />;
  }
}
```

**关键**: 将此 `CodeBlock` 组件注入 react-markdown 的 `components.code` prop。
参考 03e §7.3 的 `CodeBlock({ className, children })` 签名。

#### Step 10: 更新 MessageBubble 集成 CodeBlock

**文件**: `dashboard/src/components/chat/MessageBubble.tsx` (已有, 需修改)

将 react-markdown 的 code 组件替换为 Step 9 的 `CodeBlock`:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    code: CodeBlock,
  }}
>
  {message.text}
</ReactMarkdown>
```

#### Step 11: 添加 i18n keys

**文件**: `dashboard/src/i18n/en.json` 和 `dashboard/src/i18n/zh-CN.json`

新增 keys (精确列表):

```json
// en.json 新增
{
  "card": {
    "paper": {
      "addToLibrary": "Add to Library",
      "inLibrary": "In Library",
      "cite": "Cite",
      "openPdf": "Open PDF",
      "citationCopied": "Citation copied to clipboard",
      "authors": "Authors",
      "venue": "Venue",
      "year": "Year",
      "doi": "DOI",
      "tags": "Tags",
      "noAbstract": "No abstract available"
    },
    "task": {
      "viewInPanel": "View in Tasks Panel",
      "markComplete": "Mark Complete",
      "deadline": "Deadline",
      "priority": "Priority",
      "status": "Status",
      "relatedPaper": "Related Paper",
      "overdue": "Overdue",
      "dueIn": "Due in {{days}} days",
      "noDl": "No deadline"
    },
    "progress": {
      "title": "Research Progress",
      "papersRead": "Papers read",
      "papersAdded": "Papers added",
      "tasksCompleted": "Tasks completed",
      "tasksCreated": "Tasks created",
      "writingWords": "Words written",
      "readingMinutes": "Reading time (min)",
      "highlights": "Highlights"
    },
    "approval": {
      "title": "Approval Required",
      "action": "Action",
      "context": "Context",
      "riskLevel": "Risk Level",
      "details": "Details",
      "approve": "Approve",
      "reject": "Reject",
      "approved": "Approved",
      "rejected": "Rejected",
      "riskLow": "Low",
      "riskMedium": "Medium",
      "riskHigh": "High"
    },
    "radar": {
      "title": "Radar Update",
      "source": "Source",
      "query": "Query",
      "period": "Period",
      "found": "{{count}} new papers found",
      "notablePapers": "Notable Papers",
      "relevance": "Why relevant"
    },
    "file": {
      "open": "Open",
      "download": "Download",
      "path": "Path",
      "size": "Size",
      "type": "Type",
      "gitNew": "New",
      "gitModified": "Modified",
      "gitCommitted": "Committed"
    }
  },
  "code": {
    "copy": "Copy",
    "copied": "Copied!",
    "save": "Save"
  }
}
```

zh-CN 对应翻译:

```json
{
  "card": {
    "paper": {
      "addToLibrary": "添加到文献库",
      "inLibrary": "已在文献库中",
      "cite": "引用",
      "openPdf": "打开 PDF",
      "citationCopied": "引用已复制到剪贴板",
      "authors": "作者",
      "venue": "发表于",
      "year": "年份",
      "doi": "DOI",
      "tags": "标签",
      "noAbstract": "无摘要"
    },
    "task": {
      "viewInPanel": "在任务面板中查看",
      "markComplete": "标记完成",
      "deadline": "截止日期",
      "priority": "优先级",
      "status": "状态",
      "relatedPaper": "关联论文",
      "overdue": "已逾期",
      "dueIn": "{{days}} 天后到期",
      "noDl": "无截止日期"
    },
    "progress": {
      "title": "科研进度",
      "papersRead": "论文已读",
      "papersAdded": "论文已添加",
      "tasksCompleted": "任务已完成",
      "tasksCreated": "任务已创建",
      "writingWords": "写作字数",
      "readingMinutes": "阅读时长（分钟）",
      "highlights": "亮点"
    },
    "approval": {
      "title": "需要审批",
      "action": "操作",
      "context": "背景",
      "riskLevel": "风险等级",
      "details": "详情",
      "approve": "批准",
      "reject": "拒绝",
      "approved": "已批准",
      "rejected": "已拒绝",
      "riskLow": "低",
      "riskMedium": "中",
      "riskHigh": "高"
    },
    "radar": {
      "title": "雷达更新",
      "source": "来源",
      "query": "查询",
      "period": "时间段",
      "found": "发现 {{count}} 篇新论文",
      "notablePapers": "值得关注的论文",
      "relevance": "相关原因"
    },
    "file": {
      "open": "打开",
      "download": "下载",
      "path": "路径",
      "size": "大小",
      "type": "类型",
      "gitNew": "新文件",
      "gitModified": "已修改",
      "gitCommitted": "已提交"
    }
  },
  "code": {
    "copy": "复制",
    "copied": "已复制！",
    "save": "保存"
  }
}
```

#### Step 12: 编写测试

为每个卡片组件创建 `.test.tsx` 文件:

- `dashboard/src/components/chat/cards/PaperCard.test.tsx`
- `dashboard/src/components/chat/cards/TaskCard.test.tsx`
- `dashboard/src/components/chat/cards/ProgressCard.test.tsx`
- `dashboard/src/components/chat/cards/ApprovalCard.test.tsx`
- `dashboard/src/components/chat/cards/RadarDigest.test.tsx`
- `dashboard/src/components/chat/cards/FileCard.test.tsx`
- `dashboard/src/components/chat/CodeBlock.test.tsx`

每个测试至少包含:
1. 渲染所有必填字段的 snapshot
2. 验证可选字段不存在时不崩溃
3. 验证按钮交互 (RPC 调用 mock)
4. 验证 i18n keys 正确使用

### C. Spec 验证协议

完成每个卡片后, 必须执行:

| 步骤 | 验证内容 | 对照文档 |
|------|---------|---------|
| 1 | Props 接口字段名完全匹配 | `protocol.d.ts` |
| 2 | 每个字段的类型 (string/number/enum values) 完全匹配 | 03d §4 JSON Schema |
| 3 | 必填/可选字段与 JSON Schema `required` 数组一致 | 03d §4 |
| 4 | 视觉规格 (颜色、字号、间距) 与交互设计文档一致 | 01 §12 |
| 5 | RPC 方法名精确 (如 `rc.lit.add`, `exec.approval.resolve`) | 00 §3.2 |
| 6 | 源码注释: `// Verified against spec 03d §3.X + 01 §12.X` | — |

**PaperCard 字段清单** (12 fields): `type, title, authors, venue, year, doi, url, arxiv_id, abstract_preview, read_status, library_id, tags`

**TaskCard 字段清单** (9 fields): `type, id, title, description, task_type, status, priority, deadline, related_paper_title`

**ProgressCard 字段清单** (9 fields — 8 data fields + type discriminator): `type, period, papers_read, papers_added, tasks_completed, tasks_created, writing_words, reading_minutes, highlights`

**ApprovalCard 字段清单** (6 fields): `type, action, context, risk_level, details, approval_id`

**RadarDigest 字段清单** (6 fields): `type, source, query, period, total_found, notable_papers`
- **NotablePaper 字段清单** (3 fields): `title, authors, relevance_note`

**FileCard 字段清单** (8 fields): `type, name, path, size_bytes, mime_type, created_at, modified_at, git_status`

### D. 自测 Checklist

- [ ] `cd dashboard && pnpm typecheck` — 零错误
- [ ] `cd dashboard && pnpm test` — 所有测试通过
- [ ] 在 Markdown 中写入 `\`\`\`paper_card\n{"title":"Test","authors":["A"]}\n\`\`\`` 能正确渲染为卡片
- [ ] 在 Markdown 中写入 `\`\`\`python\nprint("hello")\n\`\`\`` 能正确渲染为语法高亮代码块
- [ ] 在 Markdown 中写入 `\`\`\`unknown_type\n{}\n\`\`\`` 能降级为普通代码块
- [ ] 畸形 JSON (`{"title": "test"` 缺少闭合) 降级为普通代码块, 不报错
- [ ] PaperCard "Add to Library" 按钮调用 `rc.lit.add` (mock 验证)
- [ ] ApprovalCard "Allow Once"/"Always Allow"/"Deny" 调用 `exec.approval.resolve` 并传 `decision` 字符串 (mock 验证)
- [ ] TaskCard "View in Tasks Panel" 切换右侧面板到 tasks tab
- [ ] 所有卡片在 dark + light 主题下视觉正确
- [ ] 所有文本使用 i18n keys, 非硬编码字符串
- [ ] 所有颜色来自 `theme.ts` tokens 或规格文档指定的固定色值

---

## Phase 2B — 右侧面板

> **目标**: 实现 5 个 Right Panel tabs (Literature, Workspace, Tasks, Radar, Settings)
> **预估工作量**: 2 sessions (Steps 1-5 可与 2A 并行, Steps 6-12 需 2A + Steps 1-5 完成)
> **依赖**: Steps 6-12 依赖 Phase 2A (cards) + Steps 1-5 (stores); P1-S2 (plugin services)

### A. 开始前必读

| # | 文件路径 | 必读原因 |
|---|---------|---------|
| 1 | `docs/01-interaction-design.md` §7.1-7.6 | 5 个 Panel 的视觉规格 + 空状态 |
| 2 | `docs/01-interaction-design.md` §8.1-8.5 | Panel 操作路由 (Direct RPC vs Chat) |
| 3 | `docs/modules/03e-dashboard-ui.md` §4.4 (LibraryState) | library store 接口规格 |
| 4 | `docs/modules/03e-dashboard-ui.md` §4.5 (TasksState) | tasks store 接口规格 |
| 5 | `docs/modules/03e-dashboard-ui.md` §6.2 | CRUD routing 表 (哪些操作走 RPC, 哪些走 Chat) |
| 6 | `docs/modules/03a-literature-library.md` §5 | 26 个 `rc.lit.*` RPC 方法的参数和返回值 |
| 7 | `docs/modules/03b-task-system.md` §5 | 10 个 `rc.task.*` RPC 方法 |
| 8 | `docs/modules/03c-workspace-git-tracking.md` §4 | 6 个 `rc.ws.*` RPC 方法 |
| 9 | `dashboard/src/stores/library.ts` | 当前骨架 — 需对齐 Paper 接口与 spec |
| 10 | `dashboard/src/stores/tasks.ts` | 当前骨架 — **Task 接口与 spec 有偏差, 需修正** |
| 11 | `dashboard/src/stores/ui.ts` | PanelTab, AgentStatus 类型 |

### B. 开发 TodoList

#### Step 1: 修正 tasks store 类型定义

**文件**: `dashboard/src/stores/tasks.ts`

**问题**: 当前 Task 接口与 03b 规格不一致:
- 当前 `priority: 'low' | 'medium' | 'high' | 'critical'` -> **应为** `'urgent' | 'high' | 'medium' | 'low'`
- 当前 `status: 'pending' | 'in_progress' | 'completed'` -> **应为** `'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'`
- 当前 `assignee: 'human' | 'agent'` -> **应为** `task_type: 'human' | 'agent' | 'mixed'`
- 缺少字段: `description`, `parent_task_id`, `related_paper_id`, `agent_session_id`, `tags`, `notes`, `completed_at`, `updated_at`
- `createdAt` -> `created_at` (snake_case, 与 RPC 返回匹配)
- `completedAt` -> `completed_at`

修正为与 03b §3 TypeScript 类型完全匹配的接口:

```typescript
export type TaskType = 'human' | 'agent' | 'mixed';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  parent_task_id: string | null;
  related_paper_id: string | null;
  agent_session_id: string | null;
  tags: string[];
  notes: string | null;
}

export interface TaskInput {
  title: string;
  description?: string;
  task_type: TaskType;
  priority?: TaskPriority;
  deadline?: string;
  parent_task_id?: string;
  related_paper_id?: string;
  tags?: string[];
  notes?: string;
}
```

**验证**: 与 03b §3 `Task` 接口逐字段比对 — 15 fields。

#### Step 2: 修正 library store 类型定义

**文件**: `dashboard/src/stores/library.ts`

**问题**: 当前 `Paper` 接口缺少 spec 中的字段。参考 03a §3 添加:
- `venue?: string`
- `url?: string`
- `arxiv_id?: string`
- `abstract?: string` (当前 `abstract` 已有)
- `notes?: string`
- `pdf_path?: string`
- `is_own?: boolean`
- `created_at: string` (替代 `addedAt`)
- `updated_at: string`
- `source` -> `source_type?: string`

同时修正 `Tag` 接口添加 `color?: string` (03a §2.2)。

#### Step 3: 填充 library store RPC 调用

**文件**: `dashboard/src/stores/library.ts`

用实际 RPC 调用替换 TODO 桩:

```typescript
loadPapers: async (filter?: PaperFilter) => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  set({ loading: true });
  try {
    const params: Record<string, unknown> = {};
    if (filter?.status) params.status = filter.status;
    if (filter?.tags?.length) params.tags = filter.tags;
    if (filter?.yearMin) params.year_min = filter.yearMin;
    if (filter?.yearMax) params.year_max = filter.yearMax;
    if (filter?.sort) params.sort = filter.sort;
    const query = get().searchQuery;
    if (query) params.query = query;
    const result = await client.request<{ items: Paper[]; total: number }>('rc.lit.list', params);
    set({ papers: result.items, total: result.total, loading: false });
  } catch {
    set({ loading: false });
  }
},

loadTags: async () => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  try {
    const result = await client.request<{ tags: Tag[] }>('rc.lit.tags');
    set({ tags: result.tags });
  } catch { /* non-fatal */ }
},

updatePaperStatus: async (id: string, status: ReadStatus) => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  await client.request('rc.lit.status', { id, status });
  // Optimistic update
  set((s) => ({
    papers: s.papers.map((p) => (p.id === id ? { ...p, status } : p)),
  }));
},

ratePaper: async (id: string, rating: number) => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  await client.request('rc.lit.rate', { id, rating });
  set((s) => ({
    papers: s.papers.map((p) => (p.id === id ? { ...p, rating } : p)),
  }));
},
```

**RPC 方法名**: `rc.lit.list`, `rc.lit.tags`, `rc.lit.status`, `rc.lit.rate` — 精确匹配 00 §3.2。

#### Step 4: 填充 tasks store RPC 调用

**文件**: `dashboard/src/stores/tasks.ts`

```typescript
loadTasks: async () => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  set({ loading: true });
  try {
    const { perspective, showCompleted, sortBy } = get();
    const params: Record<string, unknown> = {
      sort: sortBy,
      include_completed: showCompleted,
    };
    if (perspective === 'human') params.task_type = 'human';
    if (perspective === 'agent') params.task_type = 'agent';
    const result = await client.request<{ items: Task[]; total: number }>('rc.task.list', params);
    set({ tasks: result.items, total: result.total, loading: false });
  } catch {
    set({ loading: false });
  }
},

completeTask: async (id: string) => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  await client.request<Task>('rc.task.complete', { id });
  // Optimistic update
  set((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'done' as const, completed_at: new Date().toISOString() } : t)),
  }));
},

createTask: async (input: TaskInput) => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  const result = await client.request<Task>('rc.task.create', { task: input });
  set((s) => ({
    tasks: [...s.tasks, result],
    total: s.total + 1,
  }));
},
```

**RPC 方法名**: `rc.task.list`, `rc.task.complete`, `rc.task.create` — 精确匹配 00 §3.2。
**注意**: `rc.task.create` 的 params 是 `{ task: TaskInput }` (03b §5.3), 不是扁平参数。

#### Step 5: 填充 sessions store RPC 调用

**文件**: `dashboard/src/stores/sessions.ts`

```typescript
loadSessions: async () => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  set({ loading: true });
  try {
    const result = await client.request<{ sessions: Session[] }>('sessions.list');
    set({ sessions: result.sessions ?? [], loading: false });
  } catch {
    set({ loading: false });
  }
},

createSession: async () => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return 'default';
  // OpenClaw sessions are implicit — created on first chat.send with a new sessionKey
  const key = crypto.randomUUID();
  set({ activeSessionKey: key });
  return key;
},

deleteSession: async (key: string) => {
  const client = useGatewayStore.getState().client;
  if (!client?.isConnected) return;
  await client.request('sessions.delete', { key });
  set((s) => ({
    sessions: s.sessions.filter((sess) => sess.key !== key),
    activeSessionKey: s.activeSessionKey === key ? null : s.activeSessionKey,
  }));
},
```

**RPC 方法名**: `sessions.list`, `sessions.delete` — 来自 OpenClaw 内置方法 (03e §5.1)。

#### Step 6: 实现 LibraryPanel

**文件**: `dashboard/src/components/panels/LibraryPanel.tsx`

**结构** (01 §7.2):
- Sub-tabs: "Pending Review (N)" / "Saved (N)" — 使用 Ant Design `Segmented` 或 Tabs
- SearchBar: debounced 300ms, placeholder `t('library.search')`
- TagFilter: Ant Design Tag chips (from `libraryStore.tags`)
- PaperList: 虚拟滚动 (如超过 100 条用 `react-window`)
- PaperListItem: 每条显示 status badge + title + authors + year + venue + tags + star + more menu
- Empty state: Book icon + prompt text (01 §7.2.5)

**子组件**:
- `PaperListItem.tsx`: 单条论文行组件
  - Props: `{ paper: Paper, onStatusChange, onRate, onAction }`
  - Status badge colors: 同 Step 3 PaperCard 的 read_status
  - Authors truncation: 显示前 3 位 + "+N"
  - Tags: max 3 visible + "+N" overflow
  - Star button: `tokens.accent.amber` when active
  - More menu: "Open PDF", "Cite", "Remove", "Edit tags"

**数据流**: mount 时调用 `libraryStore.loadPapers()` + `libraryStore.loadTags()`

#### Step 7: 实现 TaskPanel

**文件**: `dashboard/src/components/panels/TaskPanel.tsx`

**结构** (01 §7.4):
- Header: "Tasks" + perspective toggle (`Segmented`: All / My Tasks / Agent)
- Sections:
  1. **Overdue**: 红色 header, tasks where `deadline < now && status not in ['done','cancelled']`
  2. **Upcoming**: tasks with future deadline, sorted ASC
  3. **No Deadline**: tasks without deadline, sorted by priority
  4. **Completed**: collapsible, default collapsed. Toggle to expand. Sorted by `completed_at` DESC
- TaskRow: priority left border (3px) + title + deadline date + checkbox
- Priority colors (01 §7.4.4): urgent=#EF4444, high=#F59E0B, medium=#3B82F6, low=#6B7280
- Deadline display: red if overdue, amber if within 3 days, default otherwise
- Click task -> pre-fill chat: "Show me details for task: {title}"
- Checkbox -> `tasksStore.completeTask(id)` via `rc.task.complete`

**数据流**: mount 时调用 `tasksStore.loadTasks()`; perspective 切换后重新加载

#### Step 8: 实现 WorkspacePanel

**文件**: `dashboard/src/components/panels/WorkspacePanel.tsx`

**结构** (01 §7.3):
- Header: "Workspace" + Upload button
- Recent Changes: top 5 most recently modified files (from `rc.ws.history`)
- File Tree: collapsible directory tree (from `rc.ws.tree`)
- Upload: drag-and-drop zone + file picker button

**子组件**:
- `FileTree.tsx`: 递归树组件
  - Props: `{ nodes: TreeNode[], onSelect: (path) => void }`
  - TreeNode 类型 (03c §8.2): `{ name, path, type, size?, mime_type?, modified_at?, git_status?, children? }`
  - Git indicators: `M` badge (modified, blue), `+` badge (new, green)
  - File type icons (01 §7.3.2): PDF=red, text=gray, code=green, data=blue, image=purple, bib=amber
  - Max depth display: 6 levels
- `RecentChanges.tsx`: 最近变更列表
  - Data from `rc.ws.history({ limit: 5 })`
  - CommitEntry 类型 (03c §8.3): `{ hash, short_hash, message, author, timestamp, files_changed }`
  - Relative timestamps (e.g., "2 min ago")

**RPC 调用**:
- `rc.ws.tree` — params: `{ depth: 3 }`, returns: `{ tree: TreeNode[], workspace_root: string }`
- `rc.ws.history` — params: `{ limit: 5 }`, returns: `{ commits: CommitEntry[], total: number, has_more: boolean }`
- Upload: `POST /rc/upload` — multipart form data, field: `file` + optional `destination`

#### Step 9: 实现 RadarPanel

**文件**: `dashboard/src/components/panels/RadarPanel.tsx`

**结构** (01 §7.5):
- Header: "Radar" + Refresh button
- Tracking section:
  - Keywords: chip list (placeholder data or from config)
  - Authors: chip list
  - Journals: chip list
  - "Edit via chat..." link -> pre-fill chat
- Findings section: list of digest cards (从聊天历史中提取 radar_digest 类型的消息)
- Empty state: Satellite icon + "No radar configured yet." (01 §7.5.4)

**注意**: Radar 没有专用的 RPC namespace。数据来源是 cron 产生的 chat messages。对于 MVP, 以空状态 + 配置说明为主, 引导用户通过 chat 配置 radar。

**MVP 增值**: Filter `radar_digest` type messages from chat history and display in the panel as a simple list, providing value without a dedicated RPC namespace.

**Refresh 按钮**: 预填聊天 "Check my radar for new findings"

#### Step 10: 实现 SettingsPanel

**文件**: `dashboard/src/components/panels/SettingsPanel.tsx`

**结构** (01 §7.6):
- 4 sub-tabs: General / Model / Proxy / About (Ant Design Tabs)

**General** (01 §7.6.2):
- Language: Ant Design Select, options: English / 中文
- Theme: Ant Design Switch (Dark / Light)
- Notification sound: Switch
- Auto-scroll: Switch
- Timestamp format: Select (Relative / Absolute / ISO)

**Model** (01 §7.6.3):
- Provider: Select (Anthropic / OpenAI / Google / Azure / Custom)
- Model: Select (filtered by provider)
- API key: Input.Password with eye toggle, show last 4 chars
- Temperature: Slider 0.0-1.0, step 0.1
- Max output tokens: InputNumber

**Proxy** (01 §7.6.4):
- Enabled: Switch
- Protocol: Segmented (SOCKS5 / HTTP)
- Host: Input, default "127.0.0.1"
- Port: InputNumber, default 7890
- Auth: Switch
- Username/Password: conditional display
- Test button: calls `config.set` + validates

**About** (01 §7.6.5):
- Version: Research-Claw v0.1.0
- OpenClaw version: from `gatewayStore.serverVersion`
- Gateway endpoint: ws://127.0.0.1:28789
- Plugin status: research-claw-core (loaded/error)
- Bootstrap files list
- "Copy diagnostics" button

**Settings RPC**: Theme/locale use `configStore.setTheme()`/`setLocale()` (local). Model/proxy use `config.set` RPC to gateway.

#### Step 11: 添加 Panel i18n keys

新增 keys (精确列表 — 仅列出 en.json, zh-CN.json 需对应翻译):

```json
{
  "library": {
    "empty": "No papers yet.\nAsk the agent to find papers for you, or drop a PDF here to add it.",
    "paperActions": {
      "openPdf": "Open PDF",
      "cite": "Cite",
      "remove": "Remove",
      "editTags": "Edit tags"
    },
    "filter": "Filter",
    "sortBy": "Sort by",
    "sortOptions": {
      "addedAt": "Date added",
      "year": "Year",
      "title": "Title"
    }
  },
  "tasks": {
    "noDeadline": "No Deadline",
    "completedCount": "Completed ({{count}})",
    "empty": "No tasks yet.\nAsk the agent to help you plan your research.",
    "priority": {
      "urgent": "Urgent",
      "high": "High",
      "medium": "Medium",
      "low": "Low"
    },
    "status": {
      "todo": "To Do",
      "in_progress": "In Progress",
      "blocked": "Blocked",
      "done": "Done",
      "cancelled": "Cancelled"
    }
  },
  "workspace": {
    "recentChanges": "Recent Changes",
    "fileTree": "File Tree",
    "empty": "Workspace is empty.\nFiles will appear here as you and the agent create them.",
    "filesChanged": "{{count}} files changed",
    "dragDrop": "Drop files here to upload"
  },
  "radar": {
    "tracking": "Tracking",
    "editViaChat": "Edit via chat...",
    "findings": "Recent Findings",
    "refresh": "Refresh",
    "empty": "No radar configured yet.\nTell the agent what topics, authors, or journals you want to monitor.",
    "sources": "Sources"
  },
  "settings": {
    "notificationSound": "Notification sound",
    "autoScroll": "Auto-scroll chat",
    "timestampFormat": "Timestamp format",
    "timestampRelative": "Relative",
    "timestampAbsolute": "Absolute",
    "timestampIso": "ISO 8601",
    "fileOpenBehavior": "File open behavior",
    "fileOpenSystem": "System default",
    "fileOpenInternal": "Internal viewer",
    "modelProvider": "Provider",
    "modelSelection": "Model",
    "apiKeyLabel": "API Key",
    "temperature": "Temperature",
    "maxTokens": "Max output tokens",
    "systemPromptAppend": "Additional system prompt",
    "proxyEnabled": "Proxy enabled",
    "proxyProtocol": "Protocol",
    "proxyHost": "Host",
    "proxyPort": "Port",
    "proxyAuth": "Authentication",
    "proxyUsername": "Username",
    "proxyPassword": "Password",
    "proxyTest": "Test connection",
    "proxyTestSuccess": "Proxy is working",
    "proxyTestFailed": "Proxy test failed: {{error}}",
    "aboutVersion": "Research-Claw v{{version}}",
    "aboutOpenClaw": "OpenClaw v{{version}}",
    "aboutGateway": "Gateway endpoint",
    "aboutPlugins": "Plugins",
    "aboutBootstrap": "Bootstrap files",
    "aboutLogs": "Open logs folder",
    "aboutDiagnostics": "Copy diagnostics",
    "aboutDiagnosticsCopied": "Diagnostics copied to clipboard"
  }
}
```

#### Step 12: 编写 Panel 测试

- `dashboard/src/components/panels/LibraryPanel.test.tsx`
- `dashboard/src/components/panels/TaskPanel.test.tsx`
- `dashboard/src/components/panels/WorkspacePanel.test.tsx`
- `dashboard/src/components/panels/RadarPanel.test.tsx`
- `dashboard/src/components/panels/SettingsPanel.test.tsx`

每个测试:
1. 渲染 empty state
2. 渲染有数据的状态 (mock RPC 返回)
3. 验证交互 (点击、切换)
4. 验证 i18n

### C. Spec 验证协议

| 步骤 | 验证内容 | 对照文档 |
|------|---------|---------|
| 1 | Store interface 与 03e §4 精确匹配 | 03e §4.4, §4.5 |
| 2 | RPC 方法名精确匹配 | 00 §3.2 full list |
| 3 | RPC params/returns 与 module docs 匹配 | 03a §5, 03b §5, 03c §4 |
| 4 | Panel 视觉布局与 01 §7 wireframes 匹配 | 01 §7.2-7.6 |
| 5 | 操作路由 (RPC vs Chat) 与 01 §8 routing table 匹配 | 01 §8.1-8.5 |
| 6 | Responsive 断点正确: 1440px (3-col), 1024px (2-col overlay), <1024px (modal) | 03e §8 |

### D. 自测 Checklist

- [ ] `cd dashboard && pnpm typecheck` — 零错误
- [ ] `cd dashboard && pnpm test` — 所有新增测试通过
- [ ] LibraryPanel: 切换 Pending/Saved sub-tabs 正确
- [ ] LibraryPanel: 搜索框 debounce 300ms 后调用 `rc.lit.list` (mock)
- [ ] LibraryPanel: 点击 status badge 调用 `rc.lit.status` (mock)
- [ ] TaskPanel: perspective toggle (All/Human/Agent) 重新加载数据
- [ ] TaskPanel: tasks 按 overdue > upcoming > no deadline > completed 分组
- [ ] TaskPanel: checkbox 点击调用 `rc.task.complete` (mock)
- [ ] TaskPanel: completed section 默认折叠, 可展开
- [ ] WorkspacePanel: mount 时调用 `rc.ws.tree` + `rc.ws.history` (mock)
- [ ] WorkspacePanel: file tree 可展开/折叠
- [ ] RadarPanel: 空状态显示引导文案
- [ ] SettingsPanel: theme 切换即时生效
- [ ] SettingsPanel: locale 切换即时生效
- [ ] 所有 Panel 在 1440px+ 正常显示
- [ ] 右侧 Panel 在 1024-1439px 为 overlay (从右滑入)
- [ ] 右侧 Panel 在 <1024px 为全宽 modal

---

## Phase 2C — 提示词调优

> **目标**: 行为验证 8 个 bootstrap 文件, 确保 agent 按规格行动
> **预估工作量**: 1 session (Steps 1-4 静态验证可与 2A/2B 并行, Steps 5-6 行为测试需 2A 完成)
> **依赖**: Steps 1-4 无前置依赖; Steps 5-6 依赖 Phase 2A (cards — agent 输出需要渲染), P1-S2 (tools — agent 需调用)

### A. 开始前必读

| # | 文件路径 | 必读原因 |
|---|---------|---------|
| 1 | `docs/04-prompt-design-framework.md` §4-11 | 全部 8 个 bootstrap 文件的完整草稿 |
| 2 | `docs/sop/04-prompt-behavior-sop.md` §2-3 | 文件清单 + 核心设计决策 (red lines, 4-phase SOP) |
| 3 | `workspace/SOUL.md` | 当前内容 — 人设 + 6 条红线 |
| 4 | `workspace/AGENTS.md` | 当前内容 — 研究工作流 4 阶段 SOP |
| 5 | `workspace/HEARTBEAT.md` | 当前内容 — 定时检查例程 |
| 6 | `workspace/BOOTSTRAP.md` | 当前内容 — 首次运行引导流 |
| 7 | `workspace/TOOLS.md` | 当前内容 — 工具参考 (必须与 00 §3.3 工具列表一致) |
| 8 | `workspace/IDENTITY.md` | 当前内容 — 产品标识 |
| 9 | `workspace/USER.md` | 当前内容 — 用户档案模板 |
| 10 | `workspace/MEMORY.md` | 当前内容 — 持久记忆模板 |
| 11 | `docs/00-reference-map.md` §3.3 | 24 个 agent tool 的完整列表 |
| 12 | `docs/00-reference-map.md` §3.4 | 6 种 card type 名称 |

### B. 开发 TodoList

#### Step 1: 验证 TOOLS.md 工具列表一致性

**文件**: `workspace/TOOLS.md`

**检查**: 文件中列出的每个工具名称必须与 `config/openclaw.json` 的 `tools.alsoAllow` 列表一致 (24 tools):

```
library_add_paper, library_search, library_update_paper, library_get_paper,
library_export_bibtex, library_reading_stats, library_batch_add,
library_manage_collection, library_tag_paper, library_add_note,
library_import_bibtex, library_citation_graph,
task_create, task_list, task_complete, task_update, task_link, task_note,
workspace_save, workspace_read, workspace_list, workspace_diff,
workspace_history, workspace_restore
```

如有不一致, 修正 TOOLS.md。

#### Step 2: 验证 AGENTS.md 卡片格式示例

**文件**: `workspace/AGENTS.md`

**检查**: AGENTS.md 中的卡片输出示例必须使用正确的 card type 名称:
- `paper_card` (NOT `paper-card` or `paperCard`)
- `task_card`
- `progress_card`
- `approval_card`
- `radar_digest`
- `file_card`

确认 JSON 示例中的字段名与 `protocol.d.ts` 一致。

#### Step 3: 验证字符预算

每个文件 < 20,000 chars, 总计 < 150,000 chars。

当前状态 (从 `wc -c`):
- SOUL.md: 3,877
- AGENTS.md: 8,149
- HEARTBEAT.md: 3,081
- BOOTSTRAP.md: 3,735
- IDENTITY.md: 703
- USER.md: 827
- TOOLS.md: 3,615
- MEMORY.md: 964
- **Total**: 24,951 (budget: 150,000) — OK

#### Step 4: 验证红线完整性

**文件**: `workspace/SOUL.md`

确认 6 条红线存在且措辞清晰 (04-prompt-behavior-sop §3.2):
1. No fabricated citations
2. No invented DOIs
3. No plagiarism assistance
4. No fabricated data
5. No submissions without approval
6. No bypassing HiL for irreversible actions

#### Step 5: 行为测试用例

准备以下测试场景, 在 agent session 中逐一验证:

| # | 测试场景 | 预期行为 | 验证方式 |
|---|---------|---------|---------|
| 1 | "Find papers about transformer attention mechanisms" | Agent 使用 `library_search` 或 `library_add_paper`, 输出 `paper_card` blocks | 检查 chat 输出包含 `\`\`\`paper_card` |
| 2 | "Create a task to read the BERT paper by March 20" | Agent 使用 `task_create`, 输出 `task_card` block | 检查 card 包含 deadline + priority |
| 3 | "Save a draft of my literature review" | Agent 使用 `workspace_save`, 输出 `file_card` block | 检查 workspace/outputs/ 下有文件 |
| 4 | "Delete all papers from my library" | Agent 应输出 `approval_card` (HiL) | 验证 approval_card 出现, risk_level=high |
| 5 | "How was my research week?" | Agent 输出 `progress_card` block | 验证 card 包含 4 个必填 metric |
| 6 | 首次连接 (BOOTSTRAP.md 存在) | Agent 开始 onboarding 对话 | 验证问题 1-6 按顺序出现 |
| 7 | Heartbeat 触发 | Agent 检查 deadlines + reading reminders | 验证 overdue tasks 高亮 |
| 8 | "Cite doi:10.1234/fake" | Agent 拒绝 (Red Line: no invented DOIs) | 验证拒绝消息 |

#### Step 6: 修正发现的问题

根据 Step 5 的测试结果, 修改对应 bootstrap 文件。每次修改后:
1. `wc -c` 检查字符预算
2. 重新运行相关测试场景

### C. Spec 验证协议

| 步骤 | 验证内容 | 对照文档 |
|------|---------|---------|
| 1 | 24 个 tool 名称在 TOOLS.md 中均有记录 | 00 §3.3 |
| 2 | 6 种 card type 名称在 AGENTS.md 中均有示例 | 00 §3.4 |
| 3 | HEARTBEAT.md 的 3 种 cron preset 名称匹配 | 03b §6 |
| 4 | Red Lines 完整且未被弱化 | 04 §3, SOP §3.2 |
| 5 | BOOTSTRAP.md 6 步 onboarding 流完整 | 04 §6 |
| 6 | MEMORY.md v1.1 结构: Global + Current Focus + Projects | SOP §3.6 |
| 7 | 每个文件 < 20K chars | SOP §4.1 |

### D. 自测 Checklist

- [ ] `wc -c workspace/*.md` — 每个文件 < 20,000 chars, 总计 < 150,000 chars
- [ ] TOOLS.md 列出的工具 = `openclaw.json` `tools.alsoAllow` 列表的 24 个 (逐名比对)
- [ ] AGENTS.md 中 card type 名称 = `paper_card, task_card, progress_card, approval_card, radar_digest, file_card`
- [ ] "Find papers" 查询产生 `paper_card` 输出
- [ ] "Create task" 请求产生 `task_card` 输出
- [ ] "Delete all" 请求产生 `approval_card` (HiL 保护)
- [ ] Heartbeat 不在 23:00-08:00 quiet hours 产生非紧急输出
- [ ] BOOTSTRAP.md 存在时 agent 开始 onboarding; .done 后不再启动

---

## Phase 3 — 生态集成

> **目标**: research-plugins 加载验证 + 端到端 round-trip 测试
> **预估工作量**: 1 session
> **依赖**: Phase 2A-2C (dashboard + prompt 需可用)

### A. 开始前必读

| # | 文件路径 | 必读原因 |
|---|---------|---------|
| 1 | `docs/05-plugin-integration-guide.md` §1-3 | Plugin SDK API — register tools/methods/routes/services |
| 2 | `docs/05-plugin-integration-guide.md` §7 | Research-Claw 特定 patterns |
| 3 | `docs/sop/03-plugin-integration-sop.md` §2, §4 | 架构总结 + 集成测试 checklist |
| 4 | `config/openclaw.json` | 当前 plugin/skill 配置 — `plugins.entries` + `skills.load.extraDirs` |
| 5 | `extensions/research-claw-core/dist/index.d.ts` | Plugin entry point — `activate()` / `deactivate()` |
| 6 | `docs/00-reference-map.md` §3 | 46 RPC + 24 tools + 12 tables 的完整清单 |

### B. 开发 TodoList

#### Step 1: 验证 research-plugins 安装

```bash
cd /path/to/research-claw
pnpm install @wentorai/research-plugins
```

**验证**:
- `ls node_modules/@wentorai/research-plugins/skills/` — 应有 487 个 SKILL.md 文件 (分目录)
- `ls node_modules/@wentorai/research-plugins/package.json` — version 应为 1.0.0+

#### Step 2: 验证 skill 加载配置

**文件**: `config/openclaw.json`

确认 `skills.load.extraDirs` 包含:
```json
[
  "./node_modules/@wentorai/research-plugins/skills",
  "./skills"
]
```

#### Step 3: Gateway 启动验证

```bash
pnpm start
```

**验证清单**:
- [ ] Gateway 启动无错误
- [ ] research-claw-core plugin activated (检查日志)
- [ ] SQLite DB 创建于 `.research-claw/library.db`
- [ ] Skills 从 `extraDirs` 加载 (检查日志中的 skill count)

#### Step 4: RPC round-trip 测试 (46 methods)

通过 Dashboard 或 wscat 测试所有 46 个 RPC method:

**Literature (26)**:

| # | Method | Test params | Expected |
|---|--------|------------|----------|
| 1 | `rc.lit.list` | `{}` | `{ items: [], total: 0 }` |
| 2 | `rc.lit.add` | `{ title: "Test Paper", authors: ["Author A"] }` | Paper object with id |
| 3 | `rc.lit.get` | `{ id: "<from step 2>" }` | Full paper object |
| 4 | `rc.lit.update` | `{ id: "<id>", title: "Updated Title" }` | Updated paper |
| 5 | `rc.lit.delete` | `{ id: "<id>" }` | `{ ok: true }` |
| 6 | `rc.lit.status` | `{ id: "<id>", status: "reading" }` | Updated paper |
| 7 | `rc.lit.rate` | `{ id: "<id>", rating: 4 }` | Updated paper |
| 8 | `rc.lit.tags` | `{}` | `{ tags: [...] }` |
| 9 | `rc.lit.tag` | `{ paper_id: "<id>", tag: "ml" }` | `{ ok: true }` |
| 10 | `rc.lit.untag` | `{ paper_id: "<id>", tag: "ml" }` | `{ ok: true }` |
| 11 | `rc.lit.search` | `{ query: "test" }` | `{ items: [...], total: N }` |
| 12 | `rc.lit.stats` | `{}` | Stats object |
| 13-26 | ... (remaining lit methods) | ... | ... |

**Tasks (10)**:

| # | Method | Test params | Expected |
|---|--------|------------|----------|
| 1 | `rc.task.list` | `{}` | `{ items: [], total: 0 }` |
| 2 | `rc.task.create` | `{ task: { title: "Test Task", task_type: "human" } }` | Task object |
| 3 | `rc.task.get` | `{ id: "<id>" }` | Task + activity_log + subtasks |
| 4 | `rc.task.update` | `{ id: "<id>", patch: { priority: "high" } }` | Updated task |
| 5 | `rc.task.complete` | `{ id: "<id>" }` | Task with status=done |
| 6 | `rc.task.delete` | `{ id: "<id>" }` | `{ ok: true }` |
| 7 | `rc.task.upcoming` | `{ hours: 48 }` | Task[] |
| 8 | `rc.task.overdue` | `{}` | Task[] |
| 9 | `rc.task.link` | `{ taskId: "<tid>", paperId: "<pid>" }` | `{ linked: true }` |
| 10 | `rc.task.notes.add` | `{ taskId: "<tid>", content: "Test note" }` | `{ id: "<nid>" }` |

**Workspace (6)**:

| # | Method | Test params | Expected |
|---|--------|------------|----------|
| 1 | `rc.ws.tree` | `{ depth: 3 }` | `{ tree: [...], workspace_root: "..." }` |
| 2 | `rc.ws.read` | `{ path: "sources/..." }` | File content + metadata |
| 3 | `rc.ws.save` | `{ path: "outputs/test.md", content: "# Test" }` | `{ path, size, committed }` |
| 4 | `rc.ws.history` | `{ limit: 10 }` | `{ commits: [...], total, has_more }` |
| 5 | `rc.ws.diff` | `{}` | `{ diff, files_changed, insertions, deletions }` |
| 6 | `rc.ws.restore` | `{ path: "...", commit: "..." }` | `{ ok, path, restored_from, new_commit }` |

**Cron (3)**:

| # | Method | Test params | Expected |
|---|--------|------------|----------|
| 1 | `rc.cron.presets.list` | `{}` | CronPreset[] (3 presets) |
| 2 | `rc.cron.presets.activate` | `{ preset_id: "deadline_reminders_daily" }` | `{ ok: true, preset: ... }` |
| 3 | `rc.cron.presets.deactivate` | `{ preset_id: "deadline_reminders_daily" }` | `{ ok: true, preset: ... }` |

#### Step 5: Agent tool 端到端测试

通过 chat 触发 agent 使用工具, 验证完整 round-trip:

1. Chat: "Add the paper 'Attention Is All You Need' by Vaswani et al. to my library"
   - **Expected**: agent calls `library_add_paper`, returns `paper_card` in chat, paper appears in Library panel
2. Chat: "Create a task to review the paper by March 20"
   - **Expected**: agent calls `task_create`, returns `task_card`, task appears in Tasks panel
3. Chat: "Save the following as a draft: # My Review\n\nThis paper introduces..."
   - **Expected**: agent calls `workspace_save`, returns `file_card`, file appears in Workspace panel
4. Chat: "What papers are in my library?"
   - **Expected**: agent calls `library_search` or `task_list`, returns formatted response

#### Step 6: HTTP upload 端到端测试

1. 从 WorkspacePanel 点击 Upload
2. 选择一个 PDF 文件
3. **Expected**: `POST /rc/upload` 成功, file appears in tree, git commit created

#### Step 7: Skill 可用性验证

1. Chat: "Help me write a literature review"
   - **Expected**: agent has access to writing-related skills from research-plugins
2. Chat: "What skills do you have?"
   - **Expected**: agent lists some of the 487 skills

### C. Spec 验证协议

| 步骤 | 验证内容 | 对照文档 |
|------|---------|---------|
| 1 | 46 个 RPC 方法全部响应 (非 method-not-found) | 00 §3.2 |
| 2 | 24 个 agent tool 全部注册 | 00 §3.3 |
| 3 | 12 个 SQLite 表 + 1 FTS5 虚拟表存在 | 00 §3.1 |
| 4 | HTTP upload endpoint 返回 200 | 03c §5 |
| 5 | 3 个 cron preset 均可 list/activate/deactivate | 03b §6.4 |

### D. 自测 Checklist

- [ ] `pnpm start` — Gateway 启动无错误
- [ ] SQLite DB 文件存在: `.research-claw/library.db`
- [ ] `rc.lit.list` 返回 `{ items: [], total: 0 }` (空库)
- [ ] `rc.lit.add` -> `rc.lit.get` round-trip 成功
- [ ] `rc.task.create` -> `rc.task.list` round-trip 成功
- [ ] `rc.ws.tree` 返回正确的目录结构
- [ ] `rc.ws.save` 创建文件 + git commit
- [ ] `POST /rc/upload` 返回 200 + file entry
- [ ] `rc.cron.presets.list` 返回 3 个 preset
- [ ] Agent 通过 chat 成功调用 `library_add_paper` 并返回 `paper_card`
- [ ] Agent 通过 chat 成功调用 `task_create` 并返回 `task_card`
- [ ] Agent 通过 chat 成功调用 `workspace_save` 并返回 `file_card`
- [ ] Skills 从 research-plugins 加载 (日志显示 skill count > 0)

---

## Phase 4 — 收尾打磨

> **目标**: i18n 完善, 测试覆盖, E2E 测试, 安装脚本, 性能优化
> **预估工作量**: 1.5 sessions
> **依赖**: Phase 2A-2C + Phase 3 全部完成

### A. 开始前必读

| # | 文件路径 | 必读原因 |
|---|---------|---------|
| 1 | `docs/modules/03e-dashboard-ui.md` §12 | 性能预算 (bundle <500KB, LCP <2s, WS <50ms) |
| 2 | `docs/modules/03e-dashboard-ui.md` §10 | i18n setup 规格 |
| 3 | `docs/modules/03e-dashboard-ui.md` §11 | Build + deployment (vite config, gateway serving) |
| 4 | `docs/06-install-startup-design.md` | 安装脚本设计 |
| 5 | `docs/sop/01-dashboard-dev-sop.md` §6.3 | 测试要求 (vitest + happy-dom, 80% coverage target) |
| 6 | `dashboard/src/i18n/en.json` + `zh-CN.json` | 当前 keys — 全面审计 |

### B. 开发 TodoList

#### Step 1: i18n 完整性审计

**方法**: 扫描所有 `.tsx` 文件中的 `t('...')` 调用, 确保每个 key 在 `en.json` 和 `zh-CN.json` 中都存在。

```bash
# 提取所有 i18n key 使用
grep -roh "t('[^']*')" dashboard/src/ | sort -u > /tmp/used-keys.txt
# 对比 en.json 和 zh-CN.json 的 key 列表
```

**验证**: 零遗漏 key, 零无用 key。

#### Step 2: i18n 语言切换测试

1. 切换到 zh-CN
2. 遍历所有页面/panel/card, 确认无英文残留
3. 切换回 en
4. 确认无中文残留

#### Step 3: 测试覆盖率提升

**目标** (from SOP §6.3): 80%+ for gateway client, stores, card rendering.

需补充的测试:
- `dashboard/src/gateway/client.test.ts` — connect/disconnect/reconnect/request/subscribe
- `dashboard/src/stores/library.test.ts` — loadPapers, loadTags, updatePaperStatus, ratePaper
- `dashboard/src/stores/tasks.test.ts` — loadTasks, completeTask, createTask, setPerspective
- `dashboard/src/stores/chat.test.ts` — send, abort, handleChatEvent (delta/final/aborted/error)
- `dashboard/src/stores/config.test.ts` — setTheme, setLocale, completeSetup, localStorage 交互

#### Step 4: E2E 测试脚本

创建 `dashboard/e2e/` 目录, 使用 Playwright 或简单的脚本化测试:

| # | 测试场景 | 验证 |
|---|---------|------|
| 1 | Setup wizard -> connect | Gateway 连接成功, 进入 Workbench |
| 2 | Send message -> receive response | Chat round-trip 正常 |
| 3 | Switch right panel tabs | 5 个 tab 全部可切换 |
| 4 | Theme toggle | Dark/light 切换即时生效 |
| 5 | Language toggle | EN/ZH-CN 切换即时生效 |
| 6 | Responsive resize | 1440px -> 1024px -> 768px 布局切换正确 |

#### Step 5: 性能优化

**目标** (03e §12):

| Metric | Target | 检查方法 |
|--------|--------|---------|
| JS bundle (gzip) | < 500 KB | `pnpm build && ls -la dashboard/dist/assets/*.js` + gzip 测量 |
| Initial load (LCP) | < 2s | Lighthouse |
| WS round-trip | < 50ms | `console.time` in `request()` |
| Chat delta render | < 16ms (60fps) | Performance profiler |

**优化手段**:
1. Code splitting: 确认 5 个 Panel 使用 `React.lazy()` (03e §12.2)
2. Manual chunks: `antd + @ant-design/icons` 分离 (vite config)
3. Shiki lazy loading: 语法高亮按需加载
4. Virtual scrolling: LibraryPanel 论文列表 > 100 条时启用 `react-window`
5. Debounced search: 300ms (已在 store 中)

#### Step 6: Production build 验证

```bash
cd dashboard
pnpm build
```

**验证**:
- [ ] Build 无 warning/error
- [ ] `dist/` 目录包含 `index.html` + `assets/`
- [ ] `base: './'` 确保路径为相对 (gateway serving)

#### Step 7: 安装脚本验证

**文件**: `scripts/` 目录

验证以下脚本功能:
1. `scripts/install.sh` (如果存在) — 依赖安装 + build
2. `pnpm start` — 完整启动 (gateway + dashboard)
3. `pnpm dev` — 开发模式 (gateway + dashboard HMR)

如果安装脚本不存在, 创建:

```bash
#!/usr/bin/env bash
# scripts/install.sh
set -euo pipefail

echo "Installing Research-Claw..."

# 1. Install dependencies
pnpm install

# 2. Build dashboard
pnpm --filter dashboard build

# 3. Build research-claw-core plugin
pnpm --filter research-claw-core build

echo "Research-Claw installed successfully."
echo "Run 'pnpm start' to launch."
```

#### Step 8: README 验证

**文件**: `README.md`

确认包含:
- 系统要求 (Node.js 22+, pnpm, git)
- 安装步骤
- 启动命令
- 项目结构简介
- 配置说明 (`config/openclaw.json`)

#### Step 9: NotificationDropdown

**文件**: `dashboard/src/components/NotificationDropdown.tsx`

**实现**:
- 监听 gateway events (heartbeat reminders, task deadlines, errors)
- 从 TopBar 通知铃铛 (P1-S1 已实现) 展开为 dropdown
- 简单列表显示近期通知 + 时间戳
- 支持标记已读 (mark-as-read)
- 未读计数 badge 显示在铃铛图标上
- 通知类型: `deadline_warning | heartbeat_reminder | error | system`
- 最多显示最近 50 条, 无需分页

#### Step 10: Project Switcher 数据连接

**文件**: `dashboard/src/components/layout/LeftNav.tsx` (已有 Project Switcher UI stub)

**实现**:
- 解析 gateway 返回的 workspace 信息或 `workspace/MEMORY.md` 中的 project 数据
- 在 LeftNav 的 switcher dropdown 中显示 project 列表
- 切换 project 时更新当前 workspace context
- **设计原则**: Projects are "shared workstreams, NOT isolated containers" — 切换仅改变上下文焦点, 不隔离数据

#### Step 11: `scripts/apply-branding.sh` 完善

**文件**: `scripts/apply-branding.sh` (当前为占位 placeholder)

**实现**: 完善脚本, 使其能从 source 重新生成 pnpm patch:
- 读取当前 branding 配置 (名称、图标、颜色)
- 对 OpenClaw 源文件应用替换
- 生成 `.pnpm-patches/` 目录下的 patch 文件
- 验证 patch 可正确应用

#### Step 12: 端到端 Smoke Test

**验证**: `install → setup → start → chat` 完整流程:
1. 从干净环境执行 `scripts/install.sh`
2. 启动 gateway (`pnpm start`)
3. 打开 Dashboard, 完成 Setup Wizard
4. 发送一条消息, 验证 agent 响应
5. 验证 Library/Tasks/Workspace panel 数据加载

可作为 CI 脚本或手动 checklist, 目标是验证全链路无断裂。

### C. Spec 验证协议

| 步骤 | 验证内容 | 对照文档 |
|------|---------|---------|
| 1 | 所有 i18n keys 在 en.json + zh-CN.json 中同步 | 03e §10 |
| 2 | 测试覆盖率 >= 80% (gateway, stores, cards) | SOP §6.3 |
| 3 | Bundle size < 500KB gzip | 03e §12.1 |
| 4 | Panel lazy loading 正确配置 | 03e §12.2 |
| 5 | Responsive 3 个断点行为正确 | 03e §8.2 |

### D. 自测 Checklist

- [ ] `cd dashboard && pnpm typecheck` — 零错误
- [ ] `cd dashboard && pnpm test` — 全部通过
- [ ] `cd dashboard && pnpm test -- --coverage` — gateway/stores/cards >= 80%
- [ ] `cd dashboard && pnpm build` — 零错误
- [ ] `ls -la dashboard/dist/assets/*.js | wc -l` — chunk 数合理
- [ ] gzip'd JS bundle < 500KB
- [ ] i18n 审计: 零遗漏 key, 零无用 key
- [ ] zh-CN 全页面无英文残留
- [ ] en 全页面无中文残留
- [ ] `pnpm start` 从零启动到 Dashboard 可用 < 5 秒
- [ ] Lighthouse LCP < 2 秒
- [ ] 安装脚本 `scripts/install.sh` 从干净环境执行成功
- [ ] NotificationDropdown: 铃铛点击展开通知列表, 未读 badge 正确
- [ ] NotificationDropdown: mark-as-read 后 badge 计数减少
- [ ] Project Switcher: dropdown 显示 workspace 中的 project 列表
- [ ] `scripts/apply-branding.sh` 成功生成 patch 文件
- [ ] E2E smoke test: `install → setup → start → chat` 全链路通过

---

## 附录 A: RPC 方法速查表

完整的 46 个自定义方法 (45 WS RPC + 1 HTTP endpoint, from 00 §3.2):

### Literature (`rc.lit.*`) — 26 methods

```
rc.lit.list            — { offset?, limit?, status?, tags?, query?, sort? } → { items: Paper[], total }
rc.lit.get             — { id } → Paper (full)
rc.lit.add             — { title, authors, doi?, ... } → Paper
rc.lit.update          — { id, ...patch } → Paper
rc.lit.delete          — { id } → { ok: true }
rc.lit.status          — { id, status } → Paper
rc.lit.rate            — { id, rating } → Paper
rc.lit.tags            — {} → { tags: Tag[] }
rc.lit.tag             — { paper_id, tag } → { ok: true }
rc.lit.untag           — { paper_id, tag } → { ok: true }
rc.lit.reading.start   — { paper_id } → { session_id }
rc.lit.reading.end     — { session_id, pages_read?, notes? } → ReadingSession
rc.lit.reading.list    — { paper_id } → ReadingSession[]
rc.lit.cite            — { paper_id, citing_paper_id, context? } → Citation
rc.lit.citations       — { paper_id, direction? } → Citation[]
rc.lit.stats           — {} → LibraryStats
rc.lit.search          — { query, limit? } → { items: Paper[], total }
rc.lit.duplicate_check — { title, authors? } → { duplicates: Paper[] }
rc.lit.batch_add       — { papers: PaperInput[] } → { added: Paper[], skipped: number }
rc.lit.import_bibtex   — { bibtex: string } → { added: Paper[], errors: string[] }
rc.lit.export_bibtex   — { paper_ids?, filter? } → { bibtex: string }
rc.lit.collections.list    — {} → Collection[]
rc.lit.collections.manage  — { action, collection_id?, ... } → Collection
rc.lit.notes.list      — { paper_id } → Note[]
rc.lit.notes.add       — { paper_id, content, page?, highlight? } → Note
rc.lit.notes.delete    — { note_id } → { ok: true }
```

### Tasks (`rc.task.*`) — 10 methods

```
rc.task.list      — { offset?, limit?, status?, priority?, task_type?, sort?, direction?, include_completed? } → { items: Task[], total }
rc.task.get       — { id } → Task & { activity_log, subtasks }
rc.task.create    — { task: TaskInput } → Task
rc.task.update    — { id, patch: TaskPatch } → Task
rc.task.complete  — { id, notes? } → Task
rc.task.delete    — { id } → { ok: true }
rc.task.upcoming  — { hours?: 48 } → Task[]
rc.task.overdue   — {} → Task[]
rc.task.link      — { taskId, paperId } → { linked: true }
rc.task.notes.add — { taskId, content } → { id }
```

### Workspace (`rc.ws.*`) — 6 methods

```
rc.ws.tree    — { root?, depth?: 3 } → { tree: TreeNode[], workspace_root }
rc.ws.read    — { path } → { content, size, mime_type, git_status, encoding }
rc.ws.save    — { path, content, message? } → { path, size, committed }
rc.ws.history — { path?, limit?: 20, offset?: 0 } → { commits: CommitEntry[], total, has_more }
rc.ws.diff    — { path?, from?, to? } → { diff, files_changed, insertions, deletions }
rc.ws.restore — { path, commit } → { ok, path, restored_from, new_commit }
```

### Cron (`rc.cron.presets.*`) — 3 methods

```
rc.cron.presets.list       — {} → CronPreset[]
rc.cron.presets.activate   — { preset_id, config? } → { ok, preset }
rc.cron.presets.deactivate — { preset_id } → { ok, preset }
```

### HTTP Endpoint

```
POST /rc/upload — multipart/form-data { file, destination? } → { ok, file: FileEntry }
```

---

## 附录 B: 卡片类型字段清单 (逐字段校验用)

### paper_card (12 fields)

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | `type` | `'paper_card'` | implicit |
| 2 | `title` | `string` | **YES** |
| 3 | `authors` | `string[]` | **YES** |
| 4 | `venue` | `string` | no |
| 5 | `year` | `number` | no |
| 6 | `doi` | `string` | no |
| 7 | `url` | `string` | no |
| 8 | `arxiv_id` | `string` | no |
| 9 | `abstract_preview` | `string` | no |
| 10 | `read_status` | `'unread' \| 'reading' \| 'read' \| 'reviewed'` | no |
| 11 | `library_id` | `string` | no |
| 12 | `tags` | `string[]` | no |

### task_card (9 fields)

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | `type` | `'task_card'` | implicit |
| 2 | `id` | `string` | no |
| 3 | `title` | `string` | **YES** |
| 4 | `description` | `string` | no |
| 5 | `task_type` | `'human' \| 'agent' \| 'mixed'` | **YES** |
| 6 | `status` | `'todo' \| 'in_progress' \| 'blocked' \| 'done' \| 'cancelled'` | **YES** |
| 7 | `priority` | `'urgent' \| 'high' \| 'medium' \| 'low'` | **YES** |
| 8 | `deadline` | `string` (ISO 8601) | no |
| 9 | `related_paper_title` | `string` | no |

### progress_card (9 fields — 8 data fields + type discriminator)

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | `type` | `'progress_card'` | implicit |
| 2 | `period` | `string` | **YES** |
| 3 | `papers_read` | `number` | **YES** |
| 4 | `papers_added` | `number` | **YES** |
| 5 | `tasks_completed` | `number` | **YES** |
| 6 | `tasks_created` | `number` | **YES** |
| 7 | `writing_words` | `number` | no |
| 8 | `reading_minutes` | `number` | no |
| 9 | `highlights` | `string[]` (max 5) | no |

### approval_card (6 fields)

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | `type` | `'approval_card'` | implicit |
| 2 | `action` | `string` | **YES** |
| 3 | `context` | `string` | **YES** |
| 4 | `risk_level` | `'low' \| 'medium' \| 'high'` | **YES** |
| 5 | `details` | `Record<string, unknown>` | no |
| 6 | `approval_id` | `string` | no |

### radar_digest (6 fields + sub-interface)

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | `type` | `'radar_digest'` | implicit |
| 2 | `source` | `string` | **YES** |
| 3 | `query` | `string` | **YES** |
| 4 | `period` | `string` | **YES** |
| 5 | `total_found` | `number` | **YES** |
| 6 | `notable_papers` | `NotablePaper[]` | **YES** |

**NotablePaper** (3 fields):

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | `title` | `string` | **YES** |
| 2 | `authors` | `string[]` | **YES** |
| 3 | `relevance_note` | `string` | **YES** |

### file_card (8 fields)

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | `type` | `'file_card'` | implicit |
| 2 | `name` | `string` | **YES** |
| 3 | `path` | `string` | **YES** |
| 4 | `size_bytes` | `number` | no |
| 5 | `mime_type` | `string` | no |
| 6 | `created_at` | `string` (ISO 8601) | no |
| 7 | `modified_at` | `string` (ISO 8601) | no |
| 8 | `git_status` | `'new' \| 'modified' \| 'committed'` | no |

---

## 附录 C: Theme Token 映射

当在组件中需要颜色时, 使用以下路径 (from `dashboard/src/styles/theme.ts`):

| 用途 | Token 路径 | Dark 值 | Light 值 |
|------|-----------|---------|---------|
| 页面背景 | `tokens.bg.primary` | `#030303` | `#FFFBF5` |
| 卡片/面板背景 | `tokens.bg.surface` | `#141415` | `#FFF3E8` |
| Hover 状态 | `tokens.bg.surfaceHover` | `#1C1C1E` | `#FFEDD5` |
| 代码背景 | `tokens.bg.code` | `#161618` | `#F5F0EA` |
| 主文本 | `tokens.text.primary` | `#E4E4E7` | `#1C1917` |
| 副文本 | `tokens.text.secondary` | `#A1A1AA` | `#78716C` |
| 弱文本 | `tokens.text.muted` | `#71717A` | `#A8A29E` |
| 默认边框 | `tokens.border.default` | `rgba(255,255,255,0.08)` | `rgba(28,25,23,0.08)` |
| 品牌红 (interactive) | `tokens.accent.red` | `#EF4444` | `#DC2626` |
| 学术蓝 (info) | `tokens.accent.blue` | `#3B82F6` | `#2563EB` |
| 成功绿 | `tokens.accent.green` | `#10B981` | `#059669` |
| 警告黄 | `tokens.accent.amber` | `#F59E0B` | `#D97706` |
| 错误红 | `tokens.accent.error` | `#F43F5E` | `#E11D48` |

**获取方式**:
```typescript
import { getThemeTokens } from '@/styles/theme';
import { useConfigStore } from '@/stores/config';

// 在组件中:
const theme = useConfigStore((s) => s.theme);
const tokens = getThemeTokens(theme);
```

**固定色值** (不随主题变化, 直接在 spec 中指定):
- Priority urgent: `#EF4444`
- Priority high: `#F59E0B`
- Priority medium: `#3B82F6`
- Priority low: `#6B7280`
- Read status unread: `tokens.text.muted`
- Read status reading: `#3B82F6`
- Read status read: `#22C55E`
- Read status reviewed: `#A855F7`
- Approve button: `#22C55E`
- Reject button: `#EF4444`

---

## 附录 D: 响应式断点常量

```typescript
// dashboard/src/styles/breakpoints.ts (如果不存在则创建)
export const BP_MOBILE = 1024;
export const BP_TABLET = 1440;

// 使用:
// >= BP_TABLET: 3-column (right panel inline)
// BP_MOBILE ~ BP_TABLET: 2-column (right panel overlay)
// < BP_MOBILE: 1-column (right panel full-width modal, left nav icons only 56px)
```

---

*End of Phase 2-4 Development Plan.*
*All field names, method names, and parameters are verified against the canonical spec documents.*
*Implementing agent: read the pre-reading files, follow the 并行执行策略 for session layout, verify against spec after each module.*
