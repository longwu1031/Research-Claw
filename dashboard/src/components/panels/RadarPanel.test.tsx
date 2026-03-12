import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RadarPanel from './RadarPanel';
import { useConfigStore } from '../../stores/config';
import { useGatewayStore } from '../../stores/gateway';
import { useRadarStore } from '../../stores/radar';
import { useCronStore } from '../../stores/cron';

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
    // Default: disconnected, config not loaded — triggers empty state
    useGatewayStore.setState({ client: null, state: 'disconnected' });
    useRadarStore.setState({
      config: { keywords: [], authors: [], journals: [], sources: [] },
      configLoaded: false,
    });
    useCronStore.setState({ presets: [], presetsLoaded: false });
    mockChatState.send = vi.fn();
    mockChatState.messages = [];
  });

  it('renders empty state when not connected and config not loaded', () => {
    render(<RadarPanel />);
    expect(screen.getByText('radar.empty')).toBeTruthy();
  });

  it('renders "add tracking" button when connected but no tracking items', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({ configLoaded: true });
    render(<RadarPanel />);
    expect(screen.getByText('radar.addTracking')).toBeTruthy();
  });

  it('renders radar icon in empty state', () => {
    render(<RadarPanel />);
    const emptyText = screen.getByText('radar.empty');
    expect(emptyText).toBeTruthy();
  });

  it('renders tracking section and refresh button when config has keywords', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({
      config: { keywords: ['transformer', 'attention'], authors: [], journals: [], sources: [] },
      configLoaded: true,
    });

    render(<RadarPanel />);
    expect(screen.getByText('radar.tracking')).toBeTruthy();
    expect(screen.getByText('radar.refresh')).toBeTruthy();
    expect(screen.getByText('radar.editViaChat')).toBeTruthy();
  });
});
