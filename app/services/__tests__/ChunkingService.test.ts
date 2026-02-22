/**
 * @fileoverview ChunkingService.test.ts
 *
 * Tests heading-based chunking, breadcrumb paths, paragraph splitting,
 * and stable ID generation.
 */

import { chunkFile, chunkFiles, generateChunkId } from "@app/services/ChunkingService";

// ---------------------------------------------------------------------------
// chunkFile
// ---------------------------------------------------------------------------

describe("chunkFile", () => {
  it("should split content by H1 headings", () => {
    const content = "# Introduction\nHello world\n# Methods\nSome methods";
    const chunks = chunkFile("doc.md", content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe("Introduction");
    expect(chunks[0].content).toBe("Hello world");
    expect(chunks[1].headingPath).toBe("Methods");
    expect(chunks[1].content).toBe("Some methods");
  });

  it("should split content by H2 headings", () => {
    const content = "## Setup\nSetup content\n## Usage\nUsage content";
    const chunks = chunkFile("doc.md", content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe("Setup");
    expect(chunks[1].headingPath).toBe("Usage");
  });

  it("should split content by H3 headings", () => {
    const content = "### Step 1\nDo this\n### Step 2\nDo that";
    const chunks = chunkFile("doc.md", content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe("Step 1");
    expect(chunks[1].headingPath).toBe("Step 2");
  });

  it("should build breadcrumb paths for nested headings", () => {
    const content = "# Setup\n## Prerequisites\nInstall Node\n## Installation\nRun npm install";
    const chunks = chunkFile("doc.md", content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe("Setup > Prerequisites");
    expect(chunks[0].content).toBe("Install Node");
    expect(chunks[1].headingPath).toBe("Setup > Installation");
    expect(chunks[1].content).toBe("Run npm install");
  });

  it("should handle deeply nested headings", () => {
    const content = "# A\n## B\n### C\nDeep content";
    const chunks = chunkFile("doc.md", content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toBe("A > B > C");
    expect(chunks[0].content).toBe("Deep content");
  });

  it("should handle file with no headings as single chunk", () => {
    const content = "Just some plain text content\nwith multiple lines";
    const chunks = chunkFile("notes.md", content);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toBe("(root)");
    expect(chunks[0].content).toBe(content);
  });

  it("should return empty array for empty content", () => {
    expect(chunkFile("empty.md", "")).toEqual([]);
    expect(chunkFile("empty.md", "   ")).toEqual([]);
  });

  it("should handle content before first heading", () => {
    const content = "Preamble text\n# Heading\nHeading content";
    const chunks = chunkFile("doc.md", content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe("(root)");
    expect(chunks[0].content).toBe("Preamble text");
    expect(chunks[1].headingPath).toBe("Heading");
  });

  it("should split long sections at paragraph boundaries", () => {
    // Create content > 2000 chars with paragraphs
    const para1 = "A".repeat(800);
    const para2 = "B".repeat(800);
    const para3 = "C".repeat(800);
    const content = `# Long Section\n${para1}\n\n${para2}\n\n${para3}`;
    const chunks = chunkFile("doc.md", content);

    expect(chunks.length).toBeGreaterThan(1);
    // First part should have the (part N) suffix
    expect(chunks[0].headingPath).toContain("Long Section");
  });

  it("should set correct filePath on all chunks", () => {
    const content = "# A\nContent A\n# B\nContent B";
    const chunks = chunkFile("path/to/file.md", content);

    for (const chunk of chunks) {
      expect(chunk.filePath).toBe("path/to/file.md");
    }
  });

  it("should set charCount correctly", () => {
    const content = "# Title\nHello";
    const chunks = chunkFile("doc.md", content);

    expect(chunks[0].charCount).toBe("Hello".length);
  });

  it("should pop heading stack when same level heading appears", () => {
    const content = "# A\n## B1\nContent B1\n## B2\nContent B2";
    const chunks = chunkFile("doc.md", content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toBe("A > B1");
    expect(chunks[1].headingPath).toBe("A > B2");
  });

  it("should not treat H4+ as heading splits", () => {
    const content = "# Main\n#### Deep heading\nContent after deep";
    const chunks = chunkFile("doc.md", content);

    // H4 is not matched, so it stays as content under "Main"
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toBe("Main");
    expect(chunks[0].content).toContain("#### Deep heading");
  });
});

// ---------------------------------------------------------------------------
// chunkFiles
// ---------------------------------------------------------------------------

describe("chunkFiles", () => {
  it("should batch-process multiple files", () => {
    const files = [
      { path: "a.md", content: "# A\nContent A" },
      { path: "b.md", content: "# B\nContent B" },
    ];
    const chunks = chunkFiles(files);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].filePath).toBe("a.md");
    expect(chunks[1].filePath).toBe("b.md");
  });

  it("should return empty array for empty input", () => {
    expect(chunkFiles([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateChunkId
// ---------------------------------------------------------------------------

describe("generateChunkId", () => {
  it("should generate stable IDs for same input", () => {
    const id1 = generateChunkId("file.md", "A > B");
    const id2 = generateChunkId("file.md", "A > B");
    expect(id1).toBe(id2);
  });

  it("should generate different IDs for different inputs", () => {
    const id1 = generateChunkId("file.md", "A > B");
    const id2 = generateChunkId("file.md", "A > C");
    expect(id1).not.toBe(id2);
  });

  it("should produce alphanumeric strings only", () => {
    const id = generateChunkId("path/to/file.md", "Heading > Sub heading (part 1)");
    expect(id).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("should truncate to 32 characters", () => {
    const id = generateChunkId(
      "very/long/path/to/some/deeply/nested/file.md",
      "Very Long Heading > Even Longer Subheading > More nesting",
    );
    expect(id.length).toBeLessThanOrEqual(32);
  });
});
