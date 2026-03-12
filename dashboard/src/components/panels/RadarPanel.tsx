import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spin, Switch, Tag, Typography } from 'antd';
import {
  RadarChartOutlined,
  ReloadOutlined,
  PlusOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chat';
import { useGatewayStore } from '../../stores/gateway';
import { useRadarStore } from '../../stores/radar';
import { useCronStore, type CronPreset } from '../../stores/cron';
import { getThemeTokens } from '../../styles/theme';
import { useConfigStore } from '../../stores/config';

const { Text, Link } = Typography;

interface ScanResultItem {
  source: string;
  query: string;
  papers: Array<{ title: string; authors: string[]; year?: number; url: string }>;
  total_found: number;
  papers_skipped: number;
  errors: string[];
}

function TrackingSection({
  label,
  items,
  tokens,
  accentColor,
}: {
  label: string;
  items: string[];
  tokens: ReturnType<typeof getThemeTokens>;
  accentColor?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: tokens.text.muted }}>{label}</Text>
      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {items.map((item) => (
          <Tag key={item} style={{ fontSize: 11 }} color={accentColor}>
            {item}
          </Tag>
        ))}
      </div>
    </div>
  );
}

function CronPresetRow({ preset, tokens }: { preset: CronPreset; tokens: ReturnType<typeof getThemeTokens> }) {
  const { t } = useTranslation();
  const activatePreset = useCronStore((s) => s.activatePreset);
  const deactivatePreset = useCronStore((s) => s.deactivatePreset);
  const [toggling, setToggling] = useState(false);

  const handleToggle = useCallback(async (checked: boolean) => {
    setToggling(true);
    try {
      if (checked) {
        await activatePreset(preset.id);
      } else {
        await deactivatePreset(preset.id);
      }
    } finally {
      setToggling(false);
    }
  }, [preset.id, activatePreset, deactivatePreset]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
      }}
    >
      <Switch
        size="small"
        checked={preset.enabled}
        loading={toggling}
        onChange={handleToggle}
      />
      <div style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, display: 'block' }}>{preset.name}</Text>
        <Text style={{ fontSize: 10, color: tokens.text.muted }}>
          <ClockCircleOutlined style={{ marginRight: 3 }} />
          {preset.schedule}
        </Text>
      </div>
    </div>
  );
}

