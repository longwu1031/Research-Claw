import React, { Component, type ErrorInfo } from 'react';
import { Button, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import i18n from '../i18n';

const { Text, Title } = Typography;

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI. If not provided, uses the default error card. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  handleToggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const t = (key: string): string => i18n.t(key) as string;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          gap: 12,
          minHeight: 200,
        }}
      >
        <WarningOutlined
          style={{ fontSize: 36, color: 'var(--warning, #F59E0B)' }}
        />
        <Title
          level={5}
          style={{ margin: 0, color: 'var(--text-primary, #E4E4E7)' }}
        >
          {t('error.title')}
        </Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" type="primary" onClick={this.handleRetry}>
            {t('error.retry')}
          </Button>
          <Button size="small" onClick={this.handleToggleDetails}>
            {t('error.details')}
          </Button>
        </div>
        {this.state.showDetails && this.state.error && (
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 6,
              background: 'var(--code-bg, #161618)',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
              color: 'var(--text-secondary, #A1A1AA)',
              fontSize: 12,
              fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
              maxHeight: 200,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxWidth: '100%',
            }}
          >
            {this.state.error.message}
            {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
          </pre>
        )}
      </div>
    );
  }
}
