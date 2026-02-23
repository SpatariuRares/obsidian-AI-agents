/**
 * @fileoverview KnowledgeResolver.test.ts
 *
 * Tests glob expansion, file loading, content wrapping, and token truncation.
 */

import { App, TFile } from "obsidian";
import { resolveGlobs, loadKnowledgeContent, wrapBlock } from "@app/services/KnowledgeResolver";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(path: string, mtime = 0): TFile {
  const f = new TFile(path);
  f.stat.mtime = mtime;
  return f;
}

function makeApp(files: TFile[], contents: Map<string, string>): App {
  const app = new App();
  app.vault.getFiles = jest.fn().mockReturnValue(files);
  app.vault.read = jest.fn(async (file: TFile) => contents.get(file.path) ?? "");
  app.vault.getFolderByPath = jest.fn().mockReturnValue(null);
  return app;
}

// ---------------------------------------------------------------------------
// wrapBlock
// ---------------------------------------------------------------------------

describe("wrapBlock", () => {
  it("should wrap content with START/END markers", () => {
    const result = wrapBlock("docs/readme.md", "Hello world");
    expect(result).toBe("--- START: docs/readme.md ---\nHello world\n--- END: docs/readme.md ---");
  });
});

// ---------------------------------------------------------------------------
// resolveGlobs
// ---------------------------------------------------------------------------

describe("resolveGlobs", () => {
  const files = [
    makeFile("knowledge/company/guidelines.md"),
    makeFile("knowledge/company/brand.md"),
    makeFile("knowledge/docs/api.md"),
    makeFile("data/context.md"),
    makeFile("journal/2026-01-25.md"),
    makeFile("journal/2026-01-26.md"),
    makeFile("private/secret.md"),
  ];
  const contents = new Map<string, string>();
  const app = makeApp(files, contents);

  it("should match a recursive glob pattern", () => {
    const result = resolveGlobs(["knowledge/company/**"], app);
    expect(result.map((f) => f.path)).toEqual([
      "knowledge/company/brand.md",
      "knowledge/company/guidelines.md",
    ]);
  });

  it("should match a single file path", () => {
    const result = resolveGlobs(["data/context.md"], app);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("data/context.md");
  });

  it("should match a wildcard pattern", () => {
    const result = resolveGlobs(["journal/2026-*.md"], app);
    expect(result).toHaveLength(2);
  });

  it("should combine multiple patterns and deduplicate", () => {
    const result = resolveGlobs(
      ["knowledge/company/**", "knowledge/docs/**", "data/context.md"],
      app,
    );
    expect(result).toHaveLength(4);
  });

  it("should return empty array for empty sources", () => {
    const result = resolveGlobs([], app);
    expect(result).toEqual([]);
  });

  it("should return empty array when no files match", () => {
    const result = resolveGlobs(["nonexistent/**"], app);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadKnowledgeContent
// ---------------------------------------------------------------------------

describe("loadKnowledgeContent", () => {
  it("should load and concatenate matched files with separators", async () => {
    const files = [makeFile("docs/a.md"), makeFile("docs/b.md")];
    const contents = new Map([
      ["docs/a.md", "Content A"],
      ["docs/b.md", "Content B"],
    ]);
    const app = makeApp(files, contents);

    const result = await loadKnowledgeContent(["docs/**"], app);
    expect(result).toContain("--- START: docs/a.md ---");
    expect(result).toContain("Content A");
    expect(result).toContain("--- START: docs/b.md ---");
    expect(result).toContain("Content B");
  });

  it("should return empty string when no sources match", async () => {
    const app = makeApp([], new Map());
    const result = await loadKnowledgeContent(["nothing/**"], app);
    expect(result).toBe("");
  });

  it("should return empty string for empty sources array", async () => {
    const app = makeApp([], new Map());
    const result = await loadKnowledgeContent([], app);
    expect(result).toBe("");
  });

  it("should respect max_context_tokens by dropping oldest files first", async () => {
    // Create files with different mtimes — oldest will be dropped
    const files = [
      makeFile("docs/old.md", 1000),
      makeFile("docs/mid.md", 2000),
      makeFile("docs/new.md", 3000),
    ];
    const contents = new Map([
      ["docs/old.md", "A".repeat(100)],
      ["docs/mid.md", "B".repeat(100)],
      ["docs/new.md", "C".repeat(100)],
    ]);
    const app = makeApp(files, contents);

    // Each block is ~140 chars (separators + content). Set a very tight limit.
    // maxTokens * 4 = maxChars. With 80 tokens → 320 chars → fits ~2 blocks.
    const result = await loadKnowledgeContent(["docs/**"], app, 80);

    // Should keep the 2 most recent files (new + mid), drop old
    expect(result).toContain("docs/new.md");
    expect(result).toContain("docs/mid.md");
    expect(result).not.toContain("docs/old.md");
  });

  it("should always include at least one file even if over budget", async () => {
    const files = [makeFile("docs/huge.md", 1000)];
    const contents = new Map([["docs/huge.md", "X".repeat(10000)]]);
    const app = makeApp(files, contents);

    // Token limit so small even one file exceeds it
    const result = await loadKnowledgeContent(["docs/**"], app, 1);
    expect(result).toContain("docs/huge.md");
  });
});
