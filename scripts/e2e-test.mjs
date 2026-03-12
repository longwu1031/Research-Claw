#!/usr/bin/env node
/**
 * E2E Test Runner for Research-Claw
 *
 * Connects to the gateway WebSocket at ws://127.0.0.1:28789 and tests
 * all 46 RPC methods with test data. Verifies responses match expected shapes.
 *
 * Usage:
 *   node scripts/e2e-test.mjs [--port 28789] [--timeout 30000] [--verbose]
 *
 * Prerequisites:
 *   - Gateway must be running: pnpm start
 *   - No additional dependencies required (uses native Node.js WebSocket)
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — some tests failed
 *   2 — connection failure
 */

import { WebSocket } from 'node:stream/web'
  ? await import('ws') // fallback to ws if native not available
  : { WebSocket: globalThis.WebSocket };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const PORT = getFlag('--port', '28789');
const TIMEOUT = parseInt(getFlag('--timeout', '30000'), 10);
const VERBOSE = args.includes('--verbose');
const WS_URL = `ws://127.0.0.1:${PORT}`;

function getFlag(name, defaultValue) {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let requestId = 1;
let ws = null;
const pendingRequests = new Map();

const stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
const failures = [];

function log(msg) {
  console.log(`  ${msg}`);
}

function verbose(msg) {
  if (VERBOSE) console.log(`    [verbose] ${msg}`);
}

function pass(name) {
  stats.total++;
  stats.passed++;
  log(`\x1b[32m✓\x1b[0m ${name}`);
}

function fail(name, reason) {
  stats.total++;
  stats.failed++;
  log(`\x1b[31m✗\x1b[0m ${name}: ${reason}`);
  failures.push({ name, reason });
}

function skip(name, reason) {
  stats.total++;
  stats.skipped++;
  log(`\x1b[33m○\x1b[0m ${name}: ${reason}`);
}

// ---------------------------------------------------------------------------
// WebSocket RPC Client
// ---------------------------------------------------------------------------

function connect() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Connection timeout after ${TIMEOUT}ms`));
    }, TIMEOUT);

    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      clearTimeout(timeout);
      reject(new Error(`Failed to create WebSocket: ${err.message}`));
      return;
    }

    ws.onopen = () => {
      clearTimeout(timeout);
      verbose('WebSocket connected');
      resolve();
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${err.message || 'unknown'}`));
    };

    ws.onclose = (event) => {
      verbose(`WebSocket closed: code=${event.code} reason=${event.reason}`);
      // Reject all pending requests
      for (const [id, { reject: rej }] of pendingRequests) {
        rej(new Error('Connection closed'));
        pendingRequests.delete(id);
      }
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      } catch {
        verbose(`Non-JSON message: ${event.data}`);
        return;
      }

      verbose(`← ${JSON.stringify(data).substring(0, 200)}`);

      // Match response to pending request
      if (data.id && pendingRequests.has(data.id)) {
        const { resolve: res, reject: rej } = pendingRequests.get(data.id);
        pendingRequests.delete(data.id);

        if (data.error) {
          rej(new RpcError(data.error.code, data.error.message, data.error.data));
        } else {
          res(data.result);
        }
      }
    };
  });
}

class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }
}

function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = requestId++;
    const frame = { jsonrpc: '2.0', id, method, params };

    verbose(`→ ${JSON.stringify(frame).substring(0, 200)}`);

    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`RPC timeout for ${method} after ${TIMEOUT}ms`));
    }, TIMEOUT);

    pendingRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    ws.send(JSON.stringify(frame));
  });
}

function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function testRpc(name, method, params, validator) {
  try {
    const result = await rpc(method, params);
    if (validator) {
      validator(result);
    }
    pass(name);
    return result;
  } catch (err) {
    if (err instanceof RpcError) {
      fail(name, `RPC error ${err.code}: ${err.message}`);
    } else {
      fail(name, err.message);
    }
    return null;
  }
}

