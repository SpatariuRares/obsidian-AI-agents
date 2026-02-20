/**
 * @fileoverview AgentConfig.test.ts
 *
 * Tests the agent.md parser:
 *   - splitFrontmatter: extracting YAML and body
 *   - parseAgentFile: full parsing with validation and defaults
 */

import { splitFrontmatter, parseAgentFile, AgentConfigError } from "@app/services/AgentConfig";

// ---------------------------------------------------------------------------
// Helpers — sample agent.md contents
// ---------------------------------------------------------------------------

const MINIMAL_AGENT = `---
name: "Echo"
avatar: "🔊"
enabled: "true"
model: "gpt_oss_free"
---

You are an echo bot. Repeat what the user says.`;

const FULL_AGENT = `---
name: "Writing Coach"
description: "Helps improve writing"
author: "Rares"
avatar: "✍️"
enabled: "true"
type: "conversational"
provider: "openrouter"
model: "gemini-flash"
sources:
  - "knowledge/company/**"
  - "data/context.md"
strategy: "inject_all"
max_context_tokens: 4000
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
vault_root_access: "false"
confirm_destructive: "true"
logging_enabled: "true"
logging_path: "logs"
logging_format: "daily"
logging_include_metadata: "true"
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
    expect(yaml).toContain('name: "Echo"');
    expect(body).toBe("You are an echo bot. Repeat what the user says.");
  });

  it("should handle leading whitespace before opening ---", () => {
    const raw = "\n  \n" + MINIMAL_AGENT;
    const { yaml } = splitFrontmatter(raw);
    expect(yaml).toContain('name: "Echo"');
  });

  it("should throw if file does not start with ---", () => {
    expect(() => splitFrontmatter("no frontmatter here")).toThrow(AgentConfigError);
  });

  it("should throw if closing --- is missing", () => {
    expect(() => splitFrontmatter("---\nname: test\nbody here")).toThrow(AgentConfigError);
  });

  it("should return empty body when nothing follows the closing ---", () => {
    const raw = "---\nname: test\n---";
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

    expect(result.config.name).toBe("Echo");
    expect(result.config.avatar).toBe("🔊");
    expect(result.config.enabled).toBe(true);
    expect(result.config.model).toBe("gpt_oss_free");
    expect(result.promptTemplate).toBe("You are an echo bot. Repeat what the user says.");
  });

  it("should parse a full agent.md with all fields", () => {
    const result = parseAgentFile(FULL_AGENT);

    // identity
    expect(result.config.name).toBe("Writing Coach");
    expect(result.config.description).toBe("Helps improve writing");
    expect(result.config.author).toBe("Rares");

    // agent
    expect(result.config.type).toBe("conversational");
    expect(result.config.provider).toBe("openrouter");
    expect(result.config.model).toBe("gemini-flash");

    // knowledge
    expect(result.config.sources).toEqual(["knowledge/company/**", "data/context.md"]);
    expect(result.config.strategy).toBe("inject_all");
    expect(result.config.max_context_tokens).toBe(4000);

    // permissions
    expect(result.config.read).toEqual(["data/**", "journal/**"]);
    expect(result.config.write).toEqual(["data/context.md"]);
    expect(result.config.create).toEqual(["logs/**"]);
    expect(result.config.move).toEqual(["inbox/**"]);
    expect(result.config.delete).toEqual([]);
    expect(result.config.vault_root_access).toBe(false);
    expect(result.config.confirm_destructive).toBe(true);

    // logging
    expect(result.config.logging_enabled).toBe(true);
    expect(result.config.logging_path).toBe("logs");
    expect(result.config.logging_format).toBe("daily");
    expect(result.config.logging_include_metadata).toBe(true);

    // prompt
    expect(result.promptTemplate).toContain("Writing Coach");
    expect(result.promptTemplate).toContain("{{knowledge_context}}");
  });

  // --- Defaults ---------------------------------------------------------

  it("should fill default sources when not provided", () => {
    const raw = `---
name: "Test"
model: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.sources).toEqual([]);
    expect(result.config.strategy).toBe("inject_all");
    expect(result.config.max_context_tokens).toBe(4000);
  });

  it("should fill default permissions when not provided", () => {
    const raw = `---
name: "Test"
model: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.read).toEqual([]);
    expect(result.config.write).toEqual([]);
    expect(result.config.delete).toEqual([]);
    expect(result.config.vault_root_access).toBe(false);
    expect(result.config.confirm_destructive).toBe(true);
  });

  it("should default enabled to true when not provided", () => {
    const raw = `---
name: "Test"
model: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.enabled).toBe(true);
  });

  it("should set enabled to false when explicitly false", () => {
    const raw = `---
name: "Test"
enabled: "false"
model: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.enabled).toBe(false);
  });

  it("should handle boolean enabled values (not just strings)", () => {
    const raw = `---
name: "Test"
enabled: false
model: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.enabled).toBe(false);
  });

  it("should fill default logging when not provided", () => {
    const raw = `---
name: "Test"
model: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.logging_enabled).toBe(false);
    expect(result.config.logging_path).toBe("logs");
    expect(result.config.logging_format).toBe("daily");
    expect(result.config.logging_include_metadata).toBe(true);
  });

  it("should default type to conversational", () => {
    const raw = `---
name: "Test"
model: "llama3"
---
prompt`;

    const result = parseAgentFile(raw);
    expect(result.config.type).toBe("conversational");
  });

  // --- Validation errors ------------------------------------------------

  it("should throw when name is missing", () => {
    const raw = `---
avatar: "🤖"
model: "llama3"
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("name is required");
  });

  it("should throw when name is empty", () => {
    const raw = `---
name: ""
model: "llama3"
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("name is required");
  });

  it("should throw when model is missing", () => {
    const raw = `---
name: "Test"
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("model is required");
  });

  it("should throw when model is empty", () => {
    const raw = `---
name: "Test"
model: ""
---
prompt`;

    expect(() => parseAgentFile(raw)).toThrow("model is required");
  });
});
