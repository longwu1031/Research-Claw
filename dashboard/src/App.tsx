import React, { useEffect, useCallback, Suspense, useState } from 'react';
import { ConfigProvider, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAntdThemeConfig } from './styles/theme';
import { useConfigStore } from './stores/config';
import { useGatewayStore } from './stores/gateway';
import { useChatStore } from './stores/chat';
import { useUiStore, type PanelTab } from './stores/ui';
import ErrorBoundary from './components/ErrorBoundary';
import TopBar from './components/TopBar';
import LeftNav from './components/LeftNav';
import ChatView from './components/chat/ChatView';
import RightPanel from './components/RightPanel';
import StatusBar from './components/StatusBar';
import SetupWizard from './components/setup/SetupWizard';
import type { ChatStreamEvent } from './gateway/types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'ws://127.0.0.1:18789';

const BP_MOBILE = 1024;
const BP_TABLET = 1440;

type PanelMode = 'inline' | 'overlay' | 'modal';

function usePanelMode(): PanelMode {
  const [mode, setMode] = useState<PanelMode>(() => {
    const w = window.innerWidth;
    if (w >= BP_TABLET) return 'inline';
    if (w >= BP_MOBILE) return 'overlay';
    return 'modal';
  });

  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth;
      if (w >= BP_TABLET) setMode('inline');
      else if (w >= BP_MOBILE) setMode('overlay');
      else setMode('modal');
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return mode;
}

const PANEL_TAB_ORDER: PanelTab[] = ['library', 'workspace', 'tasks', 'radar', 'settings'];

export default function App() {
  const { t } = useTranslation();
  const theme = useConfigStore((s) => s.theme);
  const setupComplete = useConfigStore((s) => s.setupComplete);
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const connect = useGatewayStore((s) => s.connect);
  const client = useGatewayStore((s) => s.client);
  const connState = useGatewayStore((s) => s.state);
  const handleChatEvent = useChatStore((s) => s.handleChatEvent);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const setAgentStatus = useUiStore((s) => s.setAgentStatus);
  const leftNavCollapsed = useUiStore((s) => s.leftNavCollapsed);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);
  const setRightPanelOpen = useUiStore((s) => s.setRightPanelOpen);
  const setLeftNavCollapsed = useUiStore((s) => s.setLeftNavCollapsed);

  const panelMode = usePanelMode();

  // Load persisted config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Auto-connect gateway when setup is complete
  useEffect(() => {
    if (setupComplete) {
      connect(GATEWAY_URL);
    }
  }, [setupComplete, connect]);

  // Subscribe to chat events
  useEffect(() => {
    if (!client) return;

    const unsubChat = client.subscribe('chat.message', (payload) => {
      handleChatEvent(payload as ChatStreamEvent);
    });

    const unsubAgent = client.subscribe('agent.status', (payload) => {
      const status = payload as { state?: string };
      if (status.state) {
        setAgentStatus(status.state as 'idle' | 'thinking' | 'tool_running' | 'streaming' | 'error');
      }
    });

    return () => {
      unsubChat();
      unsubAgent();
    };
  }, [client, handleChatEvent, setAgentStatus]);

  // Load history on connection
  useEffect(() => {
    if (connState === 'connected') {
      loadHistory();
      setAgentStatus('idle');
    } else if (connState === 'disconnected' || connState === 'reconnecting') {
      setAgentStatus('disconnected');
    }
  }, [connState, loadHistory, setAgentStatus]);

  // Responsive breakpoint listener
  const handleResize = useCallback(() => {
    const w = window.innerWidth;
    if (w < BP_MOBILE) {
      setLeftNavCollapsed(true);
      setRightPanelOpen(false);
    } else if (w < BP_TABLET) {
      // 2-column: right panel as overlay (managed by toggle), left nav stays
      setRightPanelOpen(false);
    }
  }, [setLeftNavCollapsed, setRightPanelOpen]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Keyboard shortcut: Ctrl+1-5 to switch panel tabs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          const tab = PANEL_TAB_ORDER[num - 1];
          setRightPanelTab(tab);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setRightPanelTab]);

  const antdTheme = getAntdThemeConfig(theme);

  if (!setupComplete) {
    return (
      <ConfigProvider theme={antdTheme}>
        <SetupWizard />
      </ConfigProvider>
    );
  }

  const leftNavWidth = leftNavCollapsed ? 56 : 240;
  const isInline = panelMode === 'inline';
  const showInlinePanel = isInline && rightPanelOpen;
  const showOverlayPanel = !isInline && rightPanelOpen;

  return (
    <ConfigProvider theme={antdTheme}>
      <div
        style={{
          height: '100vh',
          display: 'grid',
          gridTemplateRows: '48px 1fr 28px',
          gridTemplateColumns: `${leftNavWidth}px 1fr ${showInlinePanel ? `${rightPanelWidth}px` : '0px'}`,
          gridTemplateAreas: `
            "topbar topbar topbar"
            "leftnav chat rightpanel"
            "statusbar statusbar statusbar"
          `,
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
        <header style={{ gridArea: 'topbar' }}>
          <TopBar />
        </header>

        <aside
          role="navigation"
          aria-label={t('a11y.navigation')}
          style={{
            gridArea: 'leftnav',
            borderRight: '1px solid var(--border)',
            overflow: 'hidden',
            transition: 'width 0.2s ease',
          }}
        >
          <LeftNav />
        </aside>

        <main
          role="main"
          aria-label={t('a11y.mainContent')}
          style={{ gridArea: 'chat', overflow: 'hidden' }}
        >
          <ErrorBoundary>
            <Suspense fallback={<Spin style={{ margin: 'auto', display: 'block', paddingTop: '40vh' }} />}>
              <ChatView />
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Inline right panel (>= 1440px) */}
        <aside
          role="complementary"
          aria-label={t('a11y.sidePanel')}
          style={{
            gridArea: 'rightpanel',
            borderLeft: showInlinePanel ? '1px solid var(--border)' : 'none',
            overflow: 'hidden',
            transition: 'width 0.2s ease',
          }}
        >
          {showInlinePanel && (
            <ErrorBoundary>
              <Suspense fallback={<Spin style={{ margin: 'auto', display: 'block', paddingTop: '40vh' }} />}>
                <RightPanel />
              </Suspense>
            </ErrorBoundary>
          )}
        </aside>

        <footer style={{ gridArea: 'statusbar', borderTop: '1px solid var(--border)' }}>
          <StatusBar />
        </footer>
      </div>

      {/* Overlay/Modal right panel (< 1440px) */}
      {showOverlayPanel && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setRightPanelOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 900,
            }}
          />
          {/* Panel drawer */}
          <div
            role="complementary"
            aria-label={t('a11y.sidePanel')}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: panelMode === 'modal' ? '100%' : `${Math.min(rightPanelWidth, 480)}px`,
              background: 'var(--surface)',
              borderLeft: panelMode === 'modal' ? 'none' : '1px solid var(--border)',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'slideInRight 0.2s ease-out',
            }}
          >
            <ErrorBoundary>
              <Suspense fallback={<Spin style={{ margin: 'auto', display: 'block', paddingTop: '40vh' }} />}>
                <RightPanel />
              </Suspense>
            </ErrorBoundary>
          </div>
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}
    </ConfigProvider>
  );
}
