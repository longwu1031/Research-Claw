# C5 — Plugin Integration Guide

> **Scope**: OpenClaw Plugin SDK development for Research-Claw
> **Status**: Draft v1.0
> **Last Updated**: 2026-03-11
> **Depends On**: C2 (Engineering Architecture)
> **SDK Version**: 2026.3.8

---

## Table of Contents

1. [Plugin SDK Overview](#1-plugin-sdk-overview)
2. [Scaffold](#2-scaffold)
3. [Registration Methods](#3-registration-methods)
4. [Plugin Config Schema and uiHints](#4-plugin-config-schema-and-uihints)
5. [Testing](#5-testing)
6. [Reference Implementations](#6-reference-implementations)
7. [Research-Claw Specific Patterns](#7-research-claw-specific-patterns)

---

## 1. Plugin SDK Overview

### 1.1 What Plugins Can Do

An OpenClaw plugin is a TypeScript package that extends the agent at runtime. A
single plugin can:

- **Register tools** the LLM agent can invoke during a session.
- **Register hooks** that intercept and modify agent lifecycle events (prompt
  building, tool calls, session boundaries, compaction, etc.).
- **Register gateway methods** that expose WebSocket RPC endpoints to the
  Dashboard or external clients.
- **Register HTTP routes** on the gateway's HTTP server.
- **Register services** with managed start/stop lifecycle.
- **Register slash commands** that bypass the LLM entirely.
- **Register CLI subcommands** extending the `openclaw` command line.
- **Register channels** for alternative input transports (Slack, Discord, etc.).
- **Register providers** for custom LLM backends.
- **Register context engines** for dynamic context injection.

All registration happens synchronously inside a single `register()` function.
The function receives an `OpenClawPluginApi` object — the only surface area
between plugin code and the host runtime.

### 1.2 Plugin Loading Mechanism

OpenClaw loads plugins via **jiti**, a just-in-time TypeScript transpiler. This
means:

- Plugins are written in TypeScript and loaded directly — no build step required
  during development.
- The entry point is resolved from the `main` field in `openclaw.plugin.json`,
  defaulting to `index.ts`.
- The module must export a `register` function as its default export or named
  export.

Loading order:

1. OpenClaw reads `openclaw.plugin.json` to discover metadata and config schema.
2. jiti transpiles and loads the entry file.
3. The `register(api)` function is called with a fully initialized
   `OpenClawPluginApi` instance.
4. All `api.register*()` calls execute synchronously during this phase.
5. Registered services' `start()` methods are called after all plugins load.

### 1.3 Config Resolution

Plugin configuration flows through three layers, merged top-down:

```
openclaw.plugin.json  →  configSchema defaults
user config file      →  ~/.config/openclaw/plugins/<plugin-id>.json
environment vars      →  OPENCLAW_PLUGIN_<ID>_<KEY>=value
```

The merged result is available at `api.pluginConfig`. Sensitive values (API keys,
tokens) should be sourced from environment variables and marked `sensitive: true`
in the config schema.

### 1.4 The OpenClawPluginApi Interface

```typescript
type OpenClawPluginApi = {
  // ── Identity ──
  id: string;                    // Plugin ID from manifest
  name: string;                  // Human-readable name
  version?: string;              // Semver version
  description?: string;          // One-line description
  source: string;                // Resolved filesystem path

  // ── Config ──
  config: OpenClawConfig;        // Global OpenClaw config
  pluginConfig?: Record<string, unknown>; // Plugin-specific config

  // ── Runtime ──
  runtime: PluginRuntime;        // Access to gateway, session state
  logger: PluginLogger;          // Scoped logger (info, warn, error, debug)

  // ── Registration Methods ──
  registerTool: (tool, opts?) => void;
  registerHook: (events, handler, opts?) => void;
  registerHttpRoute: (params) => void;
  registerChannel: (registration) => void;
  registerGatewayMethod: (method, handler) => void;
  registerCli: (registrar, opts?) => void;
  registerService: (service) => void;
  registerProvider: (provider) => void;
  registerCommand: (command) => void;
  registerContextEngine: (id, factory) => void;

  // ── Utilities ──
  resolvePath: (input: string) => string; // Resolve ~ and relative paths
  on: <K>(hookName, handler, opts?) => void; // Typed hook registration
};
```

---

## 2. Scaffold

### 2.1 Minimal Plugin Structure

```
my-plugin/
├── package.json
├── openclaw.plugin.json
└── index.ts
```

### 2.2 package.json

```json
{
  "name": "@wentorai/my-plugin",
  "version": "1.0.0",
  "description": "A Research-Claw plugin that does something useful",
  "main": "index.ts",
  "type": "module",
  "keywords": ["openclaw-plugin", "research-claw"],
  "license": "MIT",
  "dependencies": {
    "@sinclair/typebox": "^0.34.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

### 2.3 openclaw.plugin.json

The manifest file tells OpenClaw how to load and configure the plugin.

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A Research-Claw plugin that does something useful",
  "main": "index.ts",
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "description": "API key for the external service",
        "uiHints": {
          "label": "API Key",
          "sensitive": true,
          "placeholder": "sk-..."
        }
      },
      "maxResults": {
        "type": "number",
        "default": 10,
        "description": "Maximum number of results to return",
        "uiHints": {
          "label": "Max Results",
          "help": "Set to 0 for unlimited"
        }
      }
    }
  }
}
```

### 2.4 index.ts

```typescript
import type { OpenClawPluginApi } from "openclaw";
import { Type } from "@sinclair/typebox";

export function register(api: OpenClawPluginApi): void {
  const config = api.pluginConfig ?? {};
  const logger = api.logger;

  logger.info("my-plugin loaded", { version: api.version });

  // Register a simple tool
  api.registerTool({
    name: "my_tool",
    label: "My Tool",
    description: "Does something useful for the researcher",
    parameters: Type.Object({
      query: Type.String({ description: "The search query" }),
    }),
    execute: async (toolCallId, params) => {
      logger.debug("my_tool called", { toolCallId, query: params.query });
      const result = `Found results for: ${params.query}`;
      return {
        content: [{ type: "text", text: result }],
      };
    },
  });

  // Register a lifecycle hook
  api.on("session_start", async (ctx) => {
    logger.info("session started", { sessionId: ctx.sessionId });
  });
}
```

### 2.5 Installing During Development

```bash
# From the Research-Claw project root
openclaw plugins install /path/to/my-plugin

# Or via npm link for active development
cd /path/to/my-plugin && npm link
openclaw plugins install my-plugin
```

---

## 3. Registration Methods

### 3.1 registerTool()

Tools are the primary way plugins expose capabilities to the LLM agent. When the
agent decides to use a tool, OpenClaw executes the tool's `execute` function and
returns the result to the conversation.

#### Simple Tool Registration

```typescript
import { Type } from "@sinclair/typebox";

api.registerTool({
  name: "literature_search",
  label: "Literature Search",
  description:
    "Search the local paper library by title, author, tag, or full-text content. " +
    "Returns matching papers with metadata and relevance scores.",
  parameters: Type.Object({
    query: Type.String({
      description: "Search query — supports title, author name, or keywords",
    }),
    tags: Type.Optional(
      Type.Array(Type.String(), {
        description: "Filter results to papers with ALL of these tags",
      })
    ),
    limit: Type.Optional(
      Type.Number({
        description: "Maximum results to return (default: 20)",
        minimum: 1,
        maximum: 100,
      })
    ),
  }),
  execute: async (toolCallId, params) => {
    const { query, tags, limit = 20 } = params;

    // Perform the search (implementation details omitted)
    const results = await searchPapers(query, { tags, limit });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: results.length,
              papers: results.map((p) => ({
                id: p.id,
                title: p.title,
                authors: p.authors,
                year: p.year,
                tags: p.tags,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  },
});
```

**Key points:**

- `name` must be unique across all loaded plugins. Use a namespace prefix
  (e.g., `rc_literature_search`) to avoid collisions.
- `parameters` uses TypeBox schemas (a JSON Schema builder). The schema is sent
  to the LLM as the tool's parameter specification.
- `execute` receives `(toolCallId: string, params: Record<string, unknown>)`.
  The first arg is the unique tool call ID; the second is the parsed parameters object.
- Return value must follow the `ToolResult` shape: `{ content: ContentPart[] }`.
  Each `ContentPart` is `{ type: "text", text: string }` or
  `{ type: "image", data: string, mimeType: string }`.

#### Tool Factory Registration

A tool factory is a function that receives runtime context and returns one or
more tools (or `null` to skip). This is useful when tools depend on config or
workspace state.

```typescript
import { Type } from "@sinclair/typebox";
import type {
  OpenClawPluginApi,
  OpenClawPluginToolContext,
  AnyAgentTool,
} from "openclaw";

api.registerTool(
  (ctx: OpenClawPluginToolContext): AnyAgentTool[] | null => {
    const config = ctx.config;
    const workspaceDir = ctx.workspaceDir;

    // Only register if we're in a research workspace
    if (!workspaceDir) return null;

    return [
      {
        name: "workspace_save",
        label: "Save Workspace Snapshot",
        description: "Save the current workspace state as a named snapshot",
        parameters: Type.Object({
          name: Type.String({ description: "Snapshot name" }),
          message: Type.Optional(
            Type.String({ description: "Description of changes" })
          ),
        }),
        execute: async (toolCallId, params) => {
          const snapshotId = await saveSnapshot(
            workspaceDir,
            params.name,
            params.message
          );
          return {
            content: [
              {
                type: "text",
                text: `Snapshot "${params.name}" saved (id: ${snapshotId})`,
              },
            ],
          };
        },
      },
      {
        name: "workspace_list",
        label: "List Workspace Snapshots",
        description: "List all saved workspace snapshots",
        parameters: Type.Object({}),
        execute: async () => {
          const snapshots = await listSnapshots(workspaceDir);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(snapshots, null, 2),
              },
            ],
          };
        },
      },
    ];
  }
);
```

**Tool context fields:**

| Field          | Type                   | Description                            |
|----------------|------------------------|----------------------------------------|
| `config`       | `OpenClawConfig`       | Full OpenClaw configuration            |
| `workspaceDir` | `string \| undefined`  | Current workspace directory            |
| `agentId`      | `string`               | Active agent identifier                |
| `sessionKey`   | `string`               | Unique key for the current session     |
| `sessionId`    | `string`               | Persistent session identifier          |

#### Tool Options

The optional second argument to `registerTool()` controls tool visibility:

```typescript
api.registerTool(myTool, {
  // Only make tool available when these conditions are met
  when: { hasWorkspace: true },
  // Group tools in the agent's tool listing
  group: "literature",
});
```

### 3.2 registerGatewayMethod()

Gateway methods expose WebSocket RPC endpoints. The Dashboard (or any WS
client) calls them via the gateway protocol:

```
→  { "type": "req", "id": "uuid", "method": "rc.lit.search", "params": { "query": "attention" } }
←  { "type": "res", "id": "uuid", "ok": true, "payload": { "papers": [...] } }
```

#### Handler Signature

The gateway passes an `opts` object to each handler:

```typescript
type GatewayRequestHandler = (opts: {
  params: Record<string, unknown>;
  respond: (ok: boolean, payload?: unknown, error?: { code: string; message: string }) => void;
}) => void | Promise<void>;
```

> **Note:** Research-Claw wraps this with a bridge function in `index.ts` that
> extracts `opts.params`, awaits the result, and calls `opts.respond()`. RPC
> handlers are written as simple `(params) => result` functions; the bridge
> handles the opts pattern transparently.

#### Example: Paper Search RPC

```typescript
// Handler uses simple (params) => result signature (bridge in index.ts wraps it)
const searchHandler = async (params: Record<string, unknown>) => {
  const { query, tags, limit } = params as {
    query: string;
    tags?: string[];
    limit?: number;
  };
  return db.searchPapers(query, { tags, limit });
};

// Bridge wraps handler for gateway's opts pattern:
api.registerGatewayMethod("rc.lit.search", async (opts) => {
  try {
    const result = await searchHandler(opts.params);
    opts.respond(true, result);
  } catch (err) {
    opts.respond(false, undefined, { code: "PLUGIN_ERROR", message: String(err) });
  }
});
```

#### Example: Stateful Data Fetch

```typescript
api.registerGatewayMethod("rc.lit.get", async (opts) => {
  try {
    const { id } = opts.params as { id: string };
    const paper = await db.getPaper(id);
    if (!paper) throw new Error("Paper not found");
    opts.respond(true, paper);
  } catch (err) {
    opts.respond(false, undefined, { code: "PLUGIN_ERROR", message: String(err) });
  }
});
```

**Namespace convention:** All Research-Claw methods use the `rc.` prefix,
followed by the module namespace:

| Prefix                | Module              | Method Count |
|-----------------------|---------------------|-------------|
| `rc.lit.*`            | Literature library  | 26 |
| `rc.task.*`           | Task system         | 11 |
| `rc.cron.presets.*`   | Cron presets        | 7 |
| `rc.notifications.*`  | Notifications       | 2 |
| `rc.ws.*`             | Workspace tracking  | 11 |
| `rc.radar.*`          | Radar tracking      | 4 |

### 3.3 registerHttpRoute()

HTTP routes add endpoints to the gateway's HTTP server. This is useful for file
uploads, webhook receivers, or serving static assets.

#### Params

```typescript
type OpenClawPluginHttpRouteParams = {
  path: string;                              // URL path (e.g., "/rc/upload")
  handler: (
    req: IncomingMessage,
    res: ServerResponse
  ) => Promise<boolean | void>;
  auth?: "gateway" | "plugin";               // Auth strategy (default: gateway)
  match?: "exact" | "prefix";                // Path matching (default: exact)
};
```

- `auth: "gateway"` — the gateway's built-in auth protects the route.
- `auth: "plugin"` — the plugin handles its own authentication.
- `match: "prefix"` — the route matches any path starting with the given prefix.
- Return `true` from the handler to indicate the response was handled. Return
  `false` or `void` to pass through to the next handler.

#### Example: File Upload Endpoint

```typescript
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

api.registerHttpRoute({
  path: "/rc/upload/pdf",
  auth: "gateway",
  match: "exact",
  handler: async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return true;
    }

    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/pdf")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "expected_pdf" }));
      return true;
    }

    const uploadDir = api.resolvePath("~/.openclaw/uploads");
    const filename = `paper-${Date.now()}.pdf`;
    const dest = join(uploadDir, filename);

    try {
      await pipeline(req, createWriteStream(dest));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: dest, filename }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upload_failed", detail: String(err) }));
    }
    return true;
  },
});
```

#### Example: Serving Static Files

```typescript
import { createReadStream, existsSync } from "node:fs";
import { join, extname } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

api.registerHttpRoute({
  path: "/rc/static",
  auth: "gateway",
  match: "prefix",
  handler: async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const relativePath = url.pathname.replace("/rc/static", "");
    const filePath = join(api.source, "static", relativePath);

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return true;
    }

    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    createReadStream(filePath).pipe(res);
    return true;
  },
});
```

### 3.4 registerHook()

Hooks let plugins observe and modify agent behavior at specific lifecycle
points. There are two registration styles.

#### Method 1: registerHook() — Internal Hook Handler

```typescript
api.registerHook("before_prompt_build", async (event) => {
  // event shape depends on the hook
  return {
    prependContext: "## Research Context\nUser is working on NLP papers.\n",
  };
});

// Multiple events with one handler
api.registerHook(
  ["session_start", "session_end"],
  async (event) => {
    api.logger.info("session lifecycle", { type: event.type });
  }
);
```

#### Method 2: api.on() — Typed Hook (Preferred)

The `on()` method provides TypeScript-level type safety for hook handlers:

```typescript
api.on("before_prompt_build", async (ctx) => {
  // ctx is fully typed for this specific hook
  const workspace = ctx.workspaceDir;
  const activeProject = await getActiveProject(workspace);

  if (activeProject) {
    return {
      prependContext: [
        `## Active Project: ${activeProject.name}`,
        `Working directory: ${activeProject.path}`,
        `Papers in scope: ${activeProject.paperCount}`,
        `Open tasks: ${activeProject.openTaskCount}`,
      ].join("\n"),
    };
  }
}, { priority: 10 });  // Lower number = higher priority
```

#### Hook Options

```typescript
type OpenClawPluginHookOptions = {
  priority?: number;  // Execution order (default: 100, lower = earlier)
};
```

#### Complete Hook Reference

The 24 available hooks, grouped by lifecycle phase:

**Session Lifecycle**

| Hook | Context | Return | When |
|------|---------|--------|------|
| `session_start` | `{ sessionId, sessionKey, agentId }` | `void` | New session begins |
| `session_end` | `{ sessionId, reason }` | `void` | Session terminates |
| `before_reset` | `{ sessionId }` | `void` | Before conversation reset |

**Prompt & Model**

| Hook | Context | Return | When |
|------|---------|--------|------|
| `before_model_resolve` | `{ model, provider }` | `{ model?, provider? }` | Before LLM model selection |
| `before_prompt_build` | `{ workspaceDir, agentId, sessionId }` | `{ prependContext?, appendContext? }` | Before system prompt assembly |
| `before_agent_start` | `{ config, sessionId }` | `void` | Before agent loop begins |
| `agent_end` | `{ sessionId, reason, tokenUsage }` | `void` | After agent loop completes |

**Message Flow**

| Hook | Context | Return | When |
|------|---------|--------|------|
| `llm_input` | `{ messages, model }` | `{ messages? }` | Before messages sent to LLM |
| `llm_output` | `{ response, model, tokenUsage }` | `void` | After LLM response received |
| `message_received` | `{ message, source }` | `{ message? }` | Incoming user message |
| `message_sending` | `{ message }` | `{ message? }` | Before message sent to user |
| `message_sent` | `{ message }` | `void` | After message delivered |
| `before_message_write` | `{ message, sessionId }` | `{ message? }` | Before message persisted |

**Tool Execution**

| Hook | Context | Return | When |
|------|---------|--------|------|
| `before_tool_call` | `{ tool, params, toolCallId }` | `{ params?, skip? }` | Before tool executes |
| `after_tool_call` | `{ tool, params, result, toolCallId, duration }` | `{ result? }` | After tool completes |
| `tool_result_persist` | `{ tool, result, sessionId }` | `void` | When tool result is saved |

**Compaction**

| Hook | Context | Return | When |
|------|---------|--------|------|
| `before_compaction` | `{ messages, tokenCount }` | `{ messages? }` | Before context compaction |
| `after_compaction` | `{ original, compacted, tokensSaved }` | `void` | After compaction completes |

**Sub-agents**

| Hook | Context | Return | When |
|------|---------|--------|------|
| `subagent_spawning` | `{ parentId, config }` | `{ config? }` | Before sub-agent created |
| `subagent_delivery_target` | `{ parentId, subagentId }` | `{ target? }` | Resolving delivery target |
| `subagent_spawned` | `{ parentId, subagentId }` | `void` | After sub-agent created |
| `subagent_ended` | `{ subagentId, reason }` | `void` | After sub-agent terminates |

**Gateway**

| Hook | Context | Return | When |
|------|---------|--------|------|
| `gateway_start` | `{ port, config }` | `void` | Gateway server started |
| `gateway_stop` | `{ reason }` | `void` | Gateway server stopping |

#### Key Hooks for Research-Claw

The following hooks are most relevant for building Research-Claw features:

```typescript
// Inject research context into every prompt
api.on("before_prompt_build", async (ctx) => {
  const recentPapers = await db.getRecentPapers(5);
  const openTasks = await db.getOpenTasks(5);

  return {
    prependContext: [
      "## Research-Claw Context",
      "",
      "### Recently Added Papers",
      ...recentPapers.map((p) => `- ${p.title} (${p.year})`),
      "",
      "### Open Tasks",
      ...openTasks.map((t) => `- [${t.status}] ${t.title}`),
    ].join("\n"),
  };
});

// Track session activity
api.on("session_start", async (ctx) => {
  await db.logActivity("session_start", { sessionId: ctx.sessionId });
});

api.on("session_end", async (ctx) => {
  await db.logActivity("session_end", {
    sessionId: ctx.sessionId,
    reason: ctx.reason,
  });
});

// Log token usage for cost tracking
api.on("agent_end", async (ctx) => {
  if (ctx.tokenUsage) {
    await db.logTokenUsage(ctx.sessionId, ctx.tokenUsage);
  }
});

// Transform tool results into message cards
api.on("after_tool_call", async (ctx) => {
  if (ctx.tool === "library_search" && ctx.result) {
    const papers = JSON.parse(ctx.result.content[0].text);
    if (papers.total > 0) {
      const cardJson = JSON.stringify({
        type: "paper_card",
        papers: papers.papers.slice(0, 5),
      });
      return {
        result: {
          content: [
            { type: "text", text: "```paper_card\n" + cardJson + "\n```" },
          ],
        },
      };
    }
  }
});

// Initialize resources when gateway starts
api.on("gateway_start", async (ctx) => {
  api.logger.info("gateway started", { port: ctx.port });
  await initializeDatabase();
});
```

### 3.5 registerService()

Services are long-running background processes with managed lifecycle. The
gateway calls `start()` after all plugins load and `stop()` during shutdown.

```typescript
type OpenClawPluginService = {
  id: string;
  start: (ctx: ServiceContext) => void | Promise<void>;
  stop?: (ctx: ServiceContext) => void | Promise<void>;
};

type ServiceContext = {
  config: OpenClawConfig;
  workspaceDir: string | undefined;
  stateDir: string;        // Plugin-specific state directory
  logger: PluginLogger;
};
```

#### Example: Database Connection Service

```typescript
import Database from "better-sqlite3";
import { join } from "node:path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}

api.registerService({
  id: "rc-database",

  start: async (ctx) => {
    const dbPath = join(ctx.stateDir, "research-claw.db");
    ctx.logger.info("opening database", { path: dbPath });

    db = new Database(dbPath);

    // Enable WAL mode for concurrent reads
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");

    // Run migrations
    await runMigrations(db, ctx.logger);

    ctx.logger.info("database ready");
  },

  stop: async (ctx) => {
    if (db) {
      ctx.logger.info("closing database");
      db.close();
      db = null;
    }
  },
});
```

#### Example: File Watcher Service

```typescript
import { watch } from "node:fs";

let watcher: ReturnType<typeof watch> | null = null;

api.registerService({
  id: "rc-paper-watcher",

  start: async (ctx) => {
    const paperDir = join(ctx.stateDir, "papers");
    ctx.logger.info("watching paper directory", { path: paperDir });

    watcher = watch(paperDir, { recursive: true }, (eventType, filename) => {
      if (filename?.endsWith(".pdf")) {
        ctx.logger.info("paper file changed", { eventType, filename });
        // Trigger re-indexing
        indexPaper(join(paperDir, filename)).catch((err) => {
          ctx.logger.error("indexing failed", { filename, error: String(err) });
        });
      }
    });
  },

  stop: async () => {
    watcher?.close();
    watcher = null;
  },
});
```

### 3.6 registerCommand()

Slash commands provide direct user actions that bypass the LLM agent. When a
user types `/mycommand` in the chat, the handler executes immediately and
returns a reply.

```typescript
type OpenClawPluginCommandDefinition = {
  name: string;               // Command name (without the slash)
  description: string;        // Shown in /help listing
  acceptsArgs?: boolean;      // Whether the command accepts arguments
  requireAuth?: boolean;      // Require authenticated session
  handler: (ctx: PluginCommandContext) => Promise<ReplyPayload>;
};

type PluginCommandContext = {
  args: string;               // Raw argument string after the command name
  sessionKey: string;
  config: OpenClawConfig;
  workspaceDir?: string;
};

type ReplyPayload = {
  text?: string;              // Plain text response
  markdown?: string;          // Markdown-formatted response
  card?: unknown;             // Structured card data
};
```

#### Example: Library Stats Command

```typescript
api.registerCommand({
  name: "library",
  description: "Show paper library statistics",
  acceptsArgs: true,
  handler: async (ctx) => {
    const subcommand = ctx.args.trim().split(/\s+/)[0] || "stats";

    if (subcommand === "stats") {
      const stats = await db.getLibraryStats();
      return {
        markdown: [
          "## Library Statistics",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Total papers | ${stats.total} |`,
          `| Tagged | ${stats.tagged} |`,
          `| Unread | ${stats.unread} |`,
          `| Added this week | ${stats.thisWeek} |`,
        ].join("\n"),
      };
    }

    if (subcommand === "recent") {
      const papers = await db.getRecentPapers(10);
      const lines = papers.map(
        (p, i) => `${i + 1}. **${p.title}** (${p.year}) — ${p.authors[0]}`
      );
      return {
        markdown: "## Recently Added Papers\n\n" + lines.join("\n"),
      };
    }

    return { text: `Unknown subcommand: ${subcommand}. Try: stats, recent` };
  },
});
```

### 3.7 registerCli()

CLI registration extends the `openclaw` command-line tool with custom
subcommands. It uses Commander.js under the hood.

```typescript
api.registerCli(
  (ctx) => {
    // ctx.program is a Commander.js Command instance
    const cmd = ctx.program
      .command("papers")
      .description("Manage the research paper library");

    cmd
      .command("list")
      .description("List all papers")
      .option("-t, --tag <tag>", "Filter by tag")
      .option("-l, --limit <n>", "Max results", "20")
      .action(async (opts) => {
        const papers = await db.searchPapers("", {
          tags: opts.tag ? [opts.tag] : undefined,
          limit: parseInt(opts.limit, 10),
        });
        for (const p of papers) {
          console.log(`  ${p.id.slice(0, 8)}  ${p.title} (${p.year})`);
        }
      });

    cmd
      .command("import <path>")
      .description("Import a PDF or BibTeX file")
      .action(async (path) => {
        const resolved = api.resolvePath(path);
        console.log(`Importing: ${resolved}`);
        await importFile(resolved);
        console.log("Done.");
      });
  },
  { commands: ["papers"] }
);
```

The `opts.commands` array tells OpenClaw which top-level commands this registrar
provides — used for lazy loading.

---

## 4. Plugin Config Schema and uiHints

### 4.1 Config Schema in openclaw.plugin.json

The `configSchema` field uses standard JSON Schema to declare the plugin's
configuration surface:

```json
{
  "id": "research-claw-core",
  "configSchema": {
    "type": "object",
    "properties": {
      "libraryPath": {
        "type": "string",
        "default": "~/.research-claw/library",
        "description": "Path to the paper library directory",
        "uiHints": {
          "label": "Library Path",
          "help": "Absolute or ~-relative path where PDFs are stored",
          "placeholder": "~/.research-claw/library"
        }
      },
      "citationStyle": {
        "type": "string",
        "enum": ["apa", "mla", "chicago", "ieee", "bibtex"],
        "default": "apa",
        "description": "Default citation format",
        "uiHints": {
          "label": "Citation Style",
          "help": "Used when generating bibliography entries"
        }
      },
      "semanticScholarApiKey": {
        "type": "string",
        "description": "API key for Semantic Scholar (optional, increases rate limits)",
        "uiHints": {
          "label": "Semantic Scholar API Key",
          "sensitive": true,
          "advanced": true,
          "placeholder": "Enter your API key"
        }
      },
      "autoIndex": {
        "type": "boolean",
        "default": true,
        "description": "Automatically index new PDFs added to the library",
        "uiHints": {
          "label": "Auto-Index Papers",
          "help": "Watch the library directory for new files"
        }
      },
      "contextPaperCount": {
        "type": "number",
        "default": 5,
        "minimum": 0,
        "maximum": 20,
        "description": "Number of recent papers to include in agent context",
        "uiHints": {
          "label": "Context Papers",
          "help": "How many recent papers to inject into the prompt. Higher values use more tokens.",
          "advanced": true
        }
      },
      "enabledModules": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["literature", "tasks", "workspace"],
        "description": "Which Research-Claw modules to activate",
        "uiHints": {
          "label": "Enabled Modules",
          "tags": ["literature", "tasks", "workspace", "cron"]
        }
      }
    },
    "required": ["libraryPath"]
  }
}
```

### 4.2 uiHints Reference

The `uiHints` object provides rendering hints for configuration UIs (Dashboard
settings, CLI prompts, etc.):

| Field         | Type       | Description |
|---------------|------------|-------------|
| `label`       | `string`   | Human-readable field label |
| `help`        | `string`   | Explanatory text shown below the input |
| `placeholder` | `string`   | Placeholder text for empty inputs |
| `sensitive`   | `boolean`  | Mask the value (password-style input) |
| `advanced`    | `boolean`  | Hide under an "Advanced" disclosure group |
| `tags`        | `string[]` | Predefined options for tag-style inputs |

### 4.3 Accessing Config at Runtime

```typescript
export function register(api: OpenClawPluginApi): void {
  // Raw access — values match JSON schema types
  const config = api.pluginConfig ?? {};
  const libraryPath = api.resolvePath(
    (config.libraryPath as string) ?? "~/.research-claw/library"
  );
  const citationStyle = (config.citationStyle as string) ?? "apa";
  const apiKey = config.semanticScholarApiKey as string | undefined;

  // ...
}
```

### 4.4 Type-Safe Config Parsing with TypeBox

For larger plugins, parse the config through a TypeBox schema for runtime
validation and TypeScript type inference:

```typescript
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const ConfigSchema = Type.Object({
  libraryPath: Type.String({ default: "~/.research-claw/library" }),
  citationStyle: Type.Union(
    [
      Type.Literal("apa"),
      Type.Literal("mla"),
      Type.Literal("chicago"),
      Type.Literal("ieee"),
      Type.Literal("bibtex"),
    ],
    { default: "apa" }
  ),
  semanticScholarApiKey: Type.Optional(Type.String()),
  autoIndex: Type.Boolean({ default: true }),
  contextPaperCount: Type.Number({ default: 5, minimum: 0, maximum: 20 }),
  enabledModules: Type.Array(Type.String(), {
    default: ["literature", "tasks", "workspace"],
  }),
});

type PluginConfig = Static<typeof ConfigSchema>;

export function register(api: OpenClawPluginApi): void {
  // Decode applies defaults and validates
  const config: PluginConfig = Value.Decode(
    ConfigSchema,
    api.pluginConfig ?? {}
  );

  const libraryPath = api.resolvePath(config.libraryPath);
  // config.citationStyle is now typed as "apa" | "mla" | "chicago" | "ieee" | "bibtex"
  // config.contextPaperCount is guaranteed to be 0-20

  api.logger.info("config loaded", {
    libraryPath,
    citationStyle: config.citationStyle,
    modules: config.enabledModules,
  });
}
```

---

## 5. Testing

### 5.1 Vitest Setup

Create `vitest.config.ts` in the plugin root:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["*.ts", "src/**/*.ts"],
      exclude: ["*.test.ts", "vitest.config.ts"],
    },
  },
});
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 5.2 Mock Plugin API

Build a minimal mock `OpenClawPluginApi` for unit tests:

```typescript
// test/helpers/mock-api.ts
import type { OpenClawPluginApi } from "openclaw";

type RegisteredTool = { name: string; execute: Function };
type RegisteredHook = { event: string; handler: Function };
type RegisteredMethod = { method: string; handler: Function };

export function createMockApi(
  overrides?: Partial<OpenClawPluginApi>
): OpenClawPluginApi & {
  _tools: RegisteredTool[];
  _hooks: RegisteredHook[];
  _methods: RegisteredMethod[];
  _services: Array<{ id: string; start: Function; stop?: Function }>;
  _commands: Array<{ name: string; handler: Function }>;
} {
  const tools: RegisteredTool[] = [];
  const hooks: RegisteredHook[] = [];
  const methods: RegisteredMethod[] = [];
  const services: Array<{ id: string; start: Function; stop?: Function }> = [];
  const commands: Array<{ name: string; handler: Function }> = [];

  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    source: "/tmp/test-plugin",
    config: {} as any,
    pluginConfig: {},
    runtime: {} as any,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },

    registerTool: (tool: any) => {
      if (typeof tool === "function") {
        const result = tool({
          config: {},
          workspaceDir: "/tmp/test-workspace",
          agentId: "test-agent",
          sessionKey: "test-key",
          sessionId: "test-session",
        });
        if (Array.isArray(result)) {
          tools.push(...result.map((t) => ({ name: t.name, execute: t.execute })));
        } else if (result) {
          tools.push({ name: result.name, execute: result.execute });
        }
      } else {
        tools.push({ name: tool.name, execute: tool.execute });
      }
    },
    registerHook: (events: any, handler: any) => {
      const eventList = Array.isArray(events) ? events : [events];
      for (const event of eventList) {
        hooks.push({ event, handler });
      }
    },
    registerGatewayMethod: (method: string, handler: any) => {
      methods.push({ method, handler });
    },
    registerHttpRoute: () => {},
    registerChannel: () => {},
    registerCli: () => {},
    registerService: (svc: any) => services.push(svc),
    registerProvider: () => {},
    registerCommand: (cmd: any) => commands.push(cmd),
    registerContextEngine: () => {},
    resolvePath: (input: string) => input.replace("~", "/tmp/home"),
    on: (hookName: any, handler: any) => {
      hooks.push({ event: hookName, handler });
    },

    _tools: tools,
    _hooks: hooks,
    _methods: methods,
    _services: services,
    _commands: commands,

    ...overrides,
  } as any;
}
```

### 5.3 Testing Tool Execution

```typescript
// test/tools.test.ts
import { describe, it, expect } from "vitest";
import { register } from "../index.js";
import { createMockApi } from "./helpers/mock-api.js";

describe("literature_search tool", () => {
  it("registers the tool", () => {
    const api = createMockApi();
    register(api);

    const tool = api._tools.find((t) => t.name === "literature_search");
    expect(tool).toBeDefined();
  });

  it("returns search results", async () => {
    const api = createMockApi();
    register(api);

    const tool = api._tools.find((t) => t.name === "literature_search")!;
    const result = await tool.execute("call-1", {
      query: "attention mechanism",
      limit: 5,
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBeGreaterThanOrEqual(0);
    expect(data.papers).toBeInstanceOf(Array);
  });
});
```

### 5.4 Testing Gateway Methods

```typescript
// test/rpc.test.ts
import { describe, it, expect } from "vitest";
import { register } from "../index.js";
import { createMockApi } from "./helpers/mock-api.js";

describe("rc.lit.search RPC", () => {
  it("responds with papers", async () => {
    const api = createMockApi();
    register(api);

    const rpc = api._methods.find((m) => m.method === "rc.lit.search");
    expect(rpc).toBeDefined();

    // Create a mock respond function
    let response: unknown = null;
    const respond = (payload: unknown) => {
      response = payload;
    };

    await rpc!.handler(
      { query: "transformers", limit: 5 },
      respond,
      { authenticated: true, config: {} }
    );

    expect(response).toBeDefined();
    expect((response as any).ok).toBe(true);
  });
});
```

### 5.5 Testing Hooks

```typescript
// test/hooks.test.ts
import { describe, it, expect } from "vitest";
import { register } from "../index.js";
import { createMockApi } from "./helpers/mock-api.js";

describe("before_prompt_build hook", () => {
  it("injects research context", async () => {
    const api = createMockApi();
    register(api);

    const hook = api._hooks.find((h) => h.event === "before_prompt_build");
    expect(hook).toBeDefined();

    const result = await hook!.handler({
      workspaceDir: "/tmp/test-workspace",
      agentId: "test-agent",
      sessionId: "test-session",
    });

    expect(result).toBeDefined();
    expect(result.prependContext).toContain("Research-Claw");
  });
});
```

### 5.6 In-Memory SQLite for Database Tests

When testing plugins that use SQLite:

```typescript
// test/helpers/test-db.ts
import Database from "better-sqlite3";

export function createTestDb(): Database.Database {
  // In-memory database — destroyed when closed
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Run the same migration script the plugin uses
  db.exec(`
    CREATE TABLE IF NOT EXISTS rc_papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,     -- JSON array
      year INTEGER,
      doi TEXT,
      abstract TEXT,
      tags TEXT DEFAULT '[]',    -- JSON array
      file_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS rc_papers_fts USING fts5(
      title, abstract, authors, content=rc_papers, content_rowid=rowid
    );
  `);

  return db;
}
```

```typescript
// test/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb } from "./helpers/test-db.js";

describe("paper database operations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("inserts and retrieves a paper", () => {
    db.prepare(
      `INSERT INTO rc_papers (id, title, authors, year)
       VALUES (?, ?, ?, ?)`
    ).run("paper-1", "Attention Is All You Need", '["Vaswani"]', 2017);

    const paper = db
      .prepare("SELECT * FROM rc_papers WHERE id = ?")
      .get("paper-1") as any;

    expect(paper.title).toBe("Attention Is All You Need");
    expect(JSON.parse(paper.authors)).toEqual(["Vaswani"]);
    expect(paper.year).toBe(2017);
  });

  it("full-text search works", () => {
    db.prepare(
      `INSERT INTO rc_papers (id, title, authors, year, abstract)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      "paper-1",
      "Attention Is All You Need",
      '["Vaswani"]',
      2017,
      "The dominant sequence transduction models are based on complex recurrent networks."
    );

    // Sync FTS index
    db.prepare(
      `INSERT INTO rc_papers_fts (rowid, title, abstract, authors)
       SELECT rowid, title, abstract, authors FROM rc_papers`
    ).run();

    const results = db
      .prepare("SELECT * FROM rc_papers_fts WHERE rc_papers_fts MATCH ?")
      .all("transduction");

    expect(results).toHaveLength(1);
  });
});
```

---

## 6. Reference Implementations

### 6.1 Pattern: memory-core Extension

The `extensions/memory-core/` extension in OpenClaw demonstrates the canonical
plugin lifecycle pattern:

```
extensions/memory-core/
├── openclaw.plugin.json
├── index.ts              ← register() entry
├── service.ts            ← MemoryService with start/stop
├── tools.ts              ← Tool definitions
└── hooks.ts              ← Hook handlers
```

Key patterns from this extension:

1. **Service initialization in `start()`**: Opens the database, runs migrations,
   sets up indexes.
2. **`before_agent_start` hook**: Loads relevant memories and prepends them to
   context.
3. **`agent_end` hook**: Extracts and persists new memories from the session.
4. **Singleton service access**: `getService()` function provides typed access
   to the running service instance from tools and hooks.

```typescript
// Simplified pattern from memory-core
let service: MemoryService | null = null;

