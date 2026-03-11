import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import LibraryPanel from './LibraryPanel';
import { useLibraryStore } from '../../stores/library';
import { useConfigStore } from '../../stores/config';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock react-window v2
vi.mock('react-window', () => ({
  List: ({ rowComponent: Row, rowCount, rowProps }: { rowComponent: Function; rowCount: number; rowProps: Record<string, unknown> }) => (
    <div data-testid="virtual-list">
      {Array.from({ length: Math.min(rowCount, 5) }, (_, i) =>
        Row({ index: i, style: {}, ariaAttributes: {}, ...rowProps }),
      )}
    </div>
  ),
}));

describe('LibraryPanel', () => {
  beforeEach(() => {
    // Reset store state
    useLibraryStore.setState({
      papers: [],
      tags: [],
      loading: false,
      total: 0,
      searchQuery: '',
      activeTab: 'pending',
      filters: {},
    });
    useConfigStore.setState({ theme: 'dark' });
  });

  it('renders empty state when no papers', () => {
    render(<LibraryPanel />);
    expect(screen.getByText('library.empty')).toBeTruthy();
  });

  it('renders papers when data available', () => {
    useLibraryStore.setState({
      papers: [
        {
          id: '1',
          title: 'Test Paper on Transformers',
          authors: ['Smith, J.', 'Lee, K.'],
          year: 2025,
          tags: ['nlp'],
          status: 'unread',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    render(<LibraryPanel />);
    expect(screen.getByText('Test Paper on Transformers')).toBeTruthy();
  });

  it('renders sub-tabs with counts', () => {
    useLibraryStore.setState({
      papers: [
        {
          id: '1',
          title: 'Paper 1',
          authors: [],
          year: 2025,
          tags: [],
          status: 'unread',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: '2',
          title: 'Paper 2',
          authors: [],
          year: 2025,
          tags: [],
          status: 'read',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      total: 2,
    });

    render(<LibraryPanel />);
    // Check sub-tab labels exist
    expect(screen.getByText(/library\.pending/)).toBeTruthy();
    expect(screen.getByText(/library\.saved/)).toBeTruthy();
  });

  it('renders search input', () => {
    useLibraryStore.setState({
      papers: [
        {
          id: '1',
          title: 'Paper',
          authors: [],
          year: 2025,
          tags: [],
          status: 'unread',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      total: 1,
    });

    render(<LibraryPanel />);
    const searchInput = screen.getByPlaceholderText('library.search');
    expect(searchInput).toBeTruthy();
  });
});
