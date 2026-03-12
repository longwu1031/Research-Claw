import { create } from 'zustand';
import i18n from '../i18n';
import { useGatewayStore } from './gateway';
import { isConfigValid } from '../utils/config-patch';

/** Model definition from openclaw.json providers */
export interface GatewayModelDef {
  id: string;
  name?: string;
  input?: string[];
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
}

/** Provider definition from openclaw.json */
export interface GatewayProviderDef {
  baseUrl?: string;
  api?: string;
  models?: GatewayModelDef[];
}

/** Subset of the gateway config we care about */
export interface GatewayConfig {
  agents?: {
    defaults?: {
      model?: { primary?: string; fallbacks?: string[] };
      imageModel?: { primary?: string; fallbacks?: string[] };
      heartbeat?: { every?: string };
    };
  };
  models?: {
    providers?: Record<string, GatewayProviderDef>;
  };
  env?: Record<string, string>;
  raw?: string | null;
  baseHash?: string | null;
}

export type BootState = 'pending' | 'ready' | 'needs_setup' | 'gateway_unreachable';

interface ConfigState {
  theme: 'dark' | 'light';
  locale: 'en' | 'zh-CN';
  systemPromptAppend: string;
  bootState: BootState;

  /** Live config from gateway (via config.get RPC) */
  gatewayConfig: GatewayConfig | null;
  gatewayConfigLoading: boolean;

  setTheme: (t: 'dark' | 'light') => void;
  setLocale: (l: 'en' | 'zh-CN') => void;
  setSystemPromptAppend: (v: string) => void;
  loadConfig: () => void;
  loadGatewayConfig: () => Promise<void>;
  evaluateConfig: () => void;
  setBootState: (s: BootState) => void;
}

function loadFromStorage(): { theme: 'dark' | 'light'; locale: 'en' | 'zh-CN'; systemPromptAppend: string } {
  try {
    const theme = (localStorage.getItem('rc-theme') as 'dark' | 'light') ?? 'dark';
    const locale = (localStorage.getItem('rc-locale') as 'en' | 'zh-CN') ?? 'zh-CN';
    const systemPromptAppend = localStorage.getItem('rc-system-prompt-append') ?? '';
    return { theme, locale, systemPromptAppend };
  } catch {
    return { theme: 'dark', locale: 'zh-CN', systemPromptAppend: '' };
  }
}

export const useConfigStore = create<ConfigState>()((set, get) => {
  const persisted = loadFromStorage();

  return {
    theme: persisted.theme,
    locale: persisted.locale,
    systemPromptAppend: persisted.systemPromptAppend,
    bootState: 'pending',
    gatewayConfig: null,
    gatewayConfigLoading: false,

    setTheme: (t: 'dark' | 'light') => {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('rc-theme', t);
      set({ theme: t });
    },

    setLocale: (l: 'en' | 'zh-CN') => {
      i18n.changeLanguage(l);
      localStorage.setItem('rc-locale', l);
      set({ locale: l });
    },

    setSystemPromptAppend: (v: string) => {
      localStorage.setItem('rc-system-prompt-append', v);
      set({ systemPromptAppend: v });
    },

    loadConfig: () => {
      const data = loadFromStorage();
      if (data.theme) {
        document.documentElement.setAttribute('data-theme', data.theme);
      }
      set(data);
    },

    loadGatewayConfig: async () => {
      const client = useGatewayStore.getState().client;
      if (!client?.isConnected) return;
      set({ gatewayConfigLoading: true });
      try {
        const snapshot = await client.request<{
          config?: Record<string, unknown>;
          resolved?: Record<string, unknown>;
          raw?: string | null;
          hash?: string | null;
        }>('config.get', {});
        // Gateway returns `hash` (not `baseHash`). We store it as `baseHash` for our interface.
        // Use `resolved` (merged config) if available, fall back to `config`.
        const configObj = (snapshot.resolved ?? snapshot.config ?? {}) as Record<string, unknown>;
        const gc: GatewayConfig = {
          agents: configObj.agents as GatewayConfig['agents'],
          models: configObj.models as GatewayConfig['models'],
          env: configObj.env as GatewayConfig['env'],
          raw: snapshot.raw ?? null,
          baseHash: snapshot.hash ?? null,
        };
        set({ gatewayConfig: gc, gatewayConfigLoading: false });
        get().evaluateConfig();
      } catch {
        set({ gatewayConfigLoading: false });
      }
    },

    evaluateConfig: () => {
      const { gatewayConfig } = get();
      if (isConfigValid(gatewayConfig as Record<string, unknown> | null)) {
        set({ bootState: 'ready' });
      } else {
        set({ bootState: 'needs_setup' });
      }
    },

    setBootState: (s: BootState) => {
      set({ bootState: s });
    },
  };
});

// Debug helper: re-enter SetupWizard from browser console.
// Usage: __resetSetup()
(window as unknown as Record<string, unknown>).__resetSetup = () => {
  useConfigStore.setState({ bootState: 'needs_setup' });
};
