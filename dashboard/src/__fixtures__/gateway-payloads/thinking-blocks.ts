/**
 * Realistic gateway payloads for thinking/reasoning block extraction.
 *
 * These fixtures cover the TWO formats thinking content can appear in:
 *
 * 1. Content blocks with `type: 'thinking'` — Anthropic extended thinking format.
 *    Source: openclaw/ui/src/ui/chat/message-extract.ts:46-54
 *      if (item.type === "thinking" && typeof item.thinking === "string")
 *
 * 2. `<think>...</think>` XML tags in text — Some providers wrap reasoning in these.
 *    Source: openclaw/ui/src/ui/chat/message-extract.ts:65-68
 *      rawText.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)
 *
 * Update these when OpenClaw protocol changes.
 */

import type { ChatStreamEvent, ChatMessage } from '../../gateway/types';

// ─── Anthropic format: type: 'thinking' content blocks ──────────────

/**
 * Message with a thinking content block + text block.
 * Source: message-extract.ts:46-54 — `item.type === "thinking" && typeof item.thinking === "string"`
 * Source: message-extract.ts:92-100 — extractRawText only joins type: 'text' blocks
 */
export const MSG_THINKING_BLOCK_AND_TEXT: ChatMessage = {
  role: 'assistant',
  content: [
    {
      type: 'thinking',
      thinking: 'Let me analyze the paper structure. The methodology section uses a transformer architecture with multi-head attention.',
    },
    {
      type: 'text',
      text: 'The paper uses a transformer-based architecture with multi-head attention for sequence modeling.',
    },
  ],
  timestamp: 1710400000000,
};

/**
 * Message with ONLY thinking blocks — no visible text after extraction.
 * Edge case: extractRawText returns null because no type:'text' blocks exist.
 */
export const MSG_THINKING_ONLY: ChatMessage = {
  role: 'assistant',
  content: [
    {
      type: 'thinking',
      thinking: 'I need to consider what tools to use here. The user wants a literature search.',
    },
  ],
  timestamp: 1710400001000,
};

/**
 * Message with multiple thinking blocks interleaved with text blocks.
 * Source: message-extract.ts:44-58 — parts are joined with "\n"
 */
export const MSG_MULTIPLE_THINKING_BLOCKS: ChatMessage = {
  role: 'assistant',
  content: [
    {
      type: 'thinking',
      thinking: 'First, I should search for papers on attention mechanisms.',
    },
    {
      type: 'text',
      text: 'I found three relevant papers. ',
    },
    {
      type: 'thinking',
      thinking: 'The user might also want to know about the citation counts.',
    },
    {
      type: 'text',
      text: 'Here are the details with citation counts.',
    },
  ],
  timestamp: 1710400002000,
};

// ─── Provider format: <think>...</think> tags in text ───────────────

/**
 * Message with <think>...</think> tags wrapping reasoning in text content.
 * Source: message-extract.ts:65-68 — regex: /<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi
 * Source: format.ts:58-60 → stripThinkingTags → stripAssistantInternalScaffolding
 * Source: reasoning-tags.ts:7 — THINKING_TAG_RE handles think, thinking, thought, antthinking
 */
export const MSG_THINK_TAGS_IN_TEXT: ChatMessage = {
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: '<think>I should analyze the methodology carefully before responding.</think>The methodology uses a novel approach to self-attention.',
    },
  ],
  timestamp: 1710400003000,
};

/**
 * Message with <thinking>...</thinking> tags (alternate tag name).
 * Source: message-extract.ts:66 — regex matches both `think` and `thinking`
 */
export const MSG_THINKING_TAGS_IN_TEXT: ChatMessage = {
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: '<thinking>The user is asking about scaling laws. Let me recall the key findings from Kaplan et al.</thinking>Scaling laws suggest that model performance follows a power law with respect to compute, dataset size, and model parameters.',
    },
  ],
  timestamp: 1710400004000,
};

/**
 * Message with multiple <think> blocks in text.
 */
export const MSG_MULTIPLE_THINK_TAGS: ChatMessage = {
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: '<think>First consideration: the paper is from 2017.</think>The paper was published in 2017. <think>Second consideration: it has over 100k citations.</think>It has become one of the most cited papers in machine learning.',
    },
  ],
  timestamp: 1710400005000,
};

/**
 * Message with text field (not content array) containing think tags.
 * Tests the text-field fallback path.
 */
export const MSG_THINK_TAGS_IN_TEXT_FIELD: ChatMessage = {
  role: 'assistant',
  text: '<think>Planning my response about BERT.</think>BERT is a bidirectional transformer model pre-trained on masked language modeling.',
  timestamp: 1710400006000,
};

// ─── Streaming deltas with thinking ────────────────────────────────

/**
 * Streaming delta that contains think tags mid-stream.
 * The displayed stream text should NOT show the raw thinking tags.
 */
export const DELTA_WITH_THINK_TAGS: ChatStreamEvent = {
  runId: 'run-think-001',
  sessionKey: 'main',
  state: 'delta',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: '<think>Let me search for relevant papers first.</think>I found several papers on attention mechanisms.',
      },
    ],
  },
};

/**
 * Streaming delta with thinking content block (Anthropic format).
 */
export const DELTA_WITH_THINKING_BLOCK: ChatStreamEvent = {
  runId: 'run-think-002',
  sessionKey: 'main',
  state: 'delta',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'thinking',
        thinking: 'Searching the literature database...',
      },
      {
        type: 'text',
        text: 'Searching for papers...',
      },
    ],
  },
};

/**
 * Final message with thinking block — what handleChatEvent receives at the end.
 */
export const FINAL_WITH_THINKING: ChatStreamEvent = {
  runId: 'run-think-001',
  sessionKey: 'main',
  state: 'final',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'thinking',
        thinking: 'The user wants a summary of transformer papers. I should focus on the key innovations.',
      },
      {
        type: 'text',
        text: 'Here is a summary of the key transformer papers and their innovations.',
      },
    ],
    stopReason: 'end_turn',
    timestamp: 1710400010000,
  },
  usage: { input: 200, output: 55, total: 255 },
};

/**
 * Final message with think tags in text (provider format).
 */
export const FINAL_WITH_THINK_TAGS: ChatStreamEvent = {
  runId: 'run-think-003',
  sessionKey: 'main',
  state: 'final',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: '<think>I need to provide a comprehensive answer about BERT pre-training.</think>BERT uses masked language modeling and next sentence prediction for pre-training.',
      },
    ],
    stopReason: 'end_turn',
    timestamp: 1710400011000,
  },
  usage: { input: 180, output: 30, total: 210 },
};
