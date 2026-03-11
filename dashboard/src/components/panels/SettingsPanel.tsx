import React, { useMemo, useState } from 'react';
import {
  Button,
  Divider,
  Input,
  InputNumber,
  Segmented,
  Select,
  Slider,
  Space,
  Switch,
  Tabs,
  Typography,
  message,
} from 'antd';
import { CopyOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/config';
import { useGatewayStore } from '../../stores/gateway';
import { getThemeTokens } from '../../styles/theme';

const { Text, Title } = Typography;

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', gap: 16 }}>
      <div style={{ flex: 1 }}>
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

// --- General tab ---

function GeneralSettings() {
  const { t } = useTranslation();
  const theme = useConfigStore((s) => s.theme);
  const setTheme = useConfigStore((s) => s.setTheme);
  const locale = useConfigStore((s) => s.locale);
  const setLocale = useConfigStore((s) => s.setLocale);

  return (
    <div style={{ padding: '8px 0' }}>
      <SettingRow label={t('settings.language.label')}>
        <Select
          value={locale}
          onChange={(v) => setLocale(v as 'en' | 'zh-CN')}
          options={[
            { label: t('settings.language.en'), value: 'en' },
            { label: t('settings.language.zhCN'), value: 'zh-CN' },
          ]}
          size="small"
          style={{ width: 120 }}
        />
      </SettingRow>

      <SettingRow label={t('settings.theme.label')}>
        <Segmented
          value={theme}
          onChange={(v) => setTheme(v as 'dark' | 'light')}
          options={[
            { label: t('settings.theme.dark'), value: 'dark' },
            { label: t('settings.theme.light'), value: 'light' },
          ]}
          size="small"
        />
      </SettingRow>

      <SettingRow label={t('settings.notificationSound')}>
        <Switch defaultChecked size="small" />
      </SettingRow>

      <SettingRow label={t('settings.autoScroll')}>
        <Switch defaultChecked size="small" />
      </SettingRow>

      <SettingRow label={t('settings.timestampFormat')}>
        <Select
          defaultValue="relative"
          options={[
            { label: t('settings.timestampRelative'), value: 'relative' },
            { label: t('settings.timestampAbsolute'), value: 'absolute' },
            { label: t('settings.timestampIso'), value: 'iso' },
          ]}
          size="small"
          style={{ width: 120 }}
        />
      </SettingRow>
    </div>
  );
}

// --- Model tab ---

function ModelSettings() {
  const { t } = useTranslation();
  const provider = useConfigStore((s) => s.provider);
  const model = useConfigStore((s) => s.model);
  const apiKey = useConfigStore((s) => s.apiKey);
  const client = useGatewayStore((s) => s.client);

  const [localProvider, setLocalProvider] = useState(provider ?? 'anthropic');
  const [localModel, setLocalModel] = useState(model ?? '');
  const [localTemp, setLocalTemp] = useState(0.7);
  const [localMaxTokens, setLocalMaxTokens] = useState(4096);

  const handleSave = async () => {
    if (!client?.isConnected) return;
    try {
      await client.request('config.set', {
        provider: localProvider,
        model: localModel,
        temperature: localTemp,
        maxTokens: localMaxTokens,
      });
      message.success(t('settings.saved'));
    } catch {
      message.error(t('settings.saveFailed'));
    }
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <SettingRow label={t('settings.modelProvider')}>
        <Select
          value={localProvider}
          onChange={setLocalProvider}
          options={[
            { label: 'Anthropic', value: 'anthropic' },
            { label: 'OpenAI', value: 'openai' },
            { label: 'Google', value: 'google' },
            { label: 'Azure', value: 'azure' },
            { label: 'Custom', value: 'custom' },
          ]}
          size="small"
          style={{ width: 120 }}
        />
      </SettingRow>

      <SettingRow label={t('settings.modelSelection')}>
        <Input
          value={localModel}
          onChange={(e) => setLocalModel(e.target.value)}
          placeholder="claude-sonnet-4-5"
          size="small"
          style={{ width: 160 }}
        />
      </SettingRow>

      <SettingRow label={t('settings.apiKeyLabel')}>
        <Input.Password
          value={apiKey ? `${'*'.repeat(Math.max(0, apiKey.length - 4))}${apiKey.slice(-4)}` : ''}
          placeholder="sk-..."
          size="small"
          style={{ width: 160 }}
          readOnly
        />
      </SettingRow>

      <SettingRow label={t('settings.temperature')}>
        <div style={{ width: 140 }}>
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={localTemp}
            onChange={setLocalTemp}
          />
        </div>
      </SettingRow>

      <SettingRow label={t('settings.maxTokens')}>
        <InputNumber
          value={localMaxTokens}
          onChange={(v) => setLocalMaxTokens(v ?? 4096)}
          min={256}
          max={32768}
          step={256}
          size="small"
          style={{ width: 100 }}
        />
      </SettingRow>

      <div style={{ textAlign: 'right', paddingTop: 8 }}>
        <Button type="primary" size="small" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

// --- Proxy tab ---

function ProxySettings() {
  const { t } = useTranslation();
  const client = useGatewayStore((s) => s.client);

  const [enabled, setEnabled] = useState(false);
  const [protocol, setProtocol] = useState<'http' | 'socks5'>('http');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(7890);
  const [auth, setAuth] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!client?.isConnected) return;
    setTesting(true);
    try {
      await client.request('config.set', {
        proxy: { enabled, type: protocol, host, port, auth, username, password },
      });
      message.success(t('settings.proxyTestSuccess'));
    } catch (err) {
      message.error(t('settings.proxyTestFailed', { error: String(err) }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <SettingRow label={t('settings.proxyEnabled')}>
        <Switch checked={enabled} onChange={setEnabled} size="small" />
      </SettingRow>

      {enabled && (
        <>
          <SettingRow label={t('settings.proxyProtocol')}>
            <Segmented
              value={protocol}
              onChange={(v) => setProtocol(v as 'http' | 'socks5')}
              options={[
                { label: 'HTTP', value: 'http' },
                { label: 'SOCKS5', value: 'socks5' },
              ]}
              size="small"
            />
          </SettingRow>

          <SettingRow label={t('settings.proxyHost')}>
            <Input value={host} onChange={(e) => setHost(e.target.value)} size="small" style={{ width: 140 }} />
          </SettingRow>

          <SettingRow label={t('settings.proxyPort')}>
            <InputNumber value={port} onChange={(v) => setPort(v ?? 7890)} size="small" style={{ width: 80 }} />
          </SettingRow>

          <SettingRow label={t('settings.proxyAuth')}>
            <Switch checked={auth} onChange={setAuth} size="small" />
          </SettingRow>

          {auth && (
            <>
              <SettingRow label={t('settings.proxyUsername')}>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} size="small" style={{ width: 140 }} />
              </SettingRow>
              <SettingRow label={t('settings.proxyPassword')}>
                <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} size="small" style={{ width: 140 }} />
              </SettingRow>
            </>
          )}

          <div style={{ textAlign: 'right', paddingTop: 8 }}>
            <Button size="small" onClick={handleTest} loading={testing}>
              {t('settings.proxyTest')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// --- About tab ---

function AboutSettings() {
  const { t } = useTranslation();
  const serverVersion = useGatewayStore((s) => s.serverVersion);
  const configTheme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(configTheme), [configTheme]);

  const handleCopyDiagnostics = async () => {
    const diagnostics = [
      `Research-Claw v0.1.0`,
      `OpenClaw ${serverVersion ?? 'unknown'}`,
      `Gateway: ws://127.0.0.1:18789`,
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
    { label: t('settings.aboutGateway'), value: 'ws://127.0.0.1:18789' },
    { label: t('settings.aboutPlugins'), value: 'research-claw-core' },
  ];

  const bootstrapFiles = ['SOUL.md', 'AGENTS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'MEMORY.md'];

  return (
    <div style={{ padding: '8px 0' }}>
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
          <Text
            key={file}
            code
            style={{ fontSize: 11 }}
          >
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
    </div>
  );
}

// --- Main SettingsPanel ---

export default function SettingsPanel() {
  const { t } = useTranslation();

  const tabItems = [
    { key: 'general', label: t('settings.general'), children: <GeneralSettings /> },
    { key: 'model', label: t('settings.model'), children: <ModelSettings /> },
    { key: 'proxy', label: t('settings.proxy'), children: <ProxySettings /> },
    { key: 'about', label: t('settings.about'), children: <AboutSettings /> },
  ];

  return (
    <div style={{ padding: '0 16px', height: '100%' }}>
      <Tabs
        items={tabItems}
        size="small"
        defaultActiveKey="general"
      />
    </div>
  );
}
