# Research-Claw Dashboard — Development & Testing SOP v1.0

> 2026-03-14 — Post-mortem of persistent bugs (image display, streaming duplication, config drift)

## 1. Why the Old Approach Failed

### The Pattern That Kept Producing Bugs

```
写代码 (based on guesses about gateway protocol)
  → 照着代码写测试 (tests verify implementation, not behavior)
  → 374 tests pass ✅
  → 用户发现不好使 ❌
  → 猜着修 → 还是不好使 → 再修 → 循环10次
```

### Root Causes (with evidence)

**1. 没有参考实现就开始写代码**

MessageBubble.tsx 从来没有图片渲染代码。不是代码有bug——是功能根本没实现。
因为开发时没有读过 OpenClaw 的 `grouped-render.ts`，不知道需要 `extractImages()`。

**2. 测试验证了错误的行为**

```typescript
// chat.test.ts — 这个测试通过了，但验证的是错误的逻辑
it('concatenates multiple deltas', () => {
  handleChatEvent({ text: 'Hello' });
  handleChatEvent({ text: ' world' });
  expect(streamText).toBe('Hello world'); // ← 错！gateway发的是累积文本
});
```

OpenClaw 原生 UI 用的是 REPLACE（取更长值），我们用的是 ACCUMULATE（拼接）。
测试照着我们的错误代码写，当然通过。

**3. 100% mock = 0% 协议验证**

所有374个测试都mock了gateway。意味着：
- gateway payload 格式对不对？不知道。
- RPC 参数名写错了？不知道。
- 事件字段变了？不知道。

**4. 核心UI组件零测试**

MessageBubble（消息渲染）、ChatView（聊天页面）、MessageInput（输入框）
——用户最常用的三个组件，测试数 = 0。

---

## 2. New Development Workflow

### 铁律：先读 OpenClaw，再写代码

Every feature in this dashboard has a reference implementation in OpenClaw's native Lit UI.
**开发任何功能前，必须先找到并读懂 OpenClaw 对应的实现。**

```
新功能/Bug修复流程：

1. 定位 OpenClaw 原生实现
   └─ ui/src/ui/chat/          → 消息渲染、图片、markdown
   └─ ui/src/ui/controllers/   → 流式处理、发送、历史
   └─ src/gateway/             → RPC协议、事件格式
   └─ src/agents/              → 模型配置、能力声明

2. 写行为规格（Behavior Spec）
   └─ 输入：真实的 gateway payload（从 OpenClaw 源码或日志中获取）
   └─ 输出：期望的行为（匹配 OpenClaw 原生 UI）
   └─ 边界：OpenClaw 处理的边缘情况

3. 写测试（Test-First）
   └─ 用真实 payload 格式
   └─ 验证行为，不验证实现细节
   └─ 测试应该在代码写完前 FAIL

4. 写代码使测试通过

5. 对照 OpenClaw 原生 UI 手动验证
```

### OpenClaw 源码关键位置速查

| 我们的文件 | OpenClaw 参考实现 | 对齐什么 |
|-----------|------------------|---------|
| `MessageBubble.tsx` | `ui/src/ui/chat/grouped-render.ts` | 图片提取、markdown渲染、工具卡片 |
| `chat.ts` (store) | `ui/src/ui/controllers/chat.ts` | delta处理（replace不是accumulate）、历史加载、发送格式 |
| `client.ts` (gateway) | `ui/src/ui/gateway.ts` | hello握手、事件订阅、ping/pong |
| `config-patch.ts` | `src/gateway/server-config.ts` | config.apply格式、sentinel处理 |
| `MessageInput.tsx` | `ui/src/ui/chat/chat-input.ts` | 附件格式、RPC参数 |

---

## 3. New Testing Pyramid

### Layer 0: Protocol Fixtures（协议固件）— NEW, HIGHEST PRIORITY

**目的：用真实的 gateway 数据格式作为测试输入，防止协议漂移。**

```
src/
  __fixtures__/
    gateway-payloads/
      chat-delta.json          ← 从真实gateway捕获的delta事件
      chat-final.json          ← 从真实gateway捕获的final事件
      chat-final-with-image.json
      chat-history-response.json
      config-get-response.json
      chat-send-response.json
```

**如何获取真实 payload：**
1. 打开 OpenClaw 原生 UI
2. 在浏览器 DevTools → Network → WS 中捕获真实通信
3. 保存为 JSON fixture 文件
4. 或者从 OpenClaw 源码的测试中提取

**每次 OpenClaw 升级时更新 fixture。**

### Layer 1: Behavioral Parity Tests（行为对齐测试）— NEW

**目的：验证我们的代码在相同输入下产生与 OpenClaw 原生 UI 相同的输出。**

