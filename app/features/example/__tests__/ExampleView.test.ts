/**
 * @fileoverview ExampleView.test.ts
 *
 * Tests the ExampleView code block processor:
 *   - YAML source parsing (defaults, valid, invalid)
 *   - DOM construction via Obsidian helper methods
 *   - Colour mapping (named tokens and arbitrary CSS values)
 *   - Lifecycle callbacks (onload, onunload)
 *
 * DOM Note: Obsidian extends HTMLElement with createEl()/createDiv()/empty().
 * These are NOT standard DOM APIs. In the node test environment we create
 * a lightweight mock container that mirrors those methods with jest.fn().
 */

import { parseYaml } from "obsidian";
import { ExampleView } from "../ExampleView";

// ─── Mock DOM factory ────────────────────────────────────────────────────────

/**
 * Creates a minimal mock of an Obsidian HTMLElement.
 * Each call to createEl / createDiv returns a fresh mock so chained
 * accesses like `wrapper.createDiv(...).createEl(...)` work correctly.
 */
function createMockEl() {
  const el: {
    empty: jest.Mock;
    createEl: jest.Mock;
    createDiv: jest.Mock;
    style: { setProperty: jest.Mock };
    textContent: string;
  } = {
    empty: jest.fn(),
    createEl: jest.fn().mockImplementation(() => createMockEl()),
    createDiv: jest.fn().mockImplementation(() => createMockEl()),
    style: { setProperty: jest.fn() },
    textContent: "",
  };
  return el;
}

