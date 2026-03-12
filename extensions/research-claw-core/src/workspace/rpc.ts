/**
 * workspace/rpc — 7 Gateway WS RPC Handlers
 *
 * Registers rc.ws.tree, rc.ws.read, rc.ws.save, rc.ws.history, rc.ws.diff,
 * rc.ws.restore, and rc.ws.delete as gateway WebSocket RPC methods.
 *
 * rc.ws.upload is HTTP-only (POST /rc/upload) and is NOT registered here.
 * It should be registered as an HTTP route in the plugin entry point (index.ts).
 *
 * All handlers delegate to WorkspaceService. Errors thrown by WorkspaceService
 * are caught and re-thrown for the gateway framework to handle.
 */

import { exec } from 'node:child_process';
import * as path from 'node:path';
import type { WorkspaceService } from './service.js';
import type { RegisterMethod } from '../types.js';

// ---------------------------------------------------------------------------
// Parameter validation helpers
// ---------------------------------------------------------------------------

function requireString(
  params: Record<string, unknown>,
  name: string,
): string {
  const value = params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw Object.assign(
      new Error(`Missing required parameter: ${name}`),
      { code: -32602, data: { parameter: name } },
    );
  }
  return value;
}

function optionalString(
  params: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = params[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw Object.assign(
      new Error(`Parameter ${name} must be a string.`),
      { code: -32602, data: { parameter: name } },
    );
  }
  return value;
}

