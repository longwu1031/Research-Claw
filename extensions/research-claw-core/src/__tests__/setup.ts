/**
 * Test Setup — Shared helpers for in-memory SQLite testing.
 *
 * Creates a fresh in-memory database for each test, applies the full v1 schema
 * (tables, indexes, FTS5, triggers), and provides teardown.
 */

import { createRequire } from 'node:module';
import type BetterSqlite3 from 'better-sqlite3';

import {
  CREATE_TABLES_SQL,
  CREATE_INDEXES_SQL,
  CREATE_FTS_SQL,
  CREATE_TRIGGERS_SQL,
  SCHEMA_VERSION,
} from '../db/schema.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3') as typeof BetterSqlite3;

/**
 * Create a fresh in-memory SQLite database with the full research-claw schema.
 * Returns the raw better-sqlite3 Database instance.
 */
export function createTestDb(): BetterSqlite3.Database {
  const db = new Database(':memory:');

  // Apply PRAGMAs
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Create all tables
  for (const sql of CREATE_TABLES_SQL) {
    db.exec(sql);
  }

  // Create indexes
  for (const sql of CREATE_INDEXES_SQL) {
    db.exec(sql);
  }

  // Create FTS5 virtual table
  for (const sql of CREATE_FTS_SQL) {
    db.exec(sql);
  }

  // Create FTS sync triggers
  for (const sql of CREATE_TRIGGERS_SQL) {
    db.exec(sql);
  }

  // Record schema version
  db.prepare(
    `INSERT INTO rc_schema_version (version, applied_at) VALUES (?, datetime('now'))`,
  ).run(SCHEMA_VERSION);

  return db;
}
