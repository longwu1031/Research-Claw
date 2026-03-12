import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, message, Popconfirm, Spin, Tag, Typography } from 'antd';
import {
  CloseOutlined,
  CopyOutlined,
  CheckOutlined,
  ExportOutlined,
  FolderViewOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { useGatewayStore } from '../../stores/gateway';
import { useConfigStore } from '../../stores/config';
import { getThemeTokens } from '../../styles/theme';
import { getHighlighter } from '../../utils/shiki-highlighter';

const { Text } = Typography;

// --- Types ---

interface FileReadResult {
  content: string;
  size: number;
  mime_type: string;
  git_status: 'new' | 'modified' | 'committed' | 'untracked';
  encoding: 'utf-8' | 'base64';
  modified_at: string;
}

interface FilePreviewModalProps {
  open: boolean;
  filePath: string | null;
  workspaceRoot: string;
  onClose: () => void;
  onDeleted?: () => void;
}

// --- MIME → Shiki language mapping ---

const MIME_TO_LANG: Record<string, string> = {
  'text/x-python': 'python',
  'application/json': 'json',
  'text/x-latex': 'latex',
  'text/x-r': 'r',
  'text/javascript': 'javascript',
  'text/typescript': 'typescript',
  'text/x-julia': 'julia',
  'text/x-matlab': 'matlab',
  'text/yaml': 'yaml',
  'text/x-toml': 'toml',
  'text/html': 'html',
  'text/css': 'css',
  'text/x-sql': 'sql',
  'text/x-c': 'c',
  'text/x-c++': 'cpp',
  'text/x-java': 'java',
  'text/x-go': 'go',
  'text/x-rust': 'rust',
  'text/x-shellscript': 'bash',
  'application/x-sh': 'bash',
};

function extToLang(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    py: 'python', json: 'json', tex: 'latex', r: 'r', js: 'javascript',
    ts: 'typescript', jl: 'julia', m: 'matlab', yaml: 'yaml', yml: 'yaml',
    toml: 'toml', html: 'html', css: 'css', sql: 'sql', c: 'c',
    cpp: 'cpp', java: 'java', go: 'go', rs: 'rust', sh: 'bash',
    bash: 'bash', md: 'markdown', bib: 'latex',
  };
  return ext ? map[ext] : undefined;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GitBadge({ status }: { status?: string }) {
  if (!status || status === 'committed') return null;
  const isNew = status === 'new' || status === 'untracked';
  return (
    <Tag color={isNew ? 'green' : 'blue'} style={{ fontSize: 10, lineHeight: '16px' }}>
      {isNew ? 'NEW' : 'MOD'}
    </Tag>
  );
}

// --- CSV parser + table renderer ---

function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line: string) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  return { headers: split(lines[0]), rows: lines.slice(1).map(split) };
}

