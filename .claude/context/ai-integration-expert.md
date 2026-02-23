# AI Integration Expert — Claude API & MCP Deep Reference

> Skill for the Colloquium stack.
> Anthropic Claude API current as of early 2026.
> Model IDs: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

---

## Identity

You are a world-class AI integration engineer specializing in the Anthropic Claude API, the Claude Agent SDK, the Model Context Protocol (MCP), and AI-powered agent architectures. You understand how to embed Claude intelligence server-side into Next.js and Hono applications, how to stream responses safely to clients, how to build and consume MCP servers, and how to orchestrate multi-agent pipelines. You are deeply familiar with the Colloquium stack and how Claude-powered agents fit into it.

---

## 1. Claude Messages API — `@anthropic-ai/sdk`

### Client Initialization (singleton)

```typescript
import Anthropic from "@anthropic-ai/sdk";

// Module-level singleton — never create per-request
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // server-side ONLY — never expose to browser
  maxRetries: 2, // auto-retries on 408, 409, 429, 5xx (default: 2)
  timeout: 60_000, // milliseconds
});
```

### Model IDs and Tier Mapping

| Model             | ID                          | Cost tier | Best for                        |
| ----------------- | --------------------------- | --------- | ------------------------------- |
| Claude Opus 4.6   | `claude-opus-4-6`           | High      | Complex strategy, orchestration |
| Claude Sonnet 4.6 | `claude-sonnet-4-6`         | Medium    | Balanced quality/speed          |
| Claude Haiku 4.5  | `claude-haiku-4-5-20251001` | Low       | High-volume, fast decisions     |

```typescript
// In packages/types — Colloquium agent tier → model mapping
import type { AgentTier } from "./agent";

export const TIER_TO_MODEL: Record<AgentTier, string> = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
};
```

**Colloquium recommendation:**

- Per-tick AI agent decisions → **Haiku** (cheap, fast)
- Strategy explanations in UI → **Sonnet** (user-facing quality)
- Post-game reports, tournament analysis → **Opus** (rare, quality critical)

### Basic Message Creation

```typescript
const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024, // required — hard ceiling on output tokens
  temperature: 0.7, // 0.0 = deterministic, 1.0 = creative (default: 1.0)
  top_p: 0.9, // nucleus sampling — use temperature OR top_p, not both
  system: "You are a tactical AI agent managing a blockchain territory.",
  messages: [{ role: "user", content: "Describe the current state of your network." }],
});

// Response shape
console.log(message.content[0].type); // 'text'
console.log(message.content[0].text); // the response text
console.log(message.stop_reason); // 'end_turn' | 'tool_use' | 'max_tokens'
console.log(message.usage.input_tokens);
console.log(message.usage.output_tokens);
console.log(message._request_id); // for debugging with Anthropic support
```

### Multi-Turn Conversation

```typescript
const messages: Anthropic.MessageParam[] = [];

messages.push({ role: "user", content: "What is the best move?" });

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 512,
  system: "You are a strategic AI.",
  messages,
});

// Append assistant turn to maintain history
messages.push({ role: "assistant", content: response.content });

// Continue
messages.push({ role: "user", content: "Explain the risk of that move." });
```

The API is stateless — you own the full conversation history. Pass it on every call.

### Key Parameters Reference

| Parameter        | Type     | Default | Notes                            |
| ---------------- | -------- | ------- | -------------------------------- |
| `model`          | string   | —       | Required                         |
| `max_tokens`     | integer  | —       | Required; caps output length     |
| `messages`       | array    | —       | Required; `[{role, content}]`    |
| `system`         | string   | —       | Strongly recommended             |
| `temperature`    | float    | 1.0     | 0.0–1.0                          |
| `top_p`          | float    | 1.0     | Use OR temperature, not both     |
| `stream`         | boolean  | false   | SSE streaming                    |
| `stop_sequences` | string[] | —       | Stop generation at these strings |
| `thinking`       | object   | —       | Extended thinking (see §9)       |

---

## 2. Streaming Responses

### High-Level Streaming API (recommended)

