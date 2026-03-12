/**
 * Shared type definitions used across multiple modules.
 */

/**
 * OpenClaw agent tool definition interface.
 *
 * All tools in literature, tasks, and workspace modules share this shape.
 * Registered via api.registerTool() from the OpenClaw plugin SDK.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: unknown,
    onUpdate?: unknown,
  ) => Promise<unknown>;
}

/**
 * Callback type for registering gateway WS RPC methods.
 *
 * Used by index.ts (the bridge wrapper) and all rpc.ts modules.
 * The handler receives parsed params and returns a result (sync or async).
 */
export type RegisterMethod = (
  method: string,
  handler: (params: Record<string, unknown>) => Promise<unknown> | unknown,
) => void;
