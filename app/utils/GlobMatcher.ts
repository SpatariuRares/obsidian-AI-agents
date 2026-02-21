/**
 * @fileoverview GlobMatcher - Pattern matching for vault file paths
 *
 * Uses micromatch to check if a specific vault path matches a set of glob patterns
 * defined in the agent's permissions. Also ensures paths do not attempt directory traversal.
 */

import * as micromatch from "micromatch";

export class GlobMatcher {
  /**
   * Evaluates if a given path matches the provided patterns.
   * Path should be relative to the vault root (e.g., 'notes/idea.md').
   *
   * Includes protection against simple path traversal (e.g., using '../').
   */
  static isMatch(path: string, patterns: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    // Path traversal protection
    if (this.containsPathTraversal(path)) {
      return false;
    }

    const normalizedPath = this.normalizePath(path);
    const normalizedPatterns = this.normalizePatterns(patterns);

    return micromatch.isMatch(normalizedPath, normalizedPatterns);
  }

  /**
   * Security check for path traversal sequences.
   */
  private static containsPathTraversal(path: string): boolean {
    // Check for ".." either as a standalone component or at the start/end
    const parts = path.split(/[\\/]/);
    return parts.includes("..");
  }

  /**
   * Converts directory-style patterns to proper glob syntax.
   * - "/" → "**" (match everything in vault)
   * - "Inbox/" → "Inbox/**" (match everything inside Inbox)
   */
  private static normalizePatterns(patterns: string[]): string[] {
    return patterns.map((p) => {
      if (p === "/") return "**";
      if (p.endsWith("/") && !p.endsWith("**/")) return p + "**";
      return p;
    });
  }

  /**
   * Normalizes slashes to forward slashes.
   */
  private static normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
  }
}
