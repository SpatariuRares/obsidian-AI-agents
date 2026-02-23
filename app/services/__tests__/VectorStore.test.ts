/**
 * @fileoverview VectorStore.test.ts
 *
 * Tests upsert, remove, cosine similarity search, staleness detection,
 * and the pure dotProduct function.
 */

import { App, TFile } from "obsidian";
import { VectorStore, dotProduct } from "@app/services/VectorStore";
import { VectorEntry } from "@app/types/RAGTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp(): App {
  const app = new App();
  app.vault.getFileByPath = jest.fn().mockReturnValue(null);
  app.vault.getFolderByPath = jest.fn().mockReturnValue(null);
  app.vault.createFolder = jest.fn().mockResolvedValue(undefined);
  app.vault.create = jest.fn().mockResolvedValue(new TFile());
  app.vault.modify = jest.fn().mockResolvedValue(undefined);
  app.vault.delete = jest.fn().mockResolvedValue(undefined);
  return app;
}

function makeEntry(
  id: string,
  vector: number[],
  filePath: string,
  headingPath = "(root)",
): VectorEntry {
  return {
    id,
    vector,
    metadata: {
      filePath,
      headingPath,
      content: `Content for ${id}`,
      charCount: 10,
      lastModified: Date.now(),
    },
  };
}

// ---------------------------------------------------------------------------
// dotProduct
// ---------------------------------------------------------------------------

describe("dotProduct", () => {
  it("should compute dot product of two identical unit vectors", () => {
    const v = [1, 0, 0];
    expect(dotProduct(v, v)).toBe(1);
  });

  it("should compute dot product of orthogonal vectors as 0", () => {
    expect(dotProduct([1, 0], [0, 1])).toBe(0);
  });

  it("should compute correct dot product for arbitrary vectors", () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32); // 4+10+18
  });

  it("should handle empty vectors", () => {
    expect(dotProduct([], [])).toBe(0);
  });

  it("should handle vectors of different lengths (uses shorter)", () => {
    expect(dotProduct([1, 2], [3, 4, 5])).toBe(11); // 3+8
  });
});

// ---------------------------------------------------------------------------
// VectorStore
// ---------------------------------------------------------------------------

