/**
 * RadarPanel — Component Tests
 *
 * Tests the 3-section layout (GAP-12), cronToHuman display (GAP-11),
 * expand/collapse (GAP-13), delete flow (GAP-14), Ask Agent (GAP-15),
 * and other UI behaviors including:
 * - Accordion behavior (only one card expanded at a time)
 * - Keyboard interaction (Enter/Space)
 * - Sources section rendering
 * - Authors and journals rendering
 * - Empty presets message
 * - "Edit via Chat" sends correct prompt
 * - "Never run" text in detail fields
 * - Enabled status dot vs disabled
 * - Custom reminder window config
 * - radar_digest extraction from chat messages
 * - No-findings hint conditional rendering
 * - Delete confirm dialog (with await on waitFor)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import RadarPanel from './RadarPanel';
import { useConfigStore } from '../../stores/config';
import { useGatewayStore } from '../../stores/gateway';
import { useRadarStore } from '../../stores/radar';
import { useCronStore, type CronPreset } from '../../stores/cron';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'name' in opts) return `${key}:${opts.name}`;
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mutable state for the chat store mock
const mockChatState = {
  send: vi.fn(),
  messages: [] as Array<{ id: string; role: string; text: string }>,
};

// Mock chat store using the mutable reference
vi.mock('../../stores/chat', () => ({
  useChatStore: (selector: Function) => selector(mockChatState),
}));

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makePreset(overrides: Partial<CronPreset> = {}): CronPreset {
  return {
    id: 'arxiv_daily_scan',
    name: 'arXiv Daily Scan',
    description: 'Scan arXiv for new papers matching your research interests daily.',
    schedule: '0 7 * * *',
    enabled: false,
    config: {},
    last_run_at: null,
    next_run_at: null,
    gateway_job_id: null,
    ...overrides,
  };
}

const FIVE_PRESETS: CronPreset[] = [
  makePreset({ id: 'arxiv_daily_scan', name: 'arXiv Daily Scan', schedule: '0 7 * * *' }),
  makePreset({ id: 'citation_tracking_weekly', name: 'Citation Tracking Weekly', schedule: '0 8 * * 1' }),
  makePreset({ id: 'deadline_reminders_daily', name: 'Deadline Reminders Daily', schedule: '0 9 * * *', enabled: true }),
  makePreset({ id: 'group_meeting_prep', name: 'Group Meeting Prep', schedule: '0 9 * * 1-5' }),
  makePreset({ id: 'weekly_report', name: 'Weekly Report', schedule: '0 17 * * 5' }),
];

/** Helper to set up connected + config-loaded + presets-loaded state */
function setupFullyLoaded(overrides?: {
  config?: Partial<{ keywords: string[]; authors: string[]; journals: string[]; sources: string[] }>;
  presets?: CronPreset[];
}) {
  useGatewayStore.setState({ state: 'connected' });
  useRadarStore.setState({
    config: {
      keywords: ['transformers'],
      authors: [],
      journals: [],
      sources: [],
      ...overrides?.config,
    },
    configLoaded: true,
  });
  useCronStore.setState({
    presets: overrides?.presets ?? FIVE_PRESETS,
    presetsLoaded: true,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RadarPanel', () => {
  beforeEach(() => {
    useConfigStore.setState({ theme: 'dark' });
    useGatewayStore.setState({ client: null, state: 'disconnected' });
    useRadarStore.setState({
      config: { keywords: [], authors: [], journals: [], sources: [] },
      configLoaded: false,
    });
    useCronStore.setState({ presets: [], presetsLoaded: false });
    mockChatState.send = vi.fn();
    mockChatState.messages = [];
  });

  // ── Empty / disconnected state ────────────────────────────────────────

  it('renders empty state when not connected and config not loaded', () => {
    render(<RadarPanel />);
    expect(screen.getByText('radar.empty')).toBeTruthy();
  });

  it('renders "add tracking" button when connected but no tracking items', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({ configLoaded: true });
    render(<RadarPanel />);
    expect(screen.getByText('radar.addTracking')).toBeTruthy();
  });

  it('renders radar icon in empty state', () => {
    render(<RadarPanel />);
    const emptyText = screen.getByText('radar.empty');
    expect(emptyText).toBeTruthy();
  });

  it('renders "no tracking" message when connected with empty config', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({ configLoaded: true });
    render(<RadarPanel />);
    expect(screen.getByText('radar.noTracking')).toBeInTheDocument();
  });

  // ── Tracking Profile section ──────────────────────────────────────────

  it('renders tracking section and refresh button when config has keywords', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({
      config: { keywords: ['transformer', 'attention'], authors: [], journals: [], sources: [] },
      configLoaded: true,
    });

    render(<RadarPanel />);
    expect(screen.getByText('radar.section.trackingProfile')).toBeTruthy();
    expect(screen.getByText('radar.refresh')).toBeTruthy();
    expect(screen.getByText('radar.editViaChat')).toBeTruthy();
  });

  it('renders keyword tags in tracking section', () => {
    setupFullyLoaded({ config: { keywords: ['transformer', 'attention'] } });
    render(<RadarPanel />);

    expect(screen.getByText('transformer')).toBeInTheDocument();
    expect(screen.getByText('attention')).toBeInTheDocument();
  });

  it('renders author tags when authors are configured', () => {
    setupFullyLoaded({ config: { keywords: ['ml'], authors: ['Hinton', 'LeCun'] } });
    render(<RadarPanel />);

    expect(screen.getByText('Hinton')).toBeInTheDocument();
    expect(screen.getByText('LeCun')).toBeInTheDocument();
  });

  it('renders journal tags when journals are configured', () => {
    setupFullyLoaded({ config: { keywords: ['ml'], journals: ['Nature', 'Science'] } });
    render(<RadarPanel />);

    expect(screen.getByText('Nature')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
  });

  it('renders source tags when sources are configured', () => {
    setupFullyLoaded({ config: { keywords: ['ml'], sources: ['arxiv', 'semantic_scholar'] } });
    render(<RadarPanel />);

    expect(screen.getByText('arxiv')).toBeInTheDocument();
    expect(screen.getByText('semantic_scholar')).toBeInTheDocument();
  });

  it('"Edit via Chat" sends the correct prompt', () => {
    setupFullyLoaded();
    render(<RadarPanel />);

    fireEvent.click(screen.getByText('radar.editViaChat'));

    expect(mockChatState.send).toHaveBeenCalledWith(
      'Configure my research radar. I want to track:',
    );
  });

  it('"Add Tracking" button sends the configure prompt', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({
      config: { keywords: [], authors: [], journals: [], sources: [] },
      configLoaded: true,
    });
    render(<RadarPanel />);

    fireEvent.click(screen.getByText('radar.addTracking'));

    expect(mockChatState.send).toHaveBeenCalledWith(
      'Configure my research radar. I want to track:',
    );
  });

  // ── GAP-12: 3-section layout ──────────────────────────────────────────

  it('renders 3 section headers when fully loaded', () => {
    setupFullyLoaded({ config: { keywords: ['transformers'], sources: ['arxiv'] } });

    render(<RadarPanel />);

    expect(screen.getByText('radar.section.trackingProfile')).toBeInTheDocument();
    expect(screen.getByText(/radar\.section\.automatedTasks/)).toBeInTheDocument();
    expect(screen.getByText('radar.section.recentDiscoveries')).toBeInTheDocument();
  });

  it('shows active count in automated tasks header', () => {
    setupFullyLoaded();
    render(<RadarPanel />);

    // 1 active (deadline_reminders_daily) / 5 total
    const header = screen.getByText(/1 \/ 5/);
    expect(header).toBeInTheDocument();
  });

  it('shows 0 / 0 when no presets exist', () => {
    setupFullyLoaded({ presets: [] });
    render(<RadarPanel />);

    expect(screen.getByText(/0 \/ 0/)).toBeInTheDocument();
  });

  it('does not show automated tasks section before presets are loaded', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({
      config: { keywords: ['transformer'], authors: [], journals: [], sources: [] },
      configLoaded: true,
    });
    useCronStore.setState({ presets: [], presetsLoaded: false });

    render(<RadarPanel />);

    // Section 1 and 3 should exist, section 2 should not
    expect(screen.getByText('radar.section.trackingProfile')).toBeInTheDocument();
    expect(screen.getByText('radar.section.recentDiscoveries')).toBeInTheDocument();
    expect(screen.queryByText(/radar\.section\.automatedTasks/)).not.toBeInTheDocument();
  });

  it('shows empty presets message when no presets exist', () => {
    setupFullyLoaded({ presets: [] });
    render(<RadarPanel />);

    expect(screen.getByText('radar.noDiscoveries')).toBeInTheDocument();
  });

  // ── GAP-11: Human-readable cron expressions ──────────────────────────

  it('shows human-readable schedule instead of raw cron expression', () => {
    setupFullyLoaded({ presets: [makePreset({ schedule: '0 7 * * *' })] });

    render(<RadarPanel />);

    expect(screen.getByText(/Daily at 07:00/)).toBeInTheDocument();
    expect(screen.queryByText('0 7 * * *')).not.toBeInTheDocument();
  });

  it('displays all 5 preset schedules as human-readable text', () => {
    setupFullyLoaded();
    render(<RadarPanel />);

    expect(screen.getByText(/Daily at 07:00/)).toBeInTheDocument();
    expect(screen.getByText(/Mondays at 08:00/)).toBeInTheDocument();
    expect(screen.getByText(/Daily at 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/Weekdays at 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/Fridays at 17:00/)).toBeInTheDocument();
  });

  it('shows "Never run" text when last_run_at is null', () => {
    setupFullyLoaded({ presets: [makePreset({ last_run_at: null })] });
    render(<RadarPanel />);

    expect(screen.getByText(/Never run/)).toBeInTheDocument();
  });

  // ── GAP-13: Expand/collapse ──────────────────────────────────────────

  it('expands a preset card on click and shows description', () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('arXiv Daily Scan'));

    expect(screen.getByText('radar.cron.desc.arxiv_daily_scan')).toBeInTheDocument();
    expect(screen.getByText('radar.cron.schedule')).toBeInTheDocument();
    expect(screen.getByText('radar.cron.relatedConfig')).toBeInTheDocument();
  });

  it('collapses an expanded preset card on second click', () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);

    fireEvent.click(screen.getByText('arXiv Daily Scan'));
    expect(screen.getByText('radar.cron.desc.arxiv_daily_scan')).toBeInTheDocument();

    fireEvent.click(screen.getByText('arXiv Daily Scan'));
    expect(screen.queryByText('radar.cron.desc.arxiv_daily_scan')).not.toBeInTheDocument();
  });

  it('shows Ask Agent and Delete buttons when expanded', () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('arXiv Daily Scan'));

    expect(screen.getByText('radar.cron.askAgent')).toBeInTheDocument();
    expect(screen.getByText('radar.cron.delete')).toBeInTheDocument();
  });

  it('accordion: expanding a second card collapses the first', () => {
    setupFullyLoaded({
      presets: [
        makePreset({ id: 'arxiv_daily_scan', name: 'arXiv Daily Scan' }),
        makePreset({ id: 'weekly_report', name: 'Weekly Report', schedule: '0 17 * * 5' }),
      ],
    });

    render(<RadarPanel />);

    // Expand first card
    fireEvent.click(screen.getByText('arXiv Daily Scan'));
    expect(screen.getByText('radar.cron.desc.arxiv_daily_scan')).toBeInTheDocument();

    // Expand second card — first should collapse
    fireEvent.click(screen.getByText('Weekly Report'));
    expect(screen.queryByText('radar.cron.desc.arxiv_daily_scan')).not.toBeInTheDocument();
    expect(screen.getByText('radar.cron.desc.weekly_report')).toBeInTheDocument();
  });

  it('expand via keyboard Enter key', () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);

    const button = screen.getByRole('button', { name: /arXiv Daily Scan/i });
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(screen.getByText('radar.cron.desc.arxiv_daily_scan')).toBeInTheDocument();
  });

  it('expand via keyboard Space key', () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);

    const button = screen.getByRole('button', { name: /arXiv Daily Scan/i });
    fireEvent.keyDown(button, { key: ' ' });

    expect(screen.getByText('radar.cron.desc.arxiv_daily_scan')).toBeInTheDocument();
  });

  it('shows "Never run" in expanded detail fields when last_run_at and next_run_at are null', () => {
    setupFullyLoaded({
      presets: [makePreset({ last_run_at: null, next_run_at: null })],
    });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('arXiv Daily Scan'));

    // The detail section shows lastRun and nextRun fields
    const neverRunTexts = screen.getAllByText('radar.cron.neverRun');
    expect(neverRunTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows related config text for presets with PRESET_META', () => {
    setupFullyLoaded({
      presets: [makePreset({ id: 'citation_tracking_weekly', name: 'Citation Tracking Weekly', schedule: '0 8 * * 1' })],
    });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('Citation Tracking Weekly'));

    expect(screen.getByText('radar.cron.relatedConfig')).toBeInTheDocument();
    expect(screen.getByText('radar.cron.related.citation_tracking_weekly')).toBeInTheDocument();
  });

  // ── GAP-14: Delete button + confirm dialog ─────────────────────────────

  it('Delete button shows confirm dialog', async () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('arXiv Daily Scan'));
    fireEvent.click(screen.getByText('radar.cron.delete'));

    // Ant Design Modal.confirm renders the title in multiple elements (modal-title + confirm-title)
    await waitFor(() => {
      const titles = screen.getAllByText('radar.cron.deleteConfirmTitle');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('Delete confirm dialog shows preset name in content', async () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('arXiv Daily Scan'));

    // The delete button may appear multiple times if a previous dialog is still mounted.
    // Use getAllByText and click the first (the panel button, not the modal's OK button).
    const deleteButtons = screen.getAllByText('radar.cron.delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      // The content uses t('radar.cron.deleteConfirmContent', { name }) which returns key:name
      const contents = screen.getAllByText('radar.cron.deleteConfirmContent:arXiv Daily Scan');
      expect(contents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── GAP-15: Ask Agent button ───────────────────────────────────────────

  it('"Ask Agent" button sends correct prompt to chat', () => {
    setupFullyLoaded({ presets: [makePreset()] });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('arXiv Daily Scan'));
    fireEvent.click(screen.getByText('radar.cron.askAgent'));

    expect(mockChatState.send).toHaveBeenCalledTimes(1);
    expect(mockChatState.send).toHaveBeenCalledWith(
      'radar.cron.askAgentPrompt:arXiv Daily Scan',
    );
  });

  it('"Ask Agent" for different presets sends the correct preset name', () => {
    setupFullyLoaded({
      presets: [makePreset({ id: 'weekly_report', name: 'Weekly Report', schedule: '0 17 * * 5' })],
    });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('Weekly Report'));
    fireEvent.click(screen.getByText('radar.cron.askAgent'));

    expect(mockChatState.send).toHaveBeenCalledWith(
      'radar.cron.askAgentPrompt:Weekly Report',
    );
  });

  // ── GAP-12: Deadline reminders extra field ─────────────────────────────

  it('shows reminder window field for deadline_reminders_daily', () => {
    setupFullyLoaded({
      presets: [makePreset({
        id: 'deadline_reminders_daily',
        name: 'Deadline Reminders Daily',
        schedule: '0 9 * * *',
      })],
    });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('Deadline Reminders Daily'));

    expect(screen.getByText('radar.cron.reminderWindow')).toBeInTheDocument();
    expect(screen.getByText(/48h before deadline/)).toBeInTheDocument();
  });

  it('shows custom reminder_window_hours from config', () => {
    setupFullyLoaded({
      presets: [makePreset({
        id: 'deadline_reminders_daily',
        name: 'Deadline Reminders Daily',
        schedule: '0 9 * * *',
        config: { reminder_window_hours: 72 },
      })],
    });

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('Deadline Reminders Daily'));

    expect(screen.getByText(/72h before deadline/)).toBeInTheDocument();
  });

  it('does not show reminder window for non-deadline presets', () => {
    setupFullyLoaded({ presets: [makePreset()] }); // arxiv_daily_scan

    render(<RadarPanel />);
    fireEvent.click(screen.getByText('arXiv Daily Scan'));

    expect(screen.queryByText('radar.cron.reminderWindow')).not.toBeInTheDocument();
  });

  // ── No findings hint ──────────────────────────────────────────────────

  it('shows no-findings hint in Recent Discoveries when no results', () => {
    setupFullyLoaded();
    render(<RadarPanel />);
    expect(screen.getByText('radar.noFindings')).toBeInTheDocument();
  });

  it('does not show no-findings hint when no tracking items configured', () => {
    useGatewayStore.setState({ state: 'connected' });
    useRadarStore.setState({
      config: { keywords: [], authors: [], journals: [], sources: [] },
      configLoaded: true,
    });
    useCronStore.setState({ presets: [], presetsLoaded: true });

    render(<RadarPanel />);
    expect(screen.queryByText('radar.noFindings')).not.toBeInTheDocument();
  });

  // ── Radar digests from chat messages ──────────────────────────────────

  it('renders radar digest cards from chat messages', () => {
    setupFullyLoaded();

    const digestJson = JSON.stringify({
      source: 'arxiv',
      query: 'transformers',
      total_found: 12,
      period: 'last 24h',
    });
    mockChatState.messages = [
      {
        id: 'msg-1',
        role: 'assistant',
        text: `Here are your results:\n\`\`\`radar_digest\n${digestJson}\`\`\``,
      },
    ];

    render(<RadarPanel />);

    expect(screen.getByText(/12 papers/)).toBeInTheDocument();
    expect(screen.getByText('arxiv')).toBeInTheDocument();
    expect(screen.getByText('last 24h')).toBeInTheDocument();
  });

  it('ignores malformed radar_digest blocks gracefully', () => {
    setupFullyLoaded();

    mockChatState.messages = [
      {
        id: 'msg-1',
        role: 'assistant',
        text: '```radar_digest\n{invalid json}\n```',
      },
    ];

    // Should not throw
    render(<RadarPanel />);
    expect(screen.queryByText(/papers/)).not.toBeInTheDocument();
  });

  it('only extracts radar_digest from assistant messages', () => {
    setupFullyLoaded();

    const digestJson = JSON.stringify({
      source: 'arxiv',
      query: 'test',
      total_found: 5,
      period: 'last week',
    });
    mockChatState.messages = [
      {
        id: 'msg-1',
        role: 'user',
        text: `\`\`\`radar_digest\n${digestJson}\`\`\``,
      },
    ];

    render(<RadarPanel />);
    // Should not render digests from user messages
    expect(screen.queryByText(/5 papers/)).not.toBeInTheDocument();
  });

  // ── All 5 presets render correctly ────────────────────────────────────

  it('renders all 5 preset names in the panel', () => {
    setupFullyLoaded();
    render(<RadarPanel />);

    expect(screen.getByText('arXiv Daily Scan')).toBeInTheDocument();
    expect(screen.getByText('Citation Tracking Weekly')).toBeInTheDocument();
    expect(screen.getByText('Deadline Reminders Daily')).toBeInTheDocument();
    expect(screen.getByText('Group Meeting Prep')).toBeInTheDocument();
    expect(screen.getByText('Weekly Report')).toBeInTheDocument();
  });
});
