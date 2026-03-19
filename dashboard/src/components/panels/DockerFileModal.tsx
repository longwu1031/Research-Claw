/**
 * DockerFileModal — shown when openExternal/openFolder fails in Docker.
 * Displays the container path, offers file download, and hints about bind mounts.
 */

import React, { useCallback } from 'react';
import { Modal, Button, Typography, App } from 'antd';
import { CopyOutlined, DownloadOutlined, ContainerOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text, Paragraph } = Typography;

export interface DockerFileModalProps {
  open: boolean;
  onClose: () => void;
  /** 'file' for openExternal, 'folder' for openFolder */
  mode: 'file' | 'folder';
  containerPath: string;
  relativePath: string;
  fileName?: string;
}

/** Derive the gateway HTTP base URL from the current page location. */
function getGatewayHttpUrl(): string {
  const loc = window.location;
  if (loc.port === '5175') return 'http://127.0.0.1:28789';
  return loc.origin;
}

export default function DockerFileModal({
  open,
  onClose,
  mode,
  containerPath,
  relativePath,
  fileName,
}: DockerFileModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(containerPath).then(
      () => message.success(t('workspace.contextMenu.pathCopied')),
      () => message.error('Copy failed'),
    );
  }, [containerPath, message, t]);

  const handleDownload = useCallback(async () => {
    try {
      const base = getGatewayHttpUrl();
      const url = `${base}/rc/download?path=${encodeURIComponent(relativePath)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer research-claw` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = mode === 'folder'
        ? `${(relativePath.split('/').pop() || 'workspace')}.tar.gz`
        : (fileName || relativePath.split('/').pop() || 'download');
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      message.error('Download failed');
    }
  }, [relativePath, fileName, message]);

  const titleNode = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <ContainerOutlined style={{ color: '#faad14', fontSize: 18 }} />
      <span style={{ fontSize: 16, fontWeight: 600 }}>
        {t(mode === 'file' ? 'docker.openFile.title' : 'docker.openFolder.title')}
      </span>
    </span>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={titleNode}
      zIndex={1100}
      centered
      footer={
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
          {t(mode === 'file' ? 'docker.downloadFile' : 'docker.downloadFolder')}
        </Button>
      }
      width={520}
    >
      <Paragraph style={{ marginBottom: 16, fontSize: 14 }}>
        {t('docker.description')}
      </Paragraph>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'var(--color-bg-secondary, rgba(0,0,0,0.04))',
          marginBottom: 16,
        }}
      >
        <Text code style={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}>
          {containerPath}
        </Text>
        <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy} />
      </div>

      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
        {t('docker.bindMountHint')}
        <Text code style={{ display: 'block', marginTop: 6, fontSize: 12, whiteSpace: 'pre', lineHeight: 1.6 }}>
          {'volumes:\n  - ./workspace:/app/workspace'}
        </Text>
      </Paragraph>
    </Modal>
  );
}