describe("VectorStore", () => {
  let app: App;
  let store: VectorStore;

  beforeEach(() => {
    app = makeApp();
    store = new VectorStore(app, "agents/test-agent");
  });

  describe("load", () => {
    it("should create empty index when no file exists", async () => {
      const index = await store.load();
      expect(index.entries).toEqual([]);
      expect(index.version).toBe(1);
    });

    it("should load existing index from vault", async () => {
      const mockIndex = {
        version: 1,
        embeddingModel: "test-model",
        dimension: 3,
        lastIndexed: "2026-01-01",
        entries: [makeEntry("e1", [1, 0, 0], "file.md")],
      };
      const mockFile = new TFile("agents/test-agent/rag/index.json");
      (app.vault.getFileByPath as jest.Mock).mockReturnValue(mockFile);
      (app.vault.read as jest.Mock).mockResolvedValue(JSON.stringify(mockIndex));

      const index = await store.load();
      expect(index.entries).toHaveLength(1);
      expect(index.embeddingModel).toBe("test-model");
    });

    it("should return cached index on subsequent loads", async () => {
      await store.load();
      await store.load();
      // getFileByPath should only be called once (cached after first load)
      expect(app.vault.getFileByPath).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsert", () => {
    it("should add new entries", async () => {
      await store.load();
      const e1 = makeEntry("e1", [1, 0, 0], "a.md");
      const e2 = makeEntry("e2", [0, 1, 0], "b.md");
      store.upsert([e1, e2]);

      const index = await store.load();
      expect(index.entries).toHaveLength(2);
    });

    it("should update existing entries by id", async () => {
      await store.load();
      store.upsert([makeEntry("e1", [1, 0, 0], "a.md")]);
      store.upsert([makeEntry("e1", [0, 1, 0], "a.md")]); // same id, different vector

      const index = await store.load();
      expect(index.entries).toHaveLength(1);
      expect(index.entries[0].vector).toEqual([0, 1, 0]);
    });

    it("should set dimension from first entry", async () => {
      await store.load();
      store.upsert([makeEntry("e1", [1, 2, 3], "a.md")]);

      const index = await store.load();
      expect(index.dimension).toBe(3);
    });
  });

  describe("remove", () => {
    it("should remove entries by ids", async () => {
      await store.load();
      store.upsert([
        makeEntry("e1", [1, 0, 0], "a.md"),
        makeEntry("e2", [0, 1, 0], "b.md"),
        makeEntry("e3", [0, 0, 1], "c.md"),
      ]);

      store.remove(["e1", "e3"]);

      const index = await store.load();
      expect(index.entries).toHaveLength(1);
      expect(index.entries[0].id).toBe("e2");
    });

    it("should handle removing non-existent ids gracefully", async () => {
      await store.load();
      store.upsert([makeEntry("e1", [1, 0, 0], "a.md")]);
      store.remove(["nonexistent"]);

      const index = await store.load();
      expect(index.entries).toHaveLength(1);
    });
  });

  describe("search", () => {
    it("should return top-k results above threshold", async () => {
      await store.load();
      store.upsert([
        makeEntry("e1", [1, 0, 0], "a.md"),
        makeEntry("e2", [0.9, 0.1, 0], "b.md"),
        makeEntry("e3", [0, 0, 1], "c.md"), // orthogonal
      ]);

      const results = store.search([1, 0, 0], 5, 0.5);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].entry.id).toBe("e1"); // highest similarity
      expect(results[0].similarity).toBe(1);
    });

    it("should respect topK limit", async () => {
      await store.load();
      store.upsert([
        makeEntry("e1", [1, 0, 0], "a.md"),
        makeEntry("e2", [0.9, 0.1, 0], "b.md"),
        makeEntry("e3", [0.8, 0.2, 0], "c.md"),
      ]);

      const results = store.search([1, 0, 0], 1, 0);
      expect(results).toHaveLength(1);
      expect(results[0].entry.id).toBe("e1");
    });

    it("should filter by threshold", async () => {
      await store.load();
      store.upsert([
        makeEntry("e1", [1, 0, 0], "a.md"),
        makeEntry("e2", [0, 0, 1], "b.md"), // orthogonal, similarity = 0
      ]);

      const results = store.search([1, 0, 0], 10, 0.5);
      expect(results).toHaveLength(1);
      expect(results[0].entry.id).toBe("e1");
    });

    it("should return empty array for empty index", async () => {
      await store.load();
      const results = store.search([1, 0, 0], 5, 0);
      expect(results).toEqual([]);
    });

    it("should sort results by similarity descending", async () => {
      await store.load();
      store.upsert([
        makeEntry("e1", [0.5, 0.5, 0], "a.md"),
        makeEntry("e2", [1, 0, 0], "b.md"),
        makeEntry("e3", [0.8, 0.2, 0], "c.md"),
      ]);

      const results = store.search([1, 0, 0], 10, 0);
      expect(results[0].entry.id).toBe("e2");
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });
  });

  describe("getStaleFiles", () => {
    it("should detect new files not in index", async () => {
      await store.load();

      const currentFiles = new Map([["new-file.md", 1000]]);
      const { stale } = store.getStaleFiles(currentFiles);

      expect(stale).toContain("new-file.md");
    });

    it("should detect modified files", async () => {
      await store.load();
      const entry = makeEntry("e1", [1, 0, 0], "modified.md");
      entry.metadata.lastModified = 1000;
      store.upsert([entry]);

      const currentFiles = new Map([["modified.md", 2000]]); // newer mtime
      const { stale } = store.getStaleFiles(currentFiles);

      expect(stale).toContain("modified.md");
    });

    it("should detect removed files", async () => {
      await store.load();
      store.upsert([makeEntry("e1", [1, 0, 0], "removed.md")]);

      const currentFiles = new Map<string, number>(); // file no longer exists
      const { removed } = store.getStaleFiles(currentFiles);

      expect(removed).toContain("removed.md");
    });

    it("should not flag up-to-date files", async () => {
      await store.load();
      const entry = makeEntry("e1", [1, 0, 0], "current.md");
      entry.metadata.lastModified = 2000;
      store.upsert([entry]);

      const currentFiles = new Map([["current.md", 1000]]); // older than indexed
      const { stale, removed } = store.getStaleFiles(currentFiles);

      expect(stale).not.toContain("current.md");
      expect(removed).toEqual([]);
    });
  });

  describe("getStats", () => {
    it("should return zero stats for empty store", () => {
      const stats = store.getStats();
      expect(stats.totalChunks).toBe(0);
      expect(stats.totalFiles).toBe(0);
    });

    it("should return correct stats after upsert", async () => {
      await store.load();
      store.upsert([
        makeEntry("e1", [1, 0], "a.md"),
        makeEntry("e2", [0, 1], "a.md"),
        makeEntry("e3", [1, 1], "b.md"),
      ]);

      const stats = store.getStats();
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalFiles).toBe(2);
      expect(stats.indexSizeBytes).toBeGreaterThan(0);
    });
  });

  describe("clear", () => {
    it("should delete the index file if it exists", async () => {
      const mockFile = new TFile("agents/test-agent/rag/index.json");
      (app.vault.getFileByPath as jest.Mock).mockReturnValue(mockFile);

      await store.clear();

      expect(app.vault.delete).toHaveBeenCalledWith(mockFile);
    });

    it("should reset internal state", async () => {
      await store.load();
      store.upsert([makeEntry("e1", [1, 0], "a.md")]);

      await store.clear();

      // After clear, stats should be empty (internal cache is null)
      const stats = store.getStats();
      expect(stats.totalChunks).toBe(0);
    });
  });

  describe("save", () => {
    it("should create file when it does not exist", async () => {
      await store.load();
      store.upsert([makeEntry("e1", [1, 0], "a.md")]);

      await store.save();

      expect(app.vault.createFolder).toHaveBeenCalled();
      expect(app.vault.create).toHaveBeenCalled();
    });

    it("should modify file when it already exists", async () => {
      const mockFile = new TFile("agents/test-agent/rag/index.json");
      // First call returns null (for load), second call returns mockFile (for save)
      (app.vault.getFileByPath as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockFile);
      (app.vault.getFolderByPath as jest.Mock).mockReturnValue({}); // folder exists

      await store.load();
      store.upsert([makeEntry("e1", [1, 0], "a.md")]);

      await store.save();

      expect(app.vault.modify).toHaveBeenCalledWith(mockFile, expect.any(String));
    });
  });

  describe("embeddingModel", () => {
    it("should set and get the embedding model", async () => {
      await store.load();
      store.setEmbeddingModel("test-model");
      expect(store.getEmbeddingModel()).toBe("test-model");
    });

    it("should return empty string when no index loaded", () => {
      expect(store.getEmbeddingModel()).toBe("");
    });
  });

  describe("unload", () => {
    it("should clear cached index", async () => {
      await store.load();
      store.unload();

      // After unload, getStats returns defaults (null index)
      const stats = store.getStats();
      expect(stats.totalChunks).toBe(0);
    });
  });
});
