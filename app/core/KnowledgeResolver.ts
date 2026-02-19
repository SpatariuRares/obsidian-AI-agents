/**
 * @fileoverview KnowledgeResolver - Expands glob patterns and loads vault files
 *
 * Resolves the `knowledge.sources` array from an agent config:
 *   1. Lists all files in the vault
 *   2. Matches each source glob pattern against vault file paths (micromatch)
 *   3. Reads matched files
 *   4. Concatenates content with separators, respecting max_context_tokens
 *   5. If over limit, drops least-recently-modified files first
 */

import { App, TFile } from "obsidian";
import * as micromatch from "micromatch";

// ---------------------------------------------------------------------------
// Resolved file entry
// ---------------------------------------------------------------------------

export interface ResolvedFile {
  path: string;
  content: string;
  mtime: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand an array of glob patterns against all vault files.
 * Returns matching TFile objects, deduplicated and sorted by path.
 */
export function resolveGlobs(sources: string[], app: App): TFile[] {
  if (sources.length === 0) return [];

  const allFiles = app.vault.getFiles();
  const paths = allFiles.map((f) => f.path);
  const matchedPaths = new Set(micromatch.match(paths, sources));

  return allFiles
    .filter((f) => matchedPaths.has(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Load knowledge content from glob-matched files.
 *
 * Each file is wrapped in separators:
 *   --- START: path/to/file.md ---
 *   [content]
 *   --- END: path/to/file.md ---
 *
 * If total character count exceeds `maxTokens * 4` (rough char-to-token estimate),
 * the least-recently-modified files are dropped until within budget.
 */
export async function loadKnowledgeContent(
  sources: string[],
  app: App,
  maxTokens?: number,
): Promise<string> {
  const files = resolveGlobs(sources, app);
  if (files.length === 0) return "";

  // Read all files and collect entries
  const entries: ResolvedFile[] = [];
  for (const file of files) {
    const content = await app.vault.read(file);
    entries.push({
      path: file.path,
      content,
      mtime: file.stat.mtime,
    });
  }

  // If a token limit is set, sort by mtime descending (most recent first)
  // and drop from the tail until we fit within budget
  const maxChars = maxTokens ? maxTokens * 4 : Infinity;

  // Sort most-recent first so we keep the freshest context
  entries.sort((a, b) => b.mtime - a.mtime);

  const included: ResolvedFile[] = [];
  let totalChars = 0;

  for (const entry of entries) {
    const block = wrapBlock(entry.path, entry.content);
    const blockLen = block.length;

    if (totalChars + blockLen > maxChars && included.length > 0) {
      break; // budget exceeded — stop adding
    }

    included.push(entry);
    totalChars += blockLen;
  }

  // Sort included files by path for stable output
  included.sort((a, b) => a.path.localeCompare(b.path));

  return included.map((e) => wrapBlock(e.path, e.content)).join("\n\n");
}

/**
 * Wrap file content in a labelled block for the LLM context.
 */
export function wrapBlock(path: string, content: string): string {
  return `--- START: ${path} ---\n${content}\n--- END: ${path} ---`;
}
