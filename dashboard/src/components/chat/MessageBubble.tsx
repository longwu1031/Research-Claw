import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../gateway/types';
import CodeBlock from './CodeBlock';

const { Text } = Typography;

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';

  const text =
    message.text ??
    message.content
      ?.filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!)
      .join('') ??
    '';

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
        }}
      >
        {isUser ? (
          <Text style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{text}</Text>
        ) : (
          <div
            style={{ fontSize: 14, lineHeight: 1.6 }}
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
