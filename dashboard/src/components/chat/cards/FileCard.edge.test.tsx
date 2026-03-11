/**
 * FileCard edge case tests
 * Covers: unknown file extension, no mime_type, very long file path,
 * zero-byte file, gigabyte-sized file, special chars in name
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FileCard from './FileCard';
import type { FileCard as FileCardType } from '@/types/cards';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/stores/config', () => ({
  useConfigStore: (selector: (s: { theme: string }) => unknown) =>
    selector({ theme: 'dark' }),
}));

describe('FileCard edge cases', () => {
  it('renders unknown file extension with generic icon', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'data.xyz123',
      path: '/workspace/data.xyz123',
    };
    render(<FileCard {...file} />);
    expect(screen.getByText('data.xyz123')).toBeInTheDocument();
    expect(screen.getByText('/workspace/data.xyz123')).toBeInTheDocument();
  });

  it('renders file with no extension', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'Makefile',
      path: '/workspace/Makefile',
    };
    render(<FileCard {...file} />);
    expect(screen.getByText('Makefile')).toBeInTheDocument();
  });

  it('renders without mime_type (hides type row)', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'data.bin',
      path: '/data.bin',
      size_bytes: 1024,
    };
    render(<FileCard {...file} />);
    expect(screen.queryByText('card.file.type')).not.toBeInTheDocument();
    // Size should still show
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });

  it('renders very long file path with word-break', () => {
    const longPath = '/workspace/' + 'deeply/nested/'.repeat(20) + 'file.py';
    const file: FileCardType = {
      type: 'file_card',
      name: 'file.py',
      path: longPath,
    };
    render(<FileCard {...file} />);
    expect(screen.getByText(longPath)).toBeInTheDocument();
  });

  it('renders zero-byte file', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'empty.txt',
      path: '/workspace/empty.txt',
      size_bytes: 0,
    };
    render(<FileCard {...file} />);
    expect(screen.getByText('0 B')).toBeInTheDocument();
  });

  it('renders gigabyte-sized file', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'model.bin',
      path: '/models/model.bin',
      size_bytes: 2.5 * 1024 * 1024 * 1024,
    };
    render(<FileCard {...file} />);
    expect(screen.getByText('2.5 GB')).toBeInTheDocument();
  });

  it('renders file with special characters in name', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'results (final-v2) [copy].csv',
      path: '/workspace/results (final-v2) [copy].csv',
    };
    render(<FileCard {...file} />);
    expect(screen.getByText('results (final-v2) [copy].csv')).toBeInTheDocument();
  });

  it('renders all known file type categories', () => {
    const testCases: { name: string; extension: string }[] = [
      { name: 'doc.pdf', extension: 'pdf' },
      { name: 'doc.tex', extension: 'tex' },
      { name: 'doc.md', extension: 'md' },
      { name: 'doc.txt', extension: 'txt' },
      { name: 'script.py', extension: 'py' },
      { name: 'script.r', extension: 'r' },
      { name: 'script.jl', extension: 'jl' },
      { name: 'data.csv', extension: 'csv' },
      { name: 'data.xlsx', extension: 'xlsx' },
      { name: 'data.json', extension: 'json' },
      { name: 'image.png', extension: 'png' },
      { name: 'image.jpg', extension: 'jpg' },
      { name: 'image.svg', extension: 'svg' },
      { name: 'refs.bib', extension: 'bib' },
      { name: 'unknown.xyz', extension: 'xyz' },
    ];

    for (const tc of testCases) {
      const { unmount } = render(
        <FileCard type="file_card" name={tc.name} path={`/workspace/${tc.name}`} />,
      );
      expect(screen.getByText(tc.name)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders without git_status (hides badge)', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'readme.md',
      path: '/readme.md',
    };
    render(<FileCard {...file} />);
    expect(screen.queryByText(/card\.file\.git/)).not.toBeInTheDocument();
  });

  it('renders action buttons (open and download)', () => {
    const file: FileCardType = {
      type: 'file_card',
      name: 'test.py',
      path: '/test.py',
    };
    render(<FileCard {...file} />);
    expect(screen.getByText('card.file.open')).toBeInTheDocument();
    expect(screen.getByText('card.file.download')).toBeInTheDocument();
  });
});
