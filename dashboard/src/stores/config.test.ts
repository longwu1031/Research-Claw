/**
 * Config store unit tests.
 * Tests theme, locale, setup completion, and localStorage persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConfigStore } from './config';

// Mock i18n
vi.mock('../i18n', () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

describe('Config store', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfigStore.setState({
      theme: 'dark',
      locale: 'en',
      model: null,
      provider: null,
      endpoint: null,
      apiKey: null,
      proxyUrl: null,
      setupComplete: false,
    });
  });

  describe('setTheme', () => {
    it('updates state to light', () => {
      useConfigStore.getState().setTheme('light');
      expect(useConfigStore.getState().theme).toBe('light');
    });

    it('updates state to dark', () => {
      useConfigStore.getState().setTheme('light');
      useConfigStore.getState().setTheme('dark');
      expect(useConfigStore.getState().theme).toBe('dark');
    });

    it('persists to localStorage', () => {
      useConfigStore.getState().setTheme('light');
      expect(localStorage.getItem('rc-theme')).toBe('light');
    });

    it('sets data-theme attribute on documentElement', () => {
      useConfigStore.getState().setTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('setLocale', () => {
    it('updates state to zh-CN', async () => {
      useConfigStore.getState().setLocale('zh-CN');
      expect(useConfigStore.getState().locale).toBe('zh-CN');
    });

    it('persists to localStorage', () => {
      useConfigStore.getState().setLocale('zh-CN');
      expect(localStorage.getItem('rc-locale')).toBe('zh-CN');
    });

    it('calls i18n.changeLanguage', async () => {
      const i18n = await import('../i18n');
      useConfigStore.getState().setLocale('zh-CN');
      expect(i18n.default.changeLanguage).toHaveBeenCalledWith('zh-CN');
    });
  });

  describe('setModel', () => {
    it('updates model in state', () => {
      useConfigStore.getState().setModel('claude-sonnet-4-5');
      expect(useConfigStore.getState().model).toBe('claude-sonnet-4-5');
    });

    it('persists to localStorage', () => {
      useConfigStore.getState().setModel('gpt-4o');
      expect(localStorage.getItem('rc-model')).toBe('gpt-4o');
    });
  });

  describe('completeSetup', () => {
    it('sets all credentials and marks setup complete', () => {
      useConfigStore.getState().completeSetup(
        'sk-test-key',
        'anthropic',
        'https://api.anthropic.com',
      );

      const state = useConfigStore.getState();
      expect(state.setupComplete).toBe(true);
      expect(state.apiKey).toBe('sk-test-key');
      expect(state.provider).toBe('anthropic');
      expect(state.endpoint).toBe('https://api.anthropic.com');
      expect(state.proxyUrl).toBeNull();
    });

    it('stores proxy when provided', () => {
      useConfigStore.getState().completeSetup(
        'sk-key',
        'openai',
        'https://api.openai.com',
        'http://127.0.0.1:7890',
      );

      expect(useConfigStore.getState().proxyUrl).toBe('http://127.0.0.1:7890');
      expect(localStorage.getItem('rc-proxy')).toBe('http://127.0.0.1:7890');
    });

    it('persists all values to localStorage', () => {
      useConfigStore.getState().completeSetup('key', 'anthropic', 'https://api.anthropic.com');

      expect(localStorage.getItem('rc-api-key')).toBe('key');
      expect(localStorage.getItem('rc-provider')).toBe('anthropic');
      expect(localStorage.getItem('rc-endpoint')).toBe('https://api.anthropic.com');
      expect(localStorage.getItem('rc-setup-complete')).toBe('true');
    });
  });

  describe('loadConfig', () => {
    it('restores state from localStorage', () => {
      localStorage.setItem('rc-theme', 'light');
      localStorage.setItem('rc-locale', 'zh-CN');
      localStorage.setItem('rc-setup-complete', 'true');
      localStorage.setItem('rc-provider', 'openai');
      localStorage.setItem('rc-endpoint', 'https://api.openai.com');
      localStorage.setItem('rc-api-key', 'sk-saved');
      localStorage.setItem('rc-proxy', 'http://proxy:8080');
      localStorage.setItem('rc-model', 'gpt-4o');

      useConfigStore.getState().loadConfig();

      const state = useConfigStore.getState();
      expect(state.theme).toBe('light');
      expect(state.locale).toBe('zh-CN');
      expect(state.setupComplete).toBe(true);
      expect(state.provider).toBe('openai');
      expect(state.endpoint).toBe('https://api.openai.com');
      expect(state.apiKey).toBe('sk-saved');
      expect(state.proxyUrl).toBe('http://proxy:8080');
      expect(state.model).toBe('gpt-4o');
    });

    it('sets data-theme attribute when loading', () => {
      localStorage.setItem('rc-theme', 'light');
      useConfigStore.getState().loadConfig();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('defaults to dark theme when localStorage is empty', () => {
      useConfigStore.getState().loadConfig();
      expect(useConfigStore.getState().theme).toBe('dark');
    });

    it('defaults setupComplete to false when not in localStorage', () => {
      useConfigStore.getState().loadConfig();
      expect(useConfigStore.getState().setupComplete).toBe(false);
    });
  });
});
