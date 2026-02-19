/**
 * @fileoverview ExampleUtils — Example utility functions
 *
 * Demonstrates how to write pure, testable utility functions for an Obsidian plugin.
 * Pure functions (no side effects, no Obsidian dependencies) are ideal for unit
 * testing and should live in app/utils/.
 *
 * Replace these examples with your own helpers as you build out the plugin.
 *
 * Usage:
 * ```typescript
 * import { formatGreeting } from '@app/utils/ExampleUtils';
 * const msg = formatGreeting('Alice'); // "Hello, Alice!"
 * ```
 */

/**
 * Formats a personalised greeting for the given name.
 *
 * Falls back to a generic greeting when the name is blank or whitespace-only.
 *
 * @param name - The name to include in the greeting
 * @returns A greeting string
 *
 * @example
 * formatGreeting('Alice')  // "Hello, Alice!"
 * formatGreeting('')       // "Hello, World!"
 * formatGreeting('  Bob ') // "Hello, Bob!"  (trimmed)
 */
export function formatGreeting(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Hello, World!";
  }
  return `Hello, ${trimmed}!`;
}
