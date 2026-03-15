import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Dropdown, Modal, Spin, Typography, Upload } from 'antd';
import type { MenuProps } from 'antd';
import {
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  CodeOutlined,
  TableOutlined,
  PictureOutlined,
  BookOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  UploadOutlined,
  EditOutlined,
  InboxOutlined,
  ExportOutlined,
  FolderViewOutlined,
  CopyOutlined,
  DeleteOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGatewayStore } from '../../stores/gateway';
import { useUiStore } from '../../stores/ui';
import { getThemeTokens } from '../../styles/theme';
import { useConfigStore } from '../../stores/config';
import FilePreviewModal from './FilePreviewModal';

const { Text } = Typography;
const { Dragger } = Upload;

// --- Types from 03c §8 ---

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mime_type?: string;
  modified_at?: string;
  git_status?: 'new' | 'modified' | 'committed' | 'untracked';
}

interface TreeNode extends FileEntry {
  children?: TreeNode[];
}

interface CommitEntry {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  timestamp: string;
  files_changed: number;
}

// --- File icon helpers ---

function getFileIcon(name: string, type: 'file' | 'directory', isOpen?: boolean): { icon: React.ReactNode; color: string } {
  if (type === 'directory') {
    return { icon: isOpen ? <FolderOpenOutlined /> : <FolderOutlined />, color: '#71717A' };
  }
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf': return { icon: <FilePdfOutlined />, color: '#EF4444' };
    case 'tex': case 'md': case 'txt': return { icon: <FileTextOutlined />, color: '#A1A1AA' };
    case 'py': case 'r': case 'jl': case 'm': case 'ts': case 'js': return { icon: <CodeOutlined />, color: '#22C55E' };
    case 'csv': case 'xlsx': case 'json': return { icon: <TableOutlined />, color: '#3B82F6' };
    case 'png': case 'jpg': case 'jpeg': case 'svg': case 'gif': return { icon: <PictureOutlined />, color: '#A855F7' };
    case 'bib': return { icon: <BookOutlined />, color: '#F59E0B' };
    default: return { icon: <FileOutlined />, color: '#71717A' };
  }
}

function GitBadge({ status }: { status?: string }) {
  if (!status || status === 'committed') return null;
  const isNew = status === 'new' || status === 'untracked';
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: isNew ? '#22C55E' : '#3B82F6',
        marginLeft: 4,
        fontFamily: "'Fira Code', monospace",
      }}
    >
      {isNew ? '+' : 'M'}
    </span>
  );
}

function relativeTime(timestamp: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('time.daysAgo', { count: days });
}

// --- FileTree component ---

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  tokens: ReturnType<typeof getThemeTokens>;
  workspaceRoot: string;
  onOpenFile?: (path: string) => void;
  onDeleted?: () => void;
  onMoved?: () => void;
}

