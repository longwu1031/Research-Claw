// Verified against spec 01 §12 — shared card shell
import React from 'react';
import { useConfigStore } from '@/stores/config';
import { getThemeTokens } from '@/styles/theme';

interface CardContainerProps {
  children: React.ReactNode;
  borderColor?: string;
  maxWidth?: number;
}

export default function CardContainer({
  children,
  borderColor,
  maxWidth = 560,
}: CardContainerProps) {
  const theme = useConfigStore((s) => s.theme);
  const tokens = getThemeTokens(theme);

  return (
    <div
      data-testid="card-container"
      style={{
        background: tokens.bg.surface,
        border: `1px solid ${tokens.border.default}`,
        borderLeft: borderColor ? `3px solid ${borderColor}` : `1px solid ${tokens.border.default}`,
        borderRadius: 8,
        padding: 16,
        margin: '8px 0',
        maxWidth,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
