import React, { useEffect, useRef, useState } from 'react';
import { Typography, Spin } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { List as VirtualList, type ListImperativeAPI } from 'react-window';
import { useChatStore } from '../../stores/chat';
import type { ChatMessage } from '../../gateway/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const { Text } = Typography;

const VIRTUAL_SCROLL_THRESHOLD = 100;
const ESTIMATED_ROW_HEIGHT = 80;

interface VirtualRowProps {
  messages: ChatMessage[];
}

function VirtualRow(props: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
} & VirtualRowProps) {
  const { index, style, messages } = props;
  return (
    <div style={style}>
      <MessageBubble message={messages[index]} />
    </div>
  );
}

export default function ChatView() {
  const { t } = useTranslation();
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const streamText = useChatStore((s) => s.streamText);
  const sending = useChatStore((s) => s.sending);
  const lastError = useChatStore((s) => s.lastError);
  const clearError = useChatStore((s) => s.clearError);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const virtualRef = useRef<ListImperativeAPI>(null);

  const useVirtual = messages.length > VIRTUAL_SCROLL_THRESHOLD;

  // Measure container height for virtual scrolling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom (non-virtual mode)
  useEffect(() => {
    if (!useVirtual && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamText, useVirtual]);

  // Auto-scroll for virtual mode: scroll to last item
  useEffect(() => {
    if (useVirtual && virtualRef.current && messages.length > 0) {
      try {
        virtualRef.current.scrollToRow({ index: messages.length - 1, align: 'end' });
      } catch {
        // RangeError if index is invalid during transition
      }
    }
  }, [messages.length, useVirtual, virtualRef]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      {/* Message list */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: useVirtual ? 'hidden' : undefined,
        }}
      >
        {!useVirtual ? (
          <div
            ref={scrollRef}
            style={{
              height: '100%',
              overflow: 'auto',
              padding: '16px 24px',
            }}
          >
            {messages.length === 0 && !streaming && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 12,
                }}
              >
                <MessageOutlined
                  style={{ fontSize: 48, color: 'var(--text-tertiary)', opacity: 0.5 }}
                />
                <Text type="secondary">{t('chat.empty')}</Text>
              </div>
            )}

            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}

            {/* Streaming indicator */}
            {streaming && streamText && (
              <MessageBubble
                message={{ role: 'assistant', text: streamText, timestamp: Date.now() }}
                isStreaming
              />
            )}

            {/* Sending indicator */}
            {sending && (
              <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('chat.thinking')}
                </Text>
              </div>
            )}
          </div>
        ) : (
          <>
            <VirtualList
              listRef={virtualRef}
              rowComponent={VirtualRow}
              rowCount={messages.length}
              rowHeight={ESTIMATED_ROW_HEIGHT}
              rowProps={{ messages }}
              style={{ height: containerHeight }}
            />

            {/* Streaming indicator (outside virtual list) */}
            {streaming && streamText && (
              <div style={{ padding: '0 24px' }}>
                <MessageBubble
                  message={{ role: 'assistant', text: streamText, timestamp: Date.now() }}
                  isStreaming
                />
              </div>
            )}

            {/* Sending indicator */}
            {sending && (
              <div style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('chat.thinking')}
                </Text>
              </div>
            )}
          </>
        )}
      </div>

      {/* Error banner */}
      {lastError && (
        <div
          style={{
            padding: '8px 24px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderTop: '1px solid var(--error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: 'var(--error)', fontSize: 13 }}>{lastError}</Text>
          <button
            onClick={clearError}
            aria-label={t('chat.dismiss')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--error)',
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 4px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Input area */}
      <MessageInput />
    </div>
  );
}
