/**
 * Radar tracking config — RPC methods
 *
 * 3 methods:
 *   - rc.radar.config.get  → returns { keywords, authors, journals, sources }
 *   - rc.radar.config.set  → persists tracking config
 *   - rc.radar.scan        → scan sources for new papers
 */

import type { Database } from 'better-sqlite3';
import { radarScan, type ScanOptions } from './scanner.js';
import type { RegisterMethod } from '../types.js';

export interface RadarConfig {
  keywords: string[];
  authors: string[];
  journals: string[];
  sources: string[];
}

const DEFAULT_CONFIG: RadarConfig = {
  keywords: [],
  authors: [],
  journals: [],
  sources: ['arxiv', 'semantic_scholar'],
};

function getConfig(db: Database): RadarConfig {
  const row = db.prepare('SELECT keywords, authors, journals, sources FROM rc_radar_config WHERE id = ?').get('default') as
    | { keywords: string; authors: string; journals: string; sources: string }
    | undefined;

  if (!row) return { ...DEFAULT_CONFIG };

  return {
    keywords: JSON.parse(row.keywords),
    authors: JSON.parse(row.authors),
    journals: JSON.parse(row.journals),
    sources: JSON.parse(row.sources),
  };
}

function setConfig(db: Database, config: Partial<RadarConfig>): RadarConfig {
  const current = getConfig(db);
  const merged: RadarConfig = {
    keywords: config.keywords ?? current.keywords,
    authors: config.authors ?? current.authors,
    journals: config.journals ?? current.journals,
    sources: config.sources ?? current.sources,
  };

  db.prepare(`
    INSERT INTO rc_radar_config (id, keywords, authors, journals, sources, updated_at)
    VALUES ('default', ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      keywords = excluded.keywords,
      authors = excluded.authors,
      journals = excluded.journals,
      sources = excluded.sources,
      updated_at = excluded.updated_at
  `).run(
    JSON.stringify(merged.keywords),
    JSON.stringify(merged.authors),
    JSON.stringify(merged.journals),
    JSON.stringify(merged.sources),
  );

  return merged;
}

export function registerRadarRpc(registerMethod: RegisterMethod, db: Database): void {
  // ── rc.radar.config.get ──────────────────────────────────────────
  registerMethod('rc.radar.config.get', (_params: Record<string, unknown>) => {
    return getConfig(db);
  });

  // ── rc.radar.config.set ──────────────────────────────────────────
  registerMethod('rc.radar.config.set', (params: Record<string, unknown>) => {
    const patch: Partial<RadarConfig> = {};
    if (Array.isArray(params.keywords)) patch.keywords = params.keywords.map(String);
    if (Array.isArray(params.authors)) patch.authors = params.authors.map(String);
    if (Array.isArray(params.journals)) patch.journals = params.journals.map(String);
    if (Array.isArray(params.sources)) patch.sources = params.sources.map(String);
    return setConfig(db, patch);
  });

  // ── rc.radar.scan ─────────────────────────────────────────────────
  registerMethod('rc.radar.scan', async (params: Record<string, unknown>) => {
    const options: ScanOptions = {};
    if (Array.isArray(params.keywords)) options.keywords = params.keywords.map(String);
    if (Array.isArray(params.sources)) options.sources = params.sources.map(String);
    if (typeof params.max_results === 'number') options.max_results = Math.min(params.max_results, 50);
    return { results: await radarScan(db, options) };
  });
}
