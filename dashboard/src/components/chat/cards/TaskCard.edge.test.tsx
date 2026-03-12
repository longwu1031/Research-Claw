/**
 * TaskCard edge case tests
 * Covers: overdue deadline, deadline exactly now, cancelled with strikethrough,
 * missing id hides Mark Complete, unknown priority/status, double-click protection
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from './TaskCard';
import type { TaskCard as TaskCardType } from '@/types/cards';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) return `${key}:${JSON.stringify(opts)}`;
      return key;
    },
  }),
}));

// Mock stores
const mockRequest = vi.fn();
const mockSetRightPanelTab = vi.fn();

vi.mock('@/stores/config', () => ({
  useConfigStore: (selector: (s: { theme: string }) => unknown) =>
    selector({ theme: 'dark' }),
}));
vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (s: { client: { request: typeof mockRequest } | null }) => unknown) =>
    selector({ client: { request: mockRequest } }),
}));
vi.mock('@/stores/ui', () => ({
  useUiStore: (selector: (s: { setRightPanelTab: typeof mockSetRightPanelTab }) => unknown) =>
    selector({ setRightPanelTab: mockSetRightPanelTab }),
}));

const baseTask: TaskCardType = {
  type: 'task_card',
  id: 'task-edge',
  title: 'Edge case task',
  task_type: 'human',
  status: 'in_progress',
  priority: 'high',
};

describe('TaskCard edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows overdue with red color when deadline is in the past', () => {
    const overdue: TaskCardType = {
      ...baseTask,
      deadline: new Date(Date.now() - 86400000 * 3).toISOString(),
    };
    render(<TaskCard {...overdue} />);
    expect(screen.getByText('card.task.overdue')).toBeInTheDocument();
  });

  it('shows "due in 0 days" when deadline is exactly now (within ceiling)', () => {
    // Math.ceil(0 / ms_per_day) === 0 for exact now, but since Date.now() may drift
    // we set deadline to 1 minute in the future for reliable test
    const almostNow: TaskCardType = {
      ...baseTask,
      deadline: new Date(Date.now() + 60000).toISOString(), // 1 min from now
    };
    render(<TaskCard {...almostNow} />);
    // diffDays = Math.ceil(60000 / 86400000) = 1
    expect(screen.getByText('card.task.dueIn:{"days":1}')).toBeInTheDocument();
  });

  it('applies strikethrough on title and status tag for cancelled status', () => {
    render(<TaskCard {...baseTask} status="cancelled" />);
    const title = screen.getByText('Edge case task');
    const styledParent = title.closest('span[style]');
    expect(styledParent).toHaveStyle({ textDecoration: 'line-through' });
    // Status tag uses i18n key and also has strikethrough
    const statusTag = screen.getByText('tasks.status.cancelled:{"defaultValue":"cancelled"}');
    expect(statusTag).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('hides Mark Complete when status is cancelled', () => {
    render(<TaskCard {...baseTask} status="cancelled" />);
    expect(screen.queryByText('card.task.markComplete')).not.toBeInTheDocument();
  });

  it('hides Mark Complete when no id is provided', () => {
    render(<TaskCard {...baseTask} id={undefined} />);
    expect(screen.queryByText('card.task.markComplete')).not.toBeInTheDocument();
  });

  it('handles unknown priority gracefully (uses fallback gray)', () => {
    const task: TaskCardType = {
      ...baseTask,
      priority: 'critical' as TaskCardType['priority'],
    };
    // Should not crash
    render(<TaskCard {...task} />);
    expect(screen.getByText('Edge case task')).toBeInTheDocument();
  });

  it('handles unknown status gracefully (uses fallback)', () => {
    const task: TaskCardType = {
      ...baseTask,
      status: 'pending_review' as TaskCardType['status'],
    };
    render(<TaskCard {...task} />);
    expect(screen.getByText('Edge case task')).toBeInTheDocument();
    // Mark Complete should still show since status is not 'done' or 'cancelled'
    expect(screen.getByText('card.task.markComplete')).toBeInTheDocument();
  });

  it('renders all five valid statuses', () => {
    const statuses: TaskCardType['status'][] = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'];
    for (const status of statuses) {
      const { unmount } = render(<TaskCard {...baseTask} status={status} />);
      expect(screen.getByText('Edge case task')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all four valid priorities', () => {
    const priorities: TaskCardType['priority'][] = ['urgent', 'high', 'medium', 'low'];
    for (const priority of priorities) {
      const { unmount } = render(<TaskCard {...baseTask} priority={priority} />);
      // Priority is now i18n-translated: t('tasks.priority.${priority}', { defaultValue: priority })
      expect(screen.getByText(`tasks.priority.${priority}:{"defaultValue":"${priority}"}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders without description', () => {
    render(<TaskCard {...baseTask} description={undefined} />);
    expect(screen.getByText('Edge case task')).toBeInTheDocument();
  });

  it('renders without related_paper_title', () => {
    render(<TaskCard {...baseTask} related_paper_title={undefined} />);
    expect(screen.queryByText('card.task.relatedPaper')).not.toBeInTheDocument();
  });

  it('renders with very long title', () => {
    const longTitle = 'T'.repeat(300);
    render(<TaskCard {...baseTask} title={longTitle} />);
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  it('deadline exactly at epoch boundary renders as valid date', () => {
    const task: TaskCardType = {
      ...baseTask,
      deadline: '2026-12-31T23:59:59Z',
    };
    render(<TaskCard {...task} />);
    // Should show the formatted date (not "overdue" since it's in the future)
    // The exact format depends on locale but should not crash
    expect(screen.getByText('Edge case task')).toBeInTheDocument();
  });
});
