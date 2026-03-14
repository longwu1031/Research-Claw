import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Spin, Switch, Tag, Typography } from 'antd';
import {
  RadarChartOutlined,
  ReloadOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chat';
import { useGatewayStore } from '../../stores/gateway';
import { useRadarStore } from '../../stores/radar';
import { useCronStore, type CronPreset } from '../../stores/cron';
import { getThemeTokens } from '../../styles/theme';
import { useConfigStore } from '../../stores/config';
import { cronToHuman } from '../../utils/cronToHuman';
import { relativeTime } from '../../utils/relativeTime';

const { Text, Link } = Typography;

// ── Preset metadata for expanded view ────────────────────────────────────────

const PRESET_META: Record<string, {
  descKey: string;
  relatedKey: string;
}> = {
  arxiv_daily_scan: {
    descKey: 'radar.cron.desc.arxiv_daily_scan',
    relatedKey: 'radar.cron.related.arxiv_daily_scan',
  },
  citation_tracking_weekly: {
    descKey: 'radar.cron.desc.citation_tracking_weekly',
    relatedKey: 'radar.cron.related.citation_tracking_weekly',
  },
  deadline_reminders_daily: {
    descKey: 'radar.cron.desc.deadline_reminders_daily',
    relatedKey: 'radar.cron.related.deadline_reminders_daily',
  },
  group_meeting_prep: {
    descKey: 'radar.cron.desc.group_meeting_prep',
    relatedKey: 'radar.cron.related.group_meeting_prep',
  },
  weekly_report: {
    descKey: 'radar.cron.desc.weekly_report',
    relatedKey: 'radar.cron.related.weekly_report',
  },
};

// ── Scan result type ─────────────────────────────────────────────────────────

interface ScanResultItem {
  source: string;
  query: string;
  papers: Array<{ title: string; authors: string[]; year?: number; url: string }>;
  total_found: number;
  papers_skipped: number;
  errors: string[];
}

// ── TrackingSection sub-component ────────────────────────────────────────────

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

// ── CronPresetCard sub-component ─────────────────────────────────────────────

function CronPresetCard({
  preset,
  tokens,
  expanded,
  onToggleExpand,
}: {
  preset: CronPreset;
  tokens: ReturnType<typeof getThemeTokens>;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t, i18n } = useTranslation();
  const activatePreset = useCronStore((s) => s.activatePreset);
  const deactivatePreset = useCronStore((s) => s.deactivatePreset);
  const deletePreset = useCronStore((s) => s.deletePreset);
  const send = useChatStore((s) => s.send);
  const [toggling, setToggling] = useState(false);

  const locale = i18n.language || 'en';
  const meta = PRESET_META[preset.id];

  const handleToggle = useCallback(async (checked: boolean, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
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

  const handleDelete = useCallback(() => {
    Modal.confirm({
      title: t('radar.cron.deleteConfirmTitle'),
      content: t('radar.cron.deleteConfirmContent', { name: preset.name }),
      okText: t('radar.cron.delete'),
      okType: 'danger',
      onOk: async () => {
        await deletePreset(preset.id);
      },
    });
  }, [preset.id, preset.name, deletePreset, t]);

  const handleAskAgent = useCallback(() => {
    const prompt = t('radar.cron.askAgentPrompt', { name: preset.name });
    send(prompt);
  }, [preset.name, send, t]);

  const humanSchedule = cronToHuman(preset.schedule, locale);
  const lastRunText = relativeTime(preset.last_run_at, locale);

  return (
    <div
      style={{
        border: `1px solid ${tokens.border.default}`,
        borderRadius: 6,
        marginBottom: 8,
        background: expanded ? tokens.bg.surface : 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Collapsed state — always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleExpand(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        {/* Status dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: preset.enabled ? '#52c41a' : tokens.text.muted,
            flexShrink: 0,
          }}
        />

        {/* Name + schedule line */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: 500, display: 'block' }}>{preset.name}</Text>
          <Text style={{ fontSize: 11, color: tokens.text.muted }}>
            <ClockCircleOutlined style={{ marginRight: 3 }} />
            {humanSchedule}
            <span style={{ margin: '0 6px' }}>&middot;</span>
            {t('radar.cron.lastRun')}: {lastRunText}
          </Text>
        </div>

        {/* Toggle switch */}
        <Switch
          size="small"
          checked={preset.enabled}
          loading={toggling}
          onChange={handleToggle}
          onClick={(_, e) => e.stopPropagation()}
        />
      </div>

      {/* Expanded state — detail fields + actions */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${tokens.border.default}`, padding: '12px 12px 8px' }}>
          {/* Description */}
          {meta && (
            <Text style={{ fontSize: 12, display: 'block', marginBottom: 12, color: tokens.text.secondary }}>
              {t(meta.descKey)}
            </Text>
          )}

          {/* Detail fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12, marginBottom: 12 }}>
            <Text style={{ color: tokens.text.muted }}>{t('radar.cron.schedule')}</Text>
            <Text>{humanSchedule}</Text>

            <Text style={{ color: tokens.text.muted }}>{t('radar.cron.lastRun')}</Text>
            <Text>{preset.last_run_at ? relativeTime(preset.last_run_at, locale) : t('radar.cron.neverRun')}</Text>

            <Text style={{ color: tokens.text.muted }}>{t('radar.cron.nextRun')}</Text>
            <Text>{preset.next_run_at ? relativeTime(preset.next_run_at, locale) : t('radar.cron.neverRun')}</Text>

            {meta && (
              <>
                <Text style={{ color: tokens.text.muted }}>{t('radar.cron.relatedConfig')}</Text>
                <Text>{t(meta.relatedKey)}</Text>
              </>
            )}

            {/* Extra field for deadline_reminders_daily */}
            {preset.id === 'deadline_reminders_daily' && (
              <>
                <Text style={{ color: tokens.text.muted }}>{t('radar.cron.reminderWindow')}</Text>
                <Text>
                  {locale.startsWith('zh')
                    ? `截止前 ${(preset.config as Record<string, unknown>).reminder_window_hours ?? 48} 小时`
                    : `${(preset.config as Record<string, unknown>).reminder_window_hours ?? 48}h before deadline`}
                </Text>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              icon={<RobotOutlined />}
              onClick={handleAskAgent}
            >
              {t('radar.cron.askAgent')}
            </Button>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            >
              {t('radar.cron.delete')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section Header sub-component ─────────────────────────────────────────────

function SectionHeader({
  title,
  tokens,
  extra,
}: {
  title: string;
  tokens: ReturnType<typeof getThemeTokens>;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: `1px solid ${tokens.border.default}`,
      paddingBottom: 6,
      marginBottom: 10,
    }}>
      <Text strong style={{
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: tokens.text.muted,
      }}>
        {title}
      </Text>
      {extra}
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export default function RadarPanel() {
  const { t, i18n } = useTranslation();
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
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);

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

  const activeCount = presets.filter((p) => p.enabled).length;
  const totalCount = presets.length;

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* ── Section 1: Tracking Profile ─────────────────────────────────── */}
      <div style={{ padding: '12px 16px 8px' }}>
        <SectionHeader
          title={t('radar.section.trackingProfile')}
          tokens={tokens}
        />

        {/* Sources */}
        {hasSources && (
          <TrackingSection
            label={t('radar.sources')}
            items={tracking.sources!}
            tokens={tokens}
            accentColor="blue"
          />
        )}

        {/* Tracking config */}
        {hasTrackingItems ? (
          <>
            <TrackingSection label={t('radar.keywords')} items={tracking.keywords} tokens={tokens} />
            <TrackingSection label={t('radar.authors')} items={tracking.authors} tokens={tokens} />
            <TrackingSection label={t('radar.journals')} items={tracking.journals} tokens={tokens} />
            <Link
              onClick={handleEditViaChat}
              style={{ fontSize: 12, color: tokens.accent.blue }}
            >
              {t('radar.editViaChat')}
            </Link>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('radar.noTracking')}
            </Text>
            <div style={{ marginTop: 8 }}>
              <Button size="small" icon={<PlusOutlined />} onClick={handleEditViaChat}>
                {t('radar.addTracking')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Automated Tasks ──────────────────────────────────── */}
      {presetsLoaded && (
        <div style={{ padding: '8px 16px 12px' }}>
          <SectionHeader
            title={`${t('radar.section.automatedTasks')} (${activeCount} / ${totalCount})`}
            tokens={tokens}
          />

          {presets.length > 0 ? (
            <div>
              {presets.map((preset) => (
                <CronPresetCard
                  key={preset.id}
                  preset={preset}
                  tokens={tokens}
                  expanded={expandedPresetId === preset.id}
                  onToggleExpand={() =>
                    setExpandedPresetId((prev) => (prev === preset.id ? null : preset.id))
                  }
                />
              ))}
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('radar.noDiscoveries')}
            </Text>
          )}
        </div>
      )}

      {/* ── Section 3: Recent Discoveries ───────────────────────────────── */}
      <div style={{ padding: '8px 16px', flex: 1 }}>
        <SectionHeader
          title={t('radar.section.recentDiscoveries')}
          tokens={tokens}
          extra={
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={scanning} />}
              onClick={handleRefresh}
              disabled={scanning}
            >
              {scanning ? t('radar.scanning') : t('radar.refresh')}
            </Button>
          }
        />

        {/* Scanning indicator */}
        {scanning && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <Spin size="small" />
            <Text style={{ marginLeft: 8, fontSize: 12, color: tokens.text.muted }}>{t('radar.scanning')}</Text>
          </div>
        )}

        {/* Scan results from RPC */}
        {scanResults && scanResults.length > 0 && (
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
        )}

        {/* Radar digests from chat */}
        {radarDigests.length > 0 && !scanResults && (
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
        )}

        {/* No findings yet hint — only show when tracking is configured */}
        {radarDigests.length === 0 && !scanResults && !scanning && hasTrackingItems && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('radar.noFindings')}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
