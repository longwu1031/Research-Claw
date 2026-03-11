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

const fullRadar: RadarDigestType = {
  type: 'radar_digest',
  source: 'arxiv',
  query: 'large language models',
  period: 'last 7 days',
  total_found: 42,
  notable_papers: [
    {
      title: 'Scaling Laws for Neural Language Models',
      authors: ['Kaplan, J.', 'McCandlish, S.'],
      relevance_note: 'Directly relevant to your scaling experiments',
    },
    {
      title: 'Chain-of-Thought Prompting',
      authors: ['Wei, J.', 'Wang, X.'],
      relevance_note: 'New prompting technique for reasoning tasks',
    },
  ],
};

describe('RadarDigest', () => {
  it('renders title', () => {
    render(<RadarDigest {...fullRadar} />);
    expect(screen.getByText('card.radar.title')).toBeInTheDocument();
  });

  it('renders summary with count', () => {
    render(<RadarDigest {...fullRadar} />);
    expect(screen.getByText('card.radar.found:{"count":42}')).toBeInTheDocument();
  });

  it('renders source as chip', () => {
    render(<RadarDigest {...fullRadar} />);
    expect(screen.getByText('arxiv')).toBeInTheDocument();
  });

  it('renders query', () => {
    render(<RadarDigest {...fullRadar} />);
    // The query is wrapped in quotes
    expect(screen.getByText(/large language models/)).toBeInTheDocument();
  });

  it('renders period', () => {
    render(<RadarDigest {...fullRadar} />);
    expect(screen.getByText('last 7 days')).toBeInTheDocument();
  });

  it('renders notable papers', () => {
    render(<RadarDigest {...fullRadar} />);
    expect(screen.getByText('Scaling Laws for Neural Language Models')).toBeInTheDocument();
    expect(screen.getByText('Chain-of-Thought Prompting')).toBeInTheDocument();
    expect(screen.getByText(/Kaplan, J., McCandlish, S./)).toBeInTheDocument();
    expect(screen.getByText(/Directly relevant to your scaling experiments/)).toBeInTheDocument();
  });

  it('handles empty notable_papers', () => {
    render(<RadarDigest {...fullRadar} notable_papers={[]} />);
    expect(screen.queryByText('card.radar.notablePapers')).not.toBeInTheDocument();
  });

  it('uses i18n keys for all labels', () => {
    render(<RadarDigest {...fullRadar} />);
    expect(screen.getByText(/card\.radar\.source/)).toBeInTheDocument();
    expect(screen.getByText(/card\.radar\.query/)).toBeInTheDocument();
    expect(screen.getByText(/card\.radar\.period/)).toBeInTheDocument();
    expect(screen.getByText(/card\.radar\.notablePapers/)).toBeInTheDocument();
  });
});
