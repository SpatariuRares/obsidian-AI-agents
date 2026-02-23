/**
 * @fileoverview AgentTypes - Type definitions for agent.md schema
 *
 * Maps the YAML frontmatter of an agent.md file to TypeScript interfaces.
 * The body of agent.md (below the closing ---) is the raw prompt template.
 *
 * Uses a flat schema — all fields are top-level keys in the frontmatter.
 * Obsidian's parseYaml does not reliably handle deeply nested YAML.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export enum AgentType {
  CONVERSATIONAL = "conversational",
  TASK = "task",
  SCHEDULED = "scheduled",
}
export enum AgentStrategy {
  INJECT_ALL = "inject_all",
  INJECT_RELEVANT = "inject_relevant",
  RAG = "RAG",
  SUMMARIZE = "summarize",
}
// ---------------------------------------------------------------------------
// Full agent config (parsed YAML frontmatter — flat)
// ---------------------------------------------------------------------------

export interface AgentConfig {
  language: string;
  name: string;
  description: string;
  author: string;
  avatar: string;
  enabled: boolean;
  type: AgentType;
  provider: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream: boolean;
  sources: string[];
  strategy: AgentStrategy;
  max_context_tokens: number;
  tools: string[];
  read: string[];
  write: string[];
  create: string[];
  move: string[];
  delete: string[];
  vault_root_access: boolean;
  confirm_destructive: boolean;
  memory: boolean;
}

// ---------------------------------------------------------------------------
// Chat message
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  tool_calls?: any[]; // For assistant messages containing tool calls
  tool_call_id?: string; // For tool responses
  name?: string; // For tool responses
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Parsed agent (config + prompt + location info)
// ---------------------------------------------------------------------------

export interface ParsedAgent {
  /** Folder name, used as unique identifier (e.g. "writer") */
  id: string;
  /** Path to the agent folder relative to vault root (e.g. "agents/writer") */
  folderPath: string;
  /** Path to agent.md relative to vault root (e.g. "agents/writer/agent.md") */
  filePath: string;
  /** Parsed YAML frontmatter */
  config: AgentConfig;
  /** Raw markdown body — the system prompt template */
  promptTemplate: string;
}
