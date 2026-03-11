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
      provider: 'anthropic',
      model: null,
      apiKey: null,
      setupComplete: true,
    });
    useGatewayStore.setState({
      client: null,
      state: 'disconnected',
      serverVersion: '0.42.0',
    });
  });

  it('renders tab labels for all four tabs', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('settings.general')).toBeTruthy();
    expect(screen.getByText('settings.model')).toBeTruthy();
    expect(screen.getByText('settings.proxy')).toBeTruthy();
    expect(screen.getByText('settings.about')).toBeTruthy();
  });

  it('renders general settings by default', () => {
    render(<SettingsPanel />);
    // General tab is default active; its controls should be visible
    expect(screen.getByText('settings.language.label')).toBeTruthy();
    expect(screen.getByText('settings.theme.label')).toBeTruthy();
    expect(screen.getByText('settings.notificationSound')).toBeTruthy();
    expect(screen.getByText('settings.autoScroll')).toBeTruthy();
    expect(screen.getByText('settings.timestampFormat')).toBeTruthy();
  });

  it('renders theme toggle options', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('settings.theme.dark')).toBeTruthy();
    expect(screen.getByText('settings.theme.light')).toBeTruthy();
  });

  it('renders language options', () => {
    render(<SettingsPanel />);
    // Language select should be present (the current value)
    expect(screen.getByText('settings.language.label')).toBeTruthy();
  });
});