export function register(api: OpenClawPluginApi): void {
  // 1. Parse config
  const config = parseConfig(api.pluginConfig);

  // 2. Register service (manages DB lifecycle)
  api.registerService({
    id: "memory-core",
    start: async (ctx) => {
      service = new MemoryService(ctx.stateDir, config, ctx.logger);
      await service.init();
    },
    stop: async () => {
      await service?.close();
      service = null;
    },
  });

  // 3. Register tools (use service via closure)
  api.registerTool({
    name: "memory_search",
    label: "Search Memory",
    description: "Search the agent's long-term memory",
    parameters: Type.Object({
      query: Type.String(),
    }),
    execute: async (_id, params) => {
      if (!service) throw new Error("Memory service not initialized");
      const results = await service.search(params.query);
      return { content: [{ type: "text", text: JSON.stringify(results) }] };
    },
  });

  // 4. Register hooks (prepend context, capture memories)
  api.on("before_agent_start", async (ctx) => {
    if (!service) return;
    const memories = await service.getRelevantMemories(ctx.sessionId);
    return { prependContext: formatMemories(memories) };
  });

  api.on("agent_end", async (ctx) => {
    if (!service) return;
    await service.extractAndStore(ctx.sessionId);
  });
}
```

### 6.2 Pattern: research-plugins Tool Factory

The `@wentorai/research-plugins` package registers hundreds of skills as tools
using the factory pattern with TypeBox schemas:

```typescript
// Simplified from research-plugins/index.ts
import { Type } from "@sinclair/typebox";

