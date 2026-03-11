import React, { useCallback } from 'react';
import { Badge, Button, Popover, Space, Switch, List, Typography } from 'antd';
import {
  BellOutlined,
  BulbOutlined,
  BulbFilled,
  UserOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../stores/config';
import { useUiStore } from '../stores/ui';
import { useEvent } from '../gateway/hooks';
import type { AgentStatus, Notification as AppNotification } from '../stores/ui';

const { Text } = Typography;

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#22C55E',
  thinking: '#F59E0B',
  tool_running: '#F59E0B',
  streaming: '#3B82F6',
  error: '#EF4444',
  disconnected: '#6B7280',
};

const PULSE_STATES = new Set<AgentStatus>(['thinking', 'tool_running', 'streaming']);

const NOTIFICATION_ICONS: Record<AppNotification['type'], React.ReactNode> = {
  deadline: <ClockCircleOutlined style={{ color: '#EF4444' }} />,
  heartbeat: <AlertOutlined style={{ color: '#F59E0B' }} />,
  system: <InfoCircleOutlined style={{ color: '#3B82F6' }} />,
  error: <WarningOutlined style={{ color: '#EF4444' }} />,
};

function relativeTimestamp(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function AgentStatusDot({ status }: { status: AgentStatus }) {
  const { t } = useTranslation();
  const color = STATUS_COLORS[status];
  const pulse = PULSE_STATES.has(status);

  return (
    <div
      title={t(`agent.${status === 'tool_running' ? 'toolRunning' : status}`)}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        animation: pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
        flexShrink: 0,
      }}
    />
  );
}

function NotificationPanel() {
  const { t } = useTranslation();
  const notifications = useUiStore((s) => s.notifications);
  const markAllRead = useUiStore((s) => s.markAllNotificationsRead);
  const markRead = useUiStore((s) => s.markNotificationRead);

  if (notifications.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', minWidth: 240 }}>
        <Text type="secondary">{t('notification.noNotifications')}</Text>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 280, maxHeight: 360, overflow: 'auto' }}>
      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>{t('topbar.notifications')}</Text>
        <Button type="link" size="small" onClick={markAllRead}>
          {t('notification.markAllRead')}
        </Button>
      </div>
      <List
        size="small"
        dataSource={notifications.slice(0, 20)}
        renderItem={(item) => (
          <List.Item
            onClick={() => !item.read && markRead(item.id)}
            style={{
              padding: '8px 12px',
              background: item.read ? 'transparent' : 'var(--surface-active)',
              cursor: item.read ? 'default' : 'pointer',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%' }}>
              <span style={{ flexShrink: 0, marginTop: 2, fontSize: 14 }}>
                {NOTIFICATION_ICONS[item.type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: item.read ? 400 : 500 }}>{item.title}</Text>
                {item.body && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.body}</Text>
                  </div>
                )}
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{relativeTimestamp(item.timestamp)}</Text>
                </div>
              </div>
              {!item.read && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#3B82F6',
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}

export default function TopBar() {
  const { t } = useTranslation();
  const theme = useConfigStore((s) => s.theme);
  const setTheme = useConfigStore((s) => s.setTheme);
  const unreadCount = useUiStore((s) => s.unreadCount);
  const agentStatus = useUiStore((s) => s.agentStatus);
  const addNotification = useUiStore((s) => s.addNotification);

  // Subscribe to gateway events for notifications
  const handleHeartbeatAlert = useCallback(
    (payload: unknown) => {
      const data = payload as { title?: string; body?: string } | undefined;
      if (data?.title) {
        addNotification({
          type: 'heartbeat',
          title: data.title,
          body: data.body,
        });
      }
    },
    [addNotification],
  );

  const handleTaskDeadline = useCallback(
    (payload: unknown) => {
      const data = payload as { title?: string; deadline?: string } | undefined;
      if (data?.title) {
        addNotification({
          type: 'deadline',
          title: data.title,
          body: data.deadline ? `Due: ${data.deadline}` : undefined,
        });
      }
    },
    [addNotification],
  );

  const handleSystemNotification = useCallback(
    (payload: unknown) => {
      const data = payload as { title?: string; body?: string; type?: string } | undefined;
      if (data?.title) {
        addNotification({
          type: (data.type as AppNotification['type']) ?? 'system',
          title: data.title,
          body: data.body,
        });
      }
    },
    [addNotification],
  );

  useEvent('heartbeat.alert', handleHeartbeatAlert);
  useEvent('task.deadline', handleTaskDeadline);
  useEvent('notification', handleSystemNotification);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
            color: 'var(--accent-primary)',
          }}
        >
          {t('app.name')}
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <Space size={12} align="center">
        {/* Notification bell */}
        <Popover
          content={<NotificationPanel />}
          trigger="click"
          placement="bottomRight"
        >
          <Badge count={unreadCount} size="small" offset={[-2, 2]} overflowCount={99}>
            <Button
              type="text"
              icon={<BellOutlined />}
              title={t('topbar.notifications')}
              aria-label={t('a11y.notifications')}
              style={{ color: 'var(--text-secondary)' }}
            />
          </Badge>
        </Popover>

        {/* Agent status dot */}
        <AgentStatusDot status={agentStatus} />

        {/* Theme toggle */}
        <Switch
          checked={theme === 'light'}
          onChange={handleThemeToggle}
          checkedChildren={<BulbFilled />}
          unCheckedChildren={<BulbOutlined />}
          title={t('topbar.themeToggle')}
          size="small"
        />

        {/* Avatar */}
        <Button
          type="text"
          icon={<UserOutlined />}
          shape="circle"
          size="small"
          title={t('topbar.profile')}
          style={{ color: 'var(--text-secondary)' }}
        />
      </Space>
    </div>
  );
}
