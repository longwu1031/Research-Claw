/**
 * LiteratureService Unit Tests
 *
 * Comprehensive tests for the 26 RPC methods in the rc.lit.* namespace.
 * Each test uses a fresh in-memory SQLite database.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { createTestDb } from './setup.js';
import { LiteratureService, type PaperInput } from '../literature/service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePaper(overrides: Partial<PaperInput> = {}): PaperInput {
  return {
    title: 'Attention Is All You Need',
    authors: ['Vaswani, A.', 'Shazeer, N.'],
    abstract: 'The dominant sequence transduction models...',
    doi: '10.48550/arXiv.1706.03762',
    venue: 'NeurIPS',
    year: 2017,
    source: 'arxiv',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('LiteratureService', () => {
  let db: BetterSqlite3.Database;
  let svc: LiteratureService;

  beforeEach(() => {
    db = createTestDb();
    svc = new LiteratureService(db);
  });

  afterEach(() => {
    db.close();
  });

  // ── add ──────────────────────────────────────────────────────────────

  describe('add', () => {
    it('adds a paper with all fields and returns it', () => {
      const paper = svc.add(makePaper());
      expect(paper.id).toBeTruthy();
      expect(paper.title).toBe('Attention Is All You Need');
      expect(paper.authors).toEqual(['Vaswani, A.', 'Shazeer, N.']);
      expect(paper.doi).toBe('10.48550/arXiv.1706.03762');
      expect(paper.venue).toBe('NeurIPS');
      expect(paper.year).toBe(2017);
      expect(paper.read_status).toBe('unread');
      expect(paper.rating).toBeNull();
      expect(paper.added_at).toBeTruthy();
      expect(paper.updated_at).toBeTruthy();
      expect(paper.bibtex_key).toBeTruthy();
    });

    it('adds a minimal paper with only title', () => {
      const paper = svc.add({ title: 'Minimal Paper' });
      expect(paper.title).toBe('Minimal Paper');
      expect(paper.authors).toEqual([]);
      expect(paper.doi).toBeNull();
      expect(paper.read_status).toBe('unread');
    });

    it('generates a bibtex_key from author + year + title', () => {
      const paper = svc.add(makePaper({ bibtex_key: undefined }));
      expect(paper.bibtex_key).toMatch(/vaswani/i);
    });

    it('attaches tags when provided', () => {
      const paper = svc.add(makePaper({ tags: ['transformers', 'NLP'] }));
      expect(paper.tags).toContain('transformers');
      expect(paper.tags).toContain('nlp'); // normalized to lowercase
    });

    it('stores metadata as JSON', () => {
      const paper = svc.add(
        makePaper({ metadata: { venue_type: 'conference', impact: 99 } }),
      );
      expect(paper.metadata).toEqual({ venue_type: 'conference', impact: 99 });
    });
  });

  // ── duplicate detection ──────────────────────────────────────────────

  describe('duplicate detection on add', () => {
    it('returns existing paper with duplicate=true for same DOI', () => {
      const p1 = svc.add(makePaper());
      const p2 = svc.add(makePaper({ title: 'Different Title' })) as ReturnType<typeof svc.add>;
      expect((p2 as any).duplicate).toBe(true);
      expect(p2.id).toBe(p1.id);
    });

    it('returns existing paper with duplicate=true for same arxiv_id', () => {
      const p1 = svc.add(makePaper({ doi: undefined, arxiv_id: '1706.03762' }));
      const p2 = svc.add(
        makePaper({ doi: undefined, arxiv_id: '1706.03762', title: 'Duplicate' }),
      );
      expect((p2 as any).duplicate).toBe(true);
      expect(p2.id).toBe(p1.id);
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe('get', () => {
    it('retrieves a paper by ID', () => {
      const added = svc.add(makePaper());
      const paper = svc.get(added.id);
      expect(paper).not.toBeNull();
      expect(paper!.id).toBe(added.id);
      expect(paper!.title).toBe('Attention Is All You Need');
    });

    it('returns null for non-existent ID', () => {
      expect(svc.get('non-existent')).toBeNull();
    });

    it('returns null for soft-deleted paper', () => {
      const added = svc.add(makePaper());
      svc.delete(added.id);
      expect(svc.get(added.id)).toBeNull();
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe('list', () => {
    it('lists all papers with pagination', () => {
      for (let i = 0; i < 5; i++) {
        svc.add(makePaper({ doi: `10.1234/test-${i}`, title: `Paper ${i}` }));
      }
      const result = svc.list({ limit: 3 });
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(5);
    });

    it('filters by read_status', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/a' }));
      svc.add(makePaper({ doi: '10.1/b' }));
      svc.setStatus(p1.id, 'read');

      const result = svc.list({ filter: { read_status: 'read' } });
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe(p1.id);
    });

    it('filters by tag', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/a', tags: ['ml'] }));
      svc.add(makePaper({ doi: '10.1/b', tags: ['physics'] }));

      const result = svc.list({ filter: { tag: 'ml' } });
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe(p1.id);
    });

    it('filters by year', () => {
      svc.add(makePaper({ doi: '10.1/a', year: 2020 }));
      svc.add(makePaper({ doi: '10.1/b', year: 2023 }));

      const result = svc.list({ filter: { year: 2023 } });
      expect(result.total).toBe(1);
    });

    it('sorts by title ascending with + prefix', () => {
      svc.add(makePaper({ doi: '10.1/a', title: 'Zebra' }));
      svc.add(makePaper({ doi: '10.1/b', title: 'Alpha' }));

      const result = svc.list({ sort: '+title' });
      expect(result.items[0].title).toBe('Alpha');
    });

    it('excludes soft-deleted papers', () => {
      const p = svc.add(makePaper());
      svc.delete(p.id);
      const result = svc.list();
      expect(result.total).toBe(0);
    });
  });

  // ── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates selected fields', () => {
      const p = svc.add(makePaper());
      const updated = svc.update(p.id, { title: 'Updated Title', rating: 5 });
      expect(updated.title).toBe('Updated Title');
      expect(updated.rating).toBe(5);
      expect(updated.doi).toBe(p.doi); // unchanged
    });

    it('updates authors as JSON array', () => {
      const p = svc.add(makePaper());
      const updated = svc.update(p.id, { authors: ['New Author'] });
      expect(updated.authors).toEqual(['New Author']);
    });

    it('throws for non-existent paper', () => {
      expect(() => svc.update('bad-id', { title: 'x' })).toThrow('Paper not found');
    });

    it('throws for soft-deleted paper', () => {
      const p = svc.add(makePaper());
      svc.delete(p.id);
      expect(() => svc.update(p.id, { title: 'x' })).toThrow('Paper not found');
    });
  });

  // ── delete (soft delete) ─────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes a paper by setting metadata.deleted_at', () => {
      const p = svc.add(makePaper());
      svc.delete(p.id);

      // Direct DB query to confirm soft-delete marker
      const row = db
        .prepare('SELECT metadata FROM rc_papers WHERE id = ?')
        .get(p.id) as { metadata: string };
      const meta = JSON.parse(row.metadata);
      expect(meta.deleted_at).toBeTruthy();
    });

    it('throws for non-existent paper', () => {
      expect(() => svc.delete('bad-id')).toThrow('Paper not found');
    });

    it('throws for already-deleted paper', () => {
      const p = svc.add(makePaper());
      svc.delete(p.id);
      expect(() => svc.delete(p.id)).toThrow('Paper not found');
    });
  });

  // ── search (FTS5) ───────────────────────────────────────────────────

  describe('search', () => {
    it('finds papers by title via FTS5', () => {
      svc.add(makePaper({ doi: '10.1/a' }));
      svc.add(makePaper({ doi: '10.1/b', title: 'Convolutional Networks for Images' }));

      const result = svc.search('attention');
      expect(result.total).toBe(1);
      expect(result.items[0].title).toContain('Attention');
    });

    it('finds papers by abstract via FTS5', () => {
      svc.add(makePaper({ doi: '10.1/a', abstract: 'Transformers use self-attention mechanisms' }));
      svc.add(makePaper({ doi: '10.1/b', abstract: 'Image classification with CNNs' }));

      const result = svc.search('self-attention');
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for no match', () => {
      svc.add(makePaper());
      const result = svc.search('quantum-computing-does-not-exist-here');
      expect(result.total).toBe(0);
    });

    it('respects pagination', () => {
      for (let i = 0; i < 5; i++) {
        svc.add(makePaper({ doi: `10.1/${i}`, title: `Attention Paper ${i}` }));
      }
      const page1 = svc.search('attention', 2, 0);
      const page2 = svc.search('attention', 2, 2);
      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(2);
    });

    it('excludes soft-deleted papers', () => {
      const p = svc.add(makePaper());
      svc.delete(p.id);
      const result = svc.search('attention');
      expect(result.total).toBe(0);
    });
  });

  // ── duplicateCheck ──────────────────────────────────────────────────

  describe('duplicateCheck', () => {
    it('finds duplicate by DOI', () => {
      svc.add(makePaper());
      const matches = svc.duplicateCheck({ doi: '10.48550/arXiv.1706.03762' });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].match_type).toBe('doi_exact');
      expect(matches[0].confidence).toBe(1.0);
    });

    it('finds duplicate by arxiv_id', () => {
      svc.add(makePaper({ arxiv_id: '1706.03762' }));
      const matches = svc.duplicateCheck({ arxiv_id: '1706.03762' });
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches.some((m) => m.match_type === 'arxiv_exact')).toBe(true);
    });

    it('finds duplicate by exact title match', () => {
      svc.add(makePaper({ doi: undefined, arxiv_id: undefined }));
      const matches = svc.duplicateCheck({ title: 'Attention Is All You Need' });
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for no matches', () => {
      const matches = svc.duplicateCheck({ doi: '10.9999/does-not-exist' });
      expect(matches).toHaveLength(0);
    });
  });

  // ── setStatus ───────────────────────────────────────────────────────

  describe('setStatus', () => {
    it('changes paper read_status', () => {
      const p = svc.add(makePaper());
      const updated = svc.setStatus(p.id, 'reading');
      expect(updated.read_status).toBe('reading');
    });

    it('auto-starts reading session when set to reading', () => {
      const p = svc.add(makePaper());
      svc.setStatus(p.id, 'reading');

      const sessions = svc.listReadingSessions(p.id);
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions[0].ended_at).toBeNull();
    });

    it('throws for invalid status', () => {
      const p = svc.add(makePaper());
      expect(() => svc.setStatus(p.id, 'invalid')).toThrow('Invalid status');
    });

    it('throws for non-existent paper', () => {
      expect(() => svc.setStatus('bad-id', 'read')).toThrow('Paper not found');
    });
  });

  // ── rate ─────────────────────────────────────────────────────────────

  describe('rate', () => {
    it('sets paper rating', () => {
      const p = svc.add(makePaper());
      const updated = svc.rate(p.id, 4);
      expect(updated.rating).toBe(4);
    });

    it('rating=0 clears rating (unrate)', () => {
      const p = svc.add(makePaper());
      svc.rate(p.id, 4);
      const unrated = svc.rate(p.id, 0);
      expect(unrated.rating).toBeNull();
    });

    it('throws for rating out of range', () => {
      const p = svc.add(makePaper());
      expect(() => svc.rate(p.id, -1)).toThrow('Invalid rating');
      expect(() => svc.rate(p.id, 6)).toThrow('Invalid rating');
    });

    it('throws for non-integer rating', () => {
      const p = svc.add(makePaper());
      expect(() => svc.rate(p.id, 3.5)).toThrow('Invalid rating');
    });
  });

  // ── Tags CRUD ───────────────────────────────────────────────────────

  describe('tags', () => {
    it('adds a tag to a paper', () => {
      const p = svc.add(makePaper());
      const tags = svc.tag(p.id, 'transformers');
      expect(tags).toContain('transformers');
    });

    it('normalizes tag names to lowercase', () => {
      const p = svc.add(makePaper());
      svc.tag(p.id, 'NLP');
      const tags = svc.tag(p.id, 'nlp'); // should not duplicate
      expect(tags.filter((t) => t === 'nlp')).toHaveLength(1);
    });

    it('removes a tag from a paper', () => {
      const p = svc.add(makePaper({ tags: ['ml', 'nlp'] }));
      const tags = svc.untag(p.id, 'ml');
      expect(tags).not.toContain('ml');
      expect(tags).toContain('nlp');
    });

    it('getTags returns all tags with paper counts', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/a', tags: ['ml'] }));
      const p2 = svc.add(makePaper({ doi: '10.1/b', tags: ['ml', 'cv'] }));

      const allTags = svc.getTags();
      const mlTag = allTags.find((t) => t.name === 'ml');
      expect(mlTag).toBeDefined();
      expect(mlTag!.paper_count).toBe(2);
    });

    it('untag with non-existent tag is a no-op', () => {
      const p = svc.add(makePaper());
      const tags = svc.untag(p.id, 'nonexistent');
      expect(tags).toEqual([]);
    });
  });

  // ── Reading sessions ────────────────────────────────────────────────

  describe('reading sessions', () => {
    it('starts a reading session', () => {
      const p = svc.add(makePaper());
      const session = svc.startReading(p.id);
      expect(session.id).toBeTruthy();
      expect(session.paper_id).toBe(p.id);
      expect(session.started_at).toBeTruthy();
      expect(session.ended_at).toBeNull();
    });

    it('ends a reading session with duration', () => {
      const p = svc.add(makePaper());
      const session = svc.startReading(p.id);
      const ended = svc.endReading(session.id, 'Great paper', 10);
      expect(ended.ended_at).toBeTruthy();
      expect(ended.duration_minutes).toBeTypeOf('number');
      expect(ended.notes).toBe('Great paper');
      expect(ended.pages_read).toBe(10);
    });

    it('auto-closes existing active sessions when starting a new one', () => {
      const p = svc.add(makePaper());
      const session1 = svc.startReading(p.id);
      const session2 = svc.startReading(p.id);

      // session1 should now be closed
      const sessions = svc.listReadingSessions(p.id);
      const closedSession = sessions.find((s) => s.id === session1.id);
      expect(closedSession?.ended_at).toBeTruthy();
      expect(session2.ended_at).toBeNull();
    });

    it('throws when ending an already-ended session', () => {
      const p = svc.add(makePaper());
      const session = svc.startReading(p.id);
      svc.endReading(session.id);
      expect(() => svc.endReading(session.id)).toThrow('already ended');
    });

    it('lists reading sessions for a paper', () => {
      const p = svc.add(makePaper());
      svc.startReading(p.id);
      const sessions = svc.listReadingSessions(p.id);
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });

    it('updates paper status to reading when starting from unread', () => {
      const p = svc.add(makePaper());
      expect(p.read_status).toBe('unread');
      svc.startReading(p.id);
      const updated = svc.get(p.id)!;
      expect(updated.read_status).toBe('reading');
    });
  });

  // ── Citations ───────────────────────────────────────────────────────

  describe('citations', () => {
    it('adds a citation between two papers', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/citing' }));
      const p2 = svc.add(makePaper({ doi: '10.1/cited', title: 'Cited Paper' }));

      const citation = svc.addCitation(p1.id, p2.id, 'Section 2 reference', 'methods');
      expect(citation.citing_paper_id).toBe(p1.id);
      expect(citation.cited_paper_id).toBe(p2.id);
      expect(citation.context).toBe('Section 2 reference');
      expect(citation.section).toBe('methods');
    });

    it('prevents self-citation', () => {
      const p = svc.add(makePaper());
      expect(() => svc.addCitation(p.id, p.id)).toThrow('cannot cite itself');
    });

    it('getCitations returns citing papers', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/citing' }));
      const p2 = svc.add(makePaper({ doi: '10.1/cited', title: 'Cited Paper' }));
      svc.addCitation(p1.id, p2.id);

      const result = svc.getCitations(p1.id, 'citing');
      expect(result.citing).toHaveLength(1);
      expect(result.cited_by).toHaveLength(0);
    });

    it('getCitations returns cited_by papers', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/citing' }));
      const p2 = svc.add(makePaper({ doi: '10.1/cited', title: 'Cited Paper' }));
      svc.addCitation(p1.id, p2.id);

      const result = svc.getCitations(p2.id, 'cited_by');
      expect(result.cited_by).toHaveLength(1);
    });

    it('getCitations returns both directions', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/a' }));
      const p2 = svc.add(makePaper({ doi: '10.1/b', title: 'B' }));
      const p3 = svc.add(makePaper({ doi: '10.1/c', title: 'C' }));
      svc.addCitation(p1.id, p2.id);
      svc.addCitation(p3.id, p1.id);

      const result = svc.getCitations(p1.id, 'both');
      expect(result.citing).toHaveLength(1);
      expect(result.cited_by).toHaveLength(1);
    });
  });

  // ── Stats ───────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns correct stats for an empty library', () => {
      const stats = svc.getStats();
      expect(stats.total).toBe(0);
      expect(stats.total_tags).toBe(0);
      expect(stats.total_reading_minutes).toBe(0);
      expect(stats.papers_with_pdf).toBe(0);
      expect(stats.average_rating).toBeNull();
    });

    it('returns correct breakdown by status', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/a' }));
      const p2 = svc.add(makePaper({ doi: '10.1/b' }));
      svc.setStatus(p1.id, 'read');

      const stats = svc.getStats();
      expect(stats.total).toBe(2);
      expect(stats.by_status['read']).toBe(1);
      expect(stats.by_status['unread']).toBe(1);
    });

    it('computes average rating', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/a' }));
      const p2 = svc.add(makePaper({ doi: '10.1/b' }));
      svc.rate(p1.id, 4);
      svc.rate(p2.id, 2);

      const stats = svc.getStats();
      expect(stats.average_rating).toBe(3);
    });

    it('counts papers with PDF', () => {
      svc.add(makePaper({ doi: '10.1/a', pdf_path: '/tmp/paper.pdf' }));
      svc.add(makePaper({ doi: '10.1/b' })); // no pdf

      const stats = svc.getStats();
      expect(stats.papers_with_pdf).toBe(1);
    });
  });

  // ── batchAdd ────────────────────────────────────────────────────────

  describe('batchAdd', () => {
    it('adds multiple papers at once', () => {
      const papers: PaperInput[] = [
        makePaper({ doi: '10.1/a', title: 'Paper A' }),
        makePaper({ doi: '10.1/b', title: 'Paper B' }),
        makePaper({ doi: '10.1/c', title: 'Paper C' }),
      ];
      const result = svc.batchAdd(papers);
      expect(result.added).toHaveLength(3);
      expect(result.duplicates).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('reports duplicates in batch', () => {
      svc.add(makePaper({ doi: '10.1/existing' }));

      const papers: PaperInput[] = [
        makePaper({ doi: '10.1/existing', title: 'Duplicate' }),
        makePaper({ doi: '10.1/new', title: 'New Paper' }),
      ];
      const result = svc.batchAdd(papers);
      expect(result.added).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
    });

    it('rejects batches exceeding MAX_BATCH_SIZE', () => {
      const papers: PaperInput[] = Array.from({ length: 101 }, (_, i) => ({
        title: `Paper ${i}`,
      }));
      expect(() => svc.batchAdd(papers)).toThrow('Batch size exceeds limit');
    });
  });

  // ── BibTeX import/export ────────────────────────────────────────────

  describe('BibTeX', () => {
    const sampleBibtex = `@article{vaswani2017attention,
  title = {Attention Is All You Need},
  author = {Vaswani, Ashish and Shazeer, Noam},
  journal = {NeurIPS},
  year = {2017},
  doi = {10.48550/arXiv.1706.03762}
}

@inproceedings{devlin2019bert,
  title = {BERT: Pre-training of Deep Bidirectional Transformers},
  author = {Devlin, Jacob and Chang, Ming-Wei},
  booktitle = {NAACL-HLT},
  year = {2019}
}`;

    it('importBibtex parses and adds papers', () => {
      const result = svc.importBibtex(sampleBibtex);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('importBibtex skips duplicates (DOI-based)', () => {
      // First import: both entries are new
      const first = svc.importBibtex(sampleBibtex);
      expect(first.imported).toBe(2);

      // Second import: DOI entry caught by DOI dedup, non-DOI entry
      // caught by title-based dedup — nothing should be imported.
      const result = svc.importBibtex(sampleBibtex);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(2);
    });

    it('exportBibtex generates valid BibTeX', () => {
      const p = svc.add(makePaper());
      const result = svc.exportBibtex({ paperIds: [p.id] });
      expect(result.count).toBe(1);
      expect(result.bibtex).toContain('@');
      expect(result.bibtex).toContain('Attention Is All You Need');
    });

    it('exportBibtex with all=true exports all papers', () => {
      svc.add(makePaper({ doi: '10.1/a' }));
      svc.add(makePaper({ doi: '10.1/b', title: 'Paper B' }));
      const result = svc.exportBibtex({ all: true });
      expect(result.count).toBe(2);
    });

    it('exportBibtex with tag filter', () => {
      const p1 = svc.add(makePaper({ doi: '10.1/a', tags: ['ml'] }));
      svc.add(makePaper({ doi: '10.1/b', title: 'No tag' }));

      const result = svc.exportBibtex({ tag: 'ml' });
      expect(result.count).toBe(1);
    });

    it('handles BibTeX with nested braces', () => {
      const complexBibtex = `@article{test2023,
  title = {A {Framework} for {Deep Learning}},
  author = {Test Author},
  year = {2023}
}`;
      const result = svc.importBibtex(complexBibtex);
      expect(result.imported).toBe(1);
    });
  });

  // ── Collections ─────────────────────────────────────────────────────

  describe('collections', () => {
    it('creates a collection', () => {
      const result = svc.manageCollection('create', {
        name: 'Survey Papers',
        description: 'Papers for the survey',
        color: '#FF0000',
      });
      expect(result.action).toBe('create');
      expect(result.id).toBeTruthy();
    });

    it('lists collections with paper counts', () => {
      svc.manageCollection('create', { name: 'Collection A' });
      const collections = svc.listCollections();
      expect(collections.length).toBeGreaterThanOrEqual(1);
      expect(collections[0].paper_count).toBe(0);
    });

    it('adds and removes papers from collections', () => {
      const col = svc.manageCollection('create', { name: 'Test Collection' });
      const p = svc.add(makePaper());

      svc.manageCollection('add_paper', { id: col.id, paper_ids: [p.id] });

      let collections = svc.listCollections();
      let found = collections.find((c) => c.id === col.id);
      expect(found!.paper_count).toBe(1);

      svc.manageCollection('remove_paper', { id: col.id, paper_ids: [p.id] });
      collections = svc.listCollections();
      found = collections.find((c) => c.id === col.id);
      expect(found!.paper_count).toBe(0);
    });

    it('deletes a collection', () => {
      const col = svc.manageCollection('create', { name: 'To Delete' });
      svc.manageCollection('delete', { id: col.id });
      const collections = svc.listCollections();
      expect(collections.find((c) => c.id === col.id)).toBeUndefined();
    });

    it('updates a collection', () => {
      const col = svc.manageCollection('create', { name: 'Original' });
      svc.manageCollection('update', { id: col.id, name: 'Updated Name' });
      const collections = svc.listCollections();
      const found = collections.find((c) => c.id === col.id);
      expect(found!.name).toBe('Updated Name');
    });
  });

  // ── Notes ───────────────────────────────────────────────────────────

  describe('notes', () => {
    it('adds a note to a paper', () => {
      const p = svc.add(makePaper());
      const note = svc.addNote(p.id, 'Key insight on page 5', 5, 'highlighted text');
      expect(note.paper_id).toBe(p.id);
      expect(note.content).toBe('Key insight on page 5');
      expect(note.page).toBe(5);
      expect(note.highlight).toBe('highlighted text');
    });

    it('lists notes for a paper', () => {
      const p = svc.add(makePaper());
      svc.addNote(p.id, 'Note 1');
      svc.addNote(p.id, 'Note 2');

      const notes = svc.listNotes(p.id);
      expect(notes).toHaveLength(2);
    });

    it('deletes a note', () => {
      const p = svc.add(makePaper());
      const note = svc.addNote(p.id, 'To delete');
      svc.deleteNote(note.id);

      const notes = svc.listNotes(p.id);
      expect(notes).toHaveLength(0);
    });

    it('throws when adding note to non-existent paper', () => {
      expect(() => svc.addNote('bad-id', 'note')).toThrow('Paper not found');
    });

    it('throws when deleting non-existent note', () => {
      expect(() => svc.deleteNote('bad-id')).toThrow('Note not found');
    });
  });
});
