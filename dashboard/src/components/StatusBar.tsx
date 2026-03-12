import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGatewayStore } from '../stores/gateway';
import { useConfigStore } from '../stores/config';
import { useChatStore } from '../stores/chat';

export default function StatusBar() {
  const { t } = useTranslation();
  const state = useGatewayStore((s) => s.state);
  const serverVersion = useGatewayStore((s) => s.serverVersion);
  const gatewayConfig = useConfigStore((s) => s.gatewayConfig);
  const tokensIn = useChatStore((s) => s.tokensIn);
  const tokensOut = useChatStore((s) => s.tokensOut);
  const [heartbeatAge, setHeartbeatAge] = useState(0);

  // Heartbeat timer — counts seconds since last tick
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeatAge((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset heartbeat on connection changes
  useEffect(() => {
    if (state === 'connected') {
      setHeartbeatAge(0);
    }
  }, [state]);

  const statusColor =
    state === 'connected'
      ? 'var(--success)'
      : state === 'reconnecting' || state === 'connecting'
        ? 'var(--warning)'
        : 'var(--text-tertiary)';

  const statusKey =
    state === 'connected'
      ? 'status.connected'
      : state === 'reconnecting'
        ? 'status.reconnecting'
        : state === 'connecting'
          ? 'status.connecting'
          : state === 'authenticating'
            ? 'status.authenticating'
            : 'status.disconnected';

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const modelDisplay = gatewayConfig?.agents?.defaults?.model?.primary ?? t('status.modelNA');

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 16,
        fontSize: 11,
        fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
        color: 'var(--text-tertiary)',
        background: 'var(--surface)',
        userSelect: 'none',
      }}
    >
      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: statusColor,
          }}
        />
        <span>{t(statusKey)}</span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

      {/* Model name */}
      <span style={{ color: 'var(--text-secondary)' }}>
        {t('status.model')}: {modelDisplay}
      </span>

      {/* Separator */}
      <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

      {/* Token counts */}
      <span>
        {t('status.tokensIn')}: {tokensIn.toLocaleString()} | {t('status.tokensOut')}: {tokensOut.toLocaleString()}
      </span>

      {/* Separator */}
      <div style={{ width: 1, height: 12, background: 'var(--border)' }} />

      {/* Heartbeat timer */}
      <span>
        {t('status.heartbeat')}: {formatTime(heartbeatAge)}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Version */}
      <span>
        {serverVersion ? t('status.version', { version: serverVersion }) : t('status.versionFallback')}
      </span>
    </div>
  );
}