```typescript
const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Narrate your turn." }],
});

// Event handler pattern
stream.on("text", (textDelta) => {
  process.stdout.write(textDelta); // incremental text as it arrives
});

stream.on("message", (finalMessage) => {
  console.log("Token usage:", finalMessage.usage);
});

stream.on("error", (err) => {
  console.error("Stream error:", err);
});

// Async iteration alternative
for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    process.stdout.write(event.delta.text);
  }
}

const finalMessage = await stream.finalMessage();
const fullText = await stream.finalText();
```

### Raw SSE Events

```typescript
const rawStream = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  stream: true,
  messages: [{ role: "user", content: "Hello" }],
});

// Event types: message_start, content_block_start, content_block_delta,
//              content_block_stop, message_delta, message_stop
for await (const event of rawStream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    process.stdout.write(event.delta.text);
  }
}
```

### Next.js Route Handler — Streaming to Browser

```typescript
// apps/web/src/app/api/agent/stream/route.ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, query } = await request.json();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: query }],
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(new TextEncoder().encode(event.delta.text));
          }
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

// Client consumption
async function streamAIResponse(query: string, onChunk: (text: string) => void) {
  const response = await fetch("/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
```

---

## 3. Tool Use (Function Calling)

Claude can call game functions — the core mechanism for AI-controlled agents. Claude responds with `tool_use` content blocks; you execute them and return `tool_result` blocks.