function FileTreeNode({ node, depth, tokens, workspaceRoot, onOpenFile, onDeleted, onMoved }: FileTreeNodeProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const client = useGatewayStore((s) => s.client);
  const [expanded, setExpanded] = useState(depth < 2);
  const [dragOver, setDragOver] = useState(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { icon, color } = getFileIcon(node.name, node.type, expanded);

  const contextMenuItems: MenuProps['items'] = useMemo(() => [
    {
      key: 'openExternal',
      icon: <ExportOutlined />,
      label: t('workspace.contextMenu.openExternal'),
      onClick: () => {
        client?.request('rc.ws.openExternal', { path: node.path }).catch(() => {
          message.error(t('workspace.contextMenu.openFailed'));
        });
      },
    },
    {
      key: 'openFolder',
      icon: <FolderViewOutlined />,
      label: t('workspace.contextMenu.openFolder'),
      onClick: () => {
        client?.request('rc.ws.openFolder', { path: node.path }).catch(() => {
          message.error(t('workspace.contextMenu.openFailed'));
        });
      },
    },
    { type: 'divider' as const },
    {
      key: 'copyPath',
      icon: <CopyOutlined />,
      label: t('workspace.contextMenu.copyPath'),
      onClick: () => {
        const absolutePath = workspaceRoot
          ? `${workspaceRoot.replace(/\/$/, '')}/${node.path}`
          : node.path;
        navigator.clipboard.writeText(absolutePath).then(() => {
          message.success(t('workspace.contextMenu.pathCopied'));
        });
      },
    },
    { type: 'divider' as const },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: t('workspace.contextMenu.delete'),
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: t('workspace.contextMenu.deleteConfirmTitle'),
          content: node.path,
          okText: t('workspace.contextMenu.deleteOk'),
          cancelText: t('workspace.contextMenu.deleteCancel'),
          okButtonProps: { danger: true },
          onOk: async () => {
            try {
              await client?.request('rc.ws.delete', { path: node.path });
              message.success(t('workspace.contextMenu.deleteSuccess'));
              onDeleted?.();
            } catch {
              message.error(t('workspace.contextMenu.deleteFailed'));
            }
          },
        });
      },
    },
  ], [node.path, t, client, workspaceRoot, onDeleted, message]);

  // --- Drag source: lightweight custom ghost image ---
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/x-workspace-path', node.path);
    e.dataTransfer.effectAllowed = 'move';
    // Create a small, unobtrusive drag ghost so it doesn't block drop targets
    const ghost = document.createElement('div');
    ghost.textContent = node.name;
    ghost.style.cssText =
      'position:fixed;top:-999px;left:-999px;padding:4px 10px;border-radius:4px;' +
      'font-size:12px;background:rgba(59,130,246,0.85);color:#fff;white-space:nowrap;' +
      'pointer-events:none;z-index:9999;max-width:200px;overflow:hidden;text-overflow:ellipsis';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    // Clean up the off-screen element after the browser captures it
    requestAnimationFrame(() => document.body.removeChild(ghost));
  }, [node.path, node.name]);

  // --- Drop target (directories only) + auto-expand on hover ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (node.type !== 'directory') return;
    if (!e.dataTransfer.types.includes('text/x-workspace-path')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOver) {
      setDragOver(true);
      // Auto-expand collapsed folder after 500ms hover
      if (!expanded) {
        expandTimerRef.current = setTimeout(() => setExpanded(true), 500);
      }
    }
  }, [node.type, dragOver, expanded]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    setDragOver(false);
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    if (node.type !== 'directory') return;
    e.preventDefault();

    const srcPath = e.dataTransfer.getData('text/x-workspace-path');
    if (!srcPath) return;

    // Don't drop onto own parent or into itself
    const srcDir = srcPath.includes('/') ? srcPath.substring(0, srcPath.lastIndexOf('/')) : '';
    if (srcDir === node.path || srcPath === node.path) return;

    const fileName = srcPath.includes('/') ? srcPath.substring(srcPath.lastIndexOf('/') + 1) : srcPath;
    const destPath = `${node.path}/${fileName}`;

    try {
      await client?.request('rc.ws.move', { from: srcPath, to: destPath });
      // Auto-expand the target folder so the user sees the moved file
      setExpanded(true);
      message.success(t('workspace.moveSuccess', { defaultValue: `Moved to ${node.name}` }));
      onMoved?.();
    } catch (err) {
      console.error('[WorkspacePanel] move failed:', err);
      message.error(t('workspace.moveFailed', { defaultValue: 'Move failed' }));
    }
  }, [node, client, t, message, onMoved]);

  return (
    <div>
      <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
        <div
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (node.type === 'directory') {
              setExpanded(!expanded);
            } else {
              onOpenFile?.(node.path);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px 3px 0',
            paddingLeft: 8 + depth * 16,
            cursor: 'pointer',
            fontSize: 12,
            color: tokens.text.primary,
            background: dragOver ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            borderRadius: dragOver ? 4 : 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!dragOver) (e.currentTarget as HTMLElement).style.background = tokens.bg.surfaceHover;
          }}
          onMouseLeave={(e) => {
            if (!dragOver) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <span style={{ color, fontSize: 14, flexShrink: 0 }}>{icon}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
          <GitBadge status={node.git_status} />
        </div>
      </Dropdown>
      {expanded && node.children?.map((child) => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} tokens={tokens} workspaceRoot={workspaceRoot} onOpenFile={onOpenFile} onDeleted={onDeleted} onMoved={onMoved} />
      ))}
    </div>
  );
}

