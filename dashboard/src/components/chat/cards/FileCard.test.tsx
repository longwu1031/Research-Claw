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
vi.mock('@/stores/ui', () => ({
  useUiStore: {
    getState: () => ({
      requestWorkspacePreview: vi.fn(),
      setRightPanelTab: vi.fn(),
    }),
  },
}));

const fullFile: FileCardType = {
  type: 'file_card',
  name: 'analysis.py',
  path: '/workspace/scripts/analysis.py',
  size_bytes: 15360,
  mime_type: 'text/x-python',
  created_at: '2026-03-10T10:00:00Z',
  modified_at: '2026-03-11T14:30:00Z',
  git_status: 'modified',
};

describe('FileCard', () => {
  it('renders filename', () => {
    render(<FileCard {...fullFile} />);
    expect(screen.getByText('analysis.py')).toBeInTheDocument();
  });

  it('renders path', () => {
    render(<FileCard {...fullFile} />);
    expect(screen.getByText('/workspace/scripts/analysis.py')).toBeInTheDocument();
  });

  it('renders size in human-readable format', () => {
    render(<FileCard {...fullFile} />);
    expect(screen.getByText('15.0 KB')).toBeInTheDocument();
  });

  it('renders mime type', () => {
    render(<FileCard {...fullFile} />);
    expect(screen.getByText('text/x-python')).toBeInTheDocument();
  });

  it('renders git status badge for modified', () => {
    render(<FileCard {...fullFile} />);
    expect(screen.getByText(/card.file.gitModified/)).toBeInTheDocument();
  });

  it('renders git status badge for new', () => {
    render(<FileCard {...fullFile} git_status="new" />);
    expect(screen.getByText(/card.file.gitNew/)).toBeInTheDocument();
  });

  it('renders git status for committed', () => {
    render(<FileCard {...fullFile} git_status="committed" />);
    expect(screen.getByText('card.file.gitCommitted')).toBeInTheDocument();
  });

  it('handles missing optional fields', () => {
    const minimal: FileCardType = {
      type: 'file_card',
      name: 'readme.md',
      path: '/readme.md',
    };
    render(<FileCard {...minimal} />);
    expect(screen.getByText('readme.md')).toBeInTheDocument();
    expect(screen.getByText('/readme.md')).toBeInTheDocument();
  });

  it('hides size when not present', () => {
    render(<FileCard {...fullFile} size_bytes={undefined} />);
    expect(screen.queryByText('card.file.size')).not.toBeInTheDocument();
  });

  it('hides mime_type when not present', () => {
    render(<FileCard {...fullFile} mime_type={undefined} />);
    expect(screen.queryByText('card.file.type')).not.toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<FileCard {...fullFile} />);
    expect(screen.getByText('card.file.openFile')).toBeInTheDocument();
    expect(screen.getByText('card.file.openDir')).toBeInTheDocument();
  });

  it('renders PDF file with correct structure', () => {
    render(
      <FileCard
        type="file_card"
        name="paper.pdf"
        path="/docs/paper.pdf"
        size_bytes={1048576}
      />,
    );
    expect(screen.getByText('paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
  });

  it('uses i18n keys for labels', () => {
    render(<FileCard {...fullFile} />);
    expect(screen.getByText(/card\.file\.path/)).toBeInTheDocument();
    expect(screen.getByText(/card\.file\.size/)).toBeInTheDocument();
    expect(screen.getByText(/card\.file\.type/)).toBeInTheDocument();
  });
});
