/**
 * @fileoverview AgentTypes - Type definitions for agent.md schema
 *
 * Maps the YAML frontmatter of an agent.md file to TypeScript interfaces.
 * The body of agent.md (below the closing ---) is the raw prompt template.
 */

// ---------------------------------------------------------------------------
// Frontmatter sections
// ---------------------------------------------------------------------------

export interface AgentMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  avatar?: string;
  created?: string;
  updated?: string;
}

export interface AgentModelConfig {
  primary: string;
  fallback?: string;
}

export interface AgentParameters {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface AgentSection {
  enabled: boolean;
  type?: "conversational" | "task" | "scheduled";
  model: AgentModelConfig;
  parameters?: AgentParameters;
}

export interface KnowledgeConfig {
  sources: string[];
  strategy?: "inject_all" | "on_demand" | "rag";
  max_context_tokens?: number;
}

export interface PermissionsConfig {
  read?: string[];
  write?: string[];
  create?: string[];
  move?: string[];
  delete?: string[];
  vault_root_access?: boolean;
  confirm_destructive?: boolean;
}

export interface LoggingConfig {
  enabled: boolean;
  path?: string;
  format?: "daily" | "per_session" | "single";
  include_metadata?: boolean;
}

// ---------------------------------------------------------------------------
// Full agent config (parsed YAML frontmatter)
// ---------------------------------------------------------------------------

export interface AgentConfig {
  metadata: AgentMetadata;
  agent: AgentSection;
  knowledge: KnowledgeConfig;
  permissions: PermissionsConfig;
  logging: LoggingConfig;
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