// --- RecentChanges component ---

function RecentChanges({ commits, tokens }: { commits: CommitEntry[]; tokens: ReturnType<typeof getThemeTokens> }) {
  const { t } = useTranslation();

  if (commits.length === 0) return null;

  return (
    <div style={{ padding: '0 16px 8px' }}>
      <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
        {t('workspace.recentChanges')}
      </Text>
      <div style={{ marginTop: 6 }}>
        {commits.map((commit) => (
          <div
            key={commit.hash}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
              fontSize: 12,
            }}
          >
            <EditOutlined style={{ color: tokens.text.muted, fontSize: 12, flexShrink: 0 }} />
            <Text
              ellipsis
              style={{ flex: 1, fontSize: 12, color: tokens.text.primary }}
            >
              {commit.message}
            </Text>
            <Text style={{ fontSize: 11, color: tokens.text.muted, flexShrink: 0, fontFamily: "'Fira Code', monospace" }}>
              {relativeTime(commit.timestamp, t)}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkspacePanel() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const configTheme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(configTheme), [configTheme]);
  const client = useGatewayStore((s) => s.client);
  const connState = useGatewayStore((s) => s.state);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  // Auto-scroll file tree when dragging near top/bottom edges.
  // Uses requestAnimationFrame for smooth 60fps scrolling.
  const handleTreeDragOver = useCallback((e: React.DragEvent) => {
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const EDGE = 40; // px from edge to trigger scroll
    const SPEED = 6; // px per frame

    const y = e.clientY;
    const nearTop = y - rect.top < EDGE;
    const nearBottom = rect.bottom - y < EDGE;

    if (!nearTop && !nearBottom) {
      // Cursor in safe zone — stop scrolling
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      return;
    }

    // Already scrolling — let the rAF loop handle it
    if (scrollRafRef.current) return;

    const tick = () => {
      if (!scrollRef.current) return;
      if (nearTop) scrollRef.current.scrollTop -= SPEED;
      else scrollRef.current.scrollTop += SPEED;
      scrollRafRef.current = requestAnimationFrame(tick);
    };
    scrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  // Stop auto-scroll when drag leaves the tree area or ends
  const stopAutoScroll = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  // Clean up rAF on unmount
  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  const loadData = useCallback(async () => {
    if (!client?.isConnected) return;
    setLoading(true);
    try {
      console.log('[WorkspacePanel] loading tree & history');
      const [treeResult, historyResult] = await Promise.all([
        client.request<{ tree: TreeNode[]; workspace_root: string }>('rc.ws.tree', { depth: 3 }),
        client.request<{ commits: CommitEntry[]; total: number; has_more: boolean }>('rc.ws.history', { limit: 5 }),
      ]);
      setTree(treeResult.tree);
      setWorkspaceRoot(treeResult.workspace_root ?? '');
      setCommits(historyResult.commits);
      setHasLoaded(true);
    } catch (err) {
      console.warn('[WorkspacePanel] loadData failed:', err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  const workspaceRefreshKey = useUiStore((s) => s.workspaceRefreshKey);
  const pendingPreviewPath = useUiStore((s) => s.pendingPreviewPath);
  const clearPendingPreview = useUiStore((s) => s.clearPendingPreview);

  useEffect(() => {
    if (connState === 'connected') {
      loadData();
    }
  }, [connState, loadData]);

  useEffect(() => {
    if (workspaceRefreshKey > 0 && connState === 'connected') {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRefreshKey]);

  useEffect(() => {
    if (pendingPreviewPath) {
      setPreviewPath(pendingPreviewPath);
      clearPendingPreview();
    }
  }, [pendingPreviewPath, clearPendingPreview]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (uploading) return false;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('destination', 'uploads/');
        // Gateway HTTP routes with auth:'gateway' require a Bearer token.
        // Use the same token resolution as App.tsx:getGatewayToken().
        const token = new URLSearchParams(window.location.search).get('token') || 'research-claw';
        const res = await fetch('/rc/upload', {
          method: 'POST',
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
        }
        message.success(t('workspace.uploadSuccess'));
        await loadData();
        setTimeout(() => loadData(), 1000);
      } catch (err) {
        console.error('[WorkspacePanel] upload failed:', err);
        message.error(t('workspace.uploadFailed', { defaultValue: 'Upload failed' }));
      } finally {
        setUploading(false);
      }
      return false;
    },
    [uploading, loadData, t, message],
  );

  if (!hasLoaded && connState === 'connected' && tree.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 200 }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
      </div>
    );
  }

  if (!loading && tree.length === 0 && commits.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 60 }}>
        <FolderOutlined style={{ fontSize: 48, color: tokens.text.muted, opacity: 0.4 }} />
        <div style={{ marginTop: 16, whiteSpace: 'pre-line' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('workspace.empty')}
          </Text>
        </div>
        <div style={{ marginTop: 24 }}>
          <Upload
            accept="*"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={uploading}
          >
            <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />} size="small" loading={uploading}>
              {t('workspace.upload')}
            </Button>
          </Upload>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <RecentChanges commits={commits} tokens={tokens} />

      {commits.length > 0 && tree.length > 0 && (
        <div style={{ borderTop: `1px solid ${tokens.border.default}`, margin: '4px 16px' }} />
      )}

      {tree.length > 0 && (
        <div
          ref={scrollRef}
          onDragOver={handleTreeDragOver}
          onDragLeave={stopAutoScroll}
          onDrop={stopAutoScroll}
          onDragEnd={stopAutoScroll}
          style={{ flex: 1, overflow: 'auto', paddingTop: 4 }}
        >
          <div style={{ padding: '0 16px 4px' }}>
            <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
              {t('workspace.fileTree')}
            </Text>
          </div>
          {tree.map((node) => (
            <FileTreeNode key={node.path} node={node} depth={0} tokens={tokens} workspaceRoot={workspaceRoot} onOpenFile={setPreviewPath} onDeleted={loadData} onMoved={loadData} />
          ))}
        </div>
      )}

      {/* Upload drop zone — locked with loading state during upload */}
      <div style={{ padding: '8px 16px', borderTop: `1px solid ${tokens.border.default}` }}>
        {uploading ? (
          <div
            style={{
              padding: '12px 0',
              border: `1px dashed ${tokens.border.hover}`,
              borderRadius: 4,
              textAlign: 'center',
            }}
          >
            <LoadingOutlined style={{ fontSize: 16, color: tokens.text.muted, marginRight: 6 }} spin />
            <span style={{ color: tokens.text.muted, fontSize: 12 }}>
              {t('workspace.uploading', { defaultValue: 'Uploading...' })}
            </span>
          </div>
        ) : (
          <Dragger
            accept="*"
            showUploadList={false}
            beforeUpload={handleUpload}
            style={{ padding: '8px 0', border: `1px dashed ${tokens.border.hover}`, background: 'transparent' }}
          >
            <p style={{ color: tokens.text.muted, fontSize: 12, margin: 0 }}>
              <InboxOutlined style={{ fontSize: 16, marginRight: 4 }} />
              {t('workspace.dragDrop')}
            </p>
          </Dragger>
        )}
      </div>

      <FilePreviewModal
        open={previewPath !== null}
        filePath={previewPath}
        workspaceRoot={workspaceRoot}
        onClose={() => setPreviewPath(null)}
        onDeleted={loadData}
      />
    </div>
  );
}