```typescript
// src/__tests__/parity/chat-streaming.parity.test.ts
import deltaPayload from '../__fixtures__/gateway-payloads/chat-delta.json';

describe('Streaming parity with OpenClaw native UI', () => {
  it('replaces stream text (not accumulates) — matches chat.ts:287-289', () => {
    // Setup: simulate two delta events as gateway actually sends them
    handleChatEvent(deltaPayload.first);  // { text: "Hello" }
    handleChatEvent(deltaPayload.second); // { text: "Hello world" } ← 完整累积文本

    // OpenClaw native UI behavior (chat.ts:289): state.chatStream = next
    expect(streamText).toBe('Hello world');
    // NOT 'HelloHello world' (accumulation bug)
  });

  it('extracts images from user message content blocks — matches grouped-render.ts:22-57', () => {
    const msg = messageWithImageFixture; // 真实格式的消息
    const images = extractImages(msg);

    expect(images).toHaveLength(1);
    expect(images[0].url).toMatch(/^data:image\//);
  });
});
```

**命名约定：`*.parity.test.ts`** — 这些测试的唯一目的是对齐 OpenClaw 行为。

### Layer 2: Component Behavior Tests（组件行为测试）— NEW

**目的：验证用户实际看到的渲染结果。**

```typescript
// src/components/chat/MessageBubble.test.tsx
describe('MessageBubble', () => {
  it('renders images from base64 content blocks', () => {
    const msg = {
      role: 'user',
      content: [
        { type: 'text', text: 'Look at this' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBOR...' } },
      ],
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('Look at this')).toBeInTheDocument();
  });

  it('renders images from image_url format (OpenAI)', () => { ... });
  it('renders message with images but no text', () => { ... });
  it('strips [Research-Claw] prefix from user messages', () => { ... });
  it('renders markdown in assistant messages', () => { ... });
});
```

**覆盖优先级：**
1. MessageBubble（消息渲染 — 图片、markdown、代码块）
2. ChatView（消息列表 — 过滤、滚动、流式显示）
3. MessageInput（发送 — 附件、RPC格式）

### Layer 3: Integration Tests with Real Gateway（真实网关集成测试）— NEW

**目的：端到端验证 dashboard ↔ gateway 通信。**

```typescript
// src/__tests__/integration/gateway-live.integration.test.ts
// 标记：只在本地开发时运行，CI 跳过
describe.skipIf(!process.env.GATEWAY_LIVE)('Live gateway integration', () => {
  it('connects to gateway and receives hello-ok', async () => {
    const client = new GatewayClient('ws://127.0.0.1:28789');
    await client.connect();
    expect(client.isConnected).toBe(true);
    client.disconnect();
  });

  it('sends chat message and receives streaming events', async () => {
    // ...真实发送，验证事件格式
  });

  it('loads chat history with image content blocks preserved', async () => {
    // ...真实加载历史，验证图片数据
  });

  it('config.get returns expected structure', async () => {
    // ...验证config格式匹配我们的类型定义
  });
});
```

**运行方式：**
```bash
# 正常开发/CI — 跳过集成测试
npx vitest run

# 本地集成测试 — 需要 gateway 运行中
GATEWAY_LIVE=1 npx vitest run src/__tests__/integration/
```

### Layer 4: Existing Unit Tests（现有单元测试）— KEEP, BUT REFORM

保留现有单元测试，但要求：
- **纯函数测试**（config-patch, provider-presets）→ 保持不变，有价值
- **Store 测试** → 用 fixture payload 替换手写的 mock 数据
- **Card 测试** → 保持不变，有价值
- **删除验证实现细节的测试** → 如果测试只是验证"代码做了我写的事"而不是"代码做了正确的事"

---

## 4. Behavioral Parity Checklist

以下是 OpenClaw 原生 UI 的关键行为，我们的 dashboard 必须逐一对齐。
每项标注 OpenClaw 源码位置，便于对照。

### Chat Streaming

| # | 行为 | OpenClaw 位置 | 我们的状态 | 测试 |
|---|------|-------------|-----------|------|
| 1 | Delta REPLACE（取更长值，不拼接） | `controllers/chat.ts:287-289` | ✅ 已修复 | ✅ 已有 |
| 2 | NO_REPLY 过滤（delta/final/history） | `controllers/chat.ts:265,274,81` | ✅ 已有 | ⚠️ 仅final |
| 3 | Sub-agent final 追加到历史（不清除streaming） | `controllers/chat.ts:272-278` | ✅ 已有 | ✅ 已有 |
| 4 | toolResult role 不显示 | `controllers/chat.ts:284-285` | ✅ 已有 | ❌ 无 |

### Message Rendering

| # | 行为 | OpenClaw 位置 | 我们的状态 | 测试 |
|---|------|-------------|-----------|------|
| 5 | 提取并渲染 base64 图片 | `grouped-render.ts:34-42` | ✅ 已修复 | ❌ 无 |
| 6 | 提取并渲染 image_url 图片 | `grouped-render.ts:46-52` | ✅ 已修复 | ❌ 无 |
| 7 | Thinking/reasoning block 提取 | `message-extract.ts:extractThinking` | ❌ 未实现 | ❌ 无 |
| 8 | Tool call/result 卡片渲染 | `tool-cards.ts:10-49` | ⚠️ 部分 | ❌ 无 |
| 9 | Markdown 渲染（sanitized） | `markdown.ts` (DOMPurify) | ✅ 已有 | ❌ 无 |
| 10 | 消息分组（同角色合并） | `grouped-render.ts:renderGroupedMessage` | ❌ 未实现 | ❌ 无 |

