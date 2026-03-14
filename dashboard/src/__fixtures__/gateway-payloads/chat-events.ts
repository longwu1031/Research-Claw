/**
 * Realistic gateway WebSocket payloads extracted from OpenClaw source code.
 *
 * These fixtures represent the ACTUAL data format the gateway sends.
 * They are the single source of truth for our protocol conformance tests.
 *
 * Sources:
 *   - openclaw/src/gateway/server-chat.ts (delta/final emission)
 *   - openclaw/ui/src/ui/controllers/chat.ts (client-side handling)
 *   - openclaw/src/gateway/chat-attachments.ts (attachment processing)
 *   - openclaw/src/gateway/protocol/schema/logs-chat.ts (schema definitions)
 *
 * Update these when OpenClaw protocol changes.
 */

import type { ChatStreamEvent, ChatMessage } from '../../gateway/types';

// ─── Delta Events ──────────────────────────────────────────────────
// Gateway sends ACCUMULATED text in each delta, NOT incremental.
// See: openclaw/ui/src/ui/controllers/chat.ts:284-290

export const DELTA_FIRST: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'delta',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello' }],
  },
};

export const DELTA_SECOND: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'delta',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello, I can help' }],
  },
};

export const DELTA_THIRD: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'delta',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello, I can help you with that question.' }],
  },
};

// Shorter delta (can happen due to throttling/reordering)
export const DELTA_SHORTER_REORDER: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'delta',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello, I can' }], // shorter than DELTA_SECOND
  },
};

// Delta from a toolResult role (should be filtered — not user-visible)
export const DELTA_TOOL_RESULT: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'delta',
  message: {
    role: 'toolResult',
    content: [{ type: 'text', text: 'Tool execution output...' }],
    toolCallId: 'call-xyz',
    toolName: 'rc.lit.search',
  },
};

// ─── Final Events ──────────────────────────────────────────────────

export const FINAL_TEXT: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'final',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello, I can help you with that question. Here is the answer.' }],
    stopReason: 'end_turn',
    timestamp: 1710400000000,
  },
  usage: { input: 150, output: 42, total: 192 },
};

export const FINAL_NO_REPLY: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'final',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: '  NO_REPLY  ' }],
    timestamp: 1710400000000,
  },
};

export const FINAL_SUB_AGENT: ChatStreamEvent = {
  runId: 'run-OTHER-456', // different runId = sub-agent
  sessionKey: 'main',
  state: 'final',
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'Sub-agent completed the task.' }],
    timestamp: 1710400000000,
  },
};

// ─── Error / Aborted Events ───────────────────────────────────────

export const ERROR_EVENT: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'error',
  errorMessage: 'Model overloaded, please retry',
};

export const ABORTED_EVENT: ChatStreamEvent = {
  runId: 'run-abc-123',
  sessionKey: 'main',
  state: 'aborted',
};

// ─── Messages with Images ─────────────────────────────────────────
// Format from: openclaw/ui/src/ui/chat/grouped-render.ts:22-57

// Tiny valid PNG (1x1 transparent pixel) for testing
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const USER_MESSAGE_WITH_IMAGE: ChatMessage = {
  role: 'user',
  text: 'What is in this image?',
  content: [
    { type: 'text', text: 'What is in this image?' },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: TINY_PNG_B64,
      },
    },
  ],
  timestamp: 1710400000000,
};

export const USER_MESSAGE_WITH_DATA_URL_IMAGE: ChatMessage = {
  role: 'user',
  text: 'Check this screenshot',
  content: [
    { type: 'text', text: 'Check this screenshot' },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: `data:image/png;base64,${TINY_PNG_B64}`, // already a data URL
      },
    },
  ],
  timestamp: 1710400000000,
};

// OpenAI image_url format (used by some providers)
export const USER_MESSAGE_WITH_IMAGE_URL: ChatMessage = {
  role: 'user',
  content: [
    { type: 'text', text: 'What about this?' },
    {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${TINY_PNG_B64}` },
    },
  ],
  timestamp: 1710400000000,
};

// Image-only message (no text)
export const USER_MESSAGE_IMAGE_ONLY: ChatMessage = {
  role: 'user',
  content: [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: TINY_PNG_B64,
      },
    },
  ],
  timestamp: 1710400000000,
};

// ─── History Response ──────────────────────────────────────────────

export const HISTORY_MESSAGES: ChatMessage[] = [
  {
    role: 'user',
    text: 'Find papers about attention mechanisms',
    content: [
      { type: 'text', text: '[Research-Claw] Library: 3 papers (1 unread)\n[Thu 2026-03-12 10:25 GMT+8] Find papers about attention mechanisms' },
    ],
    timestamp: 1710400000000,
  },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: 'I found several relevant papers on attention mechanisms.' },
    ],
    timestamp: 1710400001000,
  },
  {
    role: 'toolResult',
    content: [
      { type: 'text', text: '{"results": [{"title": "Attention Is All You Need"}]}' },
    ],
    toolCallId: 'call-123',
    toolName: 'rc.lit.search',
    timestamp: 1710400000500,
  },
  {
    role: 'user',
    text: 'Show me the diagram',
    content: [
      { type: 'text', text: '[Research-Claw] Library: 3 papers (1 unread)\n[Thu 2026-03-12 10:30 GMT+8] Show me the diagram' },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: TINY_PNG_B64,
        },
      },
    ],
    timestamp: 1710400002000,
  },
];

// ─── Attachment Format (for chat.send RPC) ─────────────────────────
// Format from: openclaw/src/gateway/chat-attachments.ts

export const SEND_ATTACHMENT = {
  type: 'image' as const,
  mimeType: 'image/png',
  fileName: 'screenshot.png',
  content: TINY_PNG_B64, // raw base64, NOT data URL
};

export { TINY_PNG_B64 };
