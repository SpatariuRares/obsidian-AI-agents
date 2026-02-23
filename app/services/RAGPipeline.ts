/**
 * @fileoverview RAGPipeline - Orchestrates chunking, embedding, and retrieval
 *
 * Manages per-agent VectorStore instances and coordinates the full RAG flow:
 *   buildIndex: resolve sources -> detect stale -> chunk -> embed -> upsert
 *   query: embed query -> similarity search -> format context
 */

import { App } from "obsidian";
import { ParsedAgent } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { DEFAULT_RAG_CONFIG } from "@app/types/RAGTypes";
import { resolveGlobs } from "@app/services/KnowledgeResolver";
import { chunkFile } from "@app/services/ChunkingService";
import * as EmbeddingService from "@app/services/EmbeddingService";
import { VectorStore } from "@app/services/VectorStore";

// ---------------------------------------------------------------------------
// Progress callback
// ---------------------------------------------------------------------------

export interface IndexProgress {
  phase: "resolving" | "chunking" | "embedding" | "saving";
  current: number;
  total: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Internal store cache
// ---------------------------------------------------------------------------

const storeCache = new Map<string, VectorStore>();

function getStore(app: App, agent: ParsedAgent): VectorStore {
  const key = agent.folderPath;
  let store = storeCache.get(key);
  if (!store) {
    store = new VectorStore(app, agent.folderPath);
    storeCache.set(key, store);
  }
  return store;
}

// ---------------------------------------------------------------------------
// RAG config resolution (agent -> settings fallback)
// ---------------------------------------------------------------------------

function resolveEmbeddingModel(agent: ParsedAgent, settings: PluginSettings): string {
  return (
    agent.config.rag_embedding_model ||
    settings.defaultEmbeddingModel ||
    DEFAULT_RAG_CONFIG.rag_embedding_model
  );
}

function resolveProvider(agent: ParsedAgent, settings: PluginSettings): string {
  return agent.config.rag_embedding_provider || settings.defaultEmbeddingProvider || "ollama";
}

function resolveTopK(agent: ParsedAgent): number {
  return agent.config.rag_top_k ?? DEFAULT_RAG_CONFIG.rag_top_k;
}

function resolveThreshold(agent: ParsedAgent): number {
  return agent.config.rag_similarity_threshold ?? DEFAULT_RAG_CONFIG.rag_similarity_threshold;
}

// ---------------------------------------------------------------------------
// Build index
// ---------------------------------------------------------------------------

export async function buildIndex(
  agent: ParsedAgent,
  settings: PluginSettings,
  app: App,
  onProgress?: (progress: IndexProgress) => void,
): Promise<{ chunksIndexed: number; filesProcessed: number }> {
  const store = getStore(app, agent);
  const embeddingModel = resolveEmbeddingModel(agent, settings);
  const providerName = resolveProvider(agent, settings);

  // 1. Resolve source files
  onProgress?.({ phase: "resolving", current: 0, total: 0, message: "Resolving source files..." });
  const files = resolveGlobs(agent.config.sources, app);
  if (files.length === 0) {
    return { chunksIndexed: 0, filesProcessed: 0 };
  }

  // 2. Load existing index and check for model mismatch
  await store.load();
  const currentModel = store.getEmbeddingModel();
  const forceRebuild = currentModel !== "" && currentModel !== embeddingModel;

  // Build a map of current file paths -> mtime
  const currentFiles = new Map<string, number>();
  for (const file of files) {
    currentFiles.set(file.path, file.stat.mtime);
  }

  // 3. Detect stale files (or rebuild all if model changed)
  let filesToProcess: string[];
  let removedFiles: string[];

  if (forceRebuild) {
    filesToProcess = Array.from(currentFiles.keys());
    removedFiles = [];
    // Clear old index since model changed
    store.upsert([]); // no-op, but we'll remove all below
    const allIds = (await store.load()).entries.map((e) => e.id);
    store.remove(allIds);
  } else {
    const { stale, removed } = store.getStaleFiles(currentFiles);
    filesToProcess = stale;
    removedFiles = removed;
  }

  // Remove entries for deleted files
  if (removedFiles.length > 0) {
    const index = await store.load();
    const removeIds = index.entries
      .filter((e) => removedFiles.includes(e.metadata.filePath))
      .map((e) => e.id);
    store.remove(removeIds);
  }

  if (filesToProcess.length === 0) {
    store.setEmbeddingModel(embeddingModel);
    await store.save();
    return { chunksIndexed: 0, filesProcessed: 0 };
  }

  // 4. Chunk the files that need processing
  onProgress?.({
    phase: "chunking",
    current: 0,
    total: filesToProcess.length,
    message: `Chunking ${filesToProcess.length} files...`,
  });

  const allChunks = [];
  for (let i = 0; i < filesToProcess.length; i++) {
    const filePath = filesToProcess[i];
    const file = files.find((f) => f.path === filePath);
    if (!file) continue;

    const content = await app.vault.read(file);
    const chunks = chunkFile(filePath, content);

    // Remove old entries for this file before adding new ones
    const index = await store.load();
    const oldIds = index.entries.filter((e) => e.metadata.filePath === filePath).map((e) => e.id);
    store.remove(oldIds);

    allChunks.push(
      ...chunks.map((chunk) => ({
        ...chunk,
        mtime: file.stat.mtime,
      })),
    );

    onProgress?.({
      phase: "chunking",
      current: i + 1,
      total: filesToProcess.length,
      message: `Chunked ${filePath}`,
    });
  }

  if (allChunks.length === 0) {
    store.setEmbeddingModel(embeddingModel);
    await store.save();
    return { chunksIndexed: 0, filesProcessed: filesToProcess.length };
  }

  // 5. Generate embeddings
  onProgress?.({
    phase: "embedding",
    current: 0,
    total: allChunks.length,
    message: `Embedding ${allChunks.length} chunks...`,
  });

  const texts = allChunks.map((c) => c.content);
  const vectors = await EmbeddingService.embed(texts, embeddingModel, providerName, settings);

  onProgress?.({
    phase: "embedding",
    current: allChunks.length,
    total: allChunks.length,
    message: "Embeddings complete",
  });

  // 6. Upsert into store
  const entries = allChunks.map((chunk, i) => ({
    id: chunk.id,
    vector: vectors[i],
    metadata: {
      filePath: chunk.filePath,
      headingPath: chunk.headingPath,
      content: chunk.content,
      charCount: chunk.charCount,
      lastModified: chunk.mtime,
    },
  }));

  store.upsert(entries);
  store.setEmbeddingModel(embeddingModel);

  // 7. Save
  onProgress?.({
    phase: "saving",
    current: 0,
    total: 1,
    message: "Saving index...",
  });
  await store.save();

  return { chunksIndexed: allChunks.length, filesProcessed: filesToProcess.length };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Query the RAG index with a user message and return formatted context.
 */
export async function query(
  userMessage: string,
  agent: ParsedAgent,
  settings: PluginSettings,
  app: App,
): Promise<string> {
  const store = getStore(app, agent);
  await store.load();

  const embeddingModel = resolveEmbeddingModel(agent, settings);
  const providerName = resolveProvider(agent, settings);
  const topK = resolveTopK(agent);
  const threshold = resolveThreshold(agent);

  // Validate model consistency
  const indexModel = store.getEmbeddingModel();
  if (indexModel && indexModel !== embeddingModel) {
    throw new Error(
      `RAG model mismatch: index uses "${indexModel}" but agent configured for "${embeddingModel}". Rebuild the index.`,
    );
  }

  // Embed the query
  const queryVector = await EmbeddingService.embedSingle(
    userMessage,
    embeddingModel,
    providerName,
    settings,
  );

  // Search
  const results = store.search(queryVector, topK, threshold);
  if (results.length === 0) return "";

  // Format results, respecting max_context_tokens
  const maxChars = (agent.config.max_context_tokens || 4000) * 4;
  let totalChars = 0;
  const blocks: string[] = [];

  for (const result of results) {
    const block = formatChunkResult(result.entry.metadata.content, result.entry.metadata.filePath, result.entry.metadata.headingPath, result.similarity);
    if (totalChars + block.length > maxChars && blocks.length > 0) break;
    blocks.push(block);
    totalChars += block.length;
  }

  return blocks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatChunkResult(
  content: string,
  filePath: string,
  headingPath: string,
  similarity: number,
): string {
  return `--- RELEVANT CHUNK (similarity: ${similarity.toFixed(2)}) ---\nSource: ${filePath} > ${headingPath}\n---\n${content}\n--- END CHUNK ---`;
}

/**
 * Clear the cached store for a specific agent.
 */
export function clearStoreCache(agentFolderPath: string): void {
  const store = storeCache.get(agentFolderPath);
  if (store) {
    store.unload();
    storeCache.delete(agentFolderPath);
  }
}

/**
 * Get a VectorStore instance for an agent (for use by RAGView).
 */
export function getStoreForAgent(app: App, agent: ParsedAgent): VectorStore {
  return getStore(app, agent);
}
