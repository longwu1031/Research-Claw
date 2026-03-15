/**
 * Behavioral Parity Tests: Chat Streaming
 *
 * These tests verify that our dashboard handles gateway events
 * IDENTICALLY to OpenClaw's native Lit UI.
 *
 * Reference: openclaw/ui/src/ui/controllers/chat.ts
 *
 * Each test documents the exact OpenClaw behavior and line number
 * it verifies parity with.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStore } from '../../stores/chat';
import {
  DELTA_FIRST,
  DELTA_SECOND,
  DELTA_THIRD,
  DELTA_SHORTER_REORDER,
  DELTA_TOOL_RESULT,
  FINAL_TEXT,
  FINAL_NO_REPLY,
  FINAL_SUB_AGENT,
  ERROR_EVENT,
  ABORTED_EVENT,
} from '../../__fixtures__/gateway-payloads/chat-events';

// Mock gateway store
const mockGatewayClient = {
  isConnected: true,
  request: vi.fn(),
};

vi.mock('../../stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({ client: mockGatewayClient, state: 'connected' }),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe('Chat streaming parity with OpenClaw native UI', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useChatStore.setState({
      messages: [],
      sending: false,
      streaming: false,
      streamText: null,
      runId: DELTA_FIRST.runId,
      sessionKey: 'main',
      lastError: null,
      tokensIn: 0,
      tokensOut: 0,
    });
  });

  describe('Delta handling — openclaw/ui/src/ui/controllers/chat.ts:284-290', () => {
    it('REPLACES stream text with accumulated delta (not appends)', () => {
      // OpenClaw behavior (chat.ts:289):
      //   state.chatStream = next;
      // NOT:
      //   state.chatStream += next;

      useChatStore.getState().handleChatEvent(DELTA_FIRST);
      expect(useChatStore.getState().streamText).toBe('Hello');

      useChatStore.getState().handleChatEvent(DELTA_SECOND);
      expect(useChatStore.getState().streamText).toBe('Hello, I can help');

      useChatStore.getState().handleChatEvent(DELTA_THIRD);
      expect(useChatStore.getState().streamText).toBe('Hello, I can help you with that question.');
    });

    it('keeps longer text when shorter delta arrives (throttle/reorder)', () => {
      // OpenClaw behavior (chat.ts:288):
      //   if (!current || next.length >= current.length)
      // Shorter deltas are ignored (can happen with network reordering)

      useChatStore.getState().handleChatEvent(DELTA_SECOND); // "Hello, I can help"
      useChatStore.getState().handleChatEvent(DELTA_SHORTER_REORDER); // "Hello, I can" (shorter)

      expect(useChatStore.getState().streamText).toBe('Hello, I can help');
    });

    it('filters toolResult role deltas (not user-visible)', () => {
      // OpenClaw behavior: toolResult messages are internal, not shown in chat UI
      // See: grouped-render.ts uses isToolResultMessage() filter

      useChatStore.getState().handleChatEvent(DELTA_FIRST); // visible
      useChatStore.getState().handleChatEvent(DELTA_TOOL_RESULT); // should be ignored

      expect(useChatStore.getState().streamText).toBe('Hello');
    });

    it('ignores deltas from different runId', () => {
      // OpenClaw behavior (chat.ts:272):
      //   if (payload.runId && state.chatRunId && payload.runId !== state.chatRunId)

      useChatStore.getState().handleChatEvent(DELTA_FIRST);
      useChatStore.getState().handleChatEvent({
        ...DELTA_SECOND,
        runId: 'different-run',
      });

      expect(useChatStore.getState().streamText).toBe('Hello');
    });

    it('sets streaming to true on first delta', () => {
      useChatStore.setState({ streaming: false });
      useChatStore.getState().handleChatEvent(DELTA_FIRST);
      expect(useChatStore.getState().streaming).toBe(true);
    });
  });

  describe('Final handling — openclaw/ui/src/ui/controllers/chat.ts:292-307', () => {
    it('adds final message to messages and clears streaming state', () => {
      useChatStore.setState({ streaming: true, streamText: 'partial' });
      useChatStore.getState().handleChatEvent(FINAL_TEXT);

      const state = useChatStore.getState();
      expect(state.streaming).toBe(false);
      expect(state.streamText).toBeNull();
      expect(state.runId).toBeNull();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('assistant');
    });

    it('tracks token usage from final event', () => {
      useChatStore.getState().handleChatEvent(FINAL_TEXT);

      expect(useChatStore.getState().tokensIn).toBe(150);
      expect(useChatStore.getState().tokensOut).toBe(42);
    });

    it('filters NO_REPLY messages', () => {
      // OpenClaw behavior: isAssistantSilentReply() checks /^\s*NO_REPLY\s*$/
      // See: chat.ts:274, chat.ts:296

      useChatStore.getState().handleChatEvent(FINAL_NO_REPLY);
      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it('appends sub-agent final without clearing main streaming state', () => {
      // OpenClaw behavior (chat.ts:272-277):
      //   if (payload.runId !== state.chatRunId && payload.state === "final")
      //     → append message only, don't touch streaming state

      useChatStore.setState({ streaming: true, streamText: 'main stream text' });
      useChatStore.getState().handleChatEvent(FINAL_SUB_AGENT);

      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().streaming).toBe(true); // NOT cleared
      expect(useChatStore.getState().streamText).toBe('main stream text'); // NOT cleared
    });
  });

  describe('Error/Abort — openclaw/ui/src/ui/controllers/chat.ts:309-333', () => {
    it('sets error and clears all streaming state', () => {
      useChatStore.setState({ streaming: true, streamText: 'partial' });
      useChatStore.getState().handleChatEvent(ERROR_EVENT);

      const state = useChatStore.getState();
      expect(state.lastError).toBe('Model overloaded, please retry');
      expect(state.streaming).toBe(false);
      expect(state.streamText).toBeNull();
      expect(state.runId).toBeNull();
    });

    it('saves partial stream text on abort', () => {
      // OpenClaw behavior (chat.ts:314-325):
      //   Uses streamedText as message content if available

      useChatStore.setState({ streaming: true, streamText: 'Partial answer before abort' });
      useChatStore.getState().handleChatEvent(ABORTED_EVENT);

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe('Partial answer before abort');
      expect(state.streaming).toBe(false);
    });

    it('clears without message on abort when no stream text', () => {
      useChatStore.setState({ streaming: true, streamText: null });
      useChatStore.getState().handleChatEvent(ABORTED_EVENT);

      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(useChatStore.getState().streaming).toBe(false);
    });
  });

  describe('Session usage loading via sessions.usage RPC', () => {
    it('loads token usage from sessions.usage RPC', async () => {
      // OpenClaw gateway tracks token usage in session transcripts but does NOT
      // include usage in chat stream events. We fetch aggregate totals via the
      // sessions.usage RPC (without key param to avoid key format mismatch).
      mockGatewayClient.request.mockResolvedValueOnce({
        totals: { input: 1200, output: 350 },
      });

      await useChatStore.getState().loadSessionUsage();

      expect(mockGatewayClient.request).toHaveBeenCalledWith('sessions.usage', {});
      expect(useChatStore.getState().tokensIn).toBe(1200);
      expect(useChatStore.getState().tokensOut).toBe(350);
    });

    it('sets absolute values (not accumulating)', async () => {
      // Ensure RPC result REPLACES existing counters, not adds to them
      useChatStore.setState({ tokensIn: 500, tokensOut: 100 });

      mockGatewayClient.request.mockResolvedValueOnce({
        totals: { input: 800, output: 200 },
      });

      await useChatStore.getState().loadSessionUsage();

      expect(useChatStore.getState().tokensIn).toBe(800);
      expect(useChatStore.getState().tokensOut).toBe(200);
    });

    it('handles RPC failure gracefully (non-fatal)', async () => {
      useChatStore.setState({ tokensIn: 100, tokensOut: 50 });
      mockGatewayClient.request.mockRejectedValueOnce(new Error('timeout'));

      await useChatStore.getState().loadSessionUsage();

      // Values unchanged on error
      expect(useChatStore.getState().tokensIn).toBe(100);
      expect(useChatStore.getState().tokensOut).toBe(50);
    });

    it('resets tokens on session switch', () => {
      useChatStore.setState({ tokensIn: 500, tokensOut: 200 });

      useChatStore.getState().setSessionKey('project-abc');

      expect(useChatStore.getState().tokensIn).toBe(0);
      expect(useChatStore.getState().tokensOut).toBe(0);
      expect(useChatStore.getState().sessionKey).toBe('project-abc');
    });
  });

  describe('Full streaming sequence (realistic)', () => {
    it('handles a complete delta → final lifecycle', () => {
      // Simulate what actually happens: multiple deltas then a final

      useChatStore.getState().handleChatEvent(DELTA_FIRST);
      expect(useChatStore.getState().streamText).toBe('Hello');
      expect(useChatStore.getState().streaming).toBe(true);

      useChatStore.getState().handleChatEvent(DELTA_SECOND);
      expect(useChatStore.getState().streamText).toBe('Hello, I can help');

      useChatStore.getState().handleChatEvent(DELTA_THIRD);
      expect(useChatStore.getState().streamText).toBe('Hello, I can help you with that question.');

      // Final arrives — stream clears, message added
      useChatStore.getState().handleChatEvent(FINAL_TEXT);

      const state = useChatStore.getState();
      expect(state.streaming).toBe(false);
      expect(state.streamText).toBeNull();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toContain('Here is the answer.');
    });
  });
});
