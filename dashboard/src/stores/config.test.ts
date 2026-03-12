/**
 * Config store unit tests.
 * Tests theme, locale, bootState, evaluateConfig, and localStorage persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConfigStore } from './config';

// Mock i18n
vi.mock('../i18n', () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

// Mock gateway store
vi.mock('./gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      client: null,
    }),
  },
}));

describe('Config store', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfigStore.setState({
      theme: 'dark',
      locale: 'zh-CN',
      systemPromptAppend: '',
      bootState: 'pending',
      gatewayConfig: null,
      gatewayConfigLoading: false,
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
    it('updates state to zh-CN', () => {
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

  describe('setSystemPromptAppend', () => {
    it('updates state and persists', () => {
      useConfigStore.getState().setSystemPromptAppend('Be concise.');
      expect(useConfigStore.getState().systemPromptAppend).toBe('Be concise.');
      expect(localStorage.getItem('rc-system-prompt-append')).toBe('Be concise.');
    });
  });

  describe('evaluateConfig', () => {
    it('sets bootState to needs_setup when gatewayConfig is null', () => {
      useConfigStore.setState({ gatewayConfig: null });
      useConfigStore.getState().evaluateConfig();
      expect(useConfigStore.getState().bootState).toBe('needs_setup');
    });

    it('sets bootState to needs_setup when no model primary', () => {
      useConfigStore.setState({
        gatewayConfig: { agents: { defaults: {} }, models: { providers: {} } },
      });
      useConfigStore.getState().evaluateConfig();
      expect(useConfigStore.getState().bootState).toBe('needs_setup');
    });

    it('sets bootState to needs_setup when provider missing', () => {
      useConfigStore.setState({
        gatewayConfig: {
          agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
          models: { providers: {} },
        },
      });
      useConfigStore.getState().evaluateConfig();
      expect(useConfigStore.getState().bootState).toBe('needs_setup');
    });

    it('sets bootState to ready when config is valid', () => {
      useConfigStore.setState({
        gatewayConfig: {
          agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
          models: {
            providers: {
              rc: { baseUrl: 'https://api.openai.com', models: [{ id: 'gpt-4o' }] },
            },
          },
        },
      });
      useConfigStore.getState().evaluateConfig();
      expect(useConfigStore.getState().bootState).toBe('ready');
    });
  });

  describe('setBootState', () => {
    it('sets bootState directly', () => {
      useConfigStore.getState().setBootState('gateway_unreachable');
      expect(useConfigStore.getState().bootState).toBe('gateway_unreachable');
    });
  });

  describe('loadConfig', () => {
    it('restores theme and locale from localStorage', () => {
      localStorage.setItem('rc-theme', 'light');
      localStorage.setItem('rc-locale', 'en');
      localStorage.setItem('rc-system-prompt-append', 'test prompt');

      useConfigStore.getState().loadConfig();

      const state = useConfigStore.getState();
      expect(state.theme).toBe('light');
      expect(state.locale).toBe('en');
      expect(state.systemPromptAppend).toBe('test prompt');
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

    it('does not touch bootState', () => {
      useConfigStore.setState({ bootState: 'pending' });
      useConfigStore.getState().loadConfig();
      expect(useConfigStore.getState().bootState).toBe('pending');
    });
  });
});
