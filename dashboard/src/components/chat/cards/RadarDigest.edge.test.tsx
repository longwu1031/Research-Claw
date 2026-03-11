/**
 * RadarDigest edge case tests
 * Covers: empty notable_papers, very long query, single paper,
 * large total_found, special characters in title/authors,
 * many notable_papers (10+)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RadarDigest from './RadarDigest';
import type { RadarDigest as RadarDigestType } from '@/types/cards';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) return `${key}:${JSON.stringify(opts)}`;
      return key;
    },
  }),
}));

vi.mock('@/stores/config', () => ({
  useConfigStore: (selector: (s: { theme: string }) => unknown) =>
    selector({ theme: 'dark' }),
}));

const baseDigest: RadarDigestType = {
  type: 'radar_digest',
  source: 'arxiv',
  query: 'test query',
  period: 'last 24h',
  total_found: 5,
  notable_papers: [],
};

describe('RadarDigest edge cases', () => {
  it('renders with zero total_found and empty notable_papers', () => {
    render(<RadarDigest {...baseDigest} total_found={0} notable_papers={[]} />);
    expect(screen.getByText('card.radar.title')).toBeInTheDocument();
    expect(screen.getByText('card.radar.found:{"count":0}')).toBeInTheDocument();
    expect(screen.queryByText('card.radar.notablePapers')).not.toBeInTheDocument();
  });

  it('renders with very long query string (200+ chars)', () => {
    const longQuery = 'Q'.repeat(250);
    render(<RadarDigest {...baseDigest} query={longQuery} />);
    expect(screen.getByText(new RegExp(longQuery))).toBeInTheDocument();
  });

  it('renders with large total_found value', () => {
    render(<RadarDigest {...baseDigest} total_found={999999} />);
    expect(screen.getByText('card.radar.found:{"count":999999}')).toBeInTheDocument();
  });

  it('renders single notable paper correctly', () => {
    const digest: RadarDigestType = {
      ...baseDigest,
      notable_papers: [
        {
          title: 'Single Paper Title',
          authors: ['Author A'],
          relevance_note: 'Very relevant',
        },
      ],
    };
    render(<RadarDigest {...digest} />);
    expect(screen.getByText('Single Paper Title')).toBeInTheDocument();
    expect(screen.getByText('Author A')).toBeInTheDocument();
  });

  it('renders 10+ notable papers without crash', () => {
    const papers = Array.from({ length: 12 }, (_, i) => ({
      title: `Paper ${i + 1}`,
      authors: [`Author ${i + 1}`],
      relevance_note: `Note ${i + 1}`,
    }));
    render(<RadarDigest {...baseDigest} notable_papers={papers} />);
    expect(screen.getByText('Paper 1')).toBeInTheDocument();
    expect(screen.getByText('Paper 12')).toBeInTheDocument();
  });

  it('handles special characters in paper title and authors', () => {
    const digest: RadarDigestType = {
      ...baseDigest,
      notable_papers: [
        {
          title: 'A "Review" of Methods & Approaches <2026>',
          authors: ["O'Brien, J.", 'Muller-Schmidt, K.'],
          relevance_note: 'Uses "novel" approach',
        },
      ],
    };
    render(<RadarDigest {...digest} />);
    expect(screen.getByText('A "Review" of Methods & Approaches <2026>')).toBeInTheDocument();
    expect(screen.getByText(/O'Brien, J., Muller-Schmidt, K./)).toBeInTheDocument();
  });

  it('renders with empty source string', () => {
    render(<RadarDigest {...baseDigest} source="" />);
    expect(screen.getByText('card.radar.title')).toBeInTheDocument();
  });

  it('renders with empty period string', () => {
    render(<RadarDigest {...baseDigest} period="" />);
    expect(screen.getByText('card.radar.title')).toBeInTheDocument();
  });

  it('renders paper with empty authors array', () => {
    const digest: RadarDigestType = {
      ...baseDigest,
      notable_papers: [
        {
          title: 'No Authors Paper',
          authors: [],
          relevance_note: 'Interesting',
        },
      ],
    };
    // authors.join(', ') on empty array produces empty string — should not crash
    render(<RadarDigest {...digest} />);
    expect(screen.getByText('No Authors Paper')).toBeInTheDocument();
  });

  it('renders paper with many authors (20+)', () => {
    const manyAuthors = Array.from({ length: 25 }, (_, i) => `Author ${i + 1}`);
    const digest: RadarDigestType = {
      ...baseDigest,
      notable_papers: [
        {
          title: 'Many Authors Paper',
          authors: manyAuthors,
          relevance_note: 'Collaboration',
        },
      ],
    };
    render(<RadarDigest {...digest} />);
    expect(screen.getByText('Many Authors Paper')).toBeInTheDocument();
    // Should contain at least first and last author
    expect(screen.getByText(new RegExp('Author 1'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp('Author 25'))).toBeInTheDocument();
  });
});
