/**
 * @fileoverview VectorStore - JSON-based vector storage per agent
 *
 * Stores embedding vectors in {agentFolder}/rag/index.json.
 * Provides upsert, remove, cosine similarity search, and staleness detection.
 * Lazy-loads the index from vault on first access and caches in memory.
 */

import { App, TFile, normalizePath } from "obsidian";
import { VectorEntry, VectorIndex, SearchResult } from "@app/types/RAGTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEX_VERSION = 1;
const RAG_SUBFOLDER = "rag";
const INDEX_FILENAME = "index.json";

// ---------------------------------------------------------------------------
// Pure function: dot product (cosine similarity for normalized vectors)
// ---------------------------------------------------------------------------

export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// ---------------------------------------------------------------------------
// VectorStore class
// ---------------------------------------------------------------------------

export class VectorStore {
  private app: App;
  private indexPath: string;
  private index: VectorIndex | null = null;

  constructor(app: App, agentFolderPath: string) {
    this.app = app;
    this.indexPath = normalizePath(`${agentFolderPath}/${RAG_SUBFOLDER}/${INDEX_FILENAME}`);
  }

  /**
   * Load the index from vault. Returns cached copy if already loaded.
   */
  async load(): Promise<VectorIndex> {
    if (this.index) return this.index;

    const file = this.app.vault.getFileByPath(this.indexPath);
    if (file && file instanceof TFile) {
      try {
        const raw = await this.app.vault.read(file);
        this.index = JSON.parse(raw) as VectorIndex;
        return this.index;
      } catch {
        // Corrupted file — start fresh
      }
    }

    // No index file or parse error — create empty index
    this.index = {
      version: INDEX_VERSION,
      embeddingModel: "",
      dimension: 0,
      lastIndexed: "",
      entries: [],
    };
    return this.index;
  }

  /**
   * Write the current index to vault.
   */
  async save(): Promise<void> {
    if (!this.index) return;

    this.index.lastIndexed = new Date().toISOString();
    const data = JSON.stringify(this.index);

    // Ensure the rag subfolder exists
    const folderPath = this.indexPath.substring(0, this.indexPath.lastIndexOf("/"));
    const folder = this.app.vault.getFolderByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }

    const existing = this.app.vault.getFileByPath(this.indexPath);
    if (existing && existing instanceof TFile) {
      await this.app.vault.modify(existing, data);
    } else {
      await this.app.vault.create(this.indexPath, data);
    }
  }

  /**
   * Add or update entries by id.
   */
  upsert(entries: VectorEntry[]): void {
    if (!this.index) return;

    const idMap = new Map(this.index.entries.map((e) => [e.id, e]));
    for (const entry of entries) {
      idMap.set(entry.id, entry);

      // Update dimension and model from first entry if not set
      if (!this.index.dimension && entry.vector.length > 0) {
        this.index.dimension = entry.vector.length;
      }
    }
    this.index.entries = Array.from(idMap.values());
  }

  /**
   * Remove entries by their ids.
   */
  remove(ids: string[]): void {
    if (!this.index) return;
    const removeSet = new Set(ids);
    this.index.entries = this.index.entries.filter((e) => !removeSet.has(e.id));
  }

  /**
   * Search for the top-k most similar entries to the query vector.
   * Only returns entries above the similarity threshold.
   */
  search(queryVector: number[], topK: number, threshold: number): SearchResult[] {
    if (!this.index || this.index.entries.length === 0) return [];

    const scored: SearchResult[] = [];
    for (const entry of this.index.entries) {
      const similarity = dotProduct(queryVector, entry.vector);
      if (similarity >= threshold) {
        scored.push({ entry, similarity });
      }
    }

    // Sort by similarity descending, take top-k
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  /**
   * Detect stale entries: files that have been modified since last indexed,
   * or files that no longer exist in the current file set.
   *
   * @param currentFiles Map of filePath -> lastModified timestamp
   * @returns Object with stale file paths (need re-indexing) and removed file paths
   */
  getStaleFiles(currentFiles: Map<string, number>): { stale: string[]; removed: string[] } {
    if (!this.index) return { stale: [], removed: [] };

    const indexedFiles = new Map<string, number>();
    for (const entry of this.index.entries) {
      const existing = indexedFiles.get(entry.metadata.filePath);
      if (!existing || entry.metadata.lastModified > existing) {
        indexedFiles.set(entry.metadata.filePath, entry.metadata.lastModified);
      }
    }

    const stale: string[] = [];
    const removed: string[] = [];

    // Check for stale or new files
    for (const [path, mtime] of currentFiles) {
      const indexedMtime = indexedFiles.get(path);
      if (indexedMtime === undefined || mtime > indexedMtime) {
        stale.push(path);
      }
    }

    // Check for removed files
    for (const path of indexedFiles.keys()) {
      if (!currentFiles.has(path)) {
        removed.push(path);
      }
    }

    return { stale, removed };
  }

  /**
   * Delete the entire index.
   */
  async clear(): Promise<void> {
    const file = this.app.vault.getFileByPath(this.indexPath);
    if (file && file instanceof TFile) {
      await this.app.fileManager.trashFile(file);
    }
    this.index = null;
  }

  /**
   * Get statistics about the current index.
   */
  getStats(): {
    totalChunks: number;
    totalFiles: number;
    lastIndexed: string;
    embeddingModel: string;
    indexSizeBytes: number;
  } {
    if (!this.index) {
      return {
        totalChunks: 0,
        totalFiles: 0,
        lastIndexed: "",
        embeddingModel: "",
        indexSizeBytes: 0,
      };
    }

    const uniqueFiles = new Set(this.index.entries.map((e) => e.metadata.filePath));
    const indexSizeBytes = JSON.stringify(this.index).length;

    return {
      totalChunks: this.index.entries.length,
      totalFiles: uniqueFiles.size,
      lastIndexed: this.index.lastIndexed,
      embeddingModel: this.index.embeddingModel,
      indexSizeBytes,
    };
  }

  /**
   * Release cached index from memory.
   */
  unload(): void {
    this.index = null;
  }

  /**
   * Set the embedding model for the index.
   */
  setEmbeddingModel(model: string): void {
    if (this.index) {
      this.index.embeddingModel = model;
    }
  }

  /**
   * Get the current embedding model.
   */
  getEmbeddingModel(): string {
    return this.index?.embeddingModel ?? "";
  }
}
