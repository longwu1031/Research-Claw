import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Collapse, Segmented, Switch, Typography } from 'antd';
import { CheckSquareOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTasksStore, type Task, type TaskPriority } from '../../stores/tasks';
import { useGatewayStore } from '../../stores/gateway';
import { useChatStore } from '../../stores/chat';
import { getThemeTokens } from '../../styles/theme';
import { useConfigStore } from '../../stores/config';

const { Text } = Typography;

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#6B7280',
};

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function isWithinDays(deadline: string | null, days: number): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff < days * 24 * 60 * 60 * 1000;
}

function formatDeadline(deadline: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!deadline) return t('tasks.noDeadline');
  const d = new Date(deadline);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface TaskRowProps {
  task: Task;
  tokens: ReturnType<typeof getThemeTokens>;
}

function TaskRow({ task, tokens }: TaskRowProps) {
  const { t } = useTranslation();
  const completeTask = useTasksStore((s) => s.completeTask);
  const reopenTask = useTasksStore((s) => s.reopenTask);
  const send = useChatStore((s) => s.send);
  const priorityColor = PRIORITY_COLORS[task.priority];
  const overdue = isOverdue(task.deadline);
  const soonDue = isWithinDays(task.deadline, 3);
  const isDone = task.status === 'done' || task.status === 'cancelled';

  const handleCheck = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (isDone) {
      reopenTask(task.id);
    } else {
      completeTask(task.id);
    }
  };

  const handleClick = () => {
    send(`Show me details for task: ${task.title}`);
  };

  let deadlineColor = tokens.text.muted;
  if (overdue) deadlineColor = '#EF4444';
  else if (soonDue) deadlineColor = '#F59E0B';

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px 6px 0',
        cursor: 'pointer',
        borderLeft: `3px solid ${priorityColor}`,
        marginLeft: 16,
        paddingLeft: 12,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = tokens.bg.surfaceHover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <Checkbox
        checked={isDone}
        onChange={handleCheck}
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: isDone ? tokens.text.muted : tokens.text.primary,
            textDecoration: isDone ? 'line-through' : undefined,
          }}
          ellipsis
        >
          {task.title}
        </Text>
      </div>
      <Text style={{ fontSize: 11, color: deadlineColor, flexShrink: 0, fontFamily: "'Fira Code', monospace" }}>
        {formatDeadline(task.deadline, t)}
      </Text>
    </div>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color?: string }) {
  return (
    <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color }}>
        {title}
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        ({count})
      </Text>
    </div>
  );
}

export default function TaskPanel() {
  const { t } = useTranslation();
  const theme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(theme), [theme]);

  const tasks = useTasksStore((s) => s.tasks);
  const loading = useTasksStore((s) => s.loading);
  const perspective = useTasksStore((s) => s.perspective);
  const setPerspective = useTasksStore((s) => s.setPerspective);
  const showCompleted = useTasksStore((s) => s.showCompleted);
  const toggleCompleted = useTasksStore((s) => s.toggleCompleted);
  const loadTasks = useTasksStore((s) => s.loadTasks);
  const connState = useGatewayStore((s) => s.state);

  // Load tasks when gateway connection is established (or re-established)
  useEffect(() => {
    if (connState === 'connected') {
      console.log('[TaskPanel] connected → loading tasks');
      loadTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState]);

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perspective, showCompleted]);

  // Sort tasks into sections
  const sections = useMemo(() => {
    const now = new Date();
    const overdue: Task[] = [];
    const upcoming: Task[] = [];
    const noDeadline: Task[] = [];
    const completed: Task[] = [];

    for (const task of tasks) {
      if (task.status === 'done' || task.status === 'cancelled') {
        completed.push(task);
      } else if (task.deadline && new Date(task.deadline) < now) {
        overdue.push(task);
      } else if (task.deadline) {
        upcoming.push(task);
      } else {
        noDeadline.push(task);
      }
    }

    // Sort overdue: most overdue first (earliest deadline first)
    overdue.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    // Sort upcoming: soonest first
    upcoming.sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    // Sort no deadline: by priority
    const priorityWeight: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    noDeadline.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
    // Sort completed: most recent first
    completed.sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    });

    return { overdue, upcoming, noDeadline, completed };
  }, [tasks]);

  const activeCount = sections.overdue.length + sections.upcoming.length + sections.noDeadline.length;

  // Empty state
  if (!loading && tasks.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 60 }}>
        <CheckSquareOutlined style={{ fontSize: 48, color: tokens.text.muted, opacity: 0.4 }} />
        <div style={{ marginTop: 16, whiteSpace: 'pre-line' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('tasks.empty')}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Perspective toggle */}
      <div style={{ padding: '8px 16px' }}>
        <Segmented
          value={perspective}
          onChange={(v) => setPerspective(v as 'all' | 'human' | 'agent')}
          options={[
            { label: t('tasks.perspective.all'), value: 'all' },
            { label: t('tasks.perspective.human'), value: 'human' },
            { label: t('tasks.perspective.agent'), value: 'agent' },
          ]}
          block
          size="small"
        />
      </div>

      {/* Show completed toggle */}
      <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <Text style={{ fontSize: 12, color: tokens.text.muted }}>{t('tasks.showCompleted')}</Text>
        <Switch size="small" checked={showCompleted} onChange={() => toggleCompleted()} />
      </div>

      {/* Task sections */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Overdue */}
        {sections.overdue.length > 0 && (
          <div>
            <SectionHeader title={t('tasks.overdue')} count={sections.overdue.length} color="#EF4444" />
            {sections.overdue.map((task) => (
              <TaskRow key={task.id} task={task} tokens={tokens} />
            ))}
          </div>
        )}

        {/* Upcoming */}
        {sections.upcoming.length > 0 && (
          <div style={{ marginTop: sections.overdue.length > 0 ? 8 : 0 }}>
            <SectionHeader title={t('tasks.upcoming')} count={sections.upcoming.length} />
            {sections.upcoming.map((task) => (
              <TaskRow key={task.id} task={task} tokens={tokens} />
            ))}
          </div>
        )}

        {/* No Deadline */}
        {sections.noDeadline.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <SectionHeader title={t('tasks.noDeadline')} count={sections.noDeadline.length} />
            {sections.noDeadline.map((task) => (
              <TaskRow key={task.id} task={task} tokens={tokens} />
            ))}
          </div>
        )}

        {/* Completed (collapsible) */}
        {sections.completed.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Collapse
              ghost
              items={[
                {
                  key: 'completed',
                  label: (
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {t('tasks.completedCount', { count: sections.completed.length })}
                    </Text>
                  ),
                  children: sections.completed.map((task) => (
                    <TaskRow key={task.id} task={task} tokens={tokens} />
                  )),
                },
              ]}
            />
          </div>
        )}

        {/* No active tasks info */}
        {activeCount === 0 && sections.completed.length > 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('tasks.allDone')}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
