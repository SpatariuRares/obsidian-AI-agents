/**
 * @fileoverview ExampleUtils.test.ts
 *
 * Demonstrates Jest test patterns for pure utility functions:
 *   - `describe()` groups related tests into a named suite
 *   - `it()` (alias: `test()`) declares a single test case
 *   - `expect()` makes assertions about the result
 *
 * Run this file alone with:
 *   npm test -- app/utils/__tests__/ExampleUtils.test.ts
 */

import { formatGreeting } from "../ExampleUtils";

describe("formatGreeting", () => {
  // Happy-path: a normal name should appear in the output.
  it("should return a personalised greeting when given a name", () => {
    expect(formatGreeting("Alice")).toBe("Hello, Alice!");
  });

  // Edge case: empty string should produce the generic fallback.
  it("should return a generic greeting when given an empty string", () => {
    expect(formatGreeting("")).toBe("Hello, World!");
  });

  // Edge case: whitespace-only input is treated as blank.
  it("should return a generic greeting when given only whitespace", () => {
    expect(formatGreeting("   ")).toBe("Hello, World!");
  });

  // The function should trim surrounding whitespace from the name.
  it("should trim leading and trailing whitespace from the name", () => {
    expect(formatGreeting("  Bob  ")).toBe("Hello, Bob!");
  });

  // Sanity check: the name is present somewhere in the output.
  it("should include the provided name in the returned string", () => {
    expect(formatGreeting("Obsidian")).toContain("Obsidian");
  });
});
