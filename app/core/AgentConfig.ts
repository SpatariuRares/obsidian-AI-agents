/**
 * @fileoverview AgentConfig - Parser for agent.md files
 *
 * Splits an agent.md file on the `---` frontmatter delimiters:
 *   - Part 1 (between first and second ---) → parseYaml() → AgentConfig
 *   - Part 2 (after second ---) → raw prompt template string
 *
 * Validates that required fields are present and returns a typed result.
 */

import { parseYaml } from "obsidian";
import { AgentConfig, KnowledgeConfig, LoggingConfig, PermissionsConfig } from "@app/types/AgentTypes";

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
// Default values for optional sections
// ---------------------------------------------------------------------------

const DEFAULT_KNOWLEDGE: KnowledgeConfig = {
  sources: [],
  strategy: "inject_all",
  max_context_tokens: 4000,
};

const DEFAULT_PERMISSIONS: PermissionsConfig = {
  read: [],
  write: [],
  create: [],
  move: [],
  delete: [],
  vault_root_access: false,
  confirm_destructive: true,
};

const DEFAULT_LOGGING: LoggingConfig = {
  enabled: false,
  path: "logs",
  format: "daily",
  include_metadata: true,
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
 * Parse an agent.md file content into a typed AgentConfig + prompt template.
 *
 * Validates required fields:
 *  - metadata.name (string)
 *  - agent.model.primary (string)
 *
 * Optional sections (knowledge, permissions, logging) are filled with defaults.
 */
export function parseAgentFile(raw: string): AgentParseResult {
  const { yaml, body } = splitFrontmatter(raw);
  const parsed = parseYaml(yaml) as Record<string, unknown>;

  // --- metadata ---
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (!metadata || typeof metadata.name !== "string" || !metadata.name.trim()) {
    throw new AgentConfigError("metadata.name is required and must be a non-empty string");
  }

  // --- agent ---
  const agent = parsed.agent as Record<string, unknown> | undefined;
  if (!agent) {
    throw new AgentConfigError("agent section is required");
  }

  const model = agent.model as Record<string, unknown> | undefined;
  if (!model || typeof model.primary !== "string" || !model.primary.trim()) {
    throw new AgentConfigError("agent.model.primary is required and must be a non-empty string");
  }

  // --- knowledge (optional, merge with defaults) ---
  const rawKnowledge = (parsed.knowledge ?? {}) as Record<string, unknown>;
  const knowledge: KnowledgeConfig = {
    ...DEFAULT_KNOWLEDGE,
    ...rawKnowledge,
    sources: Array.isArray(rawKnowledge.sources) ? rawKnowledge.sources : [],
  };

  // --- permissions (optional, merge with defaults) ---
  const rawPermissions = (parsed.permissions ?? {}) as Record<string, unknown>;
  const permissions: PermissionsConfig = {
    ...DEFAULT_PERMISSIONS,
    ...rawPermissions,
    read: Array.isArray(rawPermissions.read) ? rawPermissions.read : [],
    write: Array.isArray(rawPermissions.write) ? rawPermissions.write : [],
    create: Array.isArray(rawPermissions.create) ? rawPermissions.create : [],
    move: Array.isArray(rawPermissions.move) ? rawPermissions.move : [],
    delete: Array.isArray(rawPermissions.delete) ? rawPermissions.delete : [],
  };

  // --- logging (optional, merge with defaults) ---
  const rawLogging = (parsed.logging ?? {}) as Record<string, unknown>;
  const logging: LoggingConfig = {
    ...DEFAULT_LOGGING,
    ...rawLogging,
  };

  const config: AgentConfig = {
    metadata: {
      name: metadata.name as string,
      version: (metadata.version as string) ?? undefined,
      description: (metadata.description as string) ?? undefined,
      author: (metadata.author as string) ?? undefined,
      avatar: (metadata.avatar as string) ?? undefined,
      created: (metadata.created as string) ?? undefined,
      updated: (metadata.updated as string) ?? undefined,
    },
    agent: {
      enabled: agent.enabled !== false,
      type: (agent.type as AgentConfig["agent"]["type"]) ?? "conversational",
      model: {
        primary: model.primary as string,
        fallback: (model.fallback as string) ?? undefined,
      },
      parameters: agent.parameters
        ? (agent.parameters as AgentConfig["agent"]["parameters"])
        : undefined,
    },
    knowledge,
    permissions,
    logging,
  };

  return { config, promptTemplate: body };
}