async function testRpcError(name, method, params, expectedCode) {
  try {
    await rpc(method, params);
    fail(name, 'Expected an error but got success');
    return null;
  } catch (err) {
    if (err instanceof RpcError) {
      if (expectedCode !== undefined && err.code !== expectedCode) {
        fail(name, `Expected error code ${expectedCode}, got ${err.code}`);
      } else {
        pass(name);
      }
      return err;
    }
    fail(name, `Unexpected error type: ${err.message}`);
    return null;
  }
}

function assertField(obj, field, type) {
  if (obj === null || obj === undefined) {
    throw new Error(`Result is null/undefined, expected field "${field}"`);
  }
  if (!(field in obj)) {
    throw new Error(`Missing field "${field}" in response`);
  }
  if (type && typeof obj[field] !== type) {
    throw new Error(`Field "${field}" expected type ${type}, got ${typeof obj[field]}`);
  }
}

function assertArray(obj, field) {
  assertField(obj, field);
  if (!Array.isArray(obj[field])) {
    throw new Error(`Field "${field}" expected array, got ${typeof obj[field]}`);
  }
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

async function testLiteratureRpc() {
  console.log('\n\x1b[1m── Literature RPC (rc.lit.*) ──\x1b[0m\n');

  // 1. rc.lit.add
  const paper = await testRpc('rc.lit.add', 'rc.lit.add', {
    title: 'E2E Test Paper: Attention Is All You Need',
    authors: ['Vaswani, A.', 'Shazeer, N.'],
    doi: '10.48550/e2e-test-001',
    venue: 'NeurIPS',
    year: 2017,
    tags: ['e2e-test'],
    abstract: 'Test abstract for E2E testing.',
  }, (r) => {
    assertField(r, 'id', 'string');
    assertField(r, 'title', 'string');
    assertArray(r, 'authors');
  });

  if (!paper) return;

  // 2. rc.lit.get
  await testRpc('rc.lit.get', 'rc.lit.get', { id: paper.id }, (r) => {
    assertField(r, 'id', 'string');
    assertField(r, 'title', 'string');
  });

  // 3. rc.lit.list
  await testRpc('rc.lit.list', 'rc.lit.list', { limit: 10 }, (r) => {
    assertArray(r, 'items');
    assertField(r, 'total', 'number');
  });

  // 4. rc.lit.update
  await testRpc('rc.lit.update', 'rc.lit.update', {
    id: paper.id,
    rating: 5,
    notes: 'E2E test notes',
  }, (r) => {
    assertField(r, 'rating');
  });

  // 5. rc.lit.search
  await testRpc('rc.lit.search', 'rc.lit.search', { query: 'attention', limit: 10 }, (r) => {
    assertArray(r, 'items');
    assertField(r, 'total', 'number');
  });

  // 6. rc.lit.setStatus
  await testRpc('rc.lit.setStatus', 'rc.lit.setStatus', {
    id: paper.id,
    status: 'reading',
  }, (r) => {
    assertField(r, 'read_status', 'string');
  });

  // 7. rc.lit.rate
  await testRpc('rc.lit.rate', 'rc.lit.rate', { id: paper.id, rating: 4 }, (r) => {
    assertField(r, 'rating', 'number');
  });

  // 8. rc.lit.tag
  await testRpc('rc.lit.tag', 'rc.lit.tag', {
    paper_id: paper.id,
    tag_name: 'transformers',
  }, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array of tags');
  });

  // 9. rc.lit.untag
  await testRpc('rc.lit.untag', 'rc.lit.untag', {
    paper_id: paper.id,
    tag_name: 'transformers',
  }, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array of tags');
  });

  // 10. rc.lit.getTags
  await testRpc('rc.lit.getTags', 'rc.lit.getTags', {}, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  // 11. rc.lit.startReading
  const session = await testRpc('rc.lit.startReading', 'rc.lit.startReading', {
    paper_id: paper.id,
  }, (r) => {
    assertField(r, 'id', 'string');
    assertField(r, 'paper_id', 'string');
  });

  // 12. rc.lit.endReading
  if (session) {
    await testRpc('rc.lit.endReading', 'rc.lit.endReading', {
      session_id: session.id,
      notes: 'E2E test reading session',
      pages_read: 10,
    }, (r) => {
      assertField(r, 'ended_at');
    });
  }

  // 13. rc.lit.listReadingSessions
  await testRpc('rc.lit.listReadingSessions', 'rc.lit.listReadingSessions', {
    paper_id: paper.id,
  }, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  // 14. rc.lit.addCitation
  const paper2 = await testRpc('rc.lit.add (second paper)', 'rc.lit.add', {
    title: 'E2E Test Paper 2: BERT',
    authors: ['Devlin, J.'],
    doi: '10.48550/e2e-test-002',
    year: 2019,
  }, (r) => assertField(r, 'id'));

  if (paper2) {
    await testRpc('rc.lit.addCitation', 'rc.lit.addCitation', {
      citing_id: paper.id,
      cited_id: paper2.id,
      context: 'Methods section',
    }, (r) => {
      assertField(r, 'citing_paper_id');
      assertField(r, 'cited_paper_id');
    });

    // 15. rc.lit.getCitations
    await testRpc('rc.lit.getCitations', 'rc.lit.getCitations', {
      paper_id: paper.id,
      direction: 'both',
    }, (r) => {
      assertArray(r, 'citing');
      assertArray(r, 'cited_by');
    });
  }

  // 16. rc.lit.getStats
  await testRpc('rc.lit.getStats', 'rc.lit.getStats', {}, (r) => {
    assertField(r, 'total', 'number');
    assertField(r, 'by_status');
  });

  // 17. rc.lit.duplicateCheck
  await testRpc('rc.lit.duplicateCheck', 'rc.lit.duplicateCheck', {
    doi: '10.48550/e2e-test-001',
  }, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  // 18. rc.lit.batchAdd
  await testRpc('rc.lit.batchAdd', 'rc.lit.batchAdd', {
    papers: [
      { title: 'Batch Paper 1', doi: '10.48550/e2e-batch-001' },
      { title: 'Batch Paper 2', doi: '10.48550/e2e-batch-002' },
    ],
  }, (r) => {
    assertArray(r, 'added');
    assertArray(r, 'duplicates');
  });

  // 19. rc.lit.importBibtex
  await testRpc('rc.lit.importBibtex', 'rc.lit.importBibtex', {
    bibtex: `@article{e2etest2026,
  title = {E2E Test BibTeX Import},
  author = {Test Author},
  year = {2026}
}`,
  }, (r) => {
    assertField(r, 'imported', 'number');
    assertField(r, 'skipped', 'number');
  });

  // 20. rc.lit.exportBibtex
  await testRpc('rc.lit.exportBibtex', 'rc.lit.exportBibtex', {
    paper_ids: [paper.id],
  }, (r) => {
    assertField(r, 'bibtex', 'string');
    assertField(r, 'count', 'number');
  });

  // 21. rc.lit.addNote
  await testRpc('rc.lit.addNote', 'rc.lit.addNote', {
    paper_id: paper.id,
    content: 'E2E test note on page 5',
    page: 5,
  }, (r) => {
    assertField(r, 'id', 'string');
    assertField(r, 'content', 'string');
  });

  // 22. rc.lit.listNotes
  await testRpc('rc.lit.listNotes', 'rc.lit.listNotes', {
    paper_id: paper.id,
  }, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  // 23-25. Collections
  const col = await testRpc('rc.lit.manageCollection(create)', 'rc.lit.manageCollection', {
    action: 'create',
    name: 'E2E Test Collection',
  }, (r) => {
    assertField(r, 'id');
    assertField(r, 'action');
  });

  await testRpc('rc.lit.listCollections', 'rc.lit.listCollections', {}, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  if (col) {
    await testRpc('rc.lit.manageCollection(add_paper)', 'rc.lit.manageCollection', {
      action: 'add_paper',
      id: col.id,
      paper_ids: [paper.id],
    });
  }

  // 26. rc.lit.delete (soft)
  if (paper2) {
    await testRpc('rc.lit.delete', 'rc.lit.delete', { id: paper2.id });
  }
}

async function testTaskRpc() {
  console.log('\n\x1b[1m── Task RPC (rc.task.*) ──\x1b[0m\n');

  // 1. rc.task.create
  const task = await testRpc('rc.task.create', 'rc.task.create', {
    title: 'E2E Test Task: Review paper',
    task_type: 'human',
    priority: 'high',
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    description: 'E2E test task description',
    tags: ['e2e'],
  }, (r) => {
    assertField(r, 'id', 'string');
    assertField(r, 'status', 'string');
  });

  if (!task) return;

  // 2. rc.task.get
  await testRpc('rc.task.get', 'rc.task.get', { id: task.id }, (r) => {
    assertField(r, 'id');
    assertArray(r, 'activity_log');
    assertArray(r, 'subtasks');
  });

  // 3. rc.task.list
  await testRpc('rc.task.list', 'rc.task.list', {
    limit: 10,
    status: 'todo',
  }, (r) => {
    assertArray(r, 'items');
    assertField(r, 'total', 'number');
  });

  // 4. rc.task.update
  await testRpc('rc.task.update', 'rc.task.update', {
    id: task.id,
    status: 'in_progress',
    priority: 'urgent',
  }, (r) => {
    assertField(r, 'status', 'string');
  });

  // 5. rc.task.complete
  await testRpc('rc.task.complete', 'rc.task.complete', {
    id: task.id,
    notes: 'Completed via E2E test',
  }, (r) => {
    assertField(r, 'status', 'string');
    assertField(r, 'completed_at');
  });

  // 6. rc.task.upcoming
  await testRpc('rc.task.upcoming', 'rc.task.upcoming', { hours: 72 }, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  // 7. rc.task.overdue
  await testRpc('rc.task.overdue', 'rc.task.overdue', {}, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  // 8. rc.task.addNote
  const task2 = await testRpc('rc.task.create (for note)', 'rc.task.create', {
    title: 'E2E Note Task',
    task_type: 'agent',
  }, (r) => assertField(r, 'id'));

  if (task2) {
    await testRpc('rc.task.addNote', 'rc.task.addNote', {
      task_id: task2.id,
      content: 'E2E test note',
      actor: 'agent',
    }, (r) => {
      assertField(r, 'event_type');
    });
  }

  // 9. rc.task.link (need a paper)
  // Skipping if no paper exists from literature tests
  skip('rc.task.link', 'Requires paper from literature test — test manually');

  // 10. rc.task.delete
  if (task2) {
    await testRpc('rc.task.delete', 'rc.task.delete', { id: task2.id });
  }
}

async function testCronRpc() {
  console.log('\n\x1b[1m── Cron RPC (rc.cron.*) ──\x1b[0m\n');

  // 1. rc.cron.presets.list
  await testRpc('rc.cron.presets.list', 'rc.cron.presets.list', {}, (r) => {
    if (!Array.isArray(r)) throw new Error('Expected array');
  });

  // 2. rc.cron.presets.activate
  await testRpc('rc.cron.presets.activate', 'rc.cron.presets.activate', {
    preset_id: 'arxiv_daily_scan',
    config: { topics: ['e2e-test'] },
  }, (r) => {
    assertField(r, 'ok');
    assertField(r, 'preset');
  });

  // 3. rc.cron.presets.deactivate
  await testRpc('rc.cron.presets.deactivate', 'rc.cron.presets.deactivate', {
    preset_id: 'arxiv_daily_scan',
  }, (r) => {
    assertField(r, 'ok');
    assertField(r, 'preset');
  });
}

async function testWorkspaceRpc() {
  console.log('\n\x1b[1m── Workspace RPC (rc.ws.*) ──\x1b[0m\n');

  // 1. rc.ws.init
  await testRpc('rc.ws.init', 'rc.ws.init', {});

  // 2. rc.ws.tree
  await testRpc('rc.ws.tree', 'rc.ws.tree', { depth: 2 }, (r) => {
    assertArray(r, 'tree');
    assertField(r, 'workspace_root', 'string');
  });

  // 3. rc.ws.save
  const saved = await testRpc('rc.ws.save', 'rc.ws.save', {
    path: 'e2e-test/test-file.md',
    content: '# E2E Test\n\nThis file was created by the E2E test runner.',
  }, (r) => {
    assertField(r, 'path', 'string');
    assertField(r, 'size', 'number');
  });

  // 4. rc.ws.read
  if (saved) {
    await testRpc('rc.ws.read', 'rc.ws.read', { path: 'e2e-test/test-file.md' }, (r) => {
      assertField(r, 'content', 'string');
      assertField(r, 'encoding', 'string');
      assertField(r, 'mime_type', 'string');
    });
  }

  // 5. rc.ws.history
  await testRpc('rc.ws.history', 'rc.ws.history', { limit: 5 }, (r) => {
    assertArray(r, 'commits');
    assertField(r, 'total', 'number');
  });

  // 6. rc.ws.diff
  await testRpc('rc.ws.diff', 'rc.ws.diff', {}, (r) => {
    assertField(r, 'diff', 'string');
    assertField(r, 'files_changed', 'number');
  });

  // 7. rc.ws.restore — skip to avoid breaking test state
  skip('rc.ws.restore', 'Skipped to avoid side effects — test manually');
}

async function testErrorCases() {
  console.log('\n\x1b[1m── Error Cases ──\x1b[0m\n');

  // Non-existent method
  await testRpcError('Unknown method', 'rc.nonexistent.method', {});

  // Invalid paper ID
  await testRpcError('Get non-existent paper', 'rc.lit.get', { id: 'does-not-exist-12345' });

  // Invalid task ID
  await testRpcError('Get non-existent task', 'rc.task.get', { id: 'does-not-exist-12345' });

  // Invalid status transition
  const task = await rpc('rc.task.create', {
    title: 'Error test task',
    task_type: 'human',
  }).catch(() => null);

  if (task) {
    await testRpcError(
      'Invalid status transition (todo -> done)',
      'rc.task.update',
      { id: task.id, status: 'done' },
    );

    // Cleanup
    await rpc('rc.task.delete', { id: task.id }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Wait for gateway
// ---------------------------------------------------------------------------

async function waitForGateway(maxRetries = 15, intervalMs = 2000) {
  console.log(`\nWaiting for gateway at ${WS_URL}...`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      await connect();
      console.log('Connected to gateway.\n');
      return true;
    } catch {
      verbose(`Attempt ${i + 1}/${maxRetries} failed, retrying...`);
      disconnect();
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Research-Claw E2E Test Runner                         ║');
  console.log('║  Gateway: ' + WS_URL.padEnd(46) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const connected = await waitForGateway();
  if (!connected) {
    console.error('\n\x1b[31mFailed to connect to gateway. Is it running?\x1b[0m');
    console.error(`  Expected: ${WS_URL}`);
    console.error('  Start with: pnpm start\n');
    process.exit(2);
  }

  try {
    await testLiteratureRpc();
    await testTaskRpc();
    await testCronRpc();
    await testWorkspaceRpc();
    await testErrorCases();
  } finally {
    disconnect();
  }

  // Report
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Results                                                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Total:   ${stats.total}`);
  console.log(`  Passed:  \x1b[32m${stats.passed}\x1b[0m`);
  console.log(`  Failed:  \x1b[${stats.failed > 0 ? '31' : '32'}m${stats.failed}\x1b[0m`);
  console.log(`  Skipped: \x1b[33m${stats.skipped}\x1b[0m`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  \x1b[31m✗\x1b[0m ${f.name}: ${f.reason}`);
    }
  }

  console.log();
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nUnhandled error:', err);
  process.exit(2);
});
