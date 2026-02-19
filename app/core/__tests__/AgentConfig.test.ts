/**
 * @fileoverview AgentConfig.test.ts
 *
 * Tests the agent.md parser:
 *   - splitFrontmatter: extracting YAML and body
 *   - parseAgentFile: full parsing with validation and defaults
 */

import { splitFrontmatter, parseAgentFile, AgentConfigError } from "../AgentConfig";

// ---------------------------------------------------------------------------
// Helpers — sample agent.md contents
// ---------------------------------------------------------------------------

const MINIMAL_AGENT = `---
metadata:
  name: "Echo"
  avatar: "🔊"
agent:
  enabled: true
  model:
    primary: "gpt_oss_free"
  parameters:
    temperature: 0
    max_tokens: 500
knowledge:
  sources: []
permissions: {}
logging:
  enabled: false
---

You are an echo bot. Repeat what the user says.`;

const FULL_AGENT = `---
metadata:
  name: "Writing Coach"
  version: "1.0"
  description: "Helps improve writing"
  author: "Rares"
  avatar: "✍️"
  created: "2026-01-24"
  updated: "2026-01-25"
agent:
  enabled: true
  type: "conversational"
  model:
    primary: "gemini-flash"
    fallback: "gpt_oss_free"
  parameters:
    temperature: 0.7
    max_tokens: 2000
    top_p: 0.9
    stream: true
knowledge:
  sources:
    - "knowledge/company/**"
    - "data/context.md"
  strategy: "inject_all"
  max_context_tokens: 4000
permissions:
  read:
    - "data/**"
    - "journal/**"
  write:
    - "data/context.md"
  create:
    - "logs/**"
  move:
    - "inbox/**"
  delete: []
  vault_root_access: false
  confirm_destructive: true
logging:
  enabled: true
  path: "logs"
  format: "daily"
  include_metadata: true
---

You are a **Writing Coach**.

## Guidelines

Be concise and specific.

{{knowledge_context}}`;

// ---------------------------------------------------------------------------
// splitFrontmatter
// ---------------------------------------------------------------------------

