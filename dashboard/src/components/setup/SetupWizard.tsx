import React, { useState } from 'react';
import { Button, Input, Typography, Space, Alert, Card, Divider, Segmented } from 'antd';
import {
  ApiOutlined,
  GlobalOutlined,
  LoadingOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGatewayStore } from '../../stores/gateway';
import { buildConfigPatch } from '../../utils/config-patch';

const { Title, Text } = Typography;

export default function SetupWizard() {
  const { t } = useTranslation();
  const client = useGatewayStore((s) => s.client);
  const connState = useGatewayStore((s) => s.state);

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
  const [error, setError] = useState('');

  const canStart =
    apiKey.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    textModel.trim().length > 0;

  const handleStart = async () => {
    if (!client?.isConnected) return;

    setSaving(true);
    setError('');

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

      // Gateway will SIGUSR1 restart → WS drops → auto reconnect → onHello → config.get → evaluateConfig → bootState='ready'
      setRestarting(true);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Failed to configure gateway');
    }
  };

  // While restarting, show overlay — the gateway store's onHello will auto-fetch config
  // and evaluateConfig will set bootState to 'ready', which unmounts this wizard
  if (restarting) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          gap: 16,
        }}
      >
        <LoadingOutlined style={{ fontSize: 48, color: 'var(--accent-primary)' }} />
        <Text style={{ fontSize: 16 }}>{t('setup.gatewayRestarting')}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {connState === 'connected' ? t('status.connected') : t('status.reconnecting')}
        </Text>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        styles={{ body: { padding: 32 } }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <RocketOutlined style={{ fontSize: 48, color: 'var(--accent-primary)', marginBottom: 16 }} />
            <Title level={3} style={{ margin: 0 }}>
              {t('setup.title')}
            </Title>
            <Text type="secondary">{t('setup.subtitle')}</Text>
          </div>

          {/* ── Model ── */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('setup.baseUrl')}
            </Text>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('setup.baseUrlPlaceholder')}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('setup.apiKey')}
            </Text>
            <Input.Password
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('setup.apiKeyPlaceholder')}
              prefix={<ApiOutlined />}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('setup.modelName')}
            </Text>
            <Input
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              placeholder={t('setup.modelNamePlaceholder')}
            />
          </div>

          {/* ── Vision ── */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {t('setup.visionModel')}
            </Text>
            <Input
              value={visionModel}
              onChange={(e) => setVisionModel(e.target.value)}
              placeholder={t('setup.visionModelPlaceholder')}
            />
            <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
              {t('setup.visionModelHint')}
            </Text>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13 }}>{t('setup.differentEndpoint')}</Text>
              <Segmented
                value={useDifferentEndpoint ? 'on' : 'off'}
                onChange={(v) => setUseDifferentEndpoint(v === 'on')}
                options={[
                  { label: 'OFF', value: 'off' },
                  { label: 'ON', value: 'on' },
                ]}
                size="small"
              />
            </div>
          </div>

          {useDifferentEndpoint && (
            <>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  {t('setup.visionBaseUrl')}
                </Text>
                <Input
                  value={visionBaseUrl}
                  onChange={(e) => setVisionBaseUrl(e.target.value)}
                  placeholder={t('setup.baseUrlPlaceholder')}
                />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  {t('setup.visionApiKey')}
                </Text>
                <Input.Password
                  value={visionApiKey}
                  onChange={(e) => setVisionApiKey(e.target.value)}
                  placeholder={t('setup.apiKeyPlaceholder')}
                  prefix={<ApiOutlined />}
                />
              </div>
            </>
          )}

          <Divider style={{ margin: '4px 0' }} />

          {/* ── Network ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 13 }}>
                <GlobalOutlined style={{ marginRight: 6 }} />
                {t('setup.proxyEnabled')}
              </Text>
              <Segmented
                value={proxyEnabled ? 'on' : 'off'}
                onChange={(v) => setProxyEnabled(v === 'on')}
                options={[
                  { label: 'OFF', value: 'off' },
                  { label: 'ON', value: 'on' },
                ]}
                size="small"
              />
            </div>
            {proxyEnabled && (
              <>
                <Input
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="http://127.0.0.1:7890"
                />
                <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
                  {t('setup.proxyHint')}
                </Text>
              </>
            )}
          </div>

          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              closable
              onClose={() => setError('')}
            />
          )}

          <Alert
            type="info"
            message={t('setup.restartHint')}
            style={{ fontSize: 12 }}
          />

          <div style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              onClick={handleStart}
              disabled={!canStart || saving}
              loading={saving}
              icon={<RocketOutlined />}
            >
              {saving ? t('setup.configuring') : t('setup.start')}
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
}
