import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SettingsPanel from './SettingsPanel';
import { useConfigStore } from '../../stores/config';
import { useGatewayStore } from '../../stores/gateway';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      if (opts && 'version' in opts) return `${key}:${opts.version}`;
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('SettingsPanel', () => {
  beforeEach(() => {
    useConfigStore.setState({
      theme: 'dark',
      locale: 'en',
      systemPromptAppend: '',
      bootState: 'ready',
      gatewayConfig: null,
      gatewayConfigLoading: false,
    });
    useGatewayStore.setState({
      client: null,
      state: 'disconnected',
      serverVersion: '0.42.0',
    });
  });

  it('shows disconnected message when not connected', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('status.disconnected')).toBeTruthy();
  });

  it('renders single scrollable panel (no tabs) when connected', () => {
    useGatewayStore.setState({
      state: 'connected',
      client: { isConnected: true, request: vi.fn() } as unknown as ReturnType<typeof useGatewayStore.getState>['client'],
    });
    useConfigStore.setState({
      gatewayConfig: {
        agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
        models: { providers: { rc: { baseUrl: 'https://api.openai.com' } } },
      },
    });

    render(<SettingsPanel />);

    // Config source badge visible
    expect(screen.getByText('settings.configSource')).toBeTruthy();
    // About section inline (no tab click needed)
    expect(screen.getByText('settings.aboutDiagnostics')).toBeTruthy();
    // No tab elements
    expect(screen.queryByText('settings.model')).toBeNull();
    expect(screen.queryByText('settings.proxy')).toBeNull();
    expect(screen.queryByText('settings.about')).toBeNull();
  });

  it('renders vision endpoint toggle', () => {
    useGatewayStore.setState({
      state: 'connected',
      client: { isConnected: true, request: vi.fn() } as unknown as ReturnType<typeof useGatewayStore.getState>['client'],
    });
    useConfigStore.setState({
      gatewayConfig: {
        agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
        models: { providers: { rc: { baseUrl: 'https://api.openai.com' } } },
      },
    });

    render(<SettingsPanel />);
    expect(screen.getByText('settings.differentEndpoint')).toBeTruthy();
  });
});