export default function RadarPanel() {
  const { t } = useTranslation();
  const configTheme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(configTheme), [configTheme]);
  const send = useChatStore((s) => s.send);
  const messages = useChatStore((s) => s.messages);
  const client = useGatewayStore((s) => s.client);
  const connState = useGatewayStore((s) => s.state);
  const tracking = useRadarStore((s) => s.config);
  const configLoaded = useRadarStore((s) => s.configLoaded);
  const loadConfig = useRadarStore((s) => s.loadConfig);
  const presets = useCronStore((s) => s.presets);
  const presetsLoaded = useCronStore((s) => s.presetsLoaded);
  const loadPresets = useCronStore((s) => s.loadPresets);

  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResultItem[] | null>(null);

  // Load radar config + cron presets when gateway connects
  useEffect(() => {
    if (connState === 'connected') {
      loadConfig();
      loadPresets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState]);

  // Extract radar_digest cards from chat messages
  const radarDigests = useMemo(() => {
    const digests: Array<{ source: string; query: string; total_found: number; period: string }> = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.text) {
        const regex = /```radar_digest\n([\s\S]*?)```/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(msg.text)) !== null) {
          try {
            const data = JSON.parse(match[1]);
            digests.push(data);
          } catch {
            /* skip malformed */
          }
        }
      }
    }
    return digests;
  }, [messages]);

  const hasKeywords = tracking.keywords.length > 0;
  const hasAuthors = tracking.authors.length > 0;
  const hasJournals = tracking.journals.length > 0;
  const hasSources = (tracking.sources?.length ?? 0) > 0;
  const hasTrackingItems = hasKeywords || hasAuthors || hasJournals;

  const handleRefresh = useCallback(async () => {
    if (!client?.isConnected) return;
    setScanning(true);
    setScanResults(null);
    try {
      const result = await client.request<{ results: ScanResultItem[] }>('rc.radar.scan', {});
      setScanResults(result.results);
    } catch (err) {
      console.error('[RadarPanel] scan failed:', err);
    } finally {
      setScanning(false);
    }
  }, [client]);

  const handleEditViaChat = () => {
    send('Configure my research radar. I want to track:');
  };

  // Not connected yet — show loading state
  if (!configLoaded && connState !== 'connected') {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 60 }}>
        <RadarChartOutlined style={{ fontSize: 48, color: tokens.text.muted, opacity: 0.4 }} />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('radar.empty')}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with refresh */}
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={scanning} />}
          onClick={handleRefresh}
          disabled={scanning}
        >
          {scanning ? t('radar.scanning') : t('radar.refresh')}
        </Button>
      </div>

      {/* Sources section — always shown when config loaded */}
      {hasSources && (
        <div style={{ padding: '0 16px 8px' }}>
          <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
            {t('radar.sources')}
          </Text>
          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tracking.sources!.map((src) => (
              <Tag key={src} style={{ fontSize: 11 }} color="blue">
                {src}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Tracking section */}
      {hasTrackingItems ? (
        <div style={{ padding: '0 16px 12px' }}>
          <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
            {t('radar.tracking')}
          </Text>
          <div style={{ marginTop: 8 }}>
            <TrackingSection label={t('radar.keywords')} items={tracking.keywords} tokens={tokens} />
            <TrackingSection label={t('radar.authors')} items={tracking.authors} tokens={tokens} />
            <TrackingSection label={t('radar.journals')} items={tracking.journals} tokens={tokens} />
          </div>
          <Link
            onClick={handleEditViaChat}
            style={{ fontSize: 12, color: tokens.accent.blue }}
          >
            {t('radar.editViaChat')}
          </Link>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('radar.noTracking')}
          </Text>
          <div style={{ marginTop: 12 }}>
            <Button size="small" icon={<PlusOutlined />} onClick={handleEditViaChat}>
              {t('radar.addTracking')}
            </Button>
          </div>
        </div>
      )}

      {/* Cron presets section */}
      {presetsLoaded && presets.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${tokens.border.default}`, margin: '0 16px' }} />
          <div style={{ padding: '8px 16px 12px' }}>
            <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
              {t('radar.automations')}
            </Text>
            <div style={{ marginTop: 8 }}>
              {presets.map((preset) => (
                <CronPresetRow key={preset.id} preset={preset} tokens={tokens} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Scan results (from direct RPC call) */}
      {scanning && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Spin size="small" />
          <Text style={{ marginLeft: 8, fontSize: 12, color: tokens.text.muted }}>{t('radar.scanning')}</Text>
        </div>
      )}

      {scanResults && scanResults.length > 0 && (
        <>
          <div style={{ borderTop: `1px solid ${tokens.border.default}`, margin: '0 16px' }} />
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
            <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
              {t('radar.scanResults')}
            </Text>
            <div style={{ marginTop: 8 }}>
              {scanResults.map((result, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Tag style={{ fontSize: 10 }} color="blue">{result.source}</Tag>
                    <Text style={{ fontSize: 11, color: tokens.text.muted }}>
                      {result.papers.length} {t('radar.newPapers')}, {result.papers_skipped} {t('radar.skipped')}
                    </Text>
                  </div>
                  {result.errors.length > 0 && (
                    <Text type="danger" style={{ fontSize: 11 }}>{result.errors.join('; ')}</Text>
                  )}
                  {result.papers.slice(0, 5).map((paper, pIdx) => (
                    <div
                      key={pIdx}
                      style={{
                        padding: '6px 10px',
                        marginBottom: 4,
                        borderLeft: `2px solid ${tokens.accent.blue}`,
                        background: tokens.bg.surface,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{paper.title}</Text>
                      <Text style={{ fontSize: 10, color: tokens.text.muted }}>
                        {paper.authors.slice(0, 3).join(', ')}{paper.year ? ` (${paper.year})` : ''}
                      </Text>
                    </div>
                  ))}
                  {result.papers.length > 5 && (
                    <Text style={{ fontSize: 11, color: tokens.text.muted, fontStyle: 'italic' }}>
                      ...{result.papers.length - 5} more
                    </Text>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Divider */}
      {radarDigests.length > 0 && !scanResults && (
        <div style={{ borderTop: `1px solid ${tokens.border.default}`, margin: '0 16px' }} />
      )}

      {/* Findings from chat */}
      {radarDigests.length > 0 && !scanResults && (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
          <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
            {t('radar.findings')}
          </Text>
          <div style={{ marginTop: 8 }}>
            {radarDigests.map((digest, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  marginBottom: 8,
                  borderLeft: `3px solid ${tokens.accent.blue}`,
                  background: tokens.bg.surface,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: 500 }}>
                  {digest.total_found} papers &mdash; &quot;{digest.query}&quot;
                </Text>
                <div style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
                  <Tag style={{ fontSize: 10 }}>{digest.source}</Tag>
                  <span style={{ marginLeft: 4 }}>{digest.period}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No findings yet hint */}
      {radarDigests.length === 0 && !scanResults && hasTrackingItems && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('radar.noFindings')}
          </Text>
        </div>
      )}
    </div>
  );
}
