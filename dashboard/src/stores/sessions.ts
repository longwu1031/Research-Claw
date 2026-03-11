import { create } from 'zustand';
import { useGatewayStore } from './gateway';

export interface Session {
  key: string;
  label?: string;
  createdAt: string;
  lastMessageAt?: string;
  messageCount: number;
}

interface SessionsState {
  sessions: Session[];
  activeSessionKey: string | null;
  loading: boolean;

  loadSessions: () => Promise<void>;
  switchSession: (key: string) => void;
  createSession: () => Promise<string>;
  deleteSession: (key: string) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>()((set, get) => ({
  sessions: [],
  activeSessionKey: null,
  loading: false,

  loadSessions: async () => {
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;
    set({ loading: true });
    try {
      const result = await client.request<{ sessions: Session[] }>('sessions.list');
      set({ sessions: result.sessions ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  switchSession: (key: string) => {
    set({ activeSessionKey: key });
  },

  createSession: async () => {
    // OpenClaw sessions are implicit — created on first chat.send with a new sessionKey
    const key = crypto.randomUUID();
    set({ activeSessionKey: key });
    return key;
  },

  deleteSession: async (key: string) => {
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;
    await client.request('sessions.delete', { key });
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.key !== key),
      activeSessionKey: s.activeSessionKey === key ? null : s.activeSessionKey,
    }));
  },
}));
