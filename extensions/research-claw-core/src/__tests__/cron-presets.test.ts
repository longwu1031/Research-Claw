/**
 * Cron Presets — Unit Tests
 *
 * Tests for GAP-16 (seed logic fix), GAP-13 (delete/restore), and
 * the updated cronPresetsList filter behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { createTestDb } from './setup.js';
import { TaskService } from '../tasks/service.js';

describe('Cron Presets — Seed Logic & Delete/Restore', () => {
  let db: BetterSqlite3.Database;
  let svc: TaskService;

  beforeEach(() => {
    db = createTestDb();
    svc = new TaskService(db);
  });

  afterEach(() => {
    db.close();
  });

  // ── GAP-16: Seed Logic ─────────────────────────────────────────────

  describe('seed logic (GAP-16)', () => {
    it('seeds 5 presets on first initialization (empty table)', () => {
      const presets = svc.cronPresetsList();
      expect(presets).toHaveLength(5);
      expect(presets.map((p) => p.id)).toEqual([
        'arxiv_daily_scan',
        'citation_tracking_weekly',
        'deadline_reminders_daily',
        'group_meeting_prep',
        'weekly_report',
      ]);
    });

    it('does not re-seed after deleting a preset and re-instantiating service', () => {
      // Delete one preset
      svc.cronPresetsDelete('arxiv_daily_scan');
      expect(svc.cronPresetsList()).toHaveLength(4);

      // Re-instantiate service (simulates restart)
      const svc2 = new TaskService(db);
      const presets = svc2.cronPresetsList();
      expect(presets).toHaveLength(4);
      expect(presets.map((p) => p.id)).not.toContain('arxiv_daily_scan');
    });

    it('re-seeds if ALL presets are deleted (table becomes empty)', () => {
      // Delete all 5 presets
      svc.cronPresetsDelete('arxiv_daily_scan');
      svc.cronPresetsDelete('citation_tracking_weekly');
      svc.cronPresetsDelete('deadline_reminders_daily');
      svc.cronPresetsDelete('group_meeting_prep');
      svc.cronPresetsDelete('weekly_report');
      expect(svc.cronPresetsList()).toHaveLength(0);

      // Re-instantiate service — table is now empty, so re-seed should occur
      const svc2 = new TaskService(db);
      expect(svc2.cronPresetsList()).toHaveLength(5);
    });

    it('deadline_reminders_daily is enabled by default after seed', () => {
      const presets = svc.cronPresetsList();
      const deadline = presets.find((p) => p.id === 'deadline_reminders_daily');
      expect(deadline!.enabled).toBe(true);
    });

    it('all other presets are disabled by default after seed', () => {
      const presets = svc.cronPresetsList();
      const nonDeadline = presets.filter((p) => p.id !== 'deadline_reminders_daily');
      for (const p of nonDeadline) {
        expect(p.enabled).toBe(false);
      }
    });
  });

  // ── GAP-13: Delete ─────────────────────────────────────────────────

  describe('cronPresetsDelete (GAP-13)', () => {
    it('removes the preset row from rc_cron_state', () => {
      const result = svc.cronPresetsDelete('arxiv_daily_scan');
      expect(result.ok).toBe(true);
      expect(result.deleted).toBe('arxiv_daily_scan');

      const row = db.prepare(
        'SELECT * FROM rc_cron_state WHERE preset_id = ?',
      ).get('arxiv_daily_scan');
      expect(row).toBeUndefined();
    });

    it('returns the gateway_job_id for cleanup', () => {
      // Set a gateway_job_id first
      svc.cronPresetsSetJobId('arxiv_daily_scan', 'job-123');

      const result = svc.cronPresetsDelete('arxiv_daily_scan');
      expect(result.gateway_job_id).toBe('job-123');
    });

    it('returns null gateway_job_id when preset had no job', () => {
      const result = svc.cronPresetsDelete('arxiv_daily_scan');
      expect(result.gateway_job_id).toBeNull();
    });

    it('throws for non-existent preset_id (already deleted)', () => {
      svc.cronPresetsDelete('arxiv_daily_scan');
      expect(() => svc.cronPresetsDelete('arxiv_daily_scan')).toThrow(
        'Cron preset not found',
      );
    });

    it('deleted preset is omitted from cronPresetsList', () => {
      svc.cronPresetsDelete('weekly_report');
      const presets = svc.cronPresetsList();
      expect(presets).toHaveLength(4);
      expect(presets.map((p) => p.id)).not.toContain('weekly_report');
    });
  });

  // ── GAP-13: Restore ───────────────────────────────────────────────

  describe('cronPresetsRestore (GAP-13)', () => {
    it('re-inserts a deleted preset with enabled=0', () => {
      svc.cronPresetsDelete('arxiv_daily_scan');
      expect(svc.cronPresetsList()).toHaveLength(4);

      const result = svc.cronPresetsRestore('arxiv_daily_scan');
      expect(result.ok).toBe(true);
      expect(result.preset.id).toBe('arxiv_daily_scan');
      expect(result.preset.enabled).toBe(false);
      expect(result.preset.last_run_at).toBeNull();
      expect(result.preset.next_run_at).toBeNull();
      expect(svc.cronPresetsList()).toHaveLength(5);
    });

    it('is a no-op if preset already exists (not deleted)', () => {
      // Preset exists with enabled=true
      svc.cronPresetsActivate('arxiv_daily_scan');
      const result = svc.cronPresetsRestore('arxiv_daily_scan');
      // Should return the existing preset state, not reset it
      expect(result.ok).toBe(true);
      expect(result.preset.enabled).toBe(true);
    });

    it('throws for unknown preset_id not in PRESET_DEFINITIONS', () => {
      expect(() => svc.cronPresetsRestore('nonexistent')).toThrow(
        'Unknown preset',
      );
    });
  });
});