### Message Sending

| # | 行为 | OpenClaw 位置 | 我们的状态 | 测试 |
|---|------|-------------|-----------|------|
| 11 | 附件格式 `{ type, mimeType, content }` | `controllers/chat.ts:217-223` | ✅ 已有 | ❌ 无 |
| 12 | idempotencyKey 防重复 | `controllers/chat.ts:207` | ✅ 已有 | ❌ 无 |
| 13 | deliver: false | `controllers/chat.ts:210` | ❌ 缺少 | ❌ 无 |

### History Loading

| # | 行为 | OpenClaw 位置 | 我们的状态 | 测试 |
|---|------|-------------|-----------|------|
| 14 | 保留原始 content blocks（含图片） | `controllers/chat.ts:81` | ✅ 已修复 | ❌ 无 |
| 15 | 过滤 silent replies | `controllers/chat.ts:81` | ✅ 已有 | ❌ 无 |
| 16 | limit: 200 | `controllers/chat.ts:77` | ❌ 缺少 | ❌ 无 |

### Config / Protocol

| # | 行为 | OpenClaw 位置 | 我们的状态 | 测试 |
|---|------|-------------|-----------|------|
| 17 | config.apply（全量替换） | `server-config.ts` | ✅ 已修复 | ✅ 已有 |
| 18 | REDACTED sentinel 保留 | `server-config.ts` | ✅ 已有 | ✅ 已有 |
| 19 | contextWindow/maxTokens from presets | `models-config.providers.static.ts` | ✅ 已修复 | ✅ 已有 |

---

## 5. Immediate Action Items

### P0 — 本周必做（阻止同类 bug 再发生）

1. **创建 protocol fixtures**
   - 从 OpenClaw 原生 UI 的 WebSocket 通信中捕获真实 payload
   - 存放在 `src/__fixtures__/gateway-payloads/`
   - 至少覆盖：chat-delta、chat-final、chat-history、config-get

2. **写 MessageBubble 行为测试**
   - 测试图片渲染（base64、image_url、无图片）
   - 测试 markdown 渲染
   - 测试纯图片消息（无文本）
   - 用 fixture 数据，不用手写 mock

3. **写 Streaming Parity 测试**
   - 用真实 delta payload 格式
   - 验证 replace 行为（不是 accumulate）
   - 验证 toolResult 过滤

### P1 — 本周建议做

4. **重构 chat.test.ts 的 mock 数据**
   - 替换手写 mock 为 fixture import
   - 确保测试用的数据格式与 gateway 实际发送的一致

5. **写 ChatView 行为测试**
   - 消息列表渲染（含图片消息不被过滤）
   - 流式消息显示
   - 空消息状态

### P2 — 下周

6. **集成测试脚手架**
   - `GATEWAY_LIVE=1` 环境变量门控
   - 基础连接 + hello-ok 测试
   - chat.send + streaming round-trip

7. **行为对齐 Checklist 剩余项**
   - thinking block 提取（#7）
   - deliver: false 参数（#13）
   - history limit: 200（#16）

---

## 6. Development Checklist (per feature/fix)

每次开发新功能或修 bug 前，走这个 checklist：

```
□ 找到 OpenClaw 原生 UI 的对应实现
  └─ 记录文件路径和关键行号

□ 理解 gateway payload 格式
  └─ 从源码或 WS 抓包获取真实数据

□ 写行为测试（应该 FAIL）
  └─ 用真实 payload 格式
  └─ 验证与 OpenClaw 行为一致

□ 写代码使测试通过

□ 对照 OpenClaw 原生 UI 手动验证
  └─ 在真实 gateway 上测试
  └─ 截图对比（可选）

□ 更新 Behavioral Parity Checklist
```

---

## 7. What Tests Are Actually Valuable

### 有价值的测试（保留）

- **config-patch.test.ts** — 纯函数，输入输出明确，有真实价值
- **provider-presets 相关测试** — 数据正确性验证
- **Card 组件测试** — 渲染正确性（PaperCard, TaskCard 等）
- **Gateway client 协议测试** — hello 握手、frame 解析
- **reconnect 测试** — 重连策略

### 低价值的测试（需要重写或删除）

- **照着代码写的 store 测试** — 如果 mock 数据格式不对，测试通过也没意义
- **只验证"函数被调用了"的测试** — `expect(mock).toHaveBeenCalledWith(...)` 不能告诉你功能是否正确
- **Edge case 测试中不可能出现的场景** — 如果输入数据在现实中不存在，测试没有意义

### 判断标准

问自己一个问题：**如果这个测试通过了，我能否对用户说"这个功能好使了"？**

- 如果答案是"能" → 有价值的测试
- 如果答案是"不确定" → 需要改进
- 如果答案是"不能" → 删除或重写
