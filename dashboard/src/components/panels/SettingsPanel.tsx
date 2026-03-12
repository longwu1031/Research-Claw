import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Divider,
  Input,
  Segmented,
  Spin,
  Typography,
  message,
} from 'antd';
import { CopyOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config';
import { useGatewayStore } from '../../stores/gateway';
import { getThemeTokens } from '../../styles/theme';
import { buildConfigPatch, extractConfigFields } from '../../utils/config-patch';

const { Text } = Typography;

// --- Setting row layout ---

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13 }}>{label}</Text>
        {description && (
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {description}
            </Text>
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// --- About section ---

function AboutSection() {
  const { t } = useTranslation();
  const serverVersion = useGatewayStore((s) => s.serverVersion);
  const configTheme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(configTheme), [configTheme]);

  const handleCopyDiagnostics = async () => {
    const diagnostics = [
      `Research-Claw v0.1.0`,
      `Powered by OpenClaw ${serverVersion ?? 'unknown'}`,
      `Gateway: ws://127.0.0.1:28789`,
      `Platform: ${navigator.platform}`,
      `User-Agent: ${navigator.userAgent}`,
      `Theme: ${configTheme}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnostics);
      message.success(t('settings.aboutDiagnosticsCopied'));
    } catch {
      message.error(t('settings.copyFailed'));
    }
  };

  const infoRows = [
    { label: t('settings.aboutVersion', { version: '0.1.0' }), value: '' },
    { label: t('settings.aboutOpenClaw', { version: serverVersion ?? 'N/A' }), value: '' },
    { label: t('settings.aboutGateway'), value: 'ws://127.0.0.1:28789' },
    { label: t('settings.aboutPlugins'), value: 'research-claw-core' },
  ];

  const bootstrapFiles = ['SOUL.md', 'AGENTS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'MEMORY.md'];

  return (
    <>
      {infoRows.map((row) => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
          <Text>{row.label}</Text>
          {row.value && (
            <Text style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: tokens.text.muted }}>
              {row.value}
            </Text>
          )}
        </div>
      ))}

      <Divider style={{ margin: '8px 0' }} />

      <Text style={{ fontSize: 12, color: tokens.text.muted }}>{t('settings.aboutBootstrap')}</Text>
      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {bootstrapFiles.map((file) => (
          <Text key={file} code style={{ fontSize: 11 }}>
            {file}
          </Text>
        ))}
      </div>

      <Divider style={{ margin: '12px 0 8px' }} />

      <Button
        icon={<CopyOutlined />}
        size="small"
        onClick={handleCopyDiagnostics}
        block
      >
        {t('settings.aboutDiagnostics')}
      </Button>
    </>
  );
}

// --- Main SettingsPanel (single scrollable panel) ---

export default function SettingsPanel() {
  const { t } = useTranslation();
  const configTheme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(configTheme), [configTheme]);
  const state = useGatewayStore((s) => s.state);

  const gatewayConfig = useConfigStore((s) => s.gatewayConfig);
  const gatewayConfigLoading = useConfigStore((s) => s.gatewayConfigLoading);
  const loadGatewayConfig = useConfigStore((s) => s.loadGatewayConfig);

  const systemPromptAppend = useConfigStore((s) => s.systemPromptAppend);
  const setSystemPromptAppend = useConfigStore((s) => s.setSystemPromptAppend);

  // Editable config fields
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [textModel, setTextModel] = useState('');
  const [visionModel, setVisionModel] = useState('');
  const [useDifferentEndpoint, setUseDifferentEndpoint] = useState(false);
  const [visionBaseUrl, setVisionBaseUrl] = useState('');
  const [visionApiKey, setVisionApiKey] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('http://127.0.0.1:7890');
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Load gateway config when connected
  useEffect(() => {
    if (state === 'connected' && !gatewayConfig && !gatewayConfigLoading) {
      loadGatewayConfig();
    }
  }, [state, gatewayConfig, gatewayConfigLoading, loadGatewayConfig]);

  // Sync form fields from gateway config
  useEffect(() => {
    if (!gatewayConfig) return;
    const fields = extractConfigFields(gatewayConfig as unknown as Record<string, unknown>);
    setBaseUrl(fields.baseUrl);
    setApiKey(fields.apiKey);
    setTextModel(fields.textModel);
    setVisionModel(fields.visionModel);
    setUseDifferentEndpoint(fields.useDifferentVisionEndpoint);
    setVisionBaseUrl(fields.visionBaseUrl);
    setVisionApiKey(fields.visionApiKey);
    if (fields.proxyUrl) {
      setProxyEnabled(true);
      setProxyUrl(fields.proxyUrl);
    } else {
      setProxyEnabled(false);
    }
    // Clear restarting state when config refreshes after reconnect
    setRestarting(false);
  }, [gatewayConfig]);

  const handleRefresh = useCallback(() => {
    loadGatewayConfig();
  }, [loadGatewayConfig]);

  const handleSave = useCallback(async () => {
    const client = useGatewayStore.getState().client;
    if (!client?.isConnected) return;

    if (!baseUrl.trim() || !apiKey.trim() || !textModel.trim()) {
      message.error(t('settings.saveFailed'));
      return;
    }

    setSaving(true);
    try {
      const patch = buildConfigPatch({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        textModel: textModel.trim(),
        visionModel: visionModel.trim() || undefined,
        visionBaseUrl: useDifferentEndpoint ? visionBaseUrl.trim() || undefined : undefined,
        visionApiKey: useDifferentEndpoint ? visionApiKey.trim() || undefined : undefined,
        proxyUrl: proxyEnabled ? proxyUrl.trim() : '',
      });

      // Gateway requires baseHash for config.patch (optimistic locking).
      // Always fetch fresh hash right before patching.
      const configSnapshot = await client.request<{ hash: string }>('config.get', {});

      await client.request('config.patch', {
        raw: JSON.stringify(patch),
        baseHash: configSnapshot.hash,
      });

      message.success(t('settings.saved'));
      // Gateway will SIGUSR1 restart → WS reconnects → onHello → config.get → UI refreshes
      setRestarting(true);
    } catch {
      message.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [baseUrl, apiKey, textModel, visionModel, useDifferentEndpoint, visionBaseUrl, visionApiKey, proxyEnabled, proxyUrl, t]);

  const handleSavePrompt = useCallback(() => {
    message.success(t('settings.saved'));
  }, [t]);

  if (state !== 'connected') {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <Text type="secondary">{t('status.disconnected')}</Text>
      </div>
    );
  }

  if (gatewayConfigLoading && !gatewayConfig) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <Spin size="small" />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">{t('settings.configLoading')}</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px', height: '100%', overflow: 'auto' }}>
      {/* Config source badge + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 4px' }}>
        <Text style={{ fontSize: 11, color: tokens.text.muted }}>{t('settings.configSource')}</Text>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={gatewayConfigLoading} />}
          onClick={handleRefresh}
          style={{ fontSize: 11 }}
        >
          {t('settings.refreshConfig')}
        </Button>
      </div>

      <Divider style={{ margin: '4px 0 8px' }} />

      {/* ── Model section ── */}
      <SettingRow label={t('settings.baseUrl')}>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          size="small"
          style={{ width: 220 }}
          placeholder="https://api.openai.com/v1"
        />
      </SettingRow>

      <SettingRow label={t('settings.apiKeyLabel')}>
        <Input.Password
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          size="small"
          style={{ width: 220 }}
        />
      </SettingRow>

      <SettingRow label={t('settings.primaryModel')}>
        <Input
          value={textModel}
          onChange={(e) => setTextModel(e.target.value)}
          size="small"
          style={{ width: 220 }}
          placeholder="glm-5"
        />
      </SettingRow>

      {/* ── Vision section ── */}
      <SettingRow label={t('settings.visionModel')} description={t('settings.visionModelHint')}>
        <Input
          value={visionModel}
          onChange={(e) => setVisionModel(e.target.value)}
          size="small"
          style={{ width: 220 }}
          placeholder={t('settings.noVisionModel')}
        />
      </SettingRow>

      <SettingRow label={t('settings.differentEndpoint')}>
        <Segmented
          value={useDifferentEndpoint ? 'on' : 'off'}
          onChange={(v) => setUseDifferentEndpoint(v === 'on')}
          options={[
            { label: 'OFF', value: 'off' },
            { label: 'ON', value: 'on' },
          ]}
          size="small"
        />
      </SettingRow>

      {useDifferentEndpoint && (
        <>
          <SettingRow label={t('settings.visionBaseUrl')}>
            <Input
              value={visionBaseUrl}
              onChange={(e) => setVisionBaseUrl(e.target.value)}
              size="small"
              style={{ width: 220 }}
              placeholder="https://api.openai.com/v1"
            />
          </SettingRow>
          <SettingRow label={t('settings.visionApiKey')}>
            <Input.Password
              value={visionApiKey}
              onChange={(e) => setVisionApiKey(e.target.value)}
              size="small"
              style={{ width: 220 }}
            />
          </SettingRow>
        </>
      )}

      {/* ── Network section ── */}
      <Divider style={{ margin: '4px 0 8px' }} />

      <SettingRow label={t('settings.proxyEnabled')}>
        <Segmented
          value={proxyEnabled ? 'on' : 'off'}
          onChange={(v) => setProxyEnabled(v === 'on')}
          options={[
            { label: 'OFF', value: 'off' },
            { label: 'ON', value: 'on' },
          ]}
          size="small"
        />
      </SettingRow>

      {proxyEnabled && (
        <SettingRow label={t('settings.proxyUrl')}>
          <Input
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            size="small"
            style={{ width: 220 }}
            placeholder="http://127.0.0.1:7890"
          />
        </SettingRow>
      )}

      {/* ── Save config (model + vision + proxy) ── */}
      <Divider style={{ margin: '4px 0 8px' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 11, flex: 1 }}>
          {t('settings.restartHint')}
        </Text>
        <Button type="primary" size="small" onClick={handleSave} loading={saving} style={{ flexShrink: 0 }}>
          {restarting ? t('setup.gatewayRestarting') : t('settings.save')}
        </Button>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* ── System prompt append (local-only) ── */}
      <SettingRow label={t('settings.systemPromptAppend')}>
        <Input.TextArea
          value={systemPromptAppend}
          onChange={(e) => setSystemPromptAppend(e.target.value)}
          placeholder={t('settings.systemPromptAppend')}
          rows={3}
          size="small"
          style={{ width: 220 }}
        />
      </SettingRow>

      <div style={{ textAlign: 'right', paddingTop: 8 }}>
        <Button type="primary" size="small" onClick={handleSavePrompt}>
          {t('settings.save')}
        </Button>
      </div>

      <Divider style={{ margin: '12px 0 8px' }} />

      {/* ── About section (inline) ── */}
      <AboutSection />

      <div style={{ height: 16 }} />
    </div>
  );
}
