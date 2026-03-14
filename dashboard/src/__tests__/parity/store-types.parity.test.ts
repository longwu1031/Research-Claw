/**
 * Behavioral Parity Tests: Store Type Alignment
 *
 * These tests verify that our dashboard type interfaces (Paper, Task) accept
 * the EXACT shapes returned by the Research-Claw Core plugin without any casts.
 *
 * Source references:
 *   - Paper: extensions/research-claw-core/src/literature/service.ts (lines 50-71)
 *   - Task: extensions/research-claw-core/src/tasks/service.ts (lines 25-41)
 *
 * The gateway sends `null` for empty nullable fields (not `undefined`).
 * Our interfaces MUST accept `null` for every field the plugin declares as `T | null`.
 */
import { describe, it, expect } from 'vitest';
import type { Paper, Tag } from '../../stores/library';
import type { Task } from '../../stores/tasks';
import {
  RC_LIT_LIST_RESPONSE,
  RC_LIT_TAGS_RESPONSE,
  RC_TASK_LIST_RESPONSE,
  RC_TASK_CREATE_RESPONSE,
  RC_TASK_COMPLETE_RESPONSE,
} from '../../__fixtures__/gateway-payloads/rpc-responses';

// ══════════════════════════════════════════════════════════════════════════
// Paper type parity
// ══════════════════════════════════════════════════════════════════════════

describe('Paper type parity with plugin (literature/service.ts:50-71)', () => {
  it('accepts a fully-populated Paper from rc.lit.list without casts', () => {
    // Source: literature/service.ts:50-71 — all fields present, non-null
    // This assignment MUST compile without `as any` or `as Paper`
    const paper: Paper = RC_LIT_LIST_RESPONSE.items[0];

    expect(paper.id).toBe('019523a4-7b2c-7e00-8d3f-1a2b3c4d5e6f');
    expect(paper.title).toBe('Attention Is All You Need');
    expect(paper.authors).toEqual(['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit']);
    expect(paper.abstract).toBe('The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.');
    expect(paper.doi).toBe('10.48550/arXiv.1706.03762');
    expect(paper.url).toBe('https://arxiv.org/abs/1706.03762');
    expect(paper.arxiv_id).toBe('1706.03762');
    expect(paper.pdf_path).toBe('/papers/attention-is-all-you-need.pdf');
    expect(paper.source).toBe('arxiv');
    expect(paper.source_id).toBe('1706.03762');
    expect(paper.venue).toBe('NeurIPS 2017');
    expect(paper.year).toBe(2017);
    expect(paper.added_at).toBe('2026-03-10T08:30:00.000Z');
    expect(paper.updated_at).toBe('2026-03-12T14:22:00.000Z');
    expect(paper.read_status).toBe('read');
    expect(paper.rating).toBe(5);
    expect(paper.notes).toBe('Foundational transformer paper. Key insight: self-attention replaces recurrence.');
    expect(paper.bibtex_key).toBe('vaswani2017attention');
    expect(paper.metadata).toEqual({ impact_factor: 'high', cited_by_count: 120000 });
    expect(paper.tags).toEqual(['transformers', 'NLP', 'deep-learning']);
  });

  it('accepts a Paper with null nullable fields (pdf_path, rating, notes)', () => {
    // Source: literature/service.ts:54-68 — many fields are `T | null`
    // The gateway sends JSON `null`, NOT missing/undefined
    const paper: Paper = RC_LIT_LIST_RESPONSE.items[1];

    expect(paper.pdf_path).toBeNull();
    expect(paper.rating).toBeNull();
    expect(paper.notes).toBeNull();
    // Non-null fields still present
    expect(paper.title).toBe('BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding');
    expect(paper.bibtex_key).toBe('devlin2019bert');
  });

  it('accepts a Paper with maximum null fields', () => {
    // Source: literature/service.ts:50-71 — third fixture has abstract, doi, venue, rating, notes, bibtex_key all null
    const paper: Paper = RC_LIT_LIST_RESPONSE.items[2];

    expect(paper.abstract).toBeNull();
    expect(paper.doi).toBeNull();
    expect(paper.venue).toBeNull();
    expect(paper.rating).toBeNull();
    expect(paper.notes).toBeNull();
    expect(paper.bibtex_key).toBeNull();
    expect(paper.pdf_path).toBeNull();
    // Non-nullable fields
    expect(paper.id).toBeTruthy();
    expect(paper.title).toBeTruthy();
    expect(paper.read_status).toBe('unread');
    expect(paper.metadata).toEqual({});
    expect(paper.tags).toEqual([]);
  });

  it('accepts the entire items array as Paper[]', () => {
    // This assignment MUST compile without `as any`
    const papers: Paper[] = RC_LIT_LIST_RESPONSE.items;
    expect(papers).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Tag type parity
// ══════════════════════════════════════════════════════════════════════════

describe('Tag type parity with plugin (literature/service.ts:82-88)', () => {
  it('accepts tags with null color field', () => {
    // Source: literature/service.ts:85 — color: string | null
    const tag: Tag = RC_LIT_TAGS_RESPONSE[3]; // pre-training tag has color: null
    expect(tag.color).toBeNull();
    expect(tag.name).toBe('pre-training');
  });

  it('accepts the entire tags array as Tag[]', () => {
    const tags: Tag[] = RC_LIT_TAGS_RESPONSE;
    expect(tags).toHaveLength(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Task type parity
// ══════════════════════════════════════════════════════════════════════════

describe('Task type parity with plugin (tasks/service.ts:25-41)', () => {
  it('accepts a fully-populated Task from rc.task.list without casts', () => {
    // Source: tasks/service.ts:25-41
    const task: Task = RC_TASK_LIST_RESPONSE.items[0];

    expect(task.id).toBe('task-001-uuid-placeholder');
    expect(task.title).toBe('Read Vaswani et al. 2017 — Attention Is All You Need');
    expect(task.description).toBe('Read the full paper and write a 2-page summary of key contributions.');
    expect(task.task_type).toBe('human');
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.deadline).toBe('2026-03-15T23:59:00.000Z');
    expect(task.completed_at).toBeNull();
    expect(task.parent_task_id).toBeNull();
    expect(task.related_paper_id).toBe('019523a4-7b2c-7e00-8d3f-1a2b3c4d5e6f');
    expect(task.agent_session_id).toBeNull();
    expect(task.tags).toEqual(['reading', 'literature-review']);
    expect(task.notes).toBeNull();
  });

  it('accepts a Task with null description and all nullable fields null', () => {
    // Source: tasks/service.ts:28 — description: string | null
    const task: Task = RC_TASK_LIST_RESPONSE.items[1];

    expect(task.description).toBeNull();
    expect(task.deadline).toBeNull();
    expect(task.completed_at).toBeNull();
    expect(task.parent_task_id).toBeNull();
    expect(task.related_paper_id).toBeNull();
    expect(task.notes).toBeNull();
    // Non-null fields
    expect(task.agent_session_id).toBe('agent:main:main');
  });

  it('accepts the entire items array as Task[]', () => {
    const tasks: Task[] = RC_TASK_LIST_RESPONSE.items;
    expect(tasks).toHaveLength(3);
  });

  it('accepts rc.task.create response as Task', () => {
    const task: Task = RC_TASK_CREATE_RESPONSE;
    expect(task.status).toBe('todo');
  });

  it('accepts rc.task.complete response as Task', () => {
    const task: Task = RC_TASK_COMPLETE_RESPONSE;
    expect(task.status).toBe('done');
    expect(task.completed_at).toBe('2026-03-14T15:30:00.000Z');
  });
});
