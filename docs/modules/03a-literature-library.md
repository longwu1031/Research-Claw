# 03a — Literature Library Module Spec

> **Document ID**: C3a
> **Status**: DEFINITIVE
> **Owner**: Research-Claw Core Plugin (`extensions/research-claw-core`)
> **Dependencies**: `02` (SQLite strategy), `03f` (plugin aggregation)
> **Cross-refs**: `03d` (paper_card type), `03b` (task linking to papers)
> **Last updated**: 2026-03-11

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [SQLite Schema](#2-sqlite-schema)
3. [TypeScript Types](#3-typescript-types)
4. [Agent Tools](#4-agent-tools)
5. [Plugin RPC Methods](#5-plugin-rpc-methods)
6. [Zotero Interop](#6-zotero-interop)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Error Handling](#8-error-handling)
9. [Implementation Notes](#9-implementation-notes)

---

## 1. Feature Overview

The Literature Library is Research-Claw's local paper management system. It provides
a structured SQLite database for storing, searching, tagging, and tracking academic
papers entirely on the researcher's machine. No data leaves the local system unless
the researcher explicitly exports it.

### Core Capabilities

| Capability | Description |
|---|---|
| **Paper Storage** | Store metadata (title, authors, abstract, DOI, venue, year) plus local PDF paths |
| **FTS5 Full-Text Search** | Sub-millisecond search across titles, authors, abstracts, and notes |
| **Collections** | User-defined paper groupings via tags and smart groups |
| **Smart Groups** | Saved queries that dynamically match papers (e.g., "unread from 2025") |
| **Tags** | Colored labels for ad-hoc organization |
| **Reading Sessions** | Track time spent reading each paper, pages read, session notes |
| **Citation Graph** | Record and query citing/cited relationships between papers |
| **BibTeX Import/Export** | Round-trip BibTeX support for all major citation styles |
| **Zotero Bridge** | Read-only one-way import from local Zotero SQLite database |
| **Deduplication** | Automatic DOI/arXiv-ID-based duplicate detection on add |
| **Batch Operations** | Add, tag, and export multiple papers in a single call |

### Design Principles

1. **Local-first**: All data in a single SQLite file at `{projectRoot}/.research-claw/library.db`
2. **Agent-native**: Every operation is an agent tool. The agent can search, add, tag, and
   export papers without human intervention for read operations.
3. **Human-in-Loop for destructive ops**: Deletes and bulk modifications require confirmation.
4. **Schema stability**: Table names prefixed with `rc_` to avoid collision with OpenClaw internals.
5. **Extensibility**: The `metadata` JSON column on `rc_papers` allows adding fields without migrations.

### File Layout

```
extensions/research-claw-core/
  src/
    literature/
      service.ts      ← LiteratureService class (all DB operations)
      tools.ts         ← Agent tool definitions (TypeBox schemas)
      rpc.ts           ← Gateway RPC method handlers (rc.lit.*)
      zotero.ts        ← ZoteroBridge class (read-only import)
    db/
      schema.ts        ← DDL constants and migration runner
      connection.ts    ← SQLite connection manager (better-sqlite3)
      migrations.ts    ← Versioned migration functions
```

---

## 2. SQLite Schema

All DDL is defined in `extensions/research-claw-core/src/db/schema.ts` and executed
by the migration runner on first launch or schema version bump.

### 2.1 `rc_papers`

Primary paper metadata table.

```sql
CREATE TABLE IF NOT EXISTS rc_papers (
  id              TEXT PRIMARY KEY,                    -- UUIDv4
  title           TEXT NOT NULL,
  authors         TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
  abstract        TEXT,
  doi             TEXT UNIQUE,
  url             TEXT,
  arxiv_id        TEXT,
  pdf_path        TEXT,                                -- relative to project root
  source          TEXT,                                -- 'semantic_scholar' | 'arxiv' | 'manual' | 'zotero' | 'crossref' | 'openalex'
  source_id       TEXT,                                -- ID in the source system
  venue           TEXT,
  year            INTEGER,
  added_at        TEXT NOT NULL,                       -- ISO 8601 with timezone
  updated_at      TEXT NOT NULL,                       -- ISO 8601 with timezone
  read_status     TEXT NOT NULL DEFAULT 'unread'
                    CHECK(read_status IN ('unread', 'reading', 'read', 'reviewed')),
  rating          INTEGER CHECK(rating IS NULL OR (rating BETWEEN 1 AND 5)),
  notes           TEXT,
  bibtex_key      TEXT,
  metadata        TEXT DEFAULT '{}'                    -- JSON object for extensible fields
);
```

### 2.2 `rc_tags`

Tag definitions with optional color coding.

```sql
CREATE TABLE IF NOT EXISTS rc_tags (
  id              TEXT PRIMARY KEY,                    -- UUIDv4
  name            TEXT NOT NULL UNIQUE,
  color           TEXT,                                -- hex color, e.g. '#EF4444'
  created_at      TEXT NOT NULL                        -- ISO 8601
);
```

### 2.3 `rc_paper_tags`

Junction table for many-to-many paper-tag relationships.

```sql
CREATE TABLE IF NOT EXISTS rc_paper_tags (
  paper_id        TEXT NOT NULL REFERENCES rc_papers(id) ON DELETE CASCADE,
  tag_id          TEXT NOT NULL REFERENCES rc_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, tag_id)
);
```

### 2.4 `rc_collections`

Named paper collections (folders).

```sql
CREATE TABLE IF NOT EXISTS rc_collections (
  id              TEXT PRIMARY KEY,                    -- UUIDv4
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  color           TEXT,                                -- hex color
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### 2.5 `rc_collection_papers`

Junction table for collection membership.

```sql
CREATE TABLE IF NOT EXISTS rc_collection_papers (
  collection_id   TEXT NOT NULL REFERENCES rc_collections(id) ON DELETE CASCADE,
  paper_id        TEXT NOT NULL REFERENCES rc_papers(id) ON DELETE CASCADE,
  added_at        TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  PRIMARY KEY (collection_id, paper_id)
);
```

### 2.6 `rc_smart_groups`

Saved search queries that dynamically match papers.

```sql
CREATE TABLE IF NOT EXISTS rc_smart_groups (
  id              TEXT PRIMARY KEY,                    -- UUIDv4
  name            TEXT NOT NULL UNIQUE,
  query_json      TEXT NOT NULL,                       -- JSON: { filters, sort, fts_query }
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### 2.7 `rc_reading_sessions`

Track reading activity per paper.

```sql
CREATE TABLE IF NOT EXISTS rc_reading_sessions (
  id              TEXT PRIMARY KEY,                    -- UUIDv4
  paper_id        TEXT NOT NULL REFERENCES rc_papers(id) ON DELETE CASCADE,
  started_at      TEXT NOT NULL,                       -- ISO 8601
  ended_at        TEXT,                                -- NULL while session is active
  duration_minutes INTEGER,                            -- computed on end, or NULL
  notes           TEXT,
  pages_read      INTEGER
);
```

### 2.8 `rc_citations`

Inter-paper citation relationships.

```sql
CREATE TABLE IF NOT EXISTS rc_citations (
  citing_paper_id TEXT NOT NULL REFERENCES rc_papers(id) ON DELETE CASCADE,
  cited_paper_id  TEXT NOT NULL REFERENCES rc_papers(id) ON DELETE CASCADE,
  context         TEXT,                                -- sentence containing the citation
  section         TEXT,                                -- section heading where citation appears
  PRIMARY KEY (citing_paper_id, cited_paper_id)
);
```

### 2.9 FTS5 Virtual Table

Full-text search index over paper content fields.

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS rc_papers_fts USING fts5(
  title,
  authors,
  abstract,
  notes,
  content='rc_papers',
  content_rowid='rowid'
);
```

**FTS5 triggers** — keep the FTS index in sync with the content table:

```sql
-- After INSERT
CREATE TRIGGER IF NOT EXISTS rc_papers_fts_insert AFTER INSERT ON rc_papers BEGIN
  INSERT INTO rc_papers_fts(rowid, title, authors, abstract, notes)
    VALUES (new.rowid, new.title, new.authors, new.abstract, new.notes);
END;

-- After UPDATE (delete old + insert new)
CREATE TRIGGER IF NOT EXISTS rc_papers_fts_update AFTER UPDATE ON rc_papers BEGIN
  INSERT INTO rc_papers_fts(rc_papers_fts, rowid, title, authors, abstract, notes)
    VALUES ('delete', old.rowid, old.title, old.authors, old.abstract, old.notes);
  INSERT INTO rc_papers_fts(rowid, title, authors, abstract, notes)
    VALUES (new.rowid, new.title, new.authors, new.abstract, new.notes);
END;

-- BEFORE DELETE (must fire before row is removed so old.* is accessible)
CREATE TRIGGER IF NOT EXISTS rc_papers_fts_delete BEFORE DELETE ON rc_papers BEGIN
  INSERT INTO rc_papers_fts(rc_papers_fts, rowid, title, authors, abstract, notes)
    VALUES ('delete', old.rowid, old.title, old.authors, old.abstract, old.notes);
END;
```

### 2.10 `rc_paper_notes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | ULID |
| `paper_id` | TEXT | FK→rc_papers, NOT NULL | Parent paper |
| `content` | TEXT | NOT NULL | Note body (Markdown) |
| `page` | INTEGER | | PDF page reference (nullable) |
| `highlight` | TEXT | | Highlighted text (nullable) |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Creation timestamp |

Indexes:
- `idx_paper_notes_paper` ON `rc_paper_notes(paper_id)`

### 2.11 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_rc_papers_doi       ON rc_papers(doi);
CREATE INDEX IF NOT EXISTS idx_rc_papers_arxiv_id   ON rc_papers(arxiv_id);
CREATE INDEX IF NOT EXISTS idx_rc_papers_year       ON rc_papers(year);
CREATE INDEX IF NOT EXISTS idx_rc_papers_read_status ON rc_papers(read_status);
CREATE INDEX IF NOT EXISTS idx_rc_papers_added_at   ON rc_papers(added_at);
CREATE INDEX IF NOT EXISTS idx_rc_papers_source     ON rc_papers(source);
CREATE INDEX IF NOT EXISTS idx_rc_papers_bibtex_key ON rc_papers(bibtex_key);

CREATE INDEX IF NOT EXISTS idx_rc_reading_sessions_paper
  ON rc_reading_sessions(paper_id);
CREATE INDEX IF NOT EXISTS idx_rc_reading_sessions_started
  ON rc_reading_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_rc_citations_citing
  ON rc_citations(citing_paper_id);
CREATE INDEX IF NOT EXISTS idx_rc_citations_cited
  ON rc_citations(cited_paper_id);

CREATE INDEX IF NOT EXISTS idx_rc_paper_tags_tag
  ON rc_paper_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_rc_collection_papers_collection
  ON rc_collection_papers(collection_id);
```

### 2.12 Schema Version Table

```sql
CREATE TABLE IF NOT EXISTS rc_schema_version (
  version   INTEGER NOT NULL,
  applied_at TEXT NOT NULL
);
```

Current schema version: **6**.

### 2.13 PRAGMA Settings

Applied on every connection open:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -8000;        -- 8 MB
PRAGMA temp_store = MEMORY;
```

---

## 3. TypeScript Types

All types are defined using TypeBox for runtime validation and JSON Schema generation.
These types are the single source of truth for both agent tools and RPC methods.

### 3.1 Core Types

```typescript
import { Type, Static } from '@sinclair/typebox';

// ---------- Paper ----------

export const ReadStatus = Type.Union([
  Type.Literal('unread'),
  Type.Literal('reading'),
  Type.Literal('read'),
  Type.Literal('reviewed'),
]);
export type ReadStatus = Static<typeof ReadStatus>;

export const PaperSource = Type.Union([
  Type.Literal('semantic_scholar'),
  Type.Literal('arxiv'),
  Type.Literal('manual'),
  Type.Literal('zotero'),
  Type.Literal('crossref'),
  Type.Literal('openalex'),
]);
export type PaperSource = Static<typeof PaperSource>;

export const CitationStyle = Type.Union([
  Type.Literal('apa'),
  Type.Literal('mla'),
  Type.Literal('chicago'),
  Type.Literal('ieee'),
  Type.Literal('bibtex'),
]);
export type CitationStyle = Static<typeof CitationStyle>;

export const Paper = Type.Object({
  id: Type.String({ format: 'uuid' }),
  title: Type.String(),
  authors: Type.Array(Type.String()),
  abstract: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  doi: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  arxiv_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  pdf_path: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  source: Type.Optional(Type.Union([PaperSource, Type.Null()])),
  source_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  venue: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  year: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  added_at: Type.String(),
  updated_at: Type.String(),
  read_status: ReadStatus,
  rating: Type.Optional(Type.Union([Type.Integer({ minimum: 1, maximum: 5 }), Type.Null()])),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  bibtex_key: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  tags: Type.Optional(Type.Array(Type.String())),
});
export type Paper = Static<typeof Paper>;

export const PaperInput = Type.Object({
  title: Type.String({ minLength: 1 }),
  authors: Type.Array(Type.String(), { minItems: 1 }),
  abstract: Type.Optional(Type.String()),
  doi: Type.Optional(Type.String()),
  url: Type.Optional(Type.String({ format: 'uri' })),
  arxiv_id: Type.Optional(Type.String()),
  pdf_path: Type.Optional(Type.String()),
  source: Type.Optional(PaperSource),
  source_id: Type.Optional(Type.String()),
  venue: Type.Optional(Type.String()),
  year: Type.Optional(Type.Integer({ minimum: 1900, maximum: 2100 })),
  tags: Type.Optional(Type.Array(Type.String())),
  notes: Type.Optional(Type.String()),
  bibtex_key: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type PaperInput = Static<typeof PaperInput>;

export const PaperPatch = Type.Partial(Type.Object({
  title: Type.String({ minLength: 1 }),
  authors: Type.Array(Type.String()),
  abstract: Type.Union([Type.String(), Type.Null()]),
  doi: Type.Union([Type.String(), Type.Null()]),
  url: Type.Union([Type.String(), Type.Null()]),
  arxiv_id: Type.Union([Type.String(), Type.Null()]),
  pdf_path: Type.Union([Type.String(), Type.Null()]),
  source: Type.Union([PaperSource, Type.Null()]),
  source_id: Type.Union([Type.String(), Type.Null()]),
  venue: Type.Union([Type.String(), Type.Null()]),
  year: Type.Union([Type.Integer(), Type.Null()]),
  read_status: ReadStatus,
  rating: Type.Union([Type.Integer({ minimum: 1, maximum: 5 }), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
  bibtex_key: Type.Union([Type.String(), Type.Null()]),
  metadata: Type.Record(Type.String(), Type.Unknown()),
}));
export type PaperPatch = Static<typeof PaperPatch>;

// ---------- Tag ----------

export const Tag = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  color: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  created_at: Type.String(),
});
export type Tag = Static<typeof Tag>;

// ---------- Collection ----------

export const Collection = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  color: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  paper_count: Type.Optional(Type.Integer()),
  created_at: Type.String(),
  updated_at: Type.String(),
});
export type Collection = Static<typeof Collection>;

// ---------- Reading Session ----------

export const ReadingSession = Type.Object({
  id: Type.String({ format: 'uuid' }),
  paper_id: Type.String({ format: 'uuid' }),
  started_at: Type.String(),
  ended_at: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  duration_minutes: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  pages_read: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
});
export type ReadingSession = Static<typeof ReadingSession>;

// ---------- Citation ----------

export const Citation = Type.Object({
  citing_paper_id: Type.String({ format: 'uuid' }),
  cited_paper_id: Type.String({ format: 'uuid' }),
  context: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  section: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
export type Citation = Static<typeof Citation>;

// ---------- Filter / Sort ----------

export const PaperFilter = Type.Partial(Type.Object({
  year_min: Type.Integer(),
  year_max: Type.Integer(),
  read_status: ReadStatus,
  tags: Type.Array(Type.String()),
  source: PaperSource,
  rating_min: Type.Integer({ minimum: 1, maximum: 5 }),
  collection_id: Type.String({ format: 'uuid' }),
  has_pdf: Type.Boolean(),
}));
export type PaperFilter = Static<typeof PaperFilter>;

export const SortField = Type.Union([
  Type.Literal('added_at'),
  Type.Literal('updated_at'),
  Type.Literal('year'),
  Type.Literal('title'),
  Type.Literal('rating'),
]);

export const SortOrder = Type.Union([
  Type.Literal('asc'),
  Type.Literal('desc'),
]);

export const PaperSort = Type.Object({
  field: SortField,
  order: Type.Optional(SortOrder),
});
export type PaperSort = Static<typeof PaperSort>;

// ---------- Stats ----------

export const LibraryStats = Type.Object({
  total_papers: Type.Integer(),
  by_status: Type.Object({
    unread: Type.Integer(),
    reading: Type.Integer(),
    read: Type.Integer(),
    reviewed: Type.Integer(),
  }),
  by_year: Type.Array(Type.Object({
    year: Type.Integer(),
    count: Type.Integer(),
  })),
  by_source: Type.Array(Type.Object({
    source: Type.String(),
    count: Type.Integer(),
  })),
  total_tags: Type.Integer(),
  total_reading_minutes: Type.Integer(),
  papers_with_pdf: Type.Integer(),
  average_rating: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});
export type LibraryStats = Static<typeof LibraryStats>;

export const ReadingStats = Type.Object({
  period: Type.String(),
  total_sessions: Type.Integer(),
  total_minutes: Type.Integer(),
  total_pages: Type.Integer(),
  papers_read: Type.Integer(),
  daily_breakdown: Type.Array(Type.Object({
    date: Type.String(),
    minutes: Type.Integer(),
    sessions: Type.Integer(),
  })),
});
export type ReadingStats = Static<typeof ReadingStats>;
```

---

## 4. Agent Tools

All tools are registered via the OpenClaw Plugin SDK `api.registerTool()` method.
Each tool definition includes a TypeBox parameter schema, a description string,
and a handler function.

The agent uses these tools autonomously during a conversation. Read-only tools
require no confirmation. Write tools (add, update, delete) are allowed by the
`tools.alsoAllow` list in `config/openclaw.json`.

### 4.1 `library_add_paper`

Add a single paper to the library with metadata.

```typescript
const LibraryAddPaperParams = Type.Object({
  title: Type.String({ minLength: 1, description: 'Paper title' }),
  authors: Type.Array(Type.String(), {
    minItems: 1,
    description: 'List of author names',
  }),
  abstract: Type.Optional(Type.String({ description: 'Paper abstract' })),
  doi: Type.Optional(Type.String({ description: 'Digital Object Identifier' })),
  url: Type.Optional(Type.String({
    format: 'uri',
    description: 'URL to paper (publisher page, PDF, etc.)',
  })),
  arxiv_id: Type.Optional(Type.String({
    description: 'arXiv identifier (e.g., "2301.07041")',
  })),
  venue: Type.Optional(Type.String({
    description: 'Publication venue (journal, conference)',
  })),
  year: Type.Optional(Type.Integer({
    minimum: 1900,
    maximum: 2100,
    description: 'Publication year',
  })),
  source: Type.Optional(PaperSource),
  tags: Type.Optional(Type.Array(Type.String(), {
    description: 'Tag names to apply (created if they do not exist)',
  })),
  notes: Type.Optional(Type.String({ description: 'Initial notes' })),
  pdf_path: Type.Optional(Type.String({
    description: 'Path to local PDF file (relative to project root)',
  })),
  bibtex_key: Type.Optional(Type.String({ description: 'BibTeX citation key' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'Additional metadata as key-value pairs',
  })),
});
```

**Returns**: `Paper` object with `id`, `added_at`, and all resolved fields. If a paper
with the same DOI or arXiv ID already exists, returns the existing paper with
`{ ...paper, duplicate: true }`.

**Example agent usage**:
```
I'll add this paper to your library.
→ library_add_paper({
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", ...],
    doi: "10.5555/3295222.3295349",
    year: 2017,
    venue: "NeurIPS",
    tags: ["transformer", "nlp"]
  })
```

### 4.2 `library_search`

Full-text search across the library using FTS5.

```typescript
const LibrarySearchParams = Type.Object({
  query: Type.String({
    minLength: 1,
    description: 'Search query (full-text search across title, abstract, authors)',
  }),
  limit: Type.Optional(Type.Number({
    default: 50,
    description: 'Maximum results to return (default 50, max 500)',
  })),
  offset: Type.Optional(Type.Number({
    default: 0,
    description: 'Pagination offset',
  })),
});
```

> **Note:** The actual implementation uses flat `query`, `limit`, `offset` params
> with no `filters` wrapper object. Default limit is 50, max 500.

**Returns**: `{ items: Paper[], total: number, query: string }`.

**FTS5 query mapping**: The `query` string is passed directly to FTS5 `MATCH`. If FTS5
raises a syntax error, the handler falls back to `LIKE '%query%'` search on title
and abstract.

### 4.3 `library_update_paper`

Update one or more fields on an existing paper.

```typescript
const LibraryUpdatePaperParams = Type.Object({
  id: Type.String({ format: 'uuid', description: 'Paper ID to update' }),
  title: Type.Optional(Type.String({ minLength: 1 })),
  authors: Type.Optional(Type.Array(Type.String())),
  abstract: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  doi: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  url: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  arxiv_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  pdf_path: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  venue: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  year: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  read_status: Type.Optional(ReadStatus),
  rating: Type.Optional(Type.Union([
    Type.Integer({ minimum: 1, maximum: 5 }),
    Type.Null(),
  ])),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  bibtex_key: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
```

**Returns**: Updated `Paper` object. Rejects with `PAPER_NOT_FOUND` if `id` is invalid.

### 4.4 `library_get_paper`

Retrieve a single paper by ID with all relations.

```typescript
const LibraryGetPaperParams = Type.Object({
  id: Type.String({ format: 'uuid', description: 'Paper ID' }),
});
```

**Returns**: `Paper` object with populated `tags` array, plus:
- `reading_sessions`: `ReadingSession[]` — all sessions for this paper
- `citing`: `Paper[]` — papers in the library that this paper cites
- `cited_by`: `Paper[]` — papers in the library that cite this paper
- `total_reading_minutes`: `number` — sum of all session durations

### 4.5 `library_export_bibtex`

Export one or more papers as formatted citations.

```typescript
const LibraryExportBibtexParams = Type.Object({
  paper_ids: Type.Optional(Type.Array(Type.String(), {
    description: 'List of paper IDs to export',
  })),
  tag: Type.Optional(Type.String({
    description: 'Export all papers with this tag',
  })),
  collection: Type.Optional(Type.String({
    description: 'Export all papers in this collection ID',
  })),
  all: Type.Optional(Type.Boolean({
    description: 'Export entire library',
  })),
});
```

**Returns**: `{ bibtex: string, count: number }`.

Select papers by IDs, tag, collection, or export all. At least one selection
criterion should be provided. Each entry is a standard `@article{...}` /
`@inproceedings{...}` BibTeX block.

**BibTeX key generation**: If `bibtex_key` is set on the paper, use it. Otherwise,
generate as `{first_author_lastname}{year}{first_title_word}` lowercased
(e.g., `vaswani2017attention`).

### 4.6 `library_reading_stats`

Get reading activity statistics for a time period.

```typescript
const LibraryReadingStatsParams = Type.Object({
  period: Type.Union([
    Type.Literal('week'),
    Type.Literal('month'),
    Type.Literal('year'),
    Type.Literal('all'),
  ], { default: 'month', description: 'Time period for statistics' }),
});
```

**Returns**: `ReadingStats` object.

Period boundaries:
- `week`: last 7 days from today
- `month`: last 30 days from today
- `year`: last 365 days from today
- `all`: all time

### 4.7 `library_batch_add`

Add multiple papers in a single transaction.

```typescript
const LibraryBatchAddParams = Type.Object({
  papers: Type.Array(PaperInput, {
    minItems: 1,
    maxItems: 100,
    description: 'Array of papers to add',
  }),
});
```

**Returns**: `{ added: Paper[], duplicates: Paper[], errors: Array<{ index: number, error: string }> }`.

Each paper is processed independently within a single transaction. If a paper has
a duplicate DOI/arXiv ID, it is placed in the `duplicates` array with the existing
paper data. If a paper fails validation, it is placed in `errors`. Successfully
added papers are in `added`.

### 4.8 `library_manage_collection`

Create, update, delete, or modify membership of collections.

```typescript
const LibraryManageCollectionParams = Type.Object({
  action: Type.Union([
    Type.Literal('create'),
    Type.Literal('update'),
    Type.Literal('delete'),
    Type.Literal('add_papers'),
    Type.Literal('remove_papers'),
  ], { description: 'Action to perform' }),
  id: Type.Optional(Type.String({
    format: 'uuid',
    description: 'Collection ID (required for update/delete/add_papers/remove_papers)',
  })),
  name: Type.Optional(Type.String({
    minLength: 1,
    description: 'Collection name (required for create, optional for update)',
  })),
  description: Type.Optional(Type.String({ description: 'Collection description' })),
  color: Type.Optional(Type.String({ description: 'Hex color (e.g., "#3B82F6")' })),
  paper_ids: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Paper IDs (for add_papers/remove_papers)',
  })),
});
```

**Returns**: `Collection` for create/update, `{ ok: true }` for delete/add_papers/remove_papers.

### 4.9 `library_add_note`

Add a note or annotation to a paper, optionally tied to a specific page or
highlighted text. Notes are stored in the `rc_paper_notes` table (not appended to
the paper's `notes` text field).

```typescript
const LibraryAddNoteParams = Type.Object({
  paper_id: Type.String({ description: 'Paper ID' }),
  note_text: Type.String({
    description: 'Note content (Markdown supported)',
  }),
  page: Type.Optional(Type.Number({
    description: 'Page number the note refers to',
  })),
  highlight: Type.Optional(Type.String({
    description: 'Highlighted text the note refers to',
  })),
});
```

**Returns**: The created `PaperNote` object (`{ id, paper_id, content, page, highlight, created_at }`).

### 4.10 `library_tag_paper`

Add or remove a tag from a paper.

```typescript
const LibraryTagPaperParams = Type.Object({
  paper_id: Type.String({ format: 'uuid', description: 'Paper ID' }),
  tag_name: Type.String({
    minLength: 1,
    description: 'Tag name (created automatically if it does not exist)',
  }),
  action: Type.Union([
    Type.Literal('add'),
    Type.Literal('remove'),
  ], { description: 'Whether to add or remove the tag' }),
  color: Type.Optional(Type.String({
    description: 'Hex color for new tag (only used when creating)',
  })),
});
```

**Returns**: `{ paper_id: string, tags: string[] }` — the paper's current tag list.

### 4.11 `library_citation_graph`

Query citation relationships for a paper.

```typescript
const LibraryCitationGraphParams = Type.Object({
  paper_id: Type.String({ format: 'uuid', description: 'Central paper ID' }),
  direction: Type.Union([
    Type.Literal('citing'),
    Type.Literal('cited_by'),
    Type.Literal('both'),
  ], { default: 'both', description: 'Direction of citation relationships' }),
  depth: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 3,
    default: 1,
    description: 'How many hops to traverse (1 = direct, 2 = two-hop, 3 = three-hop)',
  })),
});
```

**Returns**:
```typescript
{
  center: Paper,
  nodes: Array<{ paper: Paper, depth: number }>,
  edges: Array<{ from: string, to: string, context?: string, section?: string }>,
}
```

The `depth` parameter controls BFS traversal depth. At depth 1, only direct
citations/references are returned. At depth 2, citations-of-citations are included.
Maximum depth is 3 to prevent excessive queries.

### 4.12 `library_import_bibtex`

Parse and import papers from a BibTeX string.

```typescript
const LibraryImportBibtexParams = Type.Object({
  bibtex_content: Type.String({
    minLength: 1,
    description: 'BibTeX content to parse and import',
  }),
  tags: Type.Optional(Type.Array(Type.String(), {
    description: 'Tags to apply to all imported papers',
  })),
  collection_id: Type.Optional(Type.String({
    format: 'uuid',
    description: 'Collection to add imported papers to',
  })),
});
```

**Returns**: `{ added: Paper[], duplicates: Paper[], errors: Array<{ key: string, error: string }> }`.

**BibTeX field mapping**:

| BibTeX field | `rc_papers` column |
|---|---|
| `title` | `title` |
| `author` | `authors` (split on ` and `) |
| `abstract` | `abstract` |
| `doi` | `doi` |
| `url` | `url` |
| `eprint` (if `archiveprefix=arXiv`) | `arxiv_id` |
| `journal` / `booktitle` | `venue` |
| `year` | `year` |
| citation key | `bibtex_key` |
| all other fields | `metadata` JSON |

---

## 5. Plugin RPC Methods

RPC methods are registered on the OpenClaw Gateway WebSocket server under the
`rc.lit.*` namespace. The dashboard and external tools call these methods via
the WS RPC protocol (see doc `02`).

All methods follow the JSON-RPC 2.0 request/response pattern over WebSocket:

```json
// Request
{ "jsonrpc": "2.0", "id": 1, "method": "rc.lit.list", "params": { ... } }

// Response
{ "jsonrpc": "2.0", "id": 1, "result": { ... } }
```

### 5.1 `rc.lit.list`

List papers with pagination, filtering, and sorting.

**Params**:
```typescript
Type.Object({
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, default: 50 })),
  sort: Type.Optional(PaperSort),
  filter: Type.Optional(PaperFilter),
})
```

**Returns**:
```typescript
Type.Object({
  items: Type.Array(Paper),
  total: Type.Integer(),
  offset: Type.Integer(),
  limit: Type.Integer(),
})
```

**SQL construction**: Builds a parameterized WHERE clause from filter fields. Tag
filtering uses `EXISTS (SELECT 1 FROM rc_paper_tags pt JOIN rc_tags t ON pt.tag_id = t.id WHERE pt.paper_id = rc_papers.id AND t.name IN (?...))`.

### 5.2 `rc.lit.get`

Get a single paper with all relations.

**Params**:
```typescript
Type.Object({
  id: Type.String({ format: 'uuid' }),
})
```

**Returns**: `Paper` with `tags: string[]`, `reading_sessions: ReadingSession[]`,
`citing_count: number`, `cited_by_count: number`.

**Error**: `{ code: -32001, message: 'Paper not found' }` if ID does not exist.

### 5.3 `rc.lit.add`

Add a paper to the library.

**Params**:
```typescript
Type.Object({
  paper: PaperInput,
})
```

**Returns**: `Paper` (the newly created record, or existing record if duplicate).

**Side effects**: If `paper.doi` or `paper.arxiv_id` matches an existing paper,
returns the existing paper with `{ duplicate: true }` instead of inserting.

### 5.4 `rc.lit.update`

Update paper fields.

**Params**:
```typescript
Type.Object({
  id: Type.String({ format: 'uuid' }),
  patch: PaperPatch,
})
```

**Returns**: `Paper` (the updated record).

**Behavior**: Only the fields present in `patch` are updated. `updated_at` is
always set to the current timestamp. If `patch` contains `authors`, the value
must be a JSON-serializable array of strings.

### 5.5 `rc.lit.delete`

Soft-delete a paper. Sets `deleted_at` in metadata (paper is excluded from queries
but retained in the database).

**Params**:
```typescript
Type.Object({
  id: Type.String({ format: 'uuid' }),
})
```

**Returns**: `{ ok: true }`.

**Implementation**: Rather than a `deleted_at` column, the delete sets
`metadata.deleted_at` to the current ISO 8601 timestamp. All list/search queries
filter out papers where `json_extract(metadata, '$.deleted_at') IS NOT NULL`.
A future hard-delete vacuum process can permanently remove these records.

### 5.6 `rc.lit.status`

Update the read status of a paper.

**Params**:
```typescript
Type.Object({
  id: Type.String({ format: 'uuid' }),
  status: ReadStatus,
})
```

**Returns**: `Paper` (updated record).

**Side effects**: When status transitions to `'reading'` and no active reading
session exists, automatically starts a new reading session.

### 5.7 `rc.lit.rate`

Set or update a paper's rating.

**Params**:
```typescript
Type.Object({
  id: Type.String({ format: 'uuid' }),
  rating: Type.Integer({ minimum: 1, maximum: 5 }),
})
```

**Returns**: `Paper` (updated record).

### 5.8 `rc.lit.tags`

List all tags in the library.

**Params**: `{}` (empty object).

**Returns**:
```typescript
Type.Array(Type.Object({
  id: Type.String(),
  name: Type.String(),
  color: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  created_at: Type.String(),
  paper_count: Type.Integer(),
}))
```

Tags are returned sorted by `paper_count DESC, name ASC`.

### 5.9 `rc.lit.tag`

Add a tag to a paper.

**Params**:
```typescript
Type.Object({
  paper_id: Type.String({ format: 'uuid' }),
  tag_name: Type.String({ minLength: 1 }),
  color: Type.Optional(Type.String()),
})
```

**Returns**: `{ paper_id: string, tags: string[] }`.

**Behavior**: If the tag does not exist, it is created with the specified color
(or `null`). If the paper already has the tag, the operation is a no-op
(idempotent). Tag names are normalized: trimmed and lowercased.

### 5.10 `rc.lit.untag`

Remove a tag from a paper.

**Params**:
```typescript
Type.Object({
  paper_id: Type.String({ format: 'uuid' }),
  tag_name: Type.String({ minLength: 1 }),
})
```

**Returns**: `{ paper_id: string, tags: string[] }`.

**Behavior**: If the paper does not have the tag, the operation is a no-op.
The tag definition itself is not deleted (it may be used by other papers).

### 5.11 `rc.lit.reading.start`

Start a new reading session for a paper.

**Params**:
```typescript
Type.Object({
  paper_id: Type.String({ format: 'uuid' }),
})
```

**Returns**: `ReadingSession` with `ended_at: null`.

**Side effects**:
- If the paper's `read_status` is `'unread'`, it is automatically updated to `'reading'`.
- If there is already an active (non-ended) session for this paper, the existing
  session is ended first (with duration calculated from `started_at` to now), and
  a new session is started.

### 5.12 `rc.lit.reading.end`

End an active reading session.

**Params**:
```typescript
Type.Object({
  session_id: Type.String({ format: 'uuid' }),
  notes: Type.Optional(Type.String()),
  pages_read: Type.Optional(Type.Integer({ minimum: 0 })),
})
```

**Returns**: `ReadingSession` with computed `duration_minutes` and `ended_at`.

**Duration calculation**: `Math.round((ended_at - started_at) / 60000)`.
If duration exceeds 480 minutes (8 hours), it is capped at 480 and a warning is
logged (likely a session that was never properly closed).

### 5.13 `rc.lit.reading.list`

List reading sessions for a paper.

**Params**:
```typescript
Type.Object({
  paper_id: Type.String({ format: 'uuid' }),
})
```

**Returns**: `ReadingSession[]` sorted by `started_at DESC`.

### 5.14 `rc.lit.cite`

Record a citation relationship between two papers in the library.

**Params**:
```typescript
Type.Object({
  citing_id: Type.String({ format: 'uuid' }),
  cited_id: Type.String({ format: 'uuid' }),
  context: Type.Optional(Type.String({
    description: 'The sentence or passage containing the citation',
  })),
  section: Type.Optional(Type.String({
    description: 'Section heading where the citation appears',
  })),
})
```

**Returns**: `Citation`.

**Validation**: `citing_id` and `cited_id` must be different. Both must exist.
If the relationship already exists, it is updated (context/section overwritten).
Uses `INSERT OR REPLACE`.

### 5.15 `rc.lit.citations`

Get citation relationships for a paper.

**Params**:
```typescript
Type.Object({
  paper_id: Type.String({ format: 'uuid' }),
  direction: Type.Union([
    Type.Literal('citing'),    // papers this paper cites
    Type.Literal('cited_by'),  // papers that cite this paper
    Type.Literal('both'),
  ], { default: 'both' }),
})
```

**Returns**:
```typescript
Type.Object({
  citing: Type.Array(Type.Object({
    paper: Paper,
    context: Type.Optional(Type.String()),
    section: Type.Optional(Type.String()),
  })),
  cited_by: Type.Array(Type.Object({
    paper: Paper,
    context: Type.Optional(Type.String()),
    section: Type.Optional(Type.String()),
  })),
})
```

When `direction` is `'citing'`, `cited_by` is an empty array (and vice versa).

### 5.16 `rc.lit.stats`

Get aggregate library statistics.

**Params**: `{}` (empty object).

**Returns**: `LibraryStats`.

**SQL queries**:
```sql
-- total_papers
SELECT COUNT(*) FROM rc_papers WHERE json_extract(metadata, '$.deleted_at') IS NULL;

-- by_status
SELECT read_status, COUNT(*) as count FROM rc_papers
  WHERE json_extract(metadata, '$.deleted_at') IS NULL
  GROUP BY read_status;

-- by_year
SELECT year, COUNT(*) as count FROM rc_papers
  WHERE year IS NOT NULL AND json_extract(metadata, '$.deleted_at') IS NULL
  GROUP BY year ORDER BY year DESC;

-- by_source
SELECT source, COUNT(*) as count FROM rc_papers
  WHERE source IS NOT NULL AND json_extract(metadata, '$.deleted_at') IS NULL
  GROUP BY source ORDER BY count DESC;

-- total_reading_minutes
SELECT COALESCE(SUM(duration_minutes), 0) FROM rc_reading_sessions;

-- papers_with_pdf
SELECT COUNT(*) FROM rc_papers
  WHERE pdf_path IS NOT NULL AND json_extract(metadata, '$.deleted_at') IS NULL;

-- average_rating
SELECT AVG(CAST(rating AS REAL)) FROM rc_papers
  WHERE rating IS NOT NULL AND json_extract(metadata, '$.deleted_at') IS NULL;
```

### 5.17 `rc.lit.search`

Full-text search via FTS5.

**Params**:
```typescript
Type.Object({
  query: Type.String({ minLength: 1 }),
  limit: Type.Optional(Type.Integer({ default: 50 })),
  offset: Type.Optional(Type.Integer({ default: 0 })),
})
```

**Returns**: `{ items: Paper[], total: number }`.

**Implementation**:
```sql
SELECT rc_papers.*, rank
FROM rc_papers_fts
JOIN rc_papers ON rc_papers.rowid = rc_papers_fts.rowid
WHERE rc_papers_fts MATCH ?
  AND json_extract(rc_papers.metadata, '$.deleted_at') IS NULL
ORDER BY rank
LIMIT ? OFFSET ?;
```

If FTS5 throws a parse error, fall back to:
```sql
SELECT * FROM rc_papers
WHERE (title LIKE ? OR abstract LIKE ? OR authors LIKE ?)
  AND json_extract(metadata, '$.deleted_at') IS NULL
ORDER BY added_at DESC
LIMIT ? OFFSET ?;
```

### 5.18 `rc.lit.duplicate_check`

Check if a paper already exists by DOI, arXiv ID, or title similarity.

**Params**:
```typescript
Type.Object({
  doi: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  arxiv_id: Type.Optional(Type.String()),
})
```

At least one of `doi`, `title`, or `arxiv_id` must be provided.

**Returns**:
```typescript
Type.Object({
  duplicates: Type.Array(Type.Object({
    paper: Paper,
    match_type: Type.Union([
      Type.Literal('doi'),
      Type.Literal('arxiv_id'),
      Type.Literal('title_exact'),
      Type.Literal('title_fuzzy'),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
  })),
})
```

**Matching strategy** (in priority order):
1. **DOI exact match**: `WHERE doi = ?` -- confidence 1.0
2. **arXiv ID exact match**: `WHERE arxiv_id = ?` -- confidence 1.0
3. **Title exact match**: `WHERE LOWER(title) = LOWER(?)` -- confidence 0.95
4. **Title fuzzy match**: FTS5 `MATCH` on title -- confidence 0.5-0.9 based on rank

### 5.19 `rc.lit.batch_add`
Batch add multiple papers.
- **Params:** `{ papers: Array<{doi?: string, title?: string, bibtex?: string}> }`
- **Returns:** `{ added: number, duplicates: number, errors: Array<{index: number, reason: string}> }`

### 5.20 `rc.lit.import_bibtex`
Import papers from BibTeX string or file content.
- **Params:** `{ bibtex: string }`
- **Returns:** `{ imported: number, skipped: number }`

### 5.21 `rc.lit.export_bibtex`
Export selected papers as BibTeX.
- **Params:** `{ paperIds?: string[], tag?: string, collection?: string, all?: boolean }`
- **Returns:** `{ bibtex: string, count: number }`

### 5.22 `rc.lit.collections.list`
List all collections with paper counts.
- **Params:** `{}`
- **Returns:** Collection array

### 5.23 `rc.lit.collections.manage`
Create, update, or delete a collection; add/remove papers.
- **Params:** `{ action: "create"|"update"|"delete"|"add_paper"|"remove_paper", id?: string, name?: string, description?: string, color?: string, paper_ids?: string[] }`
- **Returns:** `{ id: string, action: string }`

### 5.24 `rc.lit.notes.list`
List notes for a paper.
- **Params:** `{ paper_id: string }`
- **Returns:** `PaperNote[]`

### 5.25 `rc.lit.notes.add`
Add a note to a paper.
- **Params:** `{ paper_id: string, content: string, page?: number, highlight?: string }`
- **Returns:** `PaperNote`

### 5.26 `rc.lit.notes.delete`
Delete a note.
- **Params:** `{ note_id: string }`
- **Returns:** `{ ok: true }`

---

## 6. Zotero Interop

### 6.1 Overview

The Zotero bridge provides read-only, one-way import from a local Zotero installation.
Research-Claw never writes to the Zotero database.

### 6.2 Zotero Detection

```typescript
const ZOTERO_PATHS = [
  // macOS
  path.join(os.homedir(), 'Zotero', 'zotero.sqlite'),
  // Linux
  path.join(os.homedir(), '.zotero', 'zotero', '*.default', 'zotero', 'zotero.sqlite'),
  path.join(os.homedir(), 'snap', 'zotero-snap', 'common', 'Zotero', 'zotero.sqlite'),
  // Windows (via WSL or native)
  path.join(os.homedir(), 'Zotero', 'zotero.sqlite'),
];
```

Detection is attempted in order. The first existing file is used. If no file is
found, Zotero features are disabled (no error).

### 6.3 Lock File Handling

Zotero uses SQLite WAL mode and may hold locks during operation. The bridge handles
this as follows:

```
1. Check if `zotero.sqlite-journal` or `zotero.sqlite-wal` exists AND Zotero process is running
2. Open the database with SQLITE_OPEN_READONLY flag
3. Set PRAGMA query_only = ON
4. If SQLITE_BUSY is returned:
   a. Wait 500ms
   b. Retry (max 3 attempts)
   c. If all retries fail, log warning and skip import
5. Never use WAL mode on the Zotero DB (read-only)
```

### 6.4 Schema Mapping

The Zotero SQLite schema is complex. The bridge reads from these tables:

```
Zotero tables used (read-only):
  items              → paper record
  itemData           → key-value metadata
  itemDataValues     → actual values
  fields             → field name definitions
  creators           → author records
  itemCreators       → item-author junction
  creatorTypes       → author role types
  itemAttachments    → PDF attachment paths
  collections        → Zotero collections
  collectionItems    → collection membership
  tags               → tag definitions
  itemTags           → item-tag junction
```

**Field mapping from Zotero to rc_papers**:

| Zotero field (via itemData) | rc_papers column |
|---|---|
| `title` | `title` |
| `abstractNote` | `abstract` |
| `DOI` | `doi` |
| `url` | `url` |
| `date` (parsed year) | `year` |
| `publicationTitle` / `proceedingsTitle` | `venue` |
| creators (firstName + lastName) | `authors` (JSON array) |
| itemAttachments.path | `pdf_path` |
| `extra` field parsed for arXiv ID | `arxiv_id` |
| Zotero itemID | `source_id` |
| — | `source = 'zotero'` |

**Zotero query for paper extraction**:

```sql
SELECT
  i.itemID,
  i.key AS zotero_key,
  MAX(CASE WHEN f.fieldName = 'title' THEN idv.value END) AS title,
  MAX(CASE WHEN f.fieldName = 'abstractNote' THEN idv.value END) AS abstract,
  MAX(CASE WHEN f.fieldName = 'DOI' THEN idv.value END) AS doi,
  MAX(CASE WHEN f.fieldName = 'url' THEN idv.value END) AS url,
  MAX(CASE WHEN f.fieldName = 'date' THEN idv.value END) AS date_str,
  MAX(CASE WHEN f.fieldName = 'publicationTitle' THEN idv.value END) AS venue_journal,
  MAX(CASE WHEN f.fieldName = 'proceedingsTitle' THEN idv.value END) AS venue_conf,
  MAX(CASE WHEN f.fieldName = 'extra' THEN idv.value END) AS extra
FROM items i
JOIN itemData id ON i.itemID = id.itemID
JOIN itemDataValues idv ON id.valueID = idv.valueID
JOIN fields f ON id.fieldID = f.fieldID
WHERE i.itemTypeID NOT IN (
  SELECT itemTypeID FROM itemTypes WHERE typeName IN ('attachment', 'note', 'annotation')
)
GROUP BY i.itemID;
```

**Author extraction**:

```sql
SELECT
  c.firstName,
  c.lastName
FROM itemCreators ic
JOIN creators c ON ic.creatorID = c.creatorID
JOIN creatorTypes ct ON ic.creatorTypeID = ct.creatorTypeID
WHERE ic.itemID = ?
  AND ct.creatorTypeName IN ('author', 'contributor')
ORDER BY ic.orderIndex;
```

### 6.5 Import Process

```
ZoteroBridge.import(options?: { collection?: string, since?: Date }):

1. Detect Zotero DB path
2. Open read-only connection (with lock retry)
3. Query all qualifying items (or filter by collection/date)
4. For each Zotero item:
   a. Extract metadata via field mapping
   b. Parse authors from itemCreators
   c. Extract arXiv ID from `extra` field (regex: /arXiv:\s*(\d{4}\.\d{4,5})/i)
   d. Resolve PDF path from itemAttachments (storage:filename → Zotero storage dir)
   e. Check for duplicate in rc_papers by DOI, then arxiv_id, then source_id
   f. If no duplicate: INSERT into rc_papers with source='zotero'
   g. If duplicate: skip (log as already imported)
   h. Import Zotero tags as rc_tags
5. Close Zotero connection
6. Return { imported: number, skipped: number, errors: string[] }
```

### 6.6 PDF Path Resolution

Zotero stores PDFs in its own storage directory structure:

```
~/Zotero/storage/{8-char-key}/{filename}.pdf
```

The bridge resolves the full path:
1. Read `itemAttachments.path` — format is `storage:{filename}`
2. Read `items.key` for the parent item's 8-character key
3. Construct: `{zotero_data_dir}/storage/{key}/{filename}`
4. Verify the file exists
5. Store the absolute path in `rc_papers.pdf_path`

If the file does not exist at the resolved path, `pdf_path` is set to `null` and
a warning is logged.

---

## 7. Data Flow Diagrams

### 7.1 Agent Tool Flow (e.g., library_add_paper)

```
┌──────────┐     ┌──────────────┐     ┌───────────────────┐     ┌────────┐
│  Agent   │────>│  Tool Call   │────>│  LiteratureService │────>│ SQLite │
│ (Claude) │     │ library_add  │     │  .addPaper()       │     │  DB    │
│          │<────│  _paper      │<────│                    │<────│        │
│          │     │              │     │  1. Validate input │     │        │
│          │     │  TypeBox     │     │  2. Check dupes    │     │        │
│          │     │  validation  │     │  3. Generate UUID  │     │        │
│          │     │              │     │  4. INSERT paper   │     │        │
│          │     │              │     │  5. Create tags    │     │        │
│          │     │              │     │  6. Return Paper   │     │        │
└──────────┘     └──────────────┘     └───────────────────┘     └────────┘
```

### 7.2 Dashboard RPC Flow (e.g., rc.lit.list)

```
┌───────────┐     ┌──────────┐     ┌───────────────────┐     ┌────────┐
│ Dashboard │────>│ Gateway  │────>│  LiteratureService │────>│ SQLite │
│   (Lit    │ WS  │ WS RPC   │     │  .listPapers()     │     │  DB    │
│    Web    │     │ Handler  │     │                    │     │        │
│    UI)    │<────│          │<────│  1. Build WHERE    │<────│        │
│           │     │ rc.lit   │     │  2. Apply sort     │     │        │
│           │     │ .list    │     │  3. COUNT total    │     │        │
│           │     │          │     │  4. SELECT + LIMIT │     │        │
│           │     │          │     │  5. Hydrate tags   │     │        │
└───────────┘     └──────────┘     └───────────────────┘     └────────┘
```

### 7.3 Reading Session Lifecycle

```
┌──────────┐                    ┌───────────────────┐     ┌────────┐
│  Agent   │                    │  LiteratureService │     │ SQLite │
└────┬─────┘                    └────────┬──────────┘     └───┬────┘
     │                                   │                    │
     │  library_get_paper(id)            │                    │
     │──────────────────────────────────>│  SELECT            │
     │                                   │───────────────────>│
     │  Paper { status: 'unread' }       │                    │
     │<──────────────────────────────────│<───────────────────│
     │                                   │                    │
     │  [Agent reads & discusses paper]  │                    │
     │                                   │                    │
     │  rc.lit.reading.start(paper_id)   │                    │
     │──────────────────────────────────>│  UPDATE status     │
     │                                   │  INSERT session    │
     │                                   │───────────────────>│
     │  ReadingSession { started_at }    │                    │
     │<──────────────────────────────────│<───────────────────│
     │                                   │                    │
     │  [...time passes, agent works...] │                    │
     │                                   │                    │
     │  rc.lit.reading.end(session_id,   │                    │
     │    notes, pages_read)             │                    │
     │──────────────────────────────────>│  UPDATE session    │
     │                                   │  (ended_at, dur.)  │
     │                                   │───────────────────>│
     │  ReadingSession { duration: 45 }  │                    │
     │<──────────────────────────────────│<───────────────────│
     │                                   │                    │
```

### 7.4 Zotero Import Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────┐
│  Agent   │────>│ ZoteroBridge │────>│ Zotero SQLite│     │ RC DB  │
│  or      │     │  .import()   │     │ (read-only)  │     │        │
│  User    │     │              │     │              │     │        │
│          │     │  1. Detect   │     │              │     │        │
│          │     │  2. Open RO  │────>│              │     │        │
│          │     │  3. Query    │     │  items,      │     │        │
│          │     │     items    │<────│  itemData,   │     │        │
│          │     │  4. Map      │     │  creators    │     │        │
│          │     │     fields   │     │              │     │        │
│          │     │  5. Check    │     │              │     │        │
│          │     │     dupes    │─────│──────────────│────>│        │
│          │     │  6. INSERT   │     │              │     │        │
│          │     │     papers   │─────│──────────────│────>│        │
│          │<────│  7. Return   │     │              │     │        │
│          │     │     summary  │     │              │     │        │
└──────────┘     └──────────────┘     └──────────────┘     └────────┘
```

### 7.5 FTS5 Search Flow

```
┌──────────┐     ┌──────────────────────────────────────────┐
│  Query   │     │              SQLite Engine                │
│  Input   │     │                                          │
└────┬─────┘     │  ┌──────────────────┐                    │
     │           │  │  rc_papers_fts   │  FTS5 inverted     │
     │  MATCH ?  │  │  (virtual table) │  index on          │
     │──────────>│  │  title           │  title, authors,   │
     │           │  │  authors         │  abstract, notes   │
     │           │  │  abstract        │                    │
     │           │  │  notes           │                    │
     │           │  └────────┬─────────┘                    │
     │           │           │ rowid match                  │
     │           │           ▼                              │
     │           │  ┌──────────────────┐                    │
     │           │  │    rc_papers     │  JOIN on rowid     │
     │           │  │  (content table) │  to get full       │
     │  Results  │  │                  │  paper records     │
     │<──────────│  └──────────────────┘                    │
     │           │                                          │
     │           │  On FTS5 parse error:                    │
     │           │  ┌──────────────────┐                    │
     │  Fallback │  │  LIKE '%q%'      │  Scan on title,   │
     │<──────────│  │  on rc_papers    │  abstract, authors │
     │           │  └──────────────────┘                    │
     │           │                                          │
└──────────┘     └──────────────────────────────────────────┘
```

---

## 8. Error Handling

### 8.1 Error Code Registry

All errors returned by LiteratureService use structured error objects compatible
with JSON-RPC 2.0 error responses.

| Code | Constant | Message | Trigger |
|---|---|---|---|
| -32001 | `PAPER_NOT_FOUND` | Paper not found | GET/UPDATE/DELETE with invalid ID |
| -32002 | `DUPLICATE_PAPER` | Paper already exists | ADD with existing DOI or arXiv ID |
| -32003 | `TAG_NOT_FOUND` | Tag not found | UNTAG with non-existent tag |
| -32004 | `COLLECTION_NOT_FOUND` | Collection not found | Collection operation with invalid ID |
| -32005 | `SESSION_NOT_FOUND` | Reading session not found | END with invalid session ID |
| -32006 | `SESSION_ALREADY_ENDED` | Reading session already ended | END on a completed session |
| -32007 | `SELF_CITATION` | Cannot cite self | CITE with citing_id === cited_id |
| -32008 | `ZOTERO_NOT_FOUND` | Zotero database not found | Import when Zotero is not installed |
| -32009 | `ZOTERO_LOCKED` | Zotero database is locked | All retries exhausted |
| -32010 | `BIBTEX_PARSE_ERROR` | Failed to parse BibTeX | Malformed BibTeX input |
| -32011 | `VALIDATION_ERROR` | Validation failed | Missing required fields |
| -32012 | `FTS_QUERY_ERROR` | Search query syntax error | Invalid FTS5 syntax (internal, triggers fallback) |

### 8.2 Duplicate DOI Handling

When `library_add_paper` or `rc.lit.add` receives a paper with a DOI or arXiv ID
that already exists:

```typescript
// 1. Check DOI
if (input.doi) {
  const existing = db.prepare(
    'SELECT * FROM rc_papers WHERE doi = ? AND json_extract(metadata, \'$.deleted_at\') IS NULL'
  ).get(input.doi);
  if (existing) {
    return { ...hydratePaper(existing), duplicate: true };
  }
}

// 2. Check arXiv ID
if (input.arxiv_id) {
  const existing = db.prepare(
    'SELECT * FROM rc_papers WHERE arxiv_id = ? AND json_extract(metadata, \'$.deleted_at\') IS NULL'
  ).get(input.arxiv_id);
  if (existing) {
    return { ...hydratePaper(existing), duplicate: true };
  }
}

// 3. No duplicate — proceed with INSERT
```

This is **not an error**. The response includes the full paper object with
`duplicate: true` so the agent can inform the user and optionally update the
existing record.

### 8.3 Missing Required Fields

When TypeBox validation fails, the error includes the list of missing/invalid fields:

```json
{
  "code": -32011,
  "message": "Validation failed",
  "data": {
    "errors": [
      { "path": "/title", "message": "Required property" },
      { "path": "/authors", "message": "Expected array with at least 1 items" }
    ]
  }
}
```

### 8.4 Zotero Lock Retry

```typescript
async function openZoteroReadOnly(dbPath: string): Promise<Database> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      db.pragma('query_only = ON');
      // Test query to verify access
      db.prepare('SELECT COUNT(*) FROM items').get();
      return db;
    } catch (err: any) {
      if (err.code === 'SQLITE_BUSY' && attempt < MAX_RETRIES) {
        logger.warn(`Zotero DB locked, retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      if (attempt === MAX_RETRIES) {
        throw new RpcError(-32009, 'Zotero database is locked after 3 retries');
      }
      throw err;
    }
  }
  throw new RpcError(-32008, 'Zotero database not found');
}
```

### 8.5 FTS5 Query Syntax Fallback

FTS5 has its own query syntax (AND, OR, NOT, "phrases", prefix*). User queries
may contain characters that break FTS5 parsing (unbalanced quotes, stray operators).

```typescript
function searchPapers(query: string, limit: number, offset: number): SearchResult {
  try {
    // Attempt FTS5 search
    const rows = db.prepare(`
      SELECT rc_papers.*, rank
      FROM rc_papers_fts
      JOIN rc_papers ON rc_papers.rowid = rc_papers_fts.rowid
      WHERE rc_papers_fts MATCH ?
        AND json_extract(rc_papers.metadata, '$.deleted_at') IS NULL
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).all(query, limit, offset);

    const total = db.prepare(`
      SELECT COUNT(*)
      FROM rc_papers_fts
      JOIN rc_papers ON rc_papers.rowid = rc_papers_fts.rowid
      WHERE rc_papers_fts MATCH ?
        AND json_extract(rc_papers.metadata, '$.deleted_at') IS NULL
    `).get(query) as { 'COUNT(*)': number };

    return { items: rows.map(hydratePaper), total: total['COUNT(*)'] };
  } catch (err: any) {
    // FTS5 syntax error — fall back to LIKE
    if (err.message?.includes('fts5: syntax error') || err.message?.includes('parse error')) {
      const likePattern = `%${query}%`;
      const rows = db.prepare(`
        SELECT * FROM rc_papers
        WHERE (title LIKE ? OR abstract LIKE ? OR authors LIKE ?)
          AND json_extract(metadata, '$.deleted_at') IS NULL
        ORDER BY added_at DESC
        LIMIT ? OFFSET ?
      `).all(likePattern, likePattern, likePattern, limit, offset);

      const total = db.prepare(`
        SELECT COUNT(*) FROM rc_papers
        WHERE (title LIKE ? OR abstract LIKE ? OR authors LIKE ?)
          AND json_extract(metadata, '$.deleted_at') IS NULL
      `).get(likePattern, likePattern, likePattern) as { 'COUNT(*)': number };

      return { items: rows.map(hydratePaper), total: total['COUNT(*)'] };
    }
    throw err;
  }
}
```

### 8.6 Batch Operation Error Isolation

In `library_batch_add`, each paper is processed independently. A failure on one
paper does not abort the batch:

```typescript
function batchAdd(papers: PaperInput[]): BatchResult {
  const result: BatchResult = { added: [], duplicates: [], errors: [] };

  const transaction = db.transaction(() => {
    for (let i = 0; i < papers.length; i++) {
      try {
        const paper = addPaper(papers[i]);
        if ('duplicate' in paper && paper.duplicate) {
          result.duplicates.push(paper);
        } else {
          result.added.push(paper);
        }
      } catch (err: any) {
        result.errors.push({ index: i, error: err.message });
      }
    }
  });

  transaction();
  return result;
}
```

---

## 9. Implementation Notes

### 9.1 Service Architecture

The `LiteratureService` class is the single point of access for all literature
operations. Both agent tools and RPC methods delegate to the same service instance.

```typescript
class LiteratureService {
  private db: Database;
  private zoteroBridge: ZoteroBridge;

  constructor(dbPath: string) { /* ... */ }

  // Paper CRUD
  addPaper(input: PaperInput): Paper;
  getPaper(id: string): Paper;
  updatePaper(id: string, patch: PaperPatch): Paper;
  deletePaper(id: string): void;
  listPapers(opts: ListOptions): { items: Paper[], total: number };

  // Search
  searchPapers(query: string, limit: number, offset: number): SearchResult;
  duplicateCheck(doi?: string, title?: string, arxivId?: string): DuplicateResult;

  // Tags
  listTags(): TagWithCount[];
  tagPaper(paperId: string, tagName: string, color?: string): string[];
  untagPaper(paperId: string, tagName: string): string[];

  // Collections
  createCollection(name: string, opts?: CollectionOpts): Collection;
  updateCollection(id: string, patch: Partial<Collection>): Collection;
  deleteCollection(id: string): void;
  addPapersToCollection(collectionId: string, paperIds: string[]): void;
  removePapersFromCollection(collectionId: string, paperIds: string[]): void;

  // Reading sessions
  startReading(paperId: string): ReadingSession;
  endReading(sessionId: string, notes?: string, pagesRead?: number): ReadingSession;
  listReadingSessions(paperId: string): ReadingSession[];

  // Citations
  addCitation(citingId: string, citedId: string, context?: string, section?: string): Citation;
  getCitations(paperId: string, direction: 'citing' | 'cited_by' | 'both'): CitationResult;
  getCitationGraph(paperId: string, direction: string, depth: number): GraphResult;

  // Stats
  getStats(): LibraryStats;
  getReadingStats(period: 'week' | 'month' | 'year' | 'all'): ReadingStats;

  // BibTeX
  exportBibtex(paperIds: string[], style: CitationStyle): string;
  importBibtex(content: string, tags?: string[], collectionId?: string): BatchResult;

  // Zotero
  importFromZotero(opts?: ZoteroImportOptions): ZoteroImportResult;

  // Notes
  appendNote(paperId: string, noteText: string): Paper;

  // Lifecycle
  close(): void;
}
```

### 9.2 Tool Registration Pattern

Each tool is registered in the plugin's `register()` function:

```typescript
api.registerTool({
  name: 'library_add_paper',
  description: 'Add a paper to the literature library with metadata, DOI, and tags.',
  parameters: LibraryAddPaperParams,
  async handler(params) {
    const validated = validateParams(LibraryAddPaperParams, params);
    return literatureService.addPaper(validated);
  },
});
```

### 9.3 RPC Registration Pattern

Each RPC method is registered on the gateway:

```typescript
api.registerRpcMethod({
  method: 'rc.lit.list',
  handler: async (params) => {
    const { offset = 0, limit = 20, sort, filter } = params;
    return literatureService.listPapers({ offset, limit, sort, filter });
  },
});
```

### 9.4 UUID Generation

All IDs use UUIDv4 generated via `crypto.randomUUID()` (Node.js 19+). This avoids
external dependencies for ID generation.

### 9.5 Timestamp Format

All timestamps are ISO 8601 strings with timezone offset, generated via:

```typescript
new Date().toISOString(); // "2026-03-11T08:30:00.000Z"
```

### 9.6 JSON Field Handling

The `authors` and `metadata` columns store JSON text. On read, they are parsed to
native types. On write, they are serialized:

```typescript
// Write
db.prepare('INSERT INTO rc_papers (authors, metadata, ...) VALUES (?, ?, ...)')
  .run(JSON.stringify(authors), JSON.stringify(metadata ?? {}));

// Read
function hydratePaper(row: any): Paper {
  return {
    ...row,
    authors: JSON.parse(row.authors),
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    tags: getTagsForPaper(row.id),
  };
}
```

### 9.7 Transaction Strategy

- **Single writes** (add, update, delete): No explicit transaction needed (SQLite
  auto-wraps single statements).
- **Batch operations** (batch_add, import_bibtex, zotero_import): Wrapped in
  `db.transaction()` for atomicity.
- **Read-then-write** (tag_paper, append_note): Wrapped in `db.transaction()` to
  prevent TOCTOU races.
- **Stats queries**: No transaction needed (read-only, eventual consistency is fine).

### 9.8 Connection Lifecycle

```
gateway_start → open DB, run migrations, set PRAGMAs
session_start → verify DB is open, log session
session_end   → close any open reading sessions
gateway_stop  → close DB connection
```

The `better-sqlite3` library is synchronous, so no async overhead on queries.
The database file is opened once and reused for the lifetime of the gateway process.

### 9.9 Migration System

Migrations are sequential functions keyed by version number:

```typescript
const migrations: Record<number, (db: Database) => void> = {
  1: (db) => {
    // Initial schema — all CREATE TABLE, CREATE INDEX, CREATE TRIGGER statements
    db.exec(SCHEMA_V1);
  },
  // Future migrations:
  // 2: (db) => { db.exec('ALTER TABLE rc_papers ADD COLUMN ...'); },
};

function runMigrations(db: Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS rc_schema_version (version INTEGER NOT NULL, applied_at TEXT NOT NULL)');

  const current = db.prepare('SELECT MAX(version) as v FROM rc_schema_version').get() as { v: number | null };
  const currentVersion = current?.v ?? 0;

  const pending = Object.keys(migrations)
    .map(Number)
    .filter(v => v > currentVersion)
    .sort((a, b) => a - b);

  if (pending.length === 0) return;

  const applyAll = db.transaction(() => {
    for (const version of pending) {
      migrations[version](db);
      db.prepare('INSERT INTO rc_schema_version (version, applied_at) VALUES (?, ?)')
        .run(version, new Date().toISOString());
    }
  });

  applyAll();
}
```

### 9.10 BibTeX Generation

For `bibtex` style export, entries are generated as:

```bibtex
@article{vaswani2017attention,
  title     = {Attention Is All You Need},
  author    = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki},
  year      = {2017},
  journal   = {Advances in Neural Information Processing Systems},
  doi       = {10.5555/3295222.3295349},
  url       = {https://arxiv.org/abs/1706.03762},
  abstract  = {The dominant sequence transduction models are based on...},
}
```

**Entry type selection**:
- If `venue` contains "conference", "proceedings", "proc.", "workshop", or "symposium" (case-insensitive): `@inproceedings`
- If `arxiv_id` is set and no venue: `@misc` with `archiveprefix={arXiv}` and `eprint={...}`
- Otherwise: `@article`

**Author formatting** for BibTeX: `{LastName, FirstName and LastName, FirstName}`.
For single-name authors (no space), use the name as-is. For multi-word names,
the last word is treated as the last name.

### 9.11 Performance Characteristics

| Operation | Expected Latency | Notes |
|---|---|---|
| FTS5 search (10k papers) | < 5ms | Inverted index lookup |
| LIKE fallback (10k papers) | < 50ms | Full table scan |
| Add single paper | < 2ms | INSERT + index updates |
| Batch add (100 papers) | < 100ms | Single transaction |
| Citation graph (depth=2) | < 20ms | BFS with cached lookups |
| Zotero import (1000 papers) | < 5s | Batch read + batch insert |
| Stats aggregate | < 10ms | Indexed COUNT/GROUP BY |
| Export BibTeX (50 papers) | < 5ms | String concatenation |

### 9.12 Cross-References to Other Documents

| Reference | Target | Purpose |
|---|---|---|
| SQLite strategy | `docs/02-engineering-architecture.md` | WAL mode, PRAGMA settings, connection pooling |
| Plugin aggregation | `docs/modules/03f-research-claw-core-plugin.md` | How this module is registered in the plugin |
| `paper_card` type | `docs/modules/03d-message-card-protocol.md` | Card format for displaying papers in chat |
| Task linking | `docs/modules/03b-task-system.md` | Tasks can reference `paper_id` in rc_papers |
| Dashboard UI | `docs/modules/03e-dashboard-ui.md` | Literature tab in the dashboard |

### 9.13 Testing Strategy

Tests are located at `test/literature/` and use the vitest framework configured
in the project root.

| Test file | Coverage target |
|---|---|
| `service.test.ts` | LiteratureService CRUD, search, tags, collections |
| `tools.test.ts` | Tool parameter validation and handler dispatch |
| `rpc.test.ts` | RPC method parameter mapping and error codes |
| `zotero.test.ts` | Zotero bridge detection, mapping, lock handling |
| `bibtex.test.ts` | BibTeX import parsing and export formatting |
| `fts.test.ts` | FTS5 indexing, query syntax, fallback behavior |

All tests use an in-memory SQLite database (`':memory:'`) with the full schema
applied. No filesystem or network access needed.

---

*End of document 03a. This specification is sufficient for independent implementation
of the Literature Library module without reference to other documents, though
cross-references above point to related concerns.*