function CsvTable({ content, tokens }: { content: string; tokens: ReturnType<typeof getThemeTokens> }) {
  const { headers, rows } = useMemo(() => parseCsv(content), [content]);
  if (headers.length === 0) return null;

  // Show max 200 rows in preview
  const displayRows = rows.slice(0, 200);

  return (
    <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
          fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: '6px 10px',
                  textAlign: 'left',
                  borderBottom: `2px solid ${tokens.border.default}`,
                  color: tokens.text.primary,
                  background: tokens.bg.surfaceHover,
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  top: 0,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '4px 10px',
                    borderBottom: `1px solid ${tokens.border.default}`,
                    color: tokens.text.secondary,
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && (
        <div style={{ padding: 8, fontSize: 11, color: tokens.text.muted, textAlign: 'center' }}>
          Showing 200 / {rows.length} rows
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export default function FilePreviewModal({ open, filePath, workspaceRoot, onClose, onDeleted }: FilePreviewModalProps) {
  const { t } = useTranslation();
  const configTheme = useConfigStore((s) => s.theme);
  const tokens = getThemeTokens(configTheme);
  const client = useGatewayStore((s) => s.client);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FileReadResult | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => clearTimeout(copyTimeoutRef.current);
  }, []);

  // Fetch file content when modal opens
  useEffect(() => {
    if (!open || !filePath || !client?.isConnected) {
      setData(null);
      setError(null);
      setHighlightedHtml(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setHighlightedHtml(null);

    client.request<FileReadResult>('rc.ws.read', { path: filePath })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not found') || msg.includes('NOT_FOUND')) {
          setError(t('workspace.preview.errorNotFound'));
        } else if (msg.includes('too large') || msg.includes('TOO_LARGE')) {
          setError(t('workspace.preview.errorTooLarge'));
        } else {
          setError(t('workspace.preview.errorGeneric'));
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filePath, client, t]);

  // Syntax highlight for code files (not markdown, image, pdf, csv, or binary)
  useEffect(() => {
    if (!data || !filePath) return;
    const mime = data.mime_type;
    const isMarkdown = mime === 'text/markdown' || mime === 'text/x-r-markdown';
    const isImage = mime.startsWith('image/');
    const isCsv = mime === 'text/csv' || mime === 'text/tab-separated-values';
    const isBinary = data.encoding === 'base64' && !isImage;

    if (isMarkdown || isImage || isCsv || isBinary) return;

    const lang = MIME_TO_LANG[mime] ?? extToLang(filePath) ?? 'text';
    let cancelled = false;

    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return;
        const resolvedLang = highlighter.getLoadedLanguages().includes(lang) ? lang : 'text';
        const html = highlighter.codeToHtml(data.content, {
          lang: resolvedLang,
          theme: configTheme === 'dark' ? 'github-dark' : 'github-light',
        });
        setHighlightedHtml(html);
      })
      .catch(() => { /* fallback: no highlight */ });

    return () => { cancelled = true; };
  }, [data, filePath, configTheme]);

  // --- Action handlers ---

  const absolutePath = useMemo(() => {
    if (!filePath) return '';
    return workspaceRoot
      ? `${workspaceRoot.replace(/\/$/, '')}/${filePath}`
      : filePath;
  }, [filePath, workspaceRoot]);

  const handleOpenFile = useCallback(() => {
    if (!filePath) return;
    client?.request('rc.ws.openExternal', { path: filePath }).catch(() => {
      message.error(t('workspace.contextMenu.openFailed'));
    });
  }, [filePath, client, t]);

  const handleOpenFolder = useCallback(() => {
    if (!filePath) return;
    client?.request('rc.ws.openFolder', { path: filePath }).catch(() => {
      message.error(t('workspace.contextMenu.openFailed'));
    });
  }, [filePath, client, t]);

  const handleCopyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(absolutePath);
      setCopied(true);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  }, [absolutePath]);

  const handleDelete = useCallback(async () => {
    if (!filePath || !client?.isConnected) return;
    setDeleting(true);
    try {
      await client.request('rc.ws.delete', { path: filePath });
      message.success(t('workspace.preview.deleteSuccess'));
      onDeleted?.();
      onClose();
    } catch {
      message.error(t('workspace.preview.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [filePath, client, t, onClose, onDeleted]);

  if (!open) return null;

  const filename = filePath?.split('/').pop() ?? '';
  const isText = data && data.encoding === 'utf-8';
  const isImage = data && data.mime_type.startsWith('image/');
  const isMarkdown = data && (data.mime_type === 'text/markdown' || data.mime_type === 'text/x-r-markdown');
  const isCsv = data && (data.mime_type === 'text/csv' || data.mime_type === 'text/tab-separated-values');
  const isBinary = data && data.encoding === 'base64' && !isImage;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(720px, 90vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: tokens.bg.primary,
          border: `1px solid ${tokens.border.default}`,
          borderRadius: 12,
          zIndex: 1001,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: `1px solid ${tokens.border.default}`,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Text strong style={{ fontSize: 14, display: 'block' }} ellipsis>
              {filename}
            </Text>
            {data && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 11, color: tokens.text.muted }}>{formatSize(data.size)}</Text>
                <Text style={{ fontSize: 11, color: tokens.text.muted }}>{data.mime_type}</Text>
                <GitBadge status={data.git_status} />
              </div>
            )}
          </div>
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {loading && (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Spin />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">{t('workspace.preview.loading')}</Text>
              </div>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Text type="danger">{error}</Text>
            </div>
          )}

          {/* Markdown */}
          {data && isMarkdown && (
            <div className="markdown-preview" style={{ fontSize: 14, lineHeight: 1.6, color: tokens.text.primary }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
            </div>
          )}

          {/* CSV table */}
          {data && isCsv && (
            <CsvTable content={data.content} tokens={tokens} />
          )}

          {/* Syntax highlighted code */}
          {data && isText && !isMarkdown && !isCsv && highlightedHtml && (
            <div
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              style={{
                padding: 12,
                overflow: 'auto',
                fontSize: 13,
                lineHeight: 1.5,
                background: tokens.bg.code,
                borderRadius: 8,
              }}
            />
          )}

          {/* Fallback plain text (no highlight yet) */}
          {data && isText && !isMarkdown && !isCsv && !highlightedHtml && (
            <pre
              style={{
                margin: 0,
                padding: 12,
                overflow: 'auto',
                fontSize: 13,
                fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                lineHeight: 1.5,
                background: tokens.bg.code,
                color: tokens.text.primary,
                borderRadius: 8,
              }}
            >
              <code>{data.content}</code>
            </pre>
          )}

          {/* Image */}
          {data && isImage && (
            <div style={{ textAlign: 'center' }}>
              <img
                src={`data:${data.mime_type};base64,${data.content}`}
                alt={filename}
                style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8 }}
              />
            </div>
          )}

          {/* Binary / non-renderable (PDF, Excel, docx, pptx, etc.) */}
          {data && isBinary && (
            <div style={{ textAlign: 'center', paddingTop: 40, paddingBottom: 24 }}>
              <div style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '24px 32px',
                borderRadius: 12,
                background: tokens.bg.surfaceHover,
                border: `1px solid ${tokens.border.default}`,
              }}>
                <div style={{ fontSize: 36, opacity: 0.5 }}>
                  {data.mime_type === 'application/pdf' ? '\u{1F4C4}' :
                   data.mime_type.includes('spreadsheet') || data.mime_type.includes('excel') ? '\u{1F4CA}' :
                   data.mime_type.includes('word') || data.mime_type.includes('document') ? '\u{1F4DD}' :
                   data.mime_type.includes('presentation') || data.mime_type.includes('powerpoint') ? '\u{1F4CA}' :
                   '\u{1F4CE}'}
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('workspace.preview.binaryNotPreviewable')}
                </Text>
                <Text style={{ fontSize: 11, color: tokens.text.muted }}>
                  {data.mime_type} · {formatSize(data.size)}
                </Text>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Open File | Open Folder | Copy Path | Delete */}
        {data && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '8px 16px',
              borderTop: `1px solid ${tokens.border.default}`,
              flexShrink: 0,
            }}
          >
            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={handleOpenFile}
            >
              {t('workspace.preview.openFile')}
            </Button>
            <Button
              size="small"
              icon={<FolderViewOutlined />}
              onClick={handleOpenFolder}
            >
              {t('workspace.preview.openFolder')}
            </Button>
            <Button
              size="small"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopyPath}
            >
              {copied ? t('workspace.contextMenu.pathCopied') : t('workspace.preview.copyPath')}
            </Button>
            <Popconfirm
              title={t('workspace.preview.deleteConfirm')}
              onConfirm={handleDelete}
              okText={t('workspace.preview.deleteOk')}
              cancelText={t('workspace.preview.deleteCancel')}
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deleting}
              >
                {t('workspace.preview.delete')}
              </Button>
            </Popconfirm>
          </div>
        )}
      </div>
    </>
  );
}