// Cast parseYaml to a jest mock so we can inspect calls / override behaviour.
const mockParseYaml = parseYaml as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ExampleView", () => {
  beforeEach(() => {
    // Restore the default mock implementation before each test so tests
    // that override parseYaml don't pollute one another.
    mockParseYaml.mockImplementation(
      (text: string): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        if (!text?.trim()) return result;
        for (const line of text.split("\n")) {
          const match = line.match(/^(\w+)\s*:\s*(.+)$/);
          if (match) result[match[1]] = match[2].trim();
        }
        return result;
      },
    );
  });

  afterEach(() => {
    mockParseYaml.mockClear();
  });

  // ── Constructor ───────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should create an instance without throwing", () => {
      const container = createMockEl() as unknown as HTMLElement;
      expect(() => new ExampleView("", container)).not.toThrow();
    });

    it("should expose the container as containerEl (from MarkdownRenderChild)", () => {
      const container = createMockEl() as unknown as HTMLElement;
      const view = new ExampleView("", container);
      expect(view.containerEl).toBe(container);
    });
  });

  // ── onload / render with defaults ─────────────────────────────────────────

  describe("onload() with empty source", () => {
    it("should call container.empty() to clear previous content", () => {
      const container = createMockEl();
      new ExampleView("", container as unknown as HTMLElement).onload();
      expect(container.empty).toHaveBeenCalledTimes(1);
    });

    it("should create the outer wrapper div with class 'example-block'", () => {
      const container = createMockEl();
      new ExampleView("", container as unknown as HTMLElement).onload();
      expect(container.createDiv).toHaveBeenCalledWith({
        cls: "example-block",
      });
    });

    it("should apply the default 'accent' colour token as a CSS variable", () => {
      const container = createMockEl();
      // Capture the wrapper returned by createDiv so we can inspect its body.
      const wrapper = createMockEl();
      const body = createMockEl();
      wrapper.createDiv
        .mockReturnValueOnce(createMockEl()) // header
        .mockReturnValueOnce(body); // body
      container.createDiv.mockReturnValueOnce(wrapper);

      new ExampleView("", container as unknown as HTMLElement).onload();

      expect(body.style.setProperty).toHaveBeenCalledWith(
        "--example-block-color",
        "var(--interactive-accent)",
      );
    });
  });

  // ── onload / render with YAML input ───────────────────────────────────────

  describe("onload() with YAML source", () => {
    it("should create the wrapper div after parsing a valid title and colour", () => {
      const container = createMockEl();
      new ExampleView(
        "title: My Title\ncolor: warning",
        container as unknown as HTMLElement,
      ).onload();
      expect(container.createDiv).toHaveBeenCalledWith({
        cls: "example-block",
      });
    });

    it("should map 'warning' colour token to the correct CSS variable", () => {
      const container = createMockEl();
      const wrapper = createMockEl();
      const body = createMockEl();
      wrapper.createDiv
        .mockReturnValueOnce(createMockEl()) // header
        .mockReturnValueOnce(body); // body
      container.createDiv.mockReturnValueOnce(wrapper);

      new ExampleView(
        "title: Test\ncolor: warning",
        container as unknown as HTMLElement,
      ).onload();

      expect(body.style.setProperty).toHaveBeenCalledWith(
        "--example-block-color",
        "var(--text-warning)",
      );
    });

    it("should map 'error' colour token to the correct CSS variable", () => {
      const container = createMockEl();
      const wrapper = createMockEl();
      const body = createMockEl();
      wrapper.createDiv
        .mockReturnValueOnce(createMockEl())
        .mockReturnValueOnce(body);
      container.createDiv.mockReturnValueOnce(wrapper);

      new ExampleView(
        "color: error",
        container as unknown as HTMLElement,
      ).onload();

      expect(body.style.setProperty).toHaveBeenCalledWith(
        "--example-block-color",
        "var(--text-error)",
      );
    });

    it("should pass arbitrary CSS colour strings through unchanged", () => {
      const container = createMockEl();
      const wrapper = createMockEl();
      const body = createMockEl();
      wrapper.createDiv
        .mockReturnValueOnce(createMockEl())
        .mockReturnValueOnce(body);
      container.createDiv.mockReturnValueOnce(wrapper);

      new ExampleView(
        "color: #ff6600",
        container as unknown as HTMLElement,
      ).onload();

      expect(body.style.setProperty).toHaveBeenCalledWith(
        "--example-block-color",
        "#ff6600",
      );
    });
  });

  // ── onload with invalid YAML ──────────────────────────────────────────────

  describe("onload() with invalid YAML", () => {
    it("should fall back to defaults when parseYaml throws", () => {
      mockParseYaml.mockImplementationOnce(() => {
        throw new Error("YAML parse error");
      });

      const container = createMockEl();
      // Should not throw even when YAML parsing fails.
      expect(
        () =>
          new ExampleView(
            ":::invalid:::",
            container as unknown as HTMLElement,
          ).onload(),
      ).not.toThrow();

      // Container.empty() should still be called (render ran with defaults).
      expect(container.empty).toHaveBeenCalledTimes(1);
    });
  });

  // ── render() with undefined params (private method branches) ─────────────
  //
  // The render() method has two branches that can only be reached by calling
  // it with params where title and/or color are undefined.  Since parseSource()
  // always supplies string defaults, these branches cannot be triggered via
  // onload().  We call the private method directly to cover them.

  describe("render() called directly with undefined params", () => {
    // Helper: build a fully-wired mock tree so render() can traverse it.
    function buildMockTree() {
      const titleEl = createMockEl();
      const header = createMockEl();
      header.createEl.mockReturnValue(titleEl);

      const content = createMockEl();
      const badge = createMockEl();
      const body = createMockEl();
      body.createEl
        .mockReturnValueOnce(content)
        .mockReturnValueOnce(badge);

      const wrapper = createMockEl();
      wrapper.createDiv
        .mockReturnValueOnce(header)
        .mockReturnValueOnce(body);

      const container = createMockEl();
      container.createDiv.mockReturnValueOnce(wrapper);

      return { container, wrapper, header, titleEl, body, content, badge };
    }

    it("should fall back to 'accent' CSS variable when color is undefined", () => {
      const { container, body } = buildMockTree();
      const view = new ExampleView("", container as unknown as HTMLElement);
      // Call the private render directly with color: undefined
      (view as unknown as {
        render(el: unknown, params: unknown): void;
      }).render(container, { title: "Test", color: undefined });

      expect(body.style.setProperty).toHaveBeenCalledWith(
        "--example-block-color",
        "var(--interactive-accent)",
      );
    });

    it("should use 'Example Block' fallback text when title is undefined", () => {
      const { container, titleEl } = buildMockTree();
      const view = new ExampleView("", container as unknown as HTMLElement);
      (view as unknown as {
        render(el: unknown, params: unknown): void;
      }).render(container, { title: undefined, color: "accent" });

      // titleEl.textContent is set via assignment in render()
      expect(titleEl.textContent).toBe("Example Block");
    });
  });

  // ── onunload ──────────────────────────────────────────────────────────────

  describe("onunload()", () => {
    it("should not throw", () => {
      const container = createMockEl() as unknown as HTMLElement;
      const view = new ExampleView("", container);
      expect(() => view.onunload()).not.toThrow();
    });
  });
});
