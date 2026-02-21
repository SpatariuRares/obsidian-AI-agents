/**
 * @fileoverview Tests for InlineMentionSuggest molecule
 *
 * Covers trigger detection, suggestion filtering, keyboard navigation,
 * text insertion, and dismissal behaviour.
 */

import { App } from "obsidian";
import {
  InlineMentionSuggest,
  MentionTrigger,
  MentionItem,
} from "@app/components/molecules/InlineMentionSuggest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestTriggers(): MentionTrigger[] {
  return [
    {
      char: "@",
      icon: "file-text",
      getSuggestions: () => [
        { label: "notes.md", description: "folder/notes.md", value: "folder/notes.md" },
        { label: "todo.md", description: "folder/todo.md", value: "folder/todo.md" },
        { label: "archive.md", description: "archive.md", value: "archive.md" },
      ],
      formatInsertion: (item: MentionItem) => `@${item.value} `,
    },
    {
      char: "#",
      icon: "hash",
      getSuggestions: () => [
        { label: "#project", description: "5 notes", value: "#project" },
        { label: "#idea", description: "3 notes", value: "#idea" },
      ],
      formatInsertion: (item: MentionItem) => `${item.value} `,
    },
  ];
}

function createTextarea(): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  document.body.appendChild(textarea);
  return textarea;
}

