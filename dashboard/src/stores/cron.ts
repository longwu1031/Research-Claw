import { create } from 'zustand';
import { useGatewayStore } from './gateway';

export interface CronPreset {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at: string | null;
  next_run_at: string | null;
  gateway_job_id: string | null;
}

// Agent turn messages for each preset
const PRESET_AGENT_TURNS: Record<string, string> = {
  arxiv_daily_scan:
    'Use radar_scan to check arXiv for new papers matching my radar config. Summarize any interesting findings.',
  citation_tracking_weekly:
    'Check for new citations of my tracked papers using library_citation_graph.',
  deadline_reminders_daily:
    'List tasks due within 24 hours using task_list and send me a summary.',
};

interface CronState {
  presets: CronPreset[];
  presetsLoaded: boolean;

  loadPresets: () => Promise<void>;
  activatePreset: (presetId: string, config?: Record<string, unknown>) => Promise<void>;
  deactivatePreset: (presetId: string) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
}

// Mutex: tracks which presets have an activate/deactivate operation in-flight
const _inflightPresets = new Set<string>();

export const useCronStore = create<CronState>()((set, get) => ({
  presets: [],
  presetsLoaded: false,

  loadPresets: async () => {
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;
    try {
      const result = await client.request<{ presets: CronPreset[] }>('rc.cron.presets.list', {});
      set({ presets: result.presets, presetsLoaded: true });
    } catch (err) {
      console.warn('[CronStore] loadPresets failed:', err);
    }
  },

  activatePreset: async (presetId: string, config?: Record<string, unknown>) => {
    if (_inflightPresets.has(presetId)) return;
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;

    _inflightPresets.add(presetId);
    try {
      // 1. Activate in our DB
      await client.request('rc.cron.presets.activate', { preset_id: presetId, config });

      // 2. Find preset definition for schedule
      const preset = get().presets.find((p) => p.id === presetId);
      if (!preset) return;

      // 3. Create actual gateway cron job
      const message = PRESET_AGENT_TURNS[presetId] ?? `Run cron preset: ${presetId}`;
      const cronResult = await client.request<{ id: string }>('cron.add', {
        name: preset.name,
        schedule: { kind: 'cron' as const, expr: preset.schedule },
        message,
      });

      // 4. Store the gateway job ID in our DB
      if (cronResult?.id) {
        await client.request('rc.cron.presets.setJobId', {
          preset_id: presetId,
          job_id: cronResult.id,
        });
      }

      // 5. Reload presets to reflect new state
      await get().loadPresets();
    } catch (err) {
      console.error('[CronStore] activatePreset failed:', err);
      // Reload to get consistent state
      await get().loadPresets();
    } finally {
      _inflightPresets.delete(presetId);
    }
  },

  deactivatePreset: async (presetId: string) => {
    if (_inflightPresets.has(presetId)) return;
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;

    _inflightPresets.add(presetId);
    try {
      // 1. Find preset to get gateway_job_id
      const preset = get().presets.find((p) => p.id === presetId);

      // 2. Remove gateway cron job if we have a job ID
      if (preset?.gateway_job_id) {
        try {
          await client.request('cron.remove', { id: preset.gateway_job_id });
        } catch (err) {
          console.warn('[CronStore] cron.remove failed (job may not exist):', err);
        }
      }

      // 3. Deactivate in our DB
      await client.request('rc.cron.presets.deactivate', { preset_id: presetId });

      // 4. Reload presets
      await get().loadPresets();
    } catch (err) {
      console.error('[CronStore] deactivatePreset failed:', err);
      await get().loadPresets();
    } finally {
      _inflightPresets.delete(presetId);
    }
  },

  deletePreset: async (presetId: string) => {
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;

    try {
      // 1. If enabled, remove gateway cron job first
      const preset = get().presets.find((p) => p.id === presetId);
      if (preset?.gateway_job_id) {
        try {
          await client.request('cron.remove', { id: preset.gateway_job_id });
        } catch (err) {
          console.warn('[CronStore] cron.remove failed during delete:', err);
        }
      }

      // 2. Delete from plugin DB
      await client.request('rc.cron.presets.delete', { preset_id: presetId });

      // 3. Reload presets
      await get().loadPresets();
    } catch (err) {
      console.error('[CronStore] deletePreset failed:', err);
      await get().loadPresets();
    }
  },
}));
