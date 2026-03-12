import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Typography, Spin } from 'antd';
import { MessageOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/chat';
import type { ChatMessage } from '../../gateway/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const { Text } = Typography;

/** Distance (px) from bottom within which the user is considered "near bottom". Matches OpenClaw. */
const NEAR_BOTTOM_THRESHOLD = 450;

function extractVisibleText(msg: ChatMessage): string {
  if (msg.text) return msg.text;
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!)
      .join('');
  }
  return '';
}

export default function ChatView() {
  const { t } = useTranslation();
  const rawMessages = useChatStore((s) => s.messages);
  // Filter messages for display:
  // 1. Only show 'user' and 'assistant' roles (skip toolResult, etc.)
  // 2. Skip assistant messages with no visible text (tool-call-only turns)
  const messages = rawMessages.filter((m) => {
    if (m.role === 'user') return true;
    if (m.role !== 'assistant') return false;
    return extractVisibleText(m).trim().length > 0;
  });
  const streaming = useChatStore((s) => s.streaming);
  const streamText = useChatStore((s) => s.streamText);
  const sending = useChatStore((s) => s.sending);
  const lastError = useChatStore((s) => s.lastError);
  const clearError = useChatStore((s) => s.clearError);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Smart scroll state — refs to avoid re-renders on every scroll event
  const userNearBottomRef = useRef(true);
  const [newMessagesBelow, setNewMessagesBelow] = useState(false);

  // Scroll event handler — tracks whether user is near bottom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
    if (userNearBottomRef.current) {
      setNewMessagesBelow(false);
    }
  }, []);

  // Scroll to bottom — used by the "new messages" pill
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    userNearBottomRef.current = true;
    setNewMessagesBelow(false);
  }, []);

  // Smart auto-scroll: only scroll if user is near bottom
  useEffect(() => {
    if (scrollRef.current) {
      if (userNearBottomRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else if (streaming) {
        setNewMessagesBelow(true);
      }
    }
  }, [messages, streamText, streaming]);

  // Reset scroll tracking when a new session starts (messages cleared)
  useEffect(() => {
    if (messages.length === 0) {
      userNearBottomRef.current = true;
      setNewMessagesBelow(false);
    }
  }, [messages.length]);

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
        role="log"
        aria-live="polite"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
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
      </div>

      {/* "New messages below" pill — shown when user scrolls up during streaming */}
      {newMessagesBelow && (
        <div style={{ position: 'relative', height: 0, overflow: 'visible' }}>
          <button
            onClick={scrollToBottom}
            aria-label={t('chat.newMessages')}
            style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              background: 'var(--surface-hover, rgba(255,255,255,0.08))',
              border: '1px solid var(--border, rgba(255,255,255,0.1))',
              borderRadius: 9999,
              color: 'var(--text-secondary, #a1a1aa)',
              fontSize: 12,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'background 0.15s, color 0.15s',
              zIndex: 10,
            }}
          >
            <ArrowDownOutlined style={{ fontSize: 12 }} />
            {t('chat.newMessages')}
          </button>
        </div>
      )}

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
