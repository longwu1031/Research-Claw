import { create } from 'zustand';
import { useGatewayStore } from './gateway';

export interface RadarConfig {
  keywords: string[];
  authors: string[];
  journals: string[];
  sources: string[];
}

interface RadarState {
  config: RadarConfig;
  configLoaded: boolean;

  loadConfig: () => Promise<void>;
}

export const useRadarStore = create<RadarState>()((set) => ({
  config: { keywords: [], authors: [], journals: [], sources: [] },
  configLoaded: false,

  loadConfig: async () => {
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;
    try {
      console.log('[RadarStore] loadConfig → rc.radar.config.get');
      const config = await client.request<RadarConfig>('rc.radar.config.get', {});
      console.log('[RadarStore] config loaded:', config);
      set({ config, configLoaded: true });
    } catch (err) {
      console.warn('[RadarStore] loadConfig failed:', err);
    }
  },
}));
