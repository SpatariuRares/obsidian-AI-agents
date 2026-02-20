/**
 * @fileoverview GlobMatcher - Pattern matching for vault file paths
 *
 * Uses micromatch to check if a specific vault path matches a set of glob patterns
 * defined in the agent's permissions. Also ensures paths do not attempt directory traversal.
 */

import * as micromatch from 'micromatch';

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
            console.warn(`Blocked path traversal attempt: ${path}`);
            return false;
        }

        const normalizedPath = this.normalizePath(path);

        // micromatch returns true if the normalizedPath matches any of the patterns
        return micromatch.isMatch(normalizedPath, patterns);
    }

    /**
     * Security check for path traversal sequences.
     */
    private static containsPathTraversal(path: string): boolean {
        // Check for ".." either as a standalone component or at the start/end
        const parts = path.split(/[\\/]/);
        return parts.includes('..');
    }

    /**
     * Normalizes slashes to forward slashes.
     */
    private static normalizePath(path: string): string {
        return path.replace(/\\/g, '/');
    }
}