function optionalNumber(
  params: Record<string, unknown>,
  name: string,
): number | undefined {
  const value = params[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw Object.assign(
      new Error(`Parameter ${name} must be a finite number.`),
      { code: -32602, data: { parameter: name } },
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function mapError(err: unknown): never {
  if (err instanceof Error) throw err;
  throw new Error(String(err));
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the 7 workspace WS RPC methods with the gateway.
 *
 * @param registerMethod - Function to register a gateway RPC method
 * @param service        - WorkspaceService instance to delegate operations to
 * @param wsRoot         - Absolute path to workspace root (for openExternal/openFolder)
 *
 * Methods registered:
 * - rc.ws.tree         — Directory tree listing
 * - rc.ws.read         — Read a single file
 * - rc.ws.save         — Write content to a file with optional auto-commit
 * - rc.ws.history      — Paginated git log
 * - rc.ws.diff         — Git diff (uncommitted or between commits)
 * - rc.ws.restore      — Restore a file to a historical version
 * - rc.ws.delete       — Delete a file from the workspace
 * - rc.ws.openExternal — Open a file with the system default application
 * - rc.ws.openFolder   — Open the containing folder in the system file manager
 *
 * Note: rc.ws.upload is HTTP-only (POST /rc/upload) and must be registered
 * as an HTTP route in index.ts, not here.
 */
export function registerWorkspaceRpc(
  registerMethod: RegisterMethod,
  service: WorkspaceService,
  wsRoot?: string,
): void {
  // -----------------------------------------------------------------------
  // 1. rc.ws.tree — Directory tree for the dashboard sidebar
  //    params: { root?: string, depth?: number }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.tree', async (params: Record<string, unknown>) => {
    try {
      const root = optionalString(params, 'root');
      const depth = optionalNumber(params, 'depth');

      return service.tree(root, depth);
    } catch (err) {
      mapError(err);
    }
  });

  // -----------------------------------------------------------------------
  // 2. rc.ws.read — Read a single file for the dashboard preview pane
  //    params: { path: string }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.read', async (params: Record<string, unknown>) => {
    try {
      const filePath = requireString(params, 'path');

      return service.read(filePath);
    } catch (err) {
      mapError(err);
    }
  });

  // -----------------------------------------------------------------------
  // 3. rc.ws.save — Write content to a workspace file with optional commit
  //    params: { path: string, content: string, message?: string }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.save', async (params: Record<string, unknown>) => {
    try {
      const filePath = requireString(params, 'path');
      const content = requireString(params, 'content');
      const message = optionalString(params, 'message');

      return service.save(filePath, content, message);
    } catch (err) {
      mapError(err);
    }
  });

  // -----------------------------------------------------------------------
  // 4. rc.ws.history — Paginated git log for the dashboard timeline
  //    params: { path?: string, limit?: number, offset?: number }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.history', async (params: Record<string, unknown>) => {
    try {
      const filePath = optionalString(params, 'path');
      const limit = optionalNumber(params, 'limit');
      const offset = optionalNumber(params, 'offset');

      return service.history(filePath, limit, offset);
    } catch (err) {
      mapError(err);
    }
  });

  // -----------------------------------------------------------------------
  // 5. rc.ws.diff — Git diff for the dashboard diff viewer
  //    params: { path?: string, from?: string, to?: string }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.diff', async (params: Record<string, unknown>) => {
    try {
      const filePath = optionalString(params, 'path');
      const from = optionalString(params, 'from');
      const to = optionalString(params, 'to');

      return service.diff(filePath, from, to);
    } catch (err) {
      mapError(err);
    }
  });

  // -----------------------------------------------------------------------
  // 6. rc.ws.restore — Restore a file to a historical version
  //    params: { path: string, commit: string }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.restore', async (params: Record<string, unknown>) => {
    try {
      const filePath = requireString(params, 'path');
      const commit = requireString(params, 'commit');

      return service.restore(filePath, commit);
    } catch (err) {
      mapError(err);
    }
  });

  // -----------------------------------------------------------------------
  // 7. rc.ws.delete — Delete a file from the workspace
  //    params: { path: string }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.delete', async (params: Record<string, unknown>) => {
    try {
      const filePath = requireString(params, 'path');
      return service.delete(filePath);
    } catch (err) {
      mapError(err);
    }
  });

  // -----------------------------------------------------------------------
  // 8. rc.ws.openExternal — Open a file with the system default application
  //    params: { path: string }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.openExternal', async (params: Record<string, unknown>) => {
    const filePath = requireString(params, 'path');
    if (!wsRoot) throw new Error('Workspace root not configured');

    // Resolve and validate path stays within workspace
    const resolved = path.resolve(wsRoot, filePath);
    if (!resolved.startsWith(path.resolve(wsRoot) + path.sep) && resolved !== path.resolve(wsRoot)) {
      throw Object.assign(new Error('Path escapes workspace root'), { code: -32001 });
    }

    const cmd = process.platform === 'darwin'
      ? `open ${JSON.stringify(resolved)}`
      : process.platform === 'win32'
        ? `start "" ${JSON.stringify(resolved)}`
        : `xdg-open ${JSON.stringify(resolved)}`;

    return new Promise<{ ok: boolean }>((resolve, reject) => {
      exec(cmd, (err) => {
        if (err) reject(new Error(`Failed to open file: ${err.message}`));
        else resolve({ ok: true });
      });
    });
  });

  // -----------------------------------------------------------------------
  // 9. rc.ws.openFolder — Open the containing folder in the system file manager
  //    params: { path: string }
  // -----------------------------------------------------------------------
  registerMethod('rc.ws.openFolder', async (params: Record<string, unknown>) => {
    const filePath = requireString(params, 'path');
    if (!wsRoot) throw new Error('Workspace root not configured');

    // Resolve and validate path stays within workspace
    const resolved = path.resolve(wsRoot, filePath);
    if (!resolved.startsWith(path.resolve(wsRoot) + path.sep) && resolved !== path.resolve(wsRoot)) {
      throw Object.assign(new Error('Path escapes workspace root'), { code: -32001 });
    }

    const dir = path.dirname(resolved);
    const cmd = process.platform === 'darwin'
      ? `open ${JSON.stringify(dir)}`
      : process.platform === 'win32'
        ? `explorer ${JSON.stringify(dir)}`
        : `xdg-open ${JSON.stringify(dir)}`;

    return new Promise<{ ok: boolean }>((resolve, reject) => {
      exec(cmd, (err) => {
        if (err) reject(new Error(`Failed to open folder: ${err.message}`));
        else resolve({ ok: true });
      });
    });
  });
}
