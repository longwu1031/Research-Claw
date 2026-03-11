import React, { useMemo } from 'react';
import { Button, Tag, Typography } from 'antd';
import {
  RadarChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chat';
import { getThemeTokens } from '../../styles/theme';
import { useConfigStore } from '../../stores/config';

const { Text, Link } = Typography;

// Radar data comes from chat history (radar_digest cards) and user config.
// For MVP, this panel shows placeholder tracking config + empty state guidance.

interface TrackingConfig {
  keywords: string[];
  authors: string[];
  journals: string[];
}

function TrackingSection({
  label,
  items,
  tokens,
}: {
  label: string;
  items: string[];
  tokens: ReturnType<typeof getThemeTokens>;
}) {
  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: tokens.text.muted }}>{label}</Text>
      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {items.map((item) => (
          <Tag key={item} style={{ fontSize: 11 }}>
            {item}
          </Tag>
        ))}
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

  // Extract radar_digest cards from chat messages
  const radarDigests = useMemo(() => {
    const digests: Array<{ source: string; query: string; total_found: number; period: string }> = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.text) {
        // Check for radar_digest fenced code blocks
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

  // Placeholder tracking config (would come from config RPC in full implementation)
  const tracking: TrackingConfig = {
    keywords: [],
    authors: [],
    journals: [],
  };

  const hasTracking = tracking.keywords.length > 0 || tracking.authors.length > 0 || tracking.journals.length > 0;

  const handleRefresh = () => {
    send('Check my radar for new findings');
  };

  const handleEditViaChat = () => {
    send('Configure my research radar. I want to track:');
  };

  // Full empty state
  if (!hasTracking && radarDigests.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 60 }}>
        <RadarChartOutlined style={{ fontSize: 48, color: tokens.text.muted, opacity: 0.4 }} />
        <div style={{ marginTop: 16, whiteSpace: 'pre-line' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('radar.empty')}
          </Text>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button size="small" onClick={handleEditViaChat}>
            {t('radar.editViaChat')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with refresh */}
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
        >
          {t('radar.refresh')}
        </Button>
      </div>

      {/* Tracking section */}
      {hasTracking && (
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
      )}

      {/* Divider */}
      {hasTracking && radarDigests.length > 0 && (
        <div style={{ borderTop: `1px solid ${tokens.border.default}`, margin: '0 16px' }} />
      )}

      {/* Findings */}
      {radarDigests.length > 0 && (
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
    </div>
  );
}