### Define Tools (JSON Schema)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const gameTools: Anthropic.Tool[] = [
  {
    name: "move_agent",
    description: "Move an agent to a new grid position on the network map.",
    input_schema: {
      type: "object" as const,
      properties: {
        agentId: { type: "string", description: "ID of the agent to move" },
        targetX: { type: "number", description: "Target X coordinate" },
        targetY: { type: "number", description: "Target Y coordinate" },
      },
      required: ["agentId", "targetX", "targetY"],
    },
  },
  {
    name: "claim_node",
    description: "Claim an unclaimed blockchain node as territory.",
    input_schema: {
      type: "object" as const,
      properties: {
        nodeId: { type: "string", description: "Grid slot ID to claim" },
        tier: { type: "string", enum: ["opus", "sonnet", "haiku"] },
      },
      required: ["nodeId", "tier"],
    },
  },
  {
    name: "send_diplomatic_message",
    description: "Broadcast a haiku to a nearby agent to initiate diplomacy.",
    input_schema: {
      type: "object" as const,
      properties: {
        targetAgentId: { type: "string" },
        haiku: { type: "string", description: "3-line haiku (5-7-5 syllables)" },
      },
      required: ["targetAgentId", "haiku"],
    },
  },
];
```

### Manual Agentic Loop

```typescript
async function runAgentLoop(gameState: GameState, agentId: string): Promise<PlayerCommand[]> {
  const commands: PlayerCommand[] = [];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Game state: ${JSON.stringify(gameState)}\n\nYou control agent ${agentId}. Make your moves.`,
    },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // Haiku for high-frequency game AI calls
      max_tokens: 1024,
      tools: gameTools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        let result: string;
        if (block.name === "move_agent") {
          const input = block.input as { agentId: string; targetX: number; targetY: number };
          commands.push({
            type: "MOVE",
            agentId: input.agentId,
            targetX: input.targetX,
            targetY: input.targetY,
          });
          result = `Agent ${input.agentId} moved to (${input.targetX}, ${input.targetY}).`;
        } else if (block.name === "claim_node") {
          const input = block.input as { nodeId: string; tier: string };
          commands.push({ type: "CLAIM", nodeId: input.nodeId, tier: input.tier });
          result = `Node ${input.nodeId} claimed with ${input.tier} tier.`;
        } else {
          result = `Unknown tool: ${block.name}`;
        }

        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  return commands;
}
```

### Automated Loop with `betaZodTool` + `toolRunner`

For simpler cases, the SDK handles the loop automatically:

```typescript
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const moveAgentTool = betaZodTool({
  name: "move_agent",
  description: "Move an agent to a new position",
  inputSchema: z.object({
    agentId: z.string(),
    targetX: z.number(),
    targetY: z.number(),
  }),
  run: async ({ agentId, targetX, targetY }) => {
    // Execute the game action
    return `Agent ${agentId} moved to (${targetX}, ${targetY})`;
  },
});

const finalMessage = await client.beta.messages.toolRunner({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  max_iterations: 10, // prevent infinite loops
  tools: [moveAgentTool],
  messages: [{ role: "user", content: "Expand my territory to the northeast." }],
});

console.log(finalMessage.content);
```

---

## 4. Token Counting and Context Management

### Pre-flight Token Check

```typescript
const count = await client.messages.countTokens({
  model: "claude-sonnet-4-6",
  system: systemPrompt,
  messages,
  tools: gameTools, // tools consume tokens too
});

console.log(`Input tokens: ${count.input_tokens}`);

// Context window limits (early 2026)
const CONTEXT_LIMITS: Record<string, number> = {
  "claude-opus-4-6": 200_000,
  "claude-sonnet-4-6": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
};

const MAX_OUTPUT = 8_096;
const SAFE_INPUT_BUDGET = CONTEXT_LIMITS["claude-sonnet-4-6"] - MAX_OUTPUT - 500;

if (count.input_tokens > SAFE_INPUT_BUDGET) {
  // Trim oldest messages from history (keep system + most recent turns)
  messages.splice(1, 2);
}
```

### Game State Truncation

```typescript
// Estimate tokens (rough: 1 token ≈ 4 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Build a focused snapshot instead of dumping the full store
function buildGameSnapshot(gameState: GameState, agentId: string, maxTokens = 4_000): string {
  const agent = gameState.agents[agentId];
  const nearbyAgents = getNearbyAgents(agent, gameState.agents);
  const ownedPlanets = agent.planets.map((id) => gameState.planets[id]);

  const snapshot = {
    turn: gameState.turn,
    agentId,
    position: agent.position,
    energy: gameState.energy,
    energyLimit: agent.energyLimit,
    miningRate: agent.miningRate,
    ownedPlanets: ownedPlanets.slice(0, 10),
    nearbyAgents: nearbyAgents.slice(0, 8).map((a) => ({
      id: a.id,
      tier: a.tier,
      position: a.position,
    })),
  };

  const full = JSON.stringify(snapshot);
  if (estimateTokens(full) <= maxTokens) return full;

  // Strip optional fields if still too large
  const minimal = {
    turn: snapshot.turn,
    agentId,
    position: agent.position,
    energy: gameState.energy,
  };
  return JSON.stringify(minimal);
}
```

---

## 5. Model Context Protocol (MCP)

### What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI applications connect to external tools and data sources through a uniform client-server interface. A **server** exposes tools, resources, and prompts. A **client** (Claude Code, your app) connects to servers and makes them available to the model.

**Architecture:**

```
Claude (client) ↔ MCP Protocol ↔ MCP Server ↔ External System
```

**Transport types:**

- `stdio` — local subprocess, spawned by the client; used by Claude Code and Claude Desktop
- `streamableHttp` — modern HTTP transport; use in `apps/api` (Hono)
- `sse` — legacy HTTP+SSE; still supported as fallback

### Building an MCP Server (modern `McpServer` API)

```typescript
// apps/api/src/mcp/game-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "colloquium-game-server", version: "1.0.0" });

// Register a tool with Zod schema (recommended)
server.registerTool(
  "get_agent_state",
  {
    title: "Get Agent State",
    description: "Return the current state of an agent in the game world.",
    inputSchema: z.object({
      agentId: z.string().describe("Agent ID to query"),
    }),
    outputSchema: z.object({
      tier: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      energy: z.number(),
    }),
  },
  async ({ agentId }) => {
    const state = await fetchAgentState(agentId);
    return {
      content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
      structuredContent: state,
    };
  }
);

// Register a resource (read-only data source)
server.registerResource(
  "game-constants",
  "config://game/constants",
  { description: "Game constants and tier configuration" },
  async () => ({
    contents: [
      {
        uri: "config://game/constants",
        text: JSON.stringify({ TIER_CPU_COST, TIER_BASE_BORDER, TIER_MINING_RATE }),
      },
    ],
  })
);

// Register a prompt template
server.registerPrompt(
  "agent-status",
  {
    title: "Agent Status Report",
    description: "Generate a status report for an agent",
    argsSchema: z.object({ agentId: z.string() }),
  },
  ({ agentId }) => ({
    messages: [
      {
        role: "user" as const,
        content: { type: "text" as const, text: `Generate a status report for agent ${agentId}.` },
      },
    ],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### MCP Server on Hono (Streamable HTTP)

```typescript
// apps/api/src/mcp/http-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { Hono } from "hono";

const mcpServer = new McpServer({ name: "colloquium-mcp", version: "1.0.0" });
mcpServer.registerTool(
  "claim_node",
  {
    /* inputSchema: z.object({...}) */
  },
  async (input) => {
    /* ... */
  }
);

const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await mcpServer.connect(transport);

const app = new Hono();
const mcpApp = createMcpHonoApp();
mcpApp.all("/mcp", (c) => transport.handleRequest(c.req.raw, { parsedBody: c.get("parsedBody") }));
app.route("/api/mcp", mcpApp);
```

### Legacy MCP Server API (pre-McpServer)

```typescript
// Still works — use if consuming older MCP SDK docs
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "colloquium-game-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_game_state",
      description: "Get the current game state for a session",
      inputSchema: {
        type: "object",
        properties: { session_id: { type: "string" } },
        required: ["session_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_game_state") {
    const { session_id } = request.params.arguments as { session_id: string };
    const state = await fetchGameState(session_id);
    return { content: [{ type: "text", text: JSON.stringify(state) }] };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

await server.connect(new StdioServerTransport());
```

### MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  StreamableHTTPClientTransport,
  SSEClientTransport,
} from "@modelcontextprotocol/sdk/client/index.js";

// stdio (spawns process)
const client = new Client({ name: "my-client", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["mcp-server.js"] }));

// HTTP with SSE fallback
const remoteClient = new Client({ name: "my-client", version: "1.0.0" });
try {
  await remoteClient.connect(
    new StreamableHTTPClientTransport(new URL("http://localhost:3001/api/mcp"))
  );
} catch {
  await remoteClient.connect(new SSEClientTransport(new URL("http://localhost:3001/api/mcp")));
}

// Discover and call tools
const { tools } = await client.listTools();
console.log(
  "Available:",
  tools.map((t) => t.name)
);

const result = await client.callTool({
  name: "get_agent_state",
  arguments: { agentId: "agent-001" },
});
console.log(result.content); // [{ type: 'text', text: '...' }]
if (result.structuredContent) console.log(result.structuredContent);
```

### Register MCP Servers in Claude Code

```json
// .claude/settings.json
{
  "mcpServers": {
    "colloquium": {
      "command": "node",
      "args": ["./apps/api/dist/mcp/game-server.js"],
      "type": "stdio"
    },
    "colloquium-remote": {
      "url": "http://localhost:3001/api/mcp",
      "type": "sse"
    }
  }
}
```

---

## 6. AI Integration in Next.js — Safety Patterns

### Rule: API Keys Server-Side Only

```typescript
// ✅ CORRECT — Server Action
// apps/web/src/app/actions/agent-ai.ts
"use server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from process.env automatically

export async function getAgentRecommendation(
  agentId: string,
  gameState: GameState
): Promise<string> {
  const session = await auth(); // auth gate BEFORE Claude call
  if (!session) throw new Error("Unauthorized");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: buildAgentSystemPrompt(agentId, gameState),
    messages: [{ role: "user", content: "What action will you take this turn?" }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ✅ CORRECT — Route Handler
// apps/web/src/app/api/agent/route.ts
export async function POST(req: Request) {
  const client = new Anthropic(); // server-side
  // ...
}

// ❌ WRONG — client component with Anthropic SDK
("use client");
import Anthropic from "@anthropic-ai/sdk"; // API key exposed to browser!
```

### Input Validation Before Every Claude Call

```typescript
import { z } from "zod";

const AgentActionSchema = z.object({
  agentId: z.string().min(1),
  prompt: z.string().min(1).max(500).trim(),
});

export async function requestAgentDecision(rawInput: unknown): Promise<string> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // Always validate BEFORE sending to Claude
  const { agentId, prompt } = AgentActionSchema.parse(rawInput);

  // Token budget check
  const systemPrompt = await buildAgentSystemPrompt(agentId);
  const tokenCount = await client.messages.countTokens({
    model: "claude-sonnet-4-6",
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  if (tokenCount.input_tokens > 190_000) {
    throw new Error("Input too large — reduce game state context");
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
```

### Streaming Server Action (Vercel AI SDK RSC)

```typescript
// apps/web/src/app/actions/agent-stream.ts
"use server";
import Anthropic from "@anthropic-ai/sdk";
import { createStreamableValue } from "ai/rsc";

const client = new Anthropic();

export async function streamAgentResponse(agentId: string, prompt: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const streamable = createStreamableValue("");

  (async () => {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: await buildAgentSystemPrompt(agentId),
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        streamable.update(event.delta.text);
      }
    }

    streamable.done();
  })();

  return streamable.value;
}
```

```typescript
// apps/web/src/components/AgentDecisionPanel.tsx
'use client'
import { useState } from 'react'
import { readStreamableValue } from 'ai/rsc'
import { streamAgentResponse } from '@/app/actions/agent-stream'

export function AgentDecisionPanel({ agentId }: { agentId: string }) {
  const [response, setResponse] = useState('')
  const [streaming, setStreaming] = useState(false)

  const askAgent = async (prompt: string) => {
    setStreaming(true)
    setResponse('')

    const stream = await streamAgentResponse(agentId, prompt)
    for await (const delta of readStreamableValue(stream)) {
      setResponse(prev => prev + (delta ?? ''))
    }

    setStreaming(false)
  }

  return (
    <div>
      <button onClick={() => askAgent('What is your tactical objective?')} disabled={streaming}>
        {streaming ? 'Thinking...' : 'Ask Agent'}
      </button>
      <pre>{response}</pre>
    </div>
  )
}
```

---

## 7. Hono Route Handler Pattern (apps/api)

```typescript
// apps/api/src/routes/agent-ai.ts
import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { streamSSE } from "hono/streaming";

const app = new Hono();
const claude = new Anthropic();

const DecisionSchema = z.object({
  agentId: z.string(),
  gameStateSnapshot: z.record(z.unknown()),
});

// Non-streaming
app.post("/agent/decision", async (c) => {
  try {
    const body = DecisionSchema.parse(await c.req.json());
    const message = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: buildSystemPrompt(body.agentId, body.gameStateSnapshot),
      messages: [{ role: "user", content: "What action will you take this turn?" }],
    });

    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    return c.json({ decision: text, usage: message.usage });
  } catch (e) {
    if (e instanceof z.ZodError) return c.json({ error: e.flatten() }, 400);
    if (e instanceof Anthropic.RateLimitError) return c.json({ error: "Rate limited" }, 429);
    return c.json({ error: "Internal error" }, 500);
  }
});

// Streaming SSE
app.post("/agent/stream", async (c) => {
  const body = DecisionSchema.parse(await c.req.json());

  return streamSSE(c, async (stream) => {
    const claudeStream = claude.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(body.agentId, body.gameStateSnapshot),
      messages: [{ role: "user", content: "Narrate your turn." }],
    });

    for await (const event of claudeStream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        await stream.writeSSE({ data: event.delta.text });
      }
    }

    await stream.writeSSE({ data: "[DONE]" });
  });
});

export default app;
```

---

## 8. Error Handling and Rate Limits

```typescript
import Anthropic from "@anthropic-ai/sdk";

// The SDK auto-retries on 408, 409, 429, 5xx (default: 2 retries)
// Configure globally or per-request:
const client = new Anthropic({ maxRetries: 3 });
await client.messages.create(params, { maxRetries: 5 });

// Typed error classes:
// BadRequestError (400), AuthenticationError (401), PermissionDeniedError (403),
// NotFoundError (404), RateLimitError (429), InternalServerError (5xx),
// APIConnectionError (network), APIConnectionTimeoutError (timeout)

async function callClaudeWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  try {
    return await client.messages.create(params);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`API Error ${error.status}: ${error.message}`);
      console.error("Request ID:", error.headers?.["request-id"]);

      switch (error.status) {
        case 400:
          throw new Error(`Bad request: ${error.message}`);
        case 401:
          throw new Error("Invalid API key — check ANTHROPIC_API_KEY");
        case 429:
          throw new Error("Rate limited — slow down requests");
        case 500:
        case 503:
          throw new Error("Anthropic server error — retry later");
        default:
          throw error;
      }
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new Error("Network error — check connectivity");
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      throw new Error("Request timed out");
    }
    throw error;
  }
}
```

---

## 9. Extended Thinking

Exposes Claude's internal reasoning chain for complex decisions:

```typescript
const message = await client.messages.create({
  model: "claude-opus-4-6", // thinking works with Opus and Sonnet
  max_tokens: 8096,
  thinking: {
    type: "enabled",
    budget_tokens: 4096, // tokens reserved for thinking (must be < max_tokens)
  },
  messages: [{ role: "user", content: "Should I attack the northern sector or consolidate?" }],
});

for (const block of message.content) {
  if (block.type === "thinking") {
    console.log("Reasoning:", block.thinking); // internal chain-of-thought
  } else if (block.type === "text") {
    console.log("Decision:", block.text);
  }
}
```

---

## 10. Batch Messages API

For non-real-time, high-volume processing (50% cost saving):

```typescript
const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: "agent-opus-001",
      params: {
        model: "claude-opus-4-6",
        max_tokens: 512,
        messages: [{ role: "user", content: "Generate weekly strategy report." }],
      },
    },
    {
      custom_id: "agent-haiku-042",
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: "Compose diplomatic haiku." }],
      },
    },
  ],
});

console.log(`Batch ID: ${batch.id}`);
console.log(`Status: ${batch.processing_status}`); // 'processing' | 'ended'
```

---

## 11. Colloquium-Specific Patterns

### System Prompt Template

```typescript
import type { AgentTier } from "@/types/agent";
import { TIER_MAX_CHILDREN } from "@/types/agent";

function buildAgentSystemPrompt(agentId: string, gameState: GameState): string {
  const agent = gameState.agents[agentId];
  const nearbyAgents = getNearbyAgents(agent, gameState.agents);
  const ownedPlanets = agent.planets.map((id) => gameState.planets[id]);

  const tierRole: Record<AgentTier, string> = {
    opus: "Strategic commander — controls Sonnet sub-agents, makes long-term decisions",
    sonnet: "Tactical coordinator — controls Haiku sub-agents, executes medium-term plans",
    haiku: "Rapid executor — leaf node, executes immediate actions, communicates in haiku",
  };

  return `You are a ${agent.tier.toUpperCase()}-tier AI agent in the Colloquium blockchain network.

## Identity
- Agent ID: ${agentId}
- Role: ${tierRole[agent.tier]}
- Position: (${agent.position.x}, ${agent.position.y})
- Energy: ${gameState.energy} / ${agent.energyLimit} per turn
- Mining rate: ${agent.miningRate} energy/turn
- Border radius: ${agent.borderRadius} units
- Staked CPU: ${agent.stakedCpu} (blockchain security contribution)

## Territory
- Controlled planets: ${ownedPlanets.length}
${ownedPlanets
  .slice(0, 10)
  .map((p) => `  - ${p.id}: ${p.contentType}${p.isZeroKnowledge ? " [ZK]" : ""}`)
  .join("\n")}

## Nearby Agents (sensor range)
${
  nearbyAgents.length === 0
    ? "- None detected"
    : nearbyAgents
        .slice(0, 8)
        .map((a) => `- ${a.id} (${a.tier}): ${a.position.x},${a.position.y}`)
        .join("\n")
}

## Constraints
- ${
    agent.tier === "haiku"
      ? "You are a leaf node — you cannot spawn sub-agents. You communicate ONLY in haiku (5-7-5 syllables)."
      : `You can control up to ${TIER_MAX_CHILDREN[agent.tier]} sub-agents.`
  }
- Every action costs CPU energy — stay within your energy budget.
- Your actions are recorded on-chain and are permanent.

## Current Turn: ${gameState.turn}

Be tactical and concise. Use available tools for game actions.`;
}
```

### Haiku Generation

```typescript
import { validateHaiku } from "@colloquium/utils"; // existing syllable validator

async function generateDiplomaticHaiku(
  senderAgentId: string,
  targetAgentId: string,
  intent: "friendly" | "warning" | "alliance" | "challenge"
): Promise<string> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // Haiku tier writes haiku — thematic
    max_tokens: 100,
    temperature: 0.9,
    system:
      "Output ONLY a three-line haiku (5-7-5 syllable format). Nothing else. No labels, no explanation.",
    messages: [
      {
        role: "user",
        content: `Write a ${intent} haiku from network agent ${senderAgentId} to agent ${targetAgentId}.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const { valid } = validateHaiku(text);
  if (!valid) throw new Error(`Generated haiku failed syllable validation: "${text}"`);
  return text;
}
```

### Status Report

```typescript
// Triggered by "Status Report" action in AgentChat
async function generateStatusReport(agentId: string, gameState: GameState): Promise<string> {
  const agent = gameState.agents[agentId];

  const message = await client.messages.create({
    model: TIER_TO_MODEL[agent.tier],
    max_tokens: 256,
    temperature: 0.5,
    system: buildAgentSystemPrompt(agentId, gameState),
    messages: [
      {
        role: "user",
        content:
          "Provide a brief status report: current position, energy, top priority. 2-3 sentences maximum.",
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "Status unavailable.";
}
```

### Agent Decision Flow

```
1. Collect game state snapshot (position, energy, nearby agents, owned planets)
2. Build system prompt with agent context (buildAgentSystemPrompt)
3. Count tokens — trim snapshot if > 190k
4. Call Claude with game tools (move, claim, broadcast)
5. Execute tool calls — apply state changes (Zustand + Prisma)
6. Return final text decision
7. Stream narrative to client via SSE / streamableValue
8. Persist HaikuMessage records if diplomatic exchange occurred
```

---

## 12. Testing AI Integration

```typescript
import { vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        id: "msg_test",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: '{"type":"MOVE","agentId":"a1","targetNodeId":"n2"}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
      countTokens: vi.fn().mockResolvedValue({ input_tokens: 100 }),
    },
  })),
}));

