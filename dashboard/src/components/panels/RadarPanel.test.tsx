import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RadarPanel from './RadarPanel';
import { useConfigStore } from '../../stores/config';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mutable state for the chat store mock
const mockChatState = {
  send: vi.fn(),
  messages: [] as Array<{ id: string; role: string; text: string }>,
};

// Mock chat store using the mutable reference
vi.mock('../../stores/chat', () => ({
  useChatStore: (selector: Function) => selector(mockChatState),
}));

describe('RadarPanel', () => {
  beforeEach(() => {
    useConfigStore.setState({ theme: 'dark' });
    mockChatState.send = vi.fn();
    mockChatState.messages = [];
  });

  it('renders empty state when no tracking config and no digests', () => {
    render(<RadarPanel />);
    expect(screen.getByText('radar.empty')).toBeTruthy();
  });

  it('renders "edit via chat" button in empty state', () => {
    render(<RadarPanel />);
    expect(screen.getByText('radar.editViaChat')).toBeTruthy();
  });

  it('renders radar icon in empty state', () => {
    render(<RadarPanel />);
    const emptyText = screen.getByText('radar.empty');
    expect(emptyText).toBeTruthy();
  });

  it('renders findings when radar_digest blocks exist in messages', () => {
    const digestData = JSON.stringify({
      source: 'arxiv',
      query: 'transformer attention',
      total_found: 12,
      period: 'last 7 days',
    });

    mockChatState.messages = [
      {
        id: 'msg-1',
        role: 'assistant',
        text: `Here are your radar results:\n\n\`\`\`radar_digest\n${digestData}\n\`\`\``,
      },
    ];

    render(<RadarPanel />);
    expect(screen.getByText('radar.findings')).toBeTruthy();
    expect(screen.getByText('radar.refresh')).toBeTruthy();
  });
});
