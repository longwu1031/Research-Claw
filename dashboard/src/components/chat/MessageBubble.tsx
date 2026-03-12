import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../gateway/types';
import CodeBlock from './CodeBlock';

const { Text } = Typography;

/**
 * Strip context metadata injected by Research-Claw's before_prompt_build hook.
 * History messages from the gateway include lines like:
 *   [Research-Claw] Library: 0 papers (0 unread)
 *   [Thu 2026-03-12 10:25 GMT+8] actual message
 * We extract only the user's original text.
 */
function stripUserMetaPrefix(raw: string): string {
  const lines = raw.split('\n');
  const cleaned: string[] = [];
  for (const line of lines) {
    // Skip [Research-Claw] context lines
    if (/^\[Research-Claw\]/.test(line.trim())) continue;
    // Strip leading timestamp tag: [Thu 2026-03-12 10:25 GMT+8]
    const tsMatch = line.match(/^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+GMT[+-]\d+\]\s*(.*)/);
    if (tsMatch) {
      if (tsMatch[1].length > 0) cleaned.push(tsMatch[1]);
      continue;
    }
    // Skip empty lines that were between meta lines
    if (line.trim() === '' && cleaned.length === 0) continue;
    cleaned.push(line);
  }
  return cleaned.join('\n').trim();
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';

  const rawText =
    message.text ??
    (typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? message.content
            .filter((c) => c.type === 'text' && c.text)
            .map((c) => c.text!)
            .join('')
        : '');

  const text = isUser ? stripUserMetaPrefix(rawText) : rawText;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      {/* Role label */}
      <Text
        type="secondary"
        style={{
          fontSize: 11,
          marginBottom: 4,
          fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
        }}
      >
        {isUser ? t('chat.you') : t('chat.assistant')}
      </Text>

      {/* Message body */}
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? 'var(--surface-hover)' : 'var(--surface)',
          border: `1px solid ${isUser ? 'var(--border-hover)' : 'var(--border)'}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isUser ? (
          <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.6 }}>{text}</Text>
        ) : (
          <div
            style={{ fontSize: 14, lineHeight: 1.6, overflow: 'hidden', wordBreak: 'break-word' }}
            className="markdown-body"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        style={{
                          background: 'var(--surface-active)',
                          padding: '2px 4px',
                          borderRadius: 3,
                          fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                          fontSize: '0.9em',
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return <CodeBlock className={className}>{children}</CodeBlock>;
                },
                pre: ({ children }) => <>{children}</>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-secondary)' }}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        )}

        {/* Streaming cursor */}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 16,
              background: 'var(--accent-secondary)',
              marginLeft: 2,
              animation: 'blink 0.8s step-end infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>
    </div>
  );
}
