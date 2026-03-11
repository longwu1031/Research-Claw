import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TaskPanel from './TaskPanel';
import { useTasksStore } from '../../stores/tasks';
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

// Mock chat store
vi.mock('../../stores/chat', () => ({
  useChatStore: (selector: Function) => {
    const state = { send: vi.fn(), messages: [] };
    return selector(state);
  },
}));

describe('TaskPanel', () => {
  beforeEach(() => {
    useTasksStore.setState({
      tasks: [],
      loading: false,
      total: 0,
      perspective: 'all',
      showCompleted: false,
      sortBy: 'deadline',
    });
    useConfigStore.setState({ theme: 'dark' });
  });

  it('renders empty state when no tasks', () => {
    render(<TaskPanel />);
    expect(screen.getByText('tasks.empty')).toBeTruthy();
  });

  it('renders perspective toggle', () => {
    useTasksStore.setState({
      tasks: [
        {
          id: '1',
          title: 'Write introduction',
          description: null,
          task_type: 'human',
          status: 'todo',
          priority: 'high',
          deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
          completed_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          parent_task_id: null,
          related_paper_id: null,
          agent_session_id: null,
          tags: [],
          notes: null,
        },
      ],
      total: 1,
    });

    render(<TaskPanel />);
    expect(screen.getByText('tasks.perspective.all')).toBeTruthy();
    expect(screen.getByText('tasks.perspective.human')).toBeTruthy();
    expect(screen.getByText('tasks.perspective.agent')).toBeTruthy();
  });

  it('groups tasks into overdue and upcoming sections', () => {
    const pastDate = new Date(Date.now() - 86400000 * 2).toISOString();
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

    useTasksStore.setState({
      tasks: [
        {
          id: '1',
          title: 'Overdue task',
          description: null,
          task_type: 'human',
          status: 'todo',
          priority: 'urgent',
          deadline: pastDate,
          completed_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          parent_task_id: null,
          related_paper_id: null,
          agent_session_id: null,
          tags: [],
          notes: null,
        },
        {
          id: '2',
          title: 'Upcoming task',
          description: null,
          task_type: 'human',
          status: 'in_progress',
          priority: 'medium',
          deadline: futureDate,
          completed_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          parent_task_id: null,
          related_paper_id: null,
          agent_session_id: null,
          tags: [],
          notes: null,
        },
      ],
      total: 2,
    });

    render(<TaskPanel />);
    expect(screen.getByText('tasks.overdue')).toBeTruthy();
    expect(screen.getByText('tasks.upcoming')).toBeTruthy();
    expect(screen.getByText('Overdue task')).toBeTruthy();
    expect(screen.getByText('Upcoming task')).toBeTruthy();
  });

  it('renders completed tasks in collapsible section', () => {
    useTasksStore.setState({
      tasks: [
        {
          id: '1',
          title: 'Done task',
          description: null,
          task_type: 'human',
          status: 'done',
          priority: 'medium',
          deadline: null,
          completed_at: '2025-01-05T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-05T00:00:00Z',
          parent_task_id: null,
          related_paper_id: null,
          agent_session_id: null,
          tags: [],
          notes: null,
        },
      ],
      total: 1,
    });

    render(<TaskPanel />);
    // Completed section should be present
    expect(screen.getByText('tasks.completedCount:1')).toBeTruthy();
  });
});