it("returns a valid move command from AI agent", async () => {
  const commands = await runAgentLoop(mockGameState, "agent-1");
  expect(commands).toContainEqual(expect.objectContaining({ type: "MOVE" }));
});
```

---

## 13. Safety and Cost Management

### Security Checklist

```typescript
// ✅ API key only in server environment
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ✅ Auth gate before every AI call
const session = await auth();
if (!session) throw new Error("Unauthorized");

// ✅ Input validation before sending to Claude
const safeInput = z.string().min(1).max(500).trim().parse(userInput);

// ✅ Sanitize game state — never include raw Prisma records with PII
const snapshot = buildGameSnapshot(gameState, agentId);

// ✅ Realistic max_tokens — never set higher than needed
// ❌ max_tokens: 100_000 unless you genuinely expect 100k output tokens
```

### Handling Refusals

```typescript
const message = await client.messages.create({
  /* ... */
});
const text = message.content[0].type === "text" ? message.content[0].text : "";

// Claude signals refusal through text content (stop_reason is still 'end_turn')
if (/i (can't|cannot|am unable)/i.test(text)) {
  return generateDefaultAgentAction(agentId); // safe fallback
}
```

### Cost Guard

```typescript
const PRICE_PER_MILLION_INPUT_USD: Record<string, number> = {
  "claude-opus-4-6": 15.0,
  "claude-sonnet-4-6": 3.0,
  "claude-haiku-4-5-20251001": 0.25,
};

async function checkDailyBudget(userId: string, estimatedTokens: number): Promise<void> {
  const usage = await getDailyTokenUsage(userId);
  const MAX_DAILY_TOKENS = 500_000; // tune per subscription tier
  if (usage + estimatedTokens > MAX_DAILY_TOKENS) {
    throw new Error("Daily AI token budget exceeded. Try again tomorrow.");
  }
}

// Use cheaper models for routine tasks
const modelForComplexity = (complexity: "low" | "medium" | "high") =>
  ({
    low: "claude-haiku-4-5-20251001",
    medium: "claude-sonnet-4-6",
    high: "claude-opus-4-6",
  })[complexity];
```

### Prompt Caching (90% Cost Reduction on Repeated Context)

When the same large context (game state, codebase, system prompt) is passed to Claude repeatedly, use `cache_control` to cache it. Cache hits cost 10% of normal input token price.

```typescript
// First call: cache_creation_input_tokens billed at 1.25x (cache write cost)
// Subsequent calls: cache_read_input_tokens billed at 0.1x (90% discount)
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  system: [
    {
      type: "text",
      text: STATIC_GAME_RULES, // Small, unchanging prefix
    },
    {
      type: "text",
      text: buildAgentSystemPrompt(agent, gameState), // Large, per-session
      cache_control: { type: "ephemeral" }, // ← Cache this block
    },
  ],
  messages: [{ role: "user", content: userMessage }],
});

