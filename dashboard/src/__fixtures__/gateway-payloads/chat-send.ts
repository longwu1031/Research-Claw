/**
 * Fixtures for chat.send RPC request/response payloads.
 *
 * These represent the ACTUAL format that OpenClaw gateway expects and returns.
 * Derived from reading the OpenClaw source code:
 *
 * - UI client attachment conversion:
 *     openclaw/ui/src/ui/controllers/chat.ts:152-243 (sendChatMessage)
 *     openclaw/ui/src/ui/controllers/chat.ts:95-101 (dataUrlToBase64)
 * - Gateway server chat.send handler:
 *     openclaw/src/gateway/server-methods/chat.ts:876-1025
 * - Gateway attachment normalization:
 *     openclaw/src/gateway/server-methods/attachment-normalize.ts:10-32
 * - Gateway attachment parsing:
 *     openclaw/src/gateway/chat-attachments.ts:49-74
 * - RPC schema:
 *     openclaw/src/gateway/protocol/schema/logs-chat.ts:35-59
 * - ChatAttachment UI type:
 *     openclaw/ui/src/ui/ui-types.ts:1-5
 *
 * Update these when OpenClaw protocol changes.
 */

// ─── Tiny valid PNG (1x1 transparent pixel) for testing ──────────
export const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_B64}`;

// Tiny JPEG-like base64 (not a real JPEG, but valid base64 for format tests)
export const TINY_JPEG_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//';
export const TINY_JPEG_DATA_URL = `data:image/jpeg;base64,${TINY_JPEG_B64}`;

// ─── Client-side ChatAttachment (our format & OpenClaw UI format) ─
// Source: openclaw/ui/src/ui/ui-types.ts:1-5
// Both OpenClaw and Research-Claw use { id, dataUrl, mimeType }

export const CLIENT_ATTACHMENT_PNG = {
  id: 'att-uuid-001',
  dataUrl: TINY_PNG_DATA_URL,
  mimeType: 'image/png',
};

export const CLIENT_ATTACHMENT_JPEG = {
  id: 'att-uuid-002',
  dataUrl: TINY_JPEG_DATA_URL,
  mimeType: 'image/jpeg',
};

// ─── RPC Attachment Format (what gets sent over the wire) ────────
// Source: openclaw/ui/src/ui/controllers/chat.ts:200-214
// OpenClaw strips data URL prefix and sends: { type, mimeType, content }
// Our dashboard adds fileName which gateway also accepts:
// openclaw/src/gateway/server-methods/attachment-normalize.ts:15-16

export const RPC_ATTACHMENT_PNG = {
  type: 'image',
  mimeType: 'image/png',
  content: TINY_PNG_B64, // raw base64, NOT data URL
};

export const RPC_ATTACHMENT_JPEG = {
  type: 'image',
  mimeType: 'image/jpeg',
  content: TINY_JPEG_B64,
};

// Our dashboard also includes fileName (gateway accepts it — attachment-normalize.ts:16)
export const RPC_ATTACHMENT_PNG_WITH_FILENAME = {
  type: 'image',
  mimeType: 'image/png',
  fileName: 'image-1.png',
  content: TINY_PNG_B64,
};

export const RPC_ATTACHMENT_JPEG_WITH_FILENAME = {
  type: 'image',
  mimeType: 'image/jpeg',
  fileName: 'image-1.jpg',
  content: TINY_JPEG_B64,
};

// ─── chat.send RPC Request Params ────────────────────────────────
// Source: openclaw/src/gateway/protocol/schema/logs-chat.ts:35-59
// Schema: { sessionKey, message, idempotencyKey, deliver?, attachments?, thinking?, timeoutMs? }

export const SEND_PARAMS_TEXT_ONLY = {
  message: 'Find papers about transformers',
  sessionKey: 'main',
  idempotencyKey: 'mock-uuid-1',
};

export const SEND_PARAMS_WITH_ATTACHMENTS = {
  message: 'What is in this image?',
  sessionKey: 'main',
  idempotencyKey: 'mock-uuid-2',
  attachments: [RPC_ATTACHMENT_PNG_WITH_FILENAME],
};

export const SEND_PARAMS_MULTI_ATTACHMENT = {
  message: 'Compare these images',
  sessionKey: 'main',
  idempotencyKey: 'mock-uuid-3',
  attachments: [RPC_ATTACHMENT_PNG_WITH_FILENAME, RPC_ATTACHMENT_JPEG_WITH_FILENAME],
};

// ─── chat.send RPC Response ──────────────────────────────────────
// Source: openclaw/src/gateway/server-methods/chat.ts:1021-1025
// Response: { runId, status: "started" }

export const SEND_RESPONSE = {
  runId: 'mock-uuid-1',
  status: 'started' as const,
};

// ─── User Message Content Blocks ─────────────────────────────────
// Source: openclaw/ui/src/ui/controllers/chat.ts:169-181
// OpenClaw builds content blocks: text block + image blocks for display
// Image source uses: { type: "base64", media_type, data: att.dataUrl }
// NOTE: OpenClaw stores the full dataUrl in the image source data field
// for local display purposes — NOT raw base64.

export const USER_CONTENT_BLOCKS_TEXT_ONLY = [
  { type: 'text' as const, text: 'Find papers about transformers' },
];

export const USER_CONTENT_BLOCKS_WITH_IMAGE = [
  { type: 'text' as const, text: 'What is in this image?' },
  {
    type: 'image' as const,
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: TINY_PNG_DATA_URL, // full dataUrl for display
    },
  },
];

export const USER_CONTENT_BLOCKS_IMAGE_ONLY = [
  {
    type: 'image' as const,
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: TINY_PNG_DATA_URL,
    },
  },
];

export const USER_CONTENT_BLOCKS_MULTI_IMAGE = [
  { type: 'text' as const, text: 'Compare these images' },
  {
    type: 'image' as const,
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: TINY_PNG_DATA_URL,
    },
  },
  {
    type: 'image' as const,
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: TINY_JPEG_DATA_URL,
    },
  },
];