const SKILLS = [
  {
    name: "semantic_scholar_search",
    label: "Semantic Scholar Search",
    description: "Search academic papers on Semantic Scholar",
    params: Type.Object({
      query: Type.String({ description: "Search query" }),
      year: Type.Optional(Type.String({ description: "Year range (e.g., 2020-2024)" })),
      fields: Type.Optional(
        Type.Array(Type.String(), { description: "Fields to return" })
      ),
    }),
    handler: "semantic-scholar",
  },
  // ... hundreds more
];

export function register(api: OpenClawPluginApi): void {
  // Tool factory — returns all tools dynamically
  api.registerTool((ctx) => {
    return SKILLS.map((skill) => ({
      name: skill.name,
      label: skill.label,
      description: skill.description,
      parameters: skill.params,
      execute: async (toolCallId: string, params: unknown) => {
        const result = await executeSkill(skill.handler, params, ctx);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    }));
  });
}
```

### 6.3 Canonical Plugin Structure for Research-Claw

Combining the patterns above, a full Research-Claw module plugin follows this
structure:

```
research-claw-core/
├── openclaw.plugin.json
├── package.json
├── index.ts              ← register() — orchestrates everything
├── src/
│   ├── config.ts         ← TypeBox config schema + parser
│   ├── db/
│   │   ├── connection.ts ← Singleton DB access
│   │   ├── migrations.ts ← Schema migrations
│   │   └── queries.ts    ← Prepared statement wrappers
│   ├── tools/
│   │   ├── literature.ts ← library_* tools
│   │   ├── tasks.ts      ← task_* tools
│   │   └── workspace.ts  ← workspace_* tools
│   ├── hooks/
│   │   ├── context.ts    ← before_prompt_build
│   │   ├── tracking.ts   ← session_start/end, agent_end
│   │   └── cards.ts      ← after_tool_call card formatting
│   ├── rpc/
│   │   ├── literature.ts ← rc.lit.* methods
│   │   ├── tasks.ts      ← rc.task.* methods
│   │   └── workspace.ts  ← rc.ws.* methods
│   └── commands/
│       ├── library.ts    ← /library command
│       └── tasks.ts      ← /tasks command
└── test/
    ├── helpers/
    │   ├── mock-api.ts
    │   └── test-db.ts
    ├── tools.test.ts
    ├── rpc.test.ts
    ├── hooks.test.ts
    └── db.test.ts
```

The `index.ts` wires everything together:

```typescript
import type { OpenClawPluginApi } from "openclaw";
import { parseConfig } from "./src/config.js";
import { initDb, closeDb } from "./src/db/connection.js";
import { registerLiteratureTools } from "./src/tools/literature.js";
import { registerTaskTools } from "./src/tools/tasks.js";
import { registerWorkspaceTools } from "./src/tools/workspace.js";
import { registerContextHooks } from "./src/hooks/context.js";
import { registerTrackingHooks } from "./src/hooks/tracking.js";
import { registerCardHooks } from "./src/hooks/cards.js";
import { registerLiteratureRpc } from "./src/rpc/literature.js";
import { registerTaskRpc } from "./src/rpc/tasks.js";
import { registerWorkspaceRpc } from "./src/rpc/workspace.js";
import { registerLibraryCommand } from "./src/commands/library.js";
import { registerTasksCommand } from "./src/commands/tasks.js";

export function register(api: OpenClawPluginApi): void {
  const config = parseConfig(api.pluginConfig);
  const logger = api.logger;

  logger.info("research-claw-core loading", {
    version: api.version,
    modules: config.enabledModules,
  });

  // ── Service: Database ──
  api.registerService({
    id: "rc-database",
    start: async (ctx) => {
      await initDb(ctx.stateDir, ctx.logger);
    },
    stop: async () => {
      closeDb();
    },
  });

  // ── Tools ──
  if (config.enabledModules.includes("literature")) {
    registerLiteratureTools(api, config);
  }
  if (config.enabledModules.includes("tasks")) {
    registerTaskTools(api, config);
  }
  if (config.enabledModules.includes("workspace")) {
    registerWorkspaceTools(api, config);
  }

  // ── Hooks ──
  registerContextHooks(api, config);
  registerTrackingHooks(api);
  registerCardHooks(api);

  // ── Gateway RPC ──
  if (config.enabledModules.includes("literature")) {
    registerLiteratureRpc(api);
  }
  if (config.enabledModules.includes("tasks")) {
    registerTaskRpc(api);
  }
  if (config.enabledModules.includes("workspace")) {
    registerWorkspaceRpc(api);
  }

  // ── Slash Commands ──
  registerLibraryCommand(api);
  registerTasksCommand(api);

  logger.info("research-claw-core ready");
}
```

---

## 7. Research-Claw Specific Patterns

### 7.1 SQLite Access: Singleton Connection via Service

Research-Claw uses a single SQLite database for all local state. The connection
is managed as a service and accessed via a module-level singleton:

```typescript
// src/db/connection.ts
import Database from "better-sqlite3";
import { join } from "node:path";
import type { PluginLogger } from "openclaw";
import { runMigrations } from "./migrations.js";

let _db: Database.Database | null = null;

export async function initDb(
  stateDir: string,
  logger: PluginLogger
): Promise<void> {
  const dbPath = join(stateDir, "research-claw.db");
  logger.info("opening database", { path: dbPath });

  _db = new Database(dbPath);

  // WAL mode for concurrent reads from Dashboard + Agent
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  _db.pragma("foreign_keys = ON");
  _db.pragma("synchronous = NORMAL");

  await runMigrations(_db, logger);
}

export function getDb(): Database.Database {
  if (!_db) {
    throw new Error(
      "Database not initialized. Ensure rc-database service has started."
    );
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
```

**Why WAL mode matters:** The Dashboard may query the database via RPC methods
while the agent is simultaneously writing tool results. WAL mode allows
concurrent readers without blocking the writer.

### 7.2 Dashboard-Plugin Communication

The Dashboard UI communicates with the plugin through the gateway's WebSocket
RPC layer. The flow:

```
Dashboard (Lit/React)       Gateway (WS)           Plugin
     │                         │                      │
     │  → request: rc.lit.search  →                   │
     │                         │  → handler(params)   │
     │                         │  ← respond(result)   │
     │  ← response: { papers }  ←                    │
     │                         │                      │
```

**Plugin side** — register RPC methods:

```typescript
// src/rpc/literature.ts
import type { OpenClawPluginApi } from "openclaw";
import { getDb } from "../db/connection.js";

export function registerLiteratureRpc(api: OpenClawPluginApi): void {
  // RPC handlers use simple (params) => result signature.
  // The bridge in index.ts wraps them for the gateway's opts pattern.
  const registerMethod = (method: string, handler: (params: Record<string, unknown>) => unknown) => {
    api.registerGatewayMethod(method, async (opts: { params: Record<string, unknown>; respond: Function }) => {
      try {
        const result = await handler(opts.params);
        opts.respond(true, result);
      } catch (err) {
        opts.respond(false, undefined, { code: 'PLUGIN_ERROR', message: String(err) });
      }
    });
  };

  registerMethod("rc.lit.search", async (params) => {
    const { query, limit = 20 } = params as { query: string; limit?: number };
    const db = getDb();
    const result = service.search(query, limit);
    return result;
  });

  registerMethod("rc.lit.tags", async () => {
    return service.getTags();
  });
}
```

**Dashboard side** — call RPC methods from the UI:

```typescript
// In a Lit component or React hook
async function searchPapers(query: string): Promise<Paper[]> {
  const response = await gateway.request("rc.lit.search", {
    query,
    limit: 20,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.papers;
}
```

### 7.3 Tool Results to Message Cards

The `after_tool_call` hook intercepts tool results and reformats them as
message cards that the Dashboard can render as rich UI components.

```typescript
// src/hooks/cards.ts
import type { OpenClawPluginApi } from "openclaw";

// Map of tool names to card formatters
const CARD_FORMATTERS: Record<
  string,
  (result: any) => string | null
> = {
  library_search: (result) => {
    const data = JSON.parse(result.content[0].text);
    if (data.total === 0) return null;

    const card = {
      type: "paper_card",
      papers: data.papers.slice(0, 5).map((p: any) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        tags: p.tags,
      })),
      total: data.total,
      hasMore: data.total > 5,
    };
    return "```paper_card\n" + JSON.stringify(card, null, 2) + "\n```";
  },

  library_add_paper: (result) => {
    const data = JSON.parse(result.content[0].text);
    const card = {
      type: "paper_card",
      papers: [data.paper],
      action: "added",
    };
    return "```paper_card\n" + JSON.stringify(card, null, 2) + "\n```";
  },

  task_create: (result) => {
    const data = JSON.parse(result.content[0].text);
    const card = {
      type: "task_card",
      task: data.task,
      action: "created",
    };
    return "```task_card\n" + JSON.stringify(card, null, 2) + "\n```";
  },

  task_list: (result) => {
    const data = JSON.parse(result.content[0].text);
    if (data.tasks.length === 0) return null;

    const card = {
      type: "progress_card",
      title: "Open Tasks",
      tasks: data.tasks,
      stats: {
        total: data.tasks.length,
        done: data.tasks.filter((t: any) => t.status === "done").length,
        inProgress: data.tasks.filter((t: any) => t.status === "in_progress")
          .length,
      },
    };
    return "```progress_card\n" + JSON.stringify(card, null, 2) + "\n```";
  },
};

export function registerCardHooks(api: OpenClawPluginApi): void {
  api.on("after_tool_call", async (ctx) => {
    const formatter = CARD_FORMATTERS[ctx.tool];
    if (!formatter || !ctx.result) return;

    try {
      const cardMarkdown = formatter(ctx.result);
      if (cardMarkdown) {
        return {
          result: {
            content: [{ type: "text", text: cardMarkdown }],
          },
        };
      }
    } catch (err) {
      api.logger.warn("card formatting failed", {
        tool: ctx.tool,
        error: String(err),
      });
      // Fall through — return original result
    }
  });
}
```

The Dashboard's Markdown renderer picks up the fenced code blocks with known
language tags (`paper_card`, `task_card`, `progress_card`) and renders them as
interactive card components. See C3d (Message Card Protocol) for the full card
type registry and rendering specification.

### 7.4 Context Injection via before_prompt_build

The `before_prompt_build` hook is the primary way to give the agent awareness of
the researcher's current state. The injected context appears at the top of the
system prompt, before the conversation.

```typescript
// src/hooks/context.ts
import type { OpenClawPluginApi } from "openclaw";
import { getDb } from "../db/connection.js";
import type { PluginConfig } from "../config.js";

export function registerContextHooks(
  api: OpenClawPluginApi,
  config: PluginConfig
): void {
  api.on(
    "before_prompt_build",
    async (ctx) => {
      const db = getDb();
      const sections: string[] = ["## Research-Claw Context", ""];

      // Recent papers
      const paperCount = config.contextPaperCount;
      if (paperCount > 0) {
        const papers = db
          .prepare(
            `SELECT title, authors, year, tags
             FROM rc_papers
             ORDER BY created_at DESC
             LIMIT ?`
          )
          .all(paperCount) as any[];

        if (papers.length > 0) {
          sections.push("### Recently Added Papers");
          for (const p of papers) {
            const authors = JSON.parse(p.authors);
            const firstAuthor =
              authors.length > 1 ? `${authors[0]} et al.` : authors[0];
            sections.push(`- ${p.title} (${firstAuthor}, ${p.year})`);
          }
          sections.push("");
        }
      }

      // Open tasks
      const tasks = db
        .prepare(
          `SELECT title, status, priority
           FROM rc_tasks
           WHERE status != 'done'
           ORDER BY
             CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
             created_at DESC
           LIMIT 5`
        )
        .all() as any[];

      if (tasks.length > 0) {
        sections.push("### Open Tasks");
        for (const t of tasks) {
          const marker =
            t.priority === "high" ? "(!)" : t.priority === "medium" ? "(*)" : "";
          sections.push(`- [${t.status}] ${t.title} ${marker}`);
        }
        sections.push("");
      }

      // Active workspace
      if (ctx.workspaceDir) {
        sections.push(`### Workspace: \`${ctx.workspaceDir}\``);
        sections.push("");
      }

      return {
        prependContext: sections.join("\n"),
      };
    },
    { priority: 10 }
  );
}
```

**Priority matters.** Lower numbers execute first. Research-Claw's context hook
uses priority 10 to ensure it runs early, so other plugins can build on the
context it provides.

### 7.5 Putting It All Together

The following diagram shows how all plugin components interact during a typical
Research-Claw session:

```
  User types: "Find papers about graph neural networks from 2023"

  ┌─────────────────────────────────────────────────────────────────┐
  │ OpenClaw Agent Loop                                             │
  │                                                                 │
  │  1. before_prompt_build hook fires                              │
  │     → Context hook injects recent papers + open tasks           │
  │                                                                 │
  │  2. LLM receives prompt + tools list                            │
  │     → Decides to call library_search tool                       │
  │                                                                 │
  │  3. before_tool_call hook fires                                 │
  │     → (optional: log, validate, modify params)                  │
  │                                                                 │
  │  4. Tool execute() runs                                         │
  │     → Queries SQLite via getDb()                                │
  │     → Returns { content: [{ type: "text", text: "..." }] }     │
  │                                                                 │
  │  5. after_tool_call hook fires                                  │
  │     → Card formatter wraps result as ```paper_card``` block     │
  │                                                                 │
  │  6. LLM sees card-formatted result, composes response           │
  │     → Response includes the paper_card fenced block             │
  │                                                                 │
  │  7. message_sent hook fires                                     │
  │     → Tracking hook logs the interaction                        │
  └─────────────────────────────────────────────────────────────────┘

  Meanwhile, Dashboard:
  ┌─────────────────────────────────────────────────────────────────┐
  │  - Receives message via WS                                      │
  │  - Markdown renderer detects ```paper_card``` block             │
  │  - Renders PaperCard component with interactive UI              │
  │  - User clicks a paper → rc.lit.get RPC → detail panel opens   │
  └─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Checklist for New Plugins

Use this checklist when creating a new Research-Claw plugin:

- [ ] `openclaw.plugin.json` has a unique `id` and accurate `configSchema`
- [ ] `package.json` includes `"openclaw-plugin"` in keywords
- [ ] All tool names use the `rc_` namespace prefix
- [ ] All RPC methods use the `rc.` namespace prefix
- [ ] Config secrets are marked `sensitive: true` in uiHints
- [ ] `registerService()` includes a `stop()` handler for cleanup
- [ ] Tools return the standard `{ content: ContentPart[] }` shape
- [ ] Error cases return meaningful messages (not raw stack traces)
- [ ] `vitest` tests cover tools, RPC methods, and hooks
- [ ] Database access goes through `getDb()` singleton (not direct opens)
- [ ] `api.logger` is used instead of `console.log`

## Appendix B: Troubleshooting

**Plugin not loading**
- Verify `openclaw.plugin.json` exists and has valid JSON.
- Check `main` field points to the correct entry file.
- Run `openclaw plugins list` to confirm discovery.
- Check logs for jiti transpilation errors.

**Tool not appearing in agent**
- Ensure `name` does not collide with another plugin's tool.
- If using a factory, verify it does not return `null` (check conditions).
- Confirm the plugin is listed in the active config.

**RPC method returns no response**
- Ensure `respond()` is called in all code paths (including error branches).
- Check for unhandled promise rejections in the handler.

**Hook not firing**
- Verify the hook name matches exactly (case-sensitive, underscore-separated).
- Check priority — a higher-priority hook may be short-circuiting.
- Confirm the hook's return type matches expectations (some hooks ignore returns).

**Database locked errors**
- Ensure WAL mode is enabled: `db.pragma("journal_mode = WAL")`.
- Set a busy timeout: `db.pragma("busy_timeout = 5000")`.
- Never open multiple connections to the same database file.

---

*Cross-references: C2 (Engineering Architecture) for gateway protocol details,
C3d (Message Card Protocol) for card type definitions, C3f (Core Plugin Spec)
for the full Research-Claw plugin aggregation design.*
