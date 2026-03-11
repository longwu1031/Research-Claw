import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Typography, Upload } from 'antd';
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
  PlusOutlined,
  EditOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGatewayStore } from '../../stores/gateway';
import { getThemeTokens } from '../../styles/theme';
import { useConfigStore } from '../../stores/config';

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

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- FileTree component ---

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  tokens: ReturnType<typeof getThemeTokens>;
}

function FileTreeNode({ node, depth, tokens }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const { icon, color } = getFileIcon(node.name, node.type, expanded);

  return (
    <div>
      <div
        onClick={() => node.type === 'directory' && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px 3px 0',
          paddingLeft: 8 + depth * 16,
          cursor: node.type === 'directory' ? 'pointer' : 'default',
          fontSize: 12,
          color: tokens.text.primary,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = tokens.bg.surfaceHover;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <span style={{ color, fontSize: 14, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        <GitBadge status={node.git_status} />
      </div>
      {expanded && node.children?.map((child) => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} tokens={tokens} />
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
              {relativeTime(commit.timestamp)}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkspacePanel() {
  const { t } = useTranslation();
  const configTheme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(configTheme), [configTheme]);
  const client = useGatewayStore((s) => s.client);

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!client?.isConnected) return;
    setLoading(true);
    try {
      const [treeResult, historyResult] = await Promise.all([
        client.request<{ tree: TreeNode[]; workspace_root: string }>('rc.ws.tree', { depth: 3 }),
        client.request<{ commits: CommitEntry[]; total: number; has_more: boolean }>('rc.ws.history', { limit: 5 }),
      ]);
      setTree(treeResult.tree);
      setCommits(historyResult.commits);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpload = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('destination', 'sources/');
      try {
        await fetch('/rc/upload', { method: 'POST', body: formData });
        loadData();
      } catch {
        // non-fatal
      }
      return false; // prevent ant Upload default behavior
    },
    [loadData],
  );

  // Empty state
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
          >
            <Button icon={<UploadOutlined />} size="small">
              {t('workspace.upload')}
            </Button>
          </Upload>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with upload */}
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Upload
          accept="*"
          showUploadList={false}
          beforeUpload={handleUpload}
        >
          <Button icon={<UploadOutlined />} size="small" type="text">
            {t('workspace.upload')}
          </Button>
        </Upload>
      </div>

      {/* Recent changes */}
      <RecentChanges commits={commits} tokens={tokens} />

      {/* Divider */}
      {commits.length > 0 && tree.length > 0 && (
        <div style={{ borderTop: `1px solid ${tokens.border.default}`, margin: '4px 16px' }} />
      )}

      {/* File tree */}
      {tree.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', paddingTop: 4 }}>
          <div style={{ padding: '0 16px 4px' }}>
            <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: tokens.text.muted }}>
              {t('workspace.fileTree')}
            </Text>
          </div>
          {tree.map((node) => (
            <FileTreeNode key={node.path} node={node} depth={0} tokens={tokens} />
          ))}
        </div>
      )}

      {/* Drag-drop zone at bottom */}
      <div style={{ padding: '8px 16px', borderTop: `1px solid ${tokens.border.default}` }}>
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
      </div>
    </div>
  );
}