function createContainer(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string, cursorPos?: number): void {
  textarea.value = value;
  const pos = cursorPos ?? value.length;
  textarea.selectionStart = pos;
  textarea.selectionEnd = pos;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InlineMentionSuggest", () => {
  let app: App;
  let textarea: HTMLTextAreaElement;
  let container: HTMLElement;
  let suggest: InlineMentionSuggest;

  beforeEach(() => {
    app = new App();
    textarea = createTextarea();
    container = createContainer();
    suggest = new InlineMentionSuggest(app, textarea, container, createTestTriggers());
    suggest.attach();
  });

  afterEach(() => {
    suggest.detach();
    textarea.remove();
    container.remove();
  });

  // ─── Trigger detection ──────────────────────────────────────────────

  describe("detectTrigger", () => {
    it("should detect @ trigger at start of text", () => {
      const result = suggest.detectTrigger("@no", 3);
      expect(result).not.toBeNull();
      expect(result!.trigger.char).toBe("@");
      expect(result!.query).toBe("no");
      expect(result!.startIndex).toBe(0);
    });

    it("should detect @ trigger after whitespace", () => {
      const result = suggest.detectTrigger("hello @no", 9);
      expect(result).not.toBeNull();
      expect(result!.trigger.char).toBe("@");
      expect(result!.query).toBe("no");
    });

    it("should not detect @ trigger in the middle of a word", () => {
      const result = suggest.detectTrigger("email@test", 10);
      expect(result).toBeNull();
    });

    it("should detect # trigger at start of text", () => {
      const result = suggest.detectTrigger("#pro", 4);
      expect(result).not.toBeNull();
      expect(result!.trigger.char).toBe("#");
      expect(result!.query).toBe("pro");
    });

    it("should detect # trigger after whitespace", () => {
      const result = suggest.detectTrigger("text #id", 8);
      expect(result).not.toBeNull();
      expect(result!.trigger.char).toBe("#");
      expect(result!.query).toBe("id");
    });

    it("should not detect trigger when query contains space", () => {
      const result = suggest.detectTrigger("@foo bar", 8);
      expect(result).toBeNull();
    });

    it("should detect trigger with empty query (just the trigger char)", () => {
      const result = suggest.detectTrigger("@", 1);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("");
    });

    it("should return null when no trigger present", () => {
      const result = suggest.detectTrigger("hello world", 11);
      expect(result).toBeNull();
    });

    it("should detect trigger after newline", () => {
      const result = suggest.detectTrigger("line1\n@qu", 9);
      expect(result).not.toBeNull();
      expect(result!.trigger.char).toBe("@");
      expect(result!.query).toBe("qu");
    });
  });

  // ─── Dropdown lifecycle ─────────────────────────────────────────────

  describe("dropdown rendering", () => {
    it("should open dropdown when input event fires with trigger", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));

      expect(suggest.isOpen()).toBe(true);
      expect(container.querySelector(".ai-agents-mention-suggest__container")).not.toBeNull();
    });

    it("should show filtered items matching query", () => {
      setTextareaValue(textarea, "@not");
      textarea.dispatchEvent(new Event("input"));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items.length).toBe(1);
      expect(items[0].querySelector(".ai-agents-mention-suggest__item-label")?.textContent).toBe(
        "notes.md",
      );
    });

    it("should show all items when query is empty", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items.length).toBe(3);
    });

    it("should show empty state when no items match", () => {
      setTextareaValue(textarea, "@zzzzz");
      textarea.dispatchEvent(new Event("input"));

      const emptyEl = container.querySelector(".ai-agents-mention-suggest__empty");
      expect(emptyEl).not.toBeNull();
    });

    it("should dismiss when text has no trigger", () => {
      setTextareaValue(textarea, "@no");
      textarea.dispatchEvent(new Event("input"));
      expect(suggest.isOpen()).toBe(true);

      setTextareaValue(textarea, "no trigger");
      textarea.dispatchEvent(new Event("input"));
      expect(suggest.isOpen()).toBe(false);
    });

    it("should show # trigger suggestions", () => {
      setTextareaValue(textarea, "#");
      textarea.dispatchEvent(new Event("input"));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items.length).toBe(2);
    });

    it("should filter # trigger suggestions", () => {
      setTextareaValue(textarea, "#pro");
      textarea.dispatchEvent(new Event("input"));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items.length).toBe(1);
      expect(items[0].querySelector(".ai-agents-mention-suggest__item-label")?.textContent).toBe(
        "#project",
      );
    });
  });

  // ─── Keyboard navigation ───────────────────────────────────────────

  describe("keyboard navigation", () => {
    beforeEach(() => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));
    });

    it("should move selection down with ArrowDown", () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items[1].classList.contains("ai-agents-mention-suggest__item--selected")).toBe(true);
    });

    it("should move selection up with ArrowUp", () => {
      // Move down first, then up
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items[0].classList.contains("ai-agents-mention-suggest__item--selected")).toBe(true);
    });

    it("should wrap around when navigating past the end", () => {
      // 3 items, press down 3 times to wrap
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items[0].classList.contains("ai-agents-mention-suggest__item--selected")).toBe(true);
    });

    it("should wrap around when navigating before the start", () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items[2].classList.contains("ai-agents-mention-suggest__item--selected")).toBe(true);
    });

    it("should dismiss on Escape", () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(suggest.isOpen()).toBe(false);
    });

    it("should not react to keyboard when dropdown is closed", () => {
      suggest.dismiss();

      const event = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });
      textarea.dispatchEvent(event);

      // Event should not be prevented
      expect(event.defaultPrevented).toBe(false);
    });
  });

  // ─── Text insertion ─────────────────────────────────────────────────

  describe("text insertion", () => {
    it("should insert selected file mention on Enter", () => {
      setTextareaValue(textarea, "@no");
      textarea.dispatchEvent(new Event("input"));

      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(textarea.value).toBe("@folder/notes.md ");
      expect(suggest.isOpen()).toBe(false);
    });

    it("should insert selected file mention on Tab", () => {
      setTextareaValue(textarea, "@no");
      textarea.dispatchEvent(new Event("input"));

      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

      expect(textarea.value).toBe("@folder/notes.md ");
      expect(suggest.isOpen()).toBe(false);
    });

    it("should insert tag mention correctly", () => {
      setTextareaValue(textarea, "#pro");
      textarea.dispatchEvent(new Event("input"));

      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(textarea.value).toBe("#project ");
      expect(suggest.isOpen()).toBe(false);
    });

    it("should preserve text before the mention", () => {
      setTextareaValue(textarea, "hello @no");
      textarea.dispatchEvent(new Event("input"));

      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(textarea.value).toBe("hello @folder/notes.md ");
    });

    it("should preserve text after the cursor", () => {
      const value = "hello @no world";
      textarea.value = value;
      textarea.selectionStart = 9; // cursor after "no"
      textarea.selectionEnd = 9;
      textarea.dispatchEvent(new Event("input"));

      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(textarea.value).toBe("hello @folder/notes.md  world");
    });

    it("should position cursor after insertion", () => {
      setTextareaValue(textarea, "@no");
      textarea.dispatchEvent(new Event("input"));

      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      const expectedPos = "@folder/notes.md ".length;
      expect(textarea.selectionStart).toBe(expectedPos);
      expect(textarea.selectionEnd).toBe(expectedPos);
    });
  });

  // ─── Mouse selection ────────────────────────────────────────────────

  describe("mouse selection", () => {
    it("should select item on mousedown", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      const secondItem = items[1] as HTMLElement;

      secondItem.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      expect(textarea.value).toBe("@folder/todo.md ");
      expect(suggest.isOpen()).toBe(false);
    });

    it("should highlight item on mouseenter", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      const secondItem = items[1] as HTMLElement;

      secondItem.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

      expect(items[1].classList.contains("ai-agents-mention-suggest__item--selected")).toBe(true);
      expect(items[0].classList.contains("ai-agents-mention-suggest__item--selected")).toBe(false);
    });
  });

  // ─── Dismissal ──────────────────────────────────────────────────────

  describe("dismissal", () => {
    it("should dismiss on blur after delay", () => {
      jest.useFakeTimers();

      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));
      expect(suggest.isOpen()).toBe(true);

      textarea.dispatchEvent(new Event("blur"));

      // Not yet dismissed (150ms delay)
      expect(suggest.isOpen()).toBe(true);

      jest.advanceTimersByTime(150);
      expect(suggest.isOpen()).toBe(false);

      jest.useRealTimers();
    });

    it("should clean up dropdown DOM on dismiss", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));
      expect(container.querySelector(".ai-agents-mention-suggest__container")).not.toBeNull();

      suggest.dismiss();
      expect(container.querySelector(".ai-agents-mention-suggest__container")).toBeNull();
    });
  });

  // ─── Public API ─────────────────────────────────────────────────────

  describe("public API", () => {
    it("isOpen should return false when not active", () => {
      expect(suggest.isOpen()).toBe(false);
    });

    it("isOpen should return true when dropdown is shown", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));
      expect(suggest.isOpen()).toBe(true);
    });

    it("detach should remove all listeners and dismiss", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));
      expect(suggest.isOpen()).toBe(true);

      suggest.detach();
      expect(suggest.isOpen()).toBe(false);

      // After detach, typing should not trigger dropdown
      setTextareaValue(textarea, "@test");
      textarea.dispatchEvent(new Event("input"));
      expect(suggest.isOpen()).toBe(false);
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle description-based filtering", () => {
      setTextareaValue(textarea, "@archive");
      textarea.dispatchEvent(new Event("input"));

      const items = container.querySelectorAll(".ai-agents-mention-suggest__item");
      expect(items.length).toBe(1);
      expect(items[0].querySelector(".ai-agents-mention-suggest__item-label")?.textContent).toBe(
        "archive.md",
      );
    });

    it("should render item descriptions when provided", () => {
      setTextareaValue(textarea, "@");
      textarea.dispatchEvent(new Event("input"));

      const descriptions = container.querySelectorAll(
        ".ai-agents-mention-suggest__item-description",
      );
      expect(descriptions.length).toBe(3);
      expect(descriptions[0].textContent).toBe("folder/notes.md");
    });
  });
});
