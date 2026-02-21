import { GlobMatcher } from "@app/utils/GlobMatcher";

describe("GlobMatcher", () => {
  it("should return false if patterns are empty", () => {
    expect(GlobMatcher.isMatch("test.md", [])).toBe(false);
  });

  it("should return true for an exact match", () => {
    expect(GlobMatcher.isMatch("notes/idea.md", ["notes/idea.md"])).toBe(true);
  });

  it("should return true for a wildcard pattern", () => {
    expect(GlobMatcher.isMatch("notes/idea.md", ["notes/*.md"])).toBe(true);
  });

  it("should return true for a double wildcard (recursive) pattern", () => {
    expect(GlobMatcher.isMatch("notes/2026/jan/idea.md", ["notes/**/*.md"])).toBe(true);
  });

  it("should return false if file does not match", () => {
    expect(GlobMatcher.isMatch("notes/idea.md", ["journal/*.md"])).toBe(false);
  });

  it("should block path traversal with ..", () => {
    expect(GlobMatcher.isMatch("../secret.md", ["**/*.md"])).toBe(false);
    expect(GlobMatcher.isMatch("notes/../../secret.md", ["**/*.md"])).toBe(false);
  });

  // Pattern normalization tests
  describe("pattern normalization", () => {
    it('should treat "/" as matching all vault files', () => {
      expect(GlobMatcher.isMatch("note.md", ["/"])).toBe(true);
      expect(GlobMatcher.isMatch("Inbox/idea.md", ["/"])).toBe(true);
      expect(GlobMatcher.isMatch("deep/nested/file.md", ["/"])).toBe(true);
    });

    it('should treat "Inbox/" as matching all files inside Inbox', () => {
      expect(GlobMatcher.isMatch("Inbox/idea.md", ["Inbox/"])).toBe(true);
      expect(GlobMatcher.isMatch("Inbox/sub/deep.md", ["Inbox/"])).toBe(true);
      expect(GlobMatcher.isMatch("Other/idea.md", ["Inbox/"])).toBe(false);
    });

    it("should leave valid glob patterns unchanged", () => {
      expect(GlobMatcher.isMatch("notes/idea.md", ["**"])).toBe(true);
      expect(GlobMatcher.isMatch("notes/idea.md", ["**/*"])).toBe(true);
      expect(GlobMatcher.isMatch("notes/idea.md", ["notes/**"])).toBe(true);
    });
  });
});
