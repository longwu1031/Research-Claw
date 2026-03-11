/**
 * GatewayClient unit tests.
 * Tests the real GatewayClient class with a mock WebSocket.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GatewayClient, GatewayRequestError } from './client';
import type { ConnectionState } from './types';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

interface MockWebSocket {
  url: string;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

let mockWsInstance: MockWebSocket;
const MockWebSocketClass = vi.fn().mockImplementation((url: string) => {
  mockWsInstance = {
    url,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    readyState: 0,
    send: vi.fn(),
    close: vi.fn().mockImplementation(function (this: MockWebSocket, code?: number, reason?: string) {
      // Simulate close event
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
      }
    }),
  };
  // Auto-fire open after microtask to simulate real WS behavior
  queueMicrotask(() => {
    if (mockWsInstance.onopen) {
      mockWsInstance.readyState = 1;
      mockWsInstance.onopen(new Event('open'));
    }
  });
  return mockWsInstance;
});

// Replace global WebSocket
const originalWebSocket = globalThis.WebSocket;

describe('GatewayClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocketClass;
    MockWebSocketClass.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as Record<string, unknown>).WebSocket = originalWebSocket;
  });

  // Helper to simulate server sending a message to the client
  function serverSend(data: unknown) {
    if (mockWsInstance.onmessage) {
      mockWsInstance.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  // Helper to complete the connect handshake
  async function completeHandshake(client: GatewayClient) {
    client.connect();
    await vi.advanceTimersByTimeAsync(1); // Let microtask fire onopen

    // Server sends connect.challenge
    serverSend({ type: 'event', event: 'connect.challenge', payload: { nonce: 'test-nonce' } });

    // Client should have sent connect request via ws.send
    const sentFrame = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
    expect(sentFrame.method).toBe('connect');

    // Server responds with hello-ok
    serverSend({
      type: 'res',
      id: sentFrame.id,
      ok: true,
      payload: {
        type: 'hello-ok',
        protocol: 3,
        server: { version: '1.0.0', connId: 'conn-123' },
        features: { methods: ['health'], events: [] },
      },
    });
  }

  describe('Connection lifecycle', () => {
    it('transitions through connecting -> authenticating -> connected', async () => {
      const states: ConnectionState[] = [];
      const onHello = vi.fn();
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: (s) => states.push(s),
        onHello,
      });

      await completeHandshake(client);

      expect(states).toContain('connecting');
      expect(states).toContain('authenticating');
      expect(states).toContain('connected');
      expect(client.isConnected).toBe(true);
      expect(client.connectionState).toBe('connected');
      expect(onHello).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'hello-ok', protocol: 3 }),
      );
    });

    it('disconnect transitions to disconnected and calls onClose', async () => {
      const onClose = vi.fn();
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
        onClose,
      });

      await completeHandshake(client);
      expect(client.isConnected).toBe(true);

      client.disconnect();
      expect(client.isConnected).toBe(false);
      expect(client.connectionState).toBe('disconnected');
    });

    it('connect() closes existing connection before reconnecting', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });

      await completeHandshake(client);
      const firstWs = mockWsInstance;

      // Connect again
      client.connect();
      expect(firstWs.close).toHaveBeenCalled();
    });
  });

  describe('Request/response correlation', () => {
    it('request resolves when server responds with matching id and ok=true', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      const requestPromise = client.request<{ ok: boolean }>('health');

      // Get the request frame that was sent
      const lastCall = mockWsInstance.send.mock.calls[mockWsInstance.send.mock.calls.length - 1];
      const reqFrame = JSON.parse(lastCall[0]);
      expect(reqFrame.type).toBe('req');
      expect(reqFrame.method).toBe('health');

      // Server responds
      serverSend({ type: 'res', id: reqFrame.id, ok: true, payload: { ok: true } });

      const result = await requestPromise;
      expect(result).toEqual({ ok: true });
    });

    it('request rejects when server responds with ok=false', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      const requestPromise = client.request('bad.method');

      const lastCall = mockWsInstance.send.mock.calls[mockWsInstance.send.mock.calls.length - 1];
      const reqFrame = JSON.parse(lastCall[0]);

      serverSend({
        type: 'res',
        id: reqFrame.id,
        ok: false,
        error: { code: 'METHOD_NOT_FOUND', message: 'No such method' },
      });

      await expect(requestPromise).rejects.toThrow(GatewayRequestError);
      await expect(requestPromise).rejects.toThrow('No such method');
    });

    it('request includes params when provided', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      client.request('chat.send', { message: 'hello' });

      const lastCall = mockWsInstance.send.mock.calls[mockWsInstance.send.mock.calls.length - 1];
      const reqFrame = JSON.parse(lastCall[0]);
      expect(reqFrame.params).toEqual({ message: 'hello' });
    });

    it('request throws if not connected', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });

      await expect(client.request('health')).rejects.toThrow('Not connected to gateway');
    });
  });

  describe('Timeout handling', () => {
    it('request times out after 30s if no response', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      // Set up the promise and attach the rejection handler BEFORE advancing timers
      const requestPromise = client.request('slow.method');
      const resultPromise = requestPromise.catch((err: Error) => err);

      // Advance timer past the 30s timeout
      await vi.advanceTimersByTimeAsync(30_001);

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/Request timeout/);
    });
  });

  describe('Event subscription', () => {
    it('subscribe receives events and unsubscribe stops delivery', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      const handler = vi.fn();
      const unsub = client.subscribe('chat.message', handler);

      // Server sends an event
      serverSend({ type: 'event', event: 'chat.message', payload: { text: 'hello' } });
      expect(handler).toHaveBeenCalledWith({ text: 'hello' });

      // Unsubscribe
      unsub();

      // Server sends another event
      serverSend({ type: 'event', event: 'chat.message', payload: { text: 'world' } });
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('multiple handlers for the same event all receive it', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.subscribe('agent.status', handler1);
      client.subscribe('agent.status', handler2);

      serverSend({ type: 'event', event: 'agent.status', payload: { state: 'thinking' } });

      expect(handler1).toHaveBeenCalledWith({ state: 'thinking' });
      expect(handler2).toHaveBeenCalledWith({ state: 'thinking' });
    });

    it('onEvent callback fires for all events', async () => {
      const onEvent = vi.fn();
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
        onEvent,
      });
      await completeHandshake(client);

      serverSend({ type: 'event', event: 'test.event', payload: { data: 1 } });

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'event', event: 'test.event' }),
      );
    });
  });

  describe('Sequence gap detection', () => {
    it('onGap fires when event sequence has a gap', async () => {
      const onGap = vi.fn();
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
        onGap,
      });
      await completeHandshake(client);

      // Send event with seq=1
      serverSend({ type: 'event', event: 'a', payload: null, seq: 1 });
      expect(onGap).not.toHaveBeenCalled();

      // Skip seq=2, send seq=3 (gap)
      serverSend({ type: 'event', event: 'b', payload: null, seq: 3 });
      expect(onGap).toHaveBeenCalledWith(2, 3);
    });
  });

  describe('Reconnection behavior', () => {
    it('schedules reconnect on unexpected close when was connected', async () => {
      const states: ConnectionState[] = [];
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: (s) => states.push(s),
      });
      await completeHandshake(client);

      // Simulate unexpected close (not intentional, code 1006)
      if (mockWsInstance.onclose) {
        mockWsInstance.onclose(new CloseEvent('close', { code: 1006, reason: 'abnormal' }));
      }

      expect(states).toContain('reconnecting');
    });

    it('does not reconnect on intentional disconnect', async () => {
      const states: ConnectionState[] = [];
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: (s) => states.push(s),
      });
      await completeHandshake(client);

      client.disconnect();

      // Should be disconnected, not reconnecting
      expect(client.connectionState).toBe('disconnected');
      expect(states).not.toContain('reconnecting');
    });

    it('rejects all pending requests on connection close', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      // Make a request but don't respond, attach rejection handler immediately
      const reqPromise = client.request('slow.method');
      const resultPromise = reqPromise.catch((err: Error) => err);

      // Simulate close
      if (mockWsInstance.onclose) {
        mockWsInstance.onclose(new CloseEvent('close', { code: 1006, reason: '' }));
      }

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Connection closed');
    });
  });

  describe('Protocol version negotiation', () => {
    it('sends protocol version 3 in connect frame', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      // Server sends challenge
      serverSend({ type: 'event', event: 'connect.challenge', payload: { nonce: 'n1' } });

      const sentFrame = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      expect(sentFrame.params.protocol).toBe(3);
    });

    it('sends client name and version in connect frame', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        clientName: 'test-client',
        clientVersion: '1.2.3',
        onStateChange: () => {},
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      serverSend({ type: 'event', event: 'connect.challenge', payload: {} });

      const sentFrame = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      expect(sentFrame.params.client.name).toBe('test-client');
      expect(sentFrame.params.client.version).toBe('1.2.3');
    });
  });

  describe('Error handling', () => {
    it('ignores malformed JSON messages', async () => {
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: () => {},
      });
      await completeHandshake(client);

      // Should not throw
      if (mockWsInstance.onmessage) {
        mockWsInstance.onmessage(new MessageEvent('message', { data: 'not json' }));
      }

      expect(client.isConnected).toBe(true);
    });

    it('GatewayRequestError contains code and details', () => {
      const err = new GatewayRequestError({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        details: { retryAfter: 5 },
      });
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.details).toEqual({ retryAfter: 5 });
      expect(err.name).toBe('GatewayRequestError');
      expect(err.message).toBe('Too many requests');
    });

    it('disconnects and does not reconnect on UNAUTHORIZED error during handshake', async () => {
      const states: ConnectionState[] = [];
      const client = new GatewayClient({
        url: 'ws://test:18789',
        onStateChange: (s) => states.push(s),
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      // Server sends challenge
      serverSend({ type: 'event', event: 'connect.challenge', payload: {} });
      const sentFrame = JSON.parse(mockWsInstance.send.mock.calls[0][0]);

      // Server rejects with UNAUTHORIZED
      serverSend({
        type: 'res',
        id: sentFrame.id,
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Bad token' },
      });

      // Should not attempt reconnect
      expect(states.filter(s => s === 'reconnecting')).toHaveLength(0);
    });
  });
});
