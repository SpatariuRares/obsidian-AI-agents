/**
 * @fileoverview TemplateEngine.test.ts
 *
 * Tests template variable resolution:
 *   - Scalar variables (agent_name, user_name, date, time, datetime)
 *   - {{READ: path}} with permission checks
 *   - {{knowledge_context}} integration with KnowledgeResolver
 *   - Placeholder variables (conversation_summary, vault_structure)
 */

import { App, TFile } from "obsidian";
import { resolveTemplate, TemplateContext } from "../TemplateEngine";
import { AgentConfig } from "@app/types/AgentTypes";
import { DEFAULT_SETTINGS, PluginSettings } from "@app/types/PluginTypes";
import { DEFAULT_CONFIG } from "@app/core/AgentConfig";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(path: string, mtime = 0): TFile {
  const f = new TFile(path);
  f.stat.mtime = mtime;
  return f;
}

function makeApp(
  files: TFile[],
  contents: Map<string, string>,
): App {
  const app = new App();
  const fileMap = new Map(files.map((f) => [f.path, f]));

  app.vault.getFiles = jest.fn().mockReturnValue(files);
  app.vault.getAbstractFileByPath = jest.fn((path: string) => fileMap.get(path) ?? null);
  app.vault.read = jest.fn(async (file: TFile) => contents.get(file.path) ?? "");
  return app;
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    ...DEFAULT_CONFIG,
    name: "TestBot",
    model: "llama3",
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<TemplateContext> = {},
): TemplateContext {
  return {
    agentConfig: makeConfig(),
    settings: { ...DEFAULT_SETTINGS, userName: "Rares" } as PluginSettings,
    app: makeApp([], new Map()),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scalar variables
// ---------------------------------------------------------------------------

describe("resolveTemplate — scalar variables", () => {
  it("should replace {{agent_name}} with name", async () => {
    const ctx = makeContext({
      agentConfig: makeConfig({ name: "Writer" }),
    });
    const result = await resolveTemplate("Hello, I am {{agent_name}}.", ctx);
    expect(result).toBe("Hello, I am Writer.");
  });

  it("should replace {{user_name}} with settings.userName", async () => {
    const ctx = makeContext();
    const result = await resolveTemplate("User: {{user_name}}", ctx);
    expect(result).toBe("User: Rares");
  });

  it("should replace {{date}} with YYYY-MM-DD format", async () => {
    const ctx = makeContext();
    const result = await resolveTemplate("Today: {{date}}", ctx);
    expect(result).toMatch(/Today: \d{4}-\d{2}-\d{2}/);
  });

  it("should replace {{time}} with HH:MM format", async () => {
    const ctx = makeContext();
    const result = await resolveTemplate("Now: {{time}}", ctx);
    expect(result).toMatch(/Now: \d{2}:\d{2}/);
  });

  it("should replace {{datetime}} with date + time", async () => {
    const ctx = makeContext();
    const result = await resolveTemplate("At: {{datetime}}", ctx);
    expect(result).toMatch(/At: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it("should replace multiple occurrences of the same variable", async () => {
    const ctx = makeContext({
      agentConfig: makeConfig({ name: "Echo" }),
    });
    const result = await resolveTemplate(
      "{{agent_name}} says: I am {{agent_name}}.",
      ctx,
    );
    expect(result).toBe("Echo says: I am Echo.");
  });

  it("should replace {{conversation_summary}} with provided value", async () => {
    const ctx = makeContext({ conversationSummary: "We discussed AI." });
    const result = await resolveTemplate("Summary: {{conversation_summary}}", ctx);
    expect(result).toBe("Summary: We discussed AI.");
  });

  it("should replace {{conversation_summary}} with empty string when not provided", async () => {
    const ctx = makeContext();
    const result = await resolveTemplate("Summary: {{conversation_summary}}", ctx);
    expect(result).toBe("Summary: ");
  });

  it("should leave unknown {{variables}} untouched", async () => {
    const ctx = makeContext();
    const result = await resolveTemplate("Hello {{unknown_var}}", ctx);
    expect(result).toBe("Hello {{unknown_var}}");
  });
});

// ---------------------------------------------------------------------------
// {{knowledge_context}}
// ---------------------------------------------------------------------------

describe("resolveTemplate — knowledge_context", () => {
  it("should inject knowledge files content", async () => {
    const files = [
      makeFile("kb/guide.md"),
      makeFile("kb/faq.md"),
    ];
    const contents = new Map([
      ["kb/guide.md", "Guide content"],
      ["kb/faq.md", "FAQ content"],
    ]);
    const app = makeApp(files, contents);

    const ctx = makeContext({
      agentConfig: makeConfig({
        sources: ["kb/**"],
        strategy: "inject_all",
        max_context_tokens: 4000,
      }),
      app,
    });

    const result = await resolveTemplate("Knowledge:\n{{knowledge_context}}", ctx);
    expect(result).toContain("--- START: kb/guide.md ---");
    expect(result).toContain("Guide content");
    expect(result).toContain("--- START: kb/faq.md ---");
    expect(result).toContain("FAQ content");
  });

  it("should replace with empty string when no sources match", async () => {
    const ctx = makeContext({
      agentConfig: makeConfig({
        sources: ["nonexistent/**"],
        strategy: "inject_all",
      }),
    });
    const result = await resolveTemplate("KB: {{knowledge_context}}", ctx);
    expect(result).toBe("KB: ");
  });
});

// ---------------------------------------------------------------------------
// {{READ: path}}
// ---------------------------------------------------------------------------

describe("resolveTemplate — READ directive", () => {
  it("should inline file content when path is in read", async () => {
    const files = [makeFile("data/context.md")];
    const contents = new Map([["data/context.md", "Context data here"]]);
    const app = makeApp(files, contents);

    const ctx = makeContext({
      agentConfig: makeConfig({
        read: ["data/**"],
      }),
      app,
    });

    const result = await resolveTemplate("{{READ: data/context.md}}", ctx);
    expect(result).toContain("--- START: data/context.md ---");
    expect(result).toContain("Context data here");
    expect(result).toContain("--- END: data/context.md ---");
  });

  it("should inline file content when path is in sources", async () => {
    const files = [makeFile("kb/ref.md")];
    const contents = new Map([["kb/ref.md", "Reference"]]);
    const app = makeApp(files, contents);

    const ctx = makeContext({
      agentConfig: makeConfig({
        sources: ["kb/**"],
        strategy: "inject_all",
      }),
      app,
    });

    const result = await resolveTemplate("{{READ: kb/ref.md}}", ctx);
    expect(result).toContain("Reference");
  });

  it("should return denial message when path is not allowed", async () => {
    const files = [makeFile("private/secret.md")];
    const contents = new Map([["private/secret.md", "top secret"]]);
    const app = makeApp(files, contents);

    const ctx = makeContext({
      agentConfig: makeConfig({
        read: ["data/**"],
      }),
      app,
    });

    const result = await resolveTemplate("{{READ: private/secret.md}}", ctx);
    expect(result).toContain("[READ denied");
    expect(result).not.toContain("top secret");
  });

  it("should return not-found message when file does not exist", async () => {
    const app = makeApp([], new Map());
    const ctx = makeContext({
      agentConfig: makeConfig({
        read: ["data/**"],
      }),
      app,
    });

    const result = await resolveTemplate("{{READ: data/missing.md}}", ctx);
    expect(result).toContain("[READ failed: data/missing.md not found]");
  });

  it("should resolve multiple READ directives in one template", async () => {
    const files = [
      makeFile("data/a.md"),
      makeFile("data/b.md"),
    ];
    const contents = new Map([
      ["data/a.md", "File A"],
      ["data/b.md", "File B"],
    ]);
    const app = makeApp(files, contents);

    const ctx = makeContext({
      agentConfig: makeConfig({
        read: ["data/**"],
      }),
      app,
    });

    const result = await resolveTemplate(
      "First: {{READ: data/a.md}}\nSecond: {{READ: data/b.md}}",
      ctx,
    );
    expect(result).toContain("File A");
    expect(result).toContain("File B");
  });

  it("should allow READ when no permissions are configured (open access)", async () => {
    const files = [makeFile("anywhere/file.md")];
    const contents = new Map([["anywhere/file.md", "Open content"]]);
    const app = makeApp(files, contents);

    // No read and no sources → allowedPatterns is empty
    const ctx = makeContext({
      agentConfig: makeConfig(),
      app,
    });

    const result = await resolveTemplate("{{READ: anywhere/file.md}}", ctx);
    expect(result).toContain("Open content");
  });
});

// ---------------------------------------------------------------------------
// Combined template
// ---------------------------------------------------------------------------

describe("resolveTemplate — full template", () => {
  it("should resolve all variable types in one pass", async () => {
    const files = [
      makeFile("data/ctx.md"),
      makeFile("kb/ref.md"),
    ];
    const contents = new Map([
      ["data/ctx.md", "User context"],
      ["kb/ref.md", "Knowledge ref"],
    ]);
    const app = makeApp(files, contents);

    const ctx = makeContext({
      agentConfig: makeConfig({
        name: "Coach",
        sources: ["kb/**"],
        strategy: "inject_all",
        max_context_tokens: 4000,
        read: ["data/**"],
      }),
      settings: { ...DEFAULT_SETTINGS, userName: "Alice" } as PluginSettings,
      app,
    });

    const template = `You are {{agent_name}}.
User: {{user_name}}
Date: {{date}}

## Context
{{READ: data/ctx.md}}

## Knowledge
{{knowledge_context}}`;

    const result = await resolveTemplate(template, ctx);

    expect(result).toContain("You are Coach.");
    expect(result).toContain("User: Alice");
    expect(result).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
    expect(result).toContain("User context");
    expect(result).toContain("Knowledge ref");
  });
});
