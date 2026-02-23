/**
 * @fileoverview EmbeddingService - Multi-provider embedding generation
 *
 * Supports Ollama and OpenRouter for generating text embeddings.
 * Uses Obsidian's requestUrl for CORS-safe HTTP requests.
 * Batches requests (20 texts per batch) with 100ms delay between batches.
 * L2-normalizes all output vectors.
 */

import { requestUrl } from "obsidian";
import { PluginSettings } from "@app/types/PluginTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;
const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate embeddings for multiple texts.
 * Batches requests and normalizes vectors.
 */
export async function embed(
  texts: string[],
  model: string,
  providerName: string,
  settings: PluginSettings,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    if (i > 0) {
      await delay(BATCH_DELAY_MS);
    }

    const vectors = await embedBatch(batch, model, providerName, settings);
    allVectors.push(...vectors);
  }

  return allVectors.map(normalizeL2);
}

/**
 * Generate embedding for a single text.
 */
export async function embedSingle(
  text: string,
  model: string,
  providerName: string,
  settings: PluginSettings,
): Promise<number[]> {
  const [vector] = await embed([text], model, providerName, settings);
  return vector;
}

// ---------------------------------------------------------------------------
// Provider-specific batch embedding
// ---------------------------------------------------------------------------

async function embedBatch(
  texts: string[],
  model: string,
  providerName: string,
  settings: PluginSettings,
): Promise<number[][]> {
  const provider = providerName.toLowerCase();

  if (provider === "ollama") {
    return embedOllama(texts, model, settings);
  } else if (provider === "openrouter") {
    return embedOpenRouter(texts, model, settings);
  }

  throw new Error(`Unsupported embedding provider: ${providerName}`);
}

// ---------------------------------------------------------------------------
// Ollama
// ---------------------------------------------------------------------------

async function embedOllama(
  texts: string[],
  model: string,
  settings: PluginSettings,
): Promise<number[][]> {
  const baseUrl = settings.ollama.baseUrl.replace(/\/$/, "");

  // Try batch endpoint first: POST /api/embed
  try {
    const response = await requestUrl({
      url: `${baseUrl}/api/embed`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
    });

    if (response.status === 200 && response.json?.embeddings) {
      return response.json.embeddings as number[][];
    }
  } catch {
    // Batch endpoint not available, fall through to single endpoint
  }

  // Fallback: single embedding endpoint POST /api/embeddings
  const vectors: number[][] = [];
  for (const text of texts) {
    const response = await requestUrl({
      url: `${baseUrl}/api/embeddings`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });

    if (response.status !== 200) {
      throw new Error(`Ollama embedding error ${response.status}: ${response.text}`);
    }

    vectors.push(response.json.embedding as number[]);
  }

  return vectors;
}

// ---------------------------------------------------------------------------
// OpenRouter
// ---------------------------------------------------------------------------

async function embedOpenRouter(
  texts: string[],
  model: string,
  settings: PluginSettings,
): Promise<number[][]> {
  const apiKey = settings.openRouter.apiKey;
  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured");
  }

  const response = await requestUrl({
    url: OPENROUTER_EMBEDDINGS_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (response.status !== 200) {
    throw new Error(`OpenRouter embedding error ${response.status}: ${response.text}`);
  }

  // OpenRouter returns data sorted by index
  const data = response.json.data as { embedding: number[]; index: number }[];
  data.sort((a, b) => a.index - b.index);

  return data.map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * L2-normalize a vector (unit length). Returns zero vector if norm is 0.
 */
function normalizeL2(vector: number[]): number[] {
  let norm = 0;
  for (const v of vector) {
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