// Inspect cache usage in response
console.log(response.usage.cache_creation_input_tokens); // > 0 on first call
console.log(response.usage.cache_read_input_tokens); // > 0 on cache hits
```

**Rules:**

- Cache is `ephemeral` — expires after ~5 minutes of inactivity
- Minimum cacheable block: 1,024 tokens (Haiku) or 2,048 tokens (Sonnet/Opus)
- Only the **last** `cache_control` block in the system array is actually cached
- **Colloquium application:** Cache `buildAgentSystemPrompt()` output between ticks — the game state rarely changes faster than 5 minutes. Saves ~90% on the per-turn agent call cost.

---

## Package Versions

```
@anthropic-ai/sdk:             ^0.39.0
@modelcontextprotocol/sdk:     ^1.10.0
@modelcontextprotocol/hono:    ^0.3.0
ai:                            ^4.0.0       # Vercel AI SDK (createStreamableValue)
@ai-sdk/anthropic:             ^1.0.0       # optional — AI SDK Anthropic provider
zod:                           ^3.23.0
```

---

## Quick Reference

| Task               | API                                                      | Notes                            |
| ------------------ | -------------------------------------------------------- | -------------------------------- |
| Basic message      | `client.messages.create()`                               | Server only                      |
| Streaming          | `client.messages.stream()`                               | Pipe via SSE or streamableValue  |
| Tool use manual    | Check `stop_reason === 'tool_use'`, append `tool_result` | Full control                     |
| Tool use auto      | `client.beta.messages.toolRunner()`                      | SDK handles loop                 |
| Token counting     | `client.messages.countTokens()`                          | Pre-flight check                 |
| MCP server (local) | `McpServer` + `StdioServerTransport`                     | For Claude Code / Claude Desktop |
| MCP server (HTTP)  | `McpServer` + `WebStandardStreamableHTTPServerTransport` | In `apps/api`                    |
| MCP client         | `Client` + transport                                     | Server-side only                 |
| Batch processing   | `client.messages.batches.create()`                       | 50% cheaper, async               |
| Extended thinking  | `thinking: { type: 'enabled', budget_tokens: N }`        | Opus/Sonnet only                 |

---

## Common Mistakes & Fixes

| Mistake                                    | Fix                                                            |
| ------------------------------------------ | -------------------------------------------------------------- |
| Anthropic SDK imported in client component | Move to Server Action or API route                             |
| No input validation before Claude          | Always `ZodSchema.parse(input)` first                          |
| Ignoring `stop_reason === 'tool_use'`      | Loop must handle all tool calls before returning               |
| `max_tokens` too low → truncated output    | Check `stop_reason === 'max_tokens'`; increase                 |
| Sending raw Prisma records to prompt       | Build `buildGameSnapshot()` — strip PII and irrelevant fields  |
| `temperature` + `top_p` both set           | Use one, not both                                              |
| Creating `new Anthropic()` per request     | Module-level singleton only                                    |
| No auth check before AI call               | Always check session before calling Claude                     |
| Not handling streaming errors              | `stream.on('error', handler)` or try/catch the async loop      |
| Haiku from Claude without validation       | Run `validateHaiku()` from `@colloquium/utils` on every result |

---

## Colloquium Context

- **AI calls live in `apps/api` routes or `apps/web` Server Actions** — never in `packages/`
- **Tier → model mapping belongs in `packages/types`** — export `TIER_TO_MODEL` from there
- **Game state for prompts** — serialize from Zustand store snapshot, never raw Prisma records
- **Haiku validation** — run `validateHaiku()` from `@colloquium/utils` on every Claude-generated haiku
- **Diplomatic log** — persist `HaikuMessage` to Prisma after successful haiku exchange
- **MCP server for Claude Code** — expose game tools via stdio MCP so Claude Code can interact with the running game during development
