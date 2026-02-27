/**
 * @fileoverview ChunkingService - Splits vault files into heading-based chunks
 *
 * Stateless functions that divide markdown files by H1-H3 headings,
 * maintaining a breadcrumb path for each chunk. Large sections are
 * split at paragraph boundaries.
 */

import { DocumentChunk } from "@app/types/RAGTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEADING_REGEX = /^(#{1,3})\s+(.+)$/;
const MAX_CHUNK_CHARS = 2000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split a single file's content into heading-based chunks.
 */
export function chunkFile(filePath: string, content: string): DocumentChunk[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const chunks: DocumentChunk[] = [];

  // Stack to track heading hierarchy: [level, title]
  const headingStack: [number, string][] = [];
  let currentLines: string[] = [];
  let currentHeadingPath = "(root)";

  for (const line of lines) {
    const match = line.match(HEADING_REGEX);

    if (match) {
      // Flush the current section before starting a new one
      if (currentLines.length > 0) {
        const text = currentLines.join("\n").trim();
        if (text) {
          chunks.push(...createChunks(filePath, currentHeadingPath, text));
        }
        currentLines = [];
      }

      const level = match[1].length;
      const title = match[2].trim();

      // Pop headings at the same or deeper level
      while (headingStack.length > 0 && headingStack[headingStack.length - 1][0] >= level) {
        headingStack.pop();
      }
      headingStack.push([level, title]);

      currentHeadingPath = headingStack.map(([, t]) => t).join(" > ");
    } else {
      currentLines.push(line);
    }
  }

  // Flush remaining content
  if (currentLines.length > 0) {
    const text = currentLines.join("\n").trim();
    if (text) {
      chunks.push(...createChunks(filePath, currentHeadingPath, text));
    }
  }

  // If no headings were found, the entire content is a single chunk
  if (chunks.length === 0 && content.trim()) {
    chunks.push(...createChunks(filePath, "(root)", content.trim()));
  }

  return chunks;
}

/**
 * Batch-process multiple files into chunks.
 */
export function chunkFiles(files: { path: string; content: string }[]): DocumentChunk[] {
  const allChunks: DocumentChunk[] = [];
  for (const file of files) {
    allChunks.push(...chunkFile(file.path, file.content));
  }
  return allChunks;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Create one or more chunks from a section. If the section exceeds
 * MAX_CHUNK_CHARS, split at paragraph boundaries (double newline).
 */
function createChunks(filePath: string, headingPath: string, text: string): DocumentChunk[] {
  if (text.length <= MAX_CHUNK_CHARS) {
    return [makeChunk(filePath, headingPath, text)];
  }

  // Split at paragraph boundaries
  const paragraphs = text.split(/\n\n+/);
  const parts: DocumentChunk[] = [];
  let buffer = "";
  let partNum = 1;

  for (const paragraph of paragraphs) {
    if (buffer && buffer.length + paragraph.length + 2 > MAX_CHUNK_CHARS) {
      parts.push(makeChunk(filePath, `${headingPath} (part ${partNum})`, buffer.trim()));
      partNum++;
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }

  if (buffer.trim()) {
    const path = parts.length > 0 ? `${headingPath} (part ${partNum})` : headingPath;
    parts.push(makeChunk(filePath, path, buffer.trim()));
  }

  return parts;
}

function makeChunk(filePath: string, headingPath: string, content: string): DocumentChunk {
  return {
    id: generateChunkId(filePath, headingPath),
    content,
    filePath,
    headingPath,
    charCount: content.length,
  };
}

/**
 * Generate a stable, alphanumeric ID from filePath and headingPath.
 * Uses TextEncoder + btoa to safely handle Unicode, truncated to 32 chars.
 */
export function generateChunkId(filePath: string, headingPath: string): string {
  const raw = `${filePath}::${headingPath}`;
  let encoded: string;
  try {
    const bytes = new TextEncoder().encode(raw);
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    encoded = btoa(binary);
  } catch {
    // Fallback: simple character code sum-based hash
    encoded = Array.from(raw)
      .map((c) => c.charCodeAt(0).toString(36))
      .join("");
  }
  return encoded.replace(/[^a-zA-Z0-9]/g, "").substring(0, 32);
}