describe("splitFrontmatter", () => {
  it("should extract yaml and body from a valid agent.md", () => {
    const { yaml, body } = splitFrontmatter(MINIMAL_AGENT);
    expect(yaml).toContain("name: \"Echo\"");
    expect(body).toBe("You are an echo bot. Repeat what the user says.");
  });

  it("should handle leading whitespace before opening ---", () => {
    const raw = "\n  \n" + MINIMAL_AGENT;
    const { yaml } = splitFrontmatter(raw);
    expect(yaml).toContain("name: \"Echo\"");
  });

  it("should throw if file does not start with ---", () => {
    expect(() => splitFrontmatter("no frontmatter here")).toThrow(AgentConfigError);
  });

  it("should throw if closing --- is missing", () => {
    expect(() => splitFrontmatter("---\nname: test\nbody here")).toThrow(AgentConfigError);
  });

  it("should return empty body when nothing follows the closing ---", () => {
    const raw = "---\nmetadata:\n  name: test\n---";
    const { body } = splitFrontmatter(raw);
    expect(body).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parseAgentFile
// ---------------------------------------------------------------------------

describe("parseAgentFile", () => {
  // --- Successful parsing -----------------------------------------------

  it("should parse a minimal agent.md correctly", () => {
    const result = parseAgentFile(MINIMAL_AGENT);

    expect(result.config.metadata.name).toBe("Echo");
    expect(result.config.metadata.avatar).toBe("🔊");
    expect(result.config.agent.enabled).toBe(true);
    expect(result.config.agent.model.primary).toBe("gpt_oss_free");
    expect(result.promptTemplate).toBe("You are an echo bot. Repeat what the user says.");
  });

  it("should parse a full agent.md with all fields", () => {
    const result = parseAgentFile(FULL_AGENT);

    // metadata
    expect(result.config.metadata.name).toBe("Writing Coach");
    expect(result.config.metadata.version).toBe("1.0");
    expect(result.config.metadata.description).toBe("Helps improve writing");
    expect(result.config.metadata.author).toBe("Rares");

    // agent
    expect(result.config.agent.type).toBe("conversational");
    expect(result.config.agent.model.primary).toBe("gemini-flash");
    expect(result.config.agent.model.fallback).toBe("gpt_oss_free");
    expect(result.config.agent.parameters?.temperature).toBe(0.7);
    expect(result.config.agent.parameters?.stream).toBe(true);

    // knowledge
    expect(result.config.knowledge.sources).toEqual([
      "knowledge/company/**",
      "data/context.md",
    ]);
    expect(result.config.knowledge.strategy).toBe("inject_all");
    expect(result.config.knowledge.max_context_tokens).toBe(4000);

    // permissions
    expect(result.config.permissions.read).toEqual(["data/**", "journal/**"]);
    expect(result.config.permissions.write).toEqual(["data/context.md"]);
    expect(result.config.permissions.create).toEqual(["logs/**"]);
    expect(result.config.permissions.move).toEqual(["inbox/**"]);
    expect(result.config.permissions.delete).toEqual([]);
    expect(result.config.permissions.vault_root_access).toBe(false);
    expect(result.config.permissions.confirm_destructive).toBe(true);

    // logging
    expect(result.config.logging.enabled).toBe(true);
    expect(result.config.logging.format).toBe("daily");

    // prompt
    expect(result.promptTemplate).toContain("Writing Coach");
    expect(result.promptTemplate).toContain("{{knowledge_context}}");
  });

  // --- Defaults ---------------------------------------------------------

  it("should fill default knowledge when section is missing", () => {
    const raw = `---
metadata:
  name: "Test"
agent:
  enabled: true
  model:
    primary: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.knowledge.sources).toEqual([]);
    expect(result.config.knowledge.strategy).toBe("inject_all");
    expect(result.config.knowledge.max_context_tokens).toBe(4000);
  });

  it("should fill default permissions when section is missing", () => {
    const raw = `---
metadata:
  name: "Test"
agent:
  enabled: true
  model:
    primary: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.permissions.read).toEqual([]);
    expect(result.config.permissions.write).toEqual([]);
    expect(result.config.permissions.delete).toEqual([]);
    expect(result.config.permissions.vault_root_access).toBe(false);
    expect(result.config.permissions.confirm_destructive).toBe(true);
  });

  it("should default agent.enabled to true when not explicitly false", () => {
    const raw = `---
metadata:
  name: "Test"
agent:
  model:
    primary: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.agent.enabled).toBe(true);
  });

  it("should set agent.enabled to false when explicitly false", () => {
    const raw = `---
metadata:
  name: "Test"
agent:
  enabled: false
  model:
    primary: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.agent.enabled).toBe(false);
  });

  it("should default agent.type to conversational", () => {
    const raw = `---
metadata:
  name: "Test"
agent:
  enabled: true
  model:
    primary: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.agent.type).toBe("conversational");
  });

  // --- Validation errors ------------------------------------------------

  it("should throw when metadata.name is missing", () => {
    const raw = `---
metadata:
  avatar: "🤖"
agent:
  enabled: true
  model:
    primary: "llama3"
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("metadata.name is required");
  });

  it("should throw when metadata section is missing entirely", () => {
    const raw = `---
agent:
  enabled: true
  model:
    primary: "llama3"
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("metadata.name is required");
  });

  it("should throw when agent section is missing", () => {
    const raw = `---
metadata:
  name: "Test"
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("agent section is required");
  });

  it("should throw when agent.model.primary is missing", () => {
    const raw = `---
metadata:
  name: "Test"
agent:
  enabled: true
  model:
    fallback: "gpt4"
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("agent.model.primary is required");
  });

  it("should throw when agent.model is missing entirely", () => {
    const raw = `---
metadata:
  name: "Test"
agent:
  enabled: true
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("agent.model.primary is required");
  });
});
