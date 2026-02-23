/**
 * @fileoverview RAGTypes - Type definitions for the RAG pipeline
 *
 * Defines interfaces for document chunking, vector storage,
 * similarity search results, and RAG configuration.
 */

// ---------------------------------------------------------------------------
// Document chunking
// ---------------------------------------------------------------------------

export interface DocumentChunk {
  /** Unique identifier derived from filePath + headingPath */
  id: string;
  /** The text content of this chunk */
  content: string;
  /** Vault-relative path of the source file */
  filePath: string;
  /** Breadcrumb heading path (e.g. "Setup > Prerequisites") */
  headingPath: string;
  /** Character count of the content */
  charCount: number;
}

// ---------------------------------------------------------------------------
// Vector storage
// ---------------------------------------------------------------------------

export interface VectorEntryMetadata {
  filePath: string;
  headingPath: string;
  content: string;
  charCount: number;
  lastModified: number;
}

export interface VectorEntry {
  /** Same id as the DocumentChunk it was created from */
  id: string;
  /** Embedding vector (L2-normalized) */
  vector: number[];
  /** Metadata for display and retrieval */
  metadata: VectorEntryMetadata;
}

export interface VectorIndex {
  /** Schema version for future migrations */
  version: number;
  /** Model used to generate embeddings */
  embeddingModel: string;
  /** Dimensionality of the embedding vectors */
  dimension: number;
  /** ISO timestamp of last indexing run */
  lastIndexed: string;
  /** All vector entries in this index */
  entries: VectorEntry[];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  entry: VectorEntry;
  similarity: number;
}

// ---------------------------------------------------------------------------
// RAG configuration (per-agent)
// ---------------------------------------------------------------------------

export interface RAGConfig {
  rag_embedding_model: string;
  rag_top_k: number;
  rag_similarity_threshold: number;
}

export const DEFAULT_RAG_CONFIG: RAGConfig = {
  rag_embedding_model: "nomic-embed-text",
  rag_top_k: 5,
  rag_similarity_threshold: 0.7,
};
