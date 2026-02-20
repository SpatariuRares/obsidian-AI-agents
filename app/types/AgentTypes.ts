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

export type AgentType = "conversational" | "task" | "scheduled";

export type LogFormat = "daily" | "per_session" | "single";

// ---------------------------------------------------------------------------
// Full agent config (parsed YAML frontmatter — flat)
// ---------------------------------------------------------------------------

export interface AgentConfig {
  name: string;
  description: string;
  author: string;
  avatar: string;
  enabled: boolean;
  type: AgentType;
  provider: string;
  model: string;
  sources: string[];
  strategy: string;
  max_context_tokens: number;
  read: string[];
  write: string[];
  create: string[];
  move: string[];
  delete: string[];
  vault_root_access: boolean;
  confirm_destructive: boolean;
  logging_enabled: boolean;
  logging_path: string;
  logging_format: LogFormat;
  logging_include_metadata: boolean;
}

// ---------------------------------------------------------------------------
// Chat message
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
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
