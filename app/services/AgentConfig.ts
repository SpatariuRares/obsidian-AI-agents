/**
 * @fileoverview AgentConfig - Parser for agent.md files
 *
 * Splits an agent.md file on the `---` frontmatter delimiters:
 *   - Part 1 (between first and second ---) → parseYaml() → AgentConfig
 *   - Part 2 (after second ---) → raw prompt template string
 *
 * Validates that required fields are present and returns a typed result.
 *
 * Uses a flat YAML schema — all fields are top-level keys.
 */

import { parseYaml } from "obsidian";
import { AgentConfig, AgentType } from "@app/types/AgentTypes";

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

export interface AgentParseResult {
  config: AgentConfig;
  promptTemplate: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AgentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentConfigError";
  }
}

// ---------------------------------------------------------------------------
// Default flat config
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: AgentConfig = {
  name: "",
  description: "",
  author: "",
  avatar: "",
  enabled: true,
  type: "conversational",
  provider: "ollama",
  model: "",
  sources: [],
  strategy: "inject_all",
  max_context_tokens: 4000,
  read: [],
  write: [],
  create: [],
  move: [],
  delete: [],
  vault_root_access: false,
  confirm_destructive: true,
  memory: false,
  stream: false,
};

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Extract the frontmatter YAML string and the body from raw file content.
 *
 * Expects the file to start with `---`, followed by YAML, then `---`,
 * then the markdown body.
 */
export function splitFrontmatter(raw: string): { yaml: string; body: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    throw new AgentConfigError("agent.md must start with --- (YAML frontmatter)");
  }

  // Find the closing --- (skip the opening one)
  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    throw new AgentConfigError("agent.md is missing the closing --- of frontmatter");
  }

  const yaml = trimmed.substring(3, endIndex).trim();
  // Body starts after the closing --- and the newline that follows it
  const body = trimmed.substring(endIndex + 4).trim();

  return { yaml, body };
}

/**
 * Parse a string boolean from YAML frontmatter.
 * Obsidian frontmatter stores booleans as strings ("true"/"false")
 * but parseYaml may return actual booleans, so handle both.
 */
function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

/**
 * Parse an agent.md file content into a typed AgentConfig + prompt template.
 *
 * Validates required fields:
 *  - name (string)
 *  - model (string)
 *
 * All other fields are filled with defaults from DEFAULT_CONFIG.
 */
export function parseAgentFile(raw: string): AgentParseResult {
  const { yaml, body } = splitFrontmatter(raw);
  const parsed = parseYaml(yaml) as Record<string, unknown>;

  // --- required: name ---
  if (typeof parsed.name !== "string" || !parsed.name.trim()) {
    throw new AgentConfigError("name is required and must be a non-empty string");
  }

  // --- required: model ---
  if (typeof parsed.model !== "string" || !parsed.model.trim()) {
    throw new AgentConfigError("model is required and must be a non-empty string");
  }

  const config: AgentConfig = {
    name: parsed.name as string,
    description:
      typeof parsed.description === "string" ? parsed.description : DEFAULT_CONFIG.description,
    author: typeof parsed.author === "string" ? parsed.author : DEFAULT_CONFIG.author,
    avatar: typeof parsed.avatar === "string" ? parsed.avatar : DEFAULT_CONFIG.avatar,
    enabled: parseBool(parsed.enabled, DEFAULT_CONFIG.enabled),
    type: typeof parsed.type === "string" ? (parsed.type as AgentType) : DEFAULT_CONFIG.type,
    provider: typeof parsed.provider === "string" ? parsed.provider : DEFAULT_CONFIG.provider,
    model: parsed.model as string,
    sources: Array.isArray(parsed.sources) ? parsed.sources : DEFAULT_CONFIG.sources,
    strategy: typeof parsed.strategy === "string" ? parsed.strategy : DEFAULT_CONFIG.strategy,
    max_context_tokens:
      typeof parsed.max_context_tokens === "number"
        ? parsed.max_context_tokens
        : DEFAULT_CONFIG.max_context_tokens,
    stream: parseBool(parsed.stream, false),
    read: Array.isArray(parsed.read) ? parsed.read : DEFAULT_CONFIG.read,
    write: Array.isArray(parsed.write) ? parsed.write : DEFAULT_CONFIG.write,
    create: Array.isArray(parsed.create) ? parsed.create : DEFAULT_CONFIG.create,
    move: Array.isArray(parsed.move) ? parsed.move : DEFAULT_CONFIG.move,
    delete: Array.isArray(parsed.delete) ? parsed.delete : DEFAULT_CONFIG.delete,
    vault_root_access: parseBool(parsed.vault_root_access, DEFAULT_CONFIG.vault_root_access),
    confirm_destructive: parseBool(parsed.confirm_destructive, DEFAULT_CONFIG.confirm_destructive),
    memory: parseBool(parsed.memory, DEFAULT_CONFIG.memory),
  };

  return { config, promptTemplate: body };
}
