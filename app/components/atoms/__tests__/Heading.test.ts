/**
 * @jest-environment jsdom
 */

import { createHeading, HeadingLevel } from "@app/components/atoms/Heading";

// Polyfill Obsidian's createEl on HTMLElement
declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string },
    ): HTMLElementTagNameMap[K];
  }
}

HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  o?: { text?: string; cls?: string },
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (o?.text) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  this.appendChild(el);
  return el;
};

describe("createHeading", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create an h1 element", () => {
    const heading = createHeading(container, { level: "h1", text: "Title" });
    expect(heading.tagName).toBe("H1");
    expect(heading.textContent).toBe("Title");
  });

  it("should create an h2 element", () => {
    const heading = createHeading(container, { level: "h2", text: "Subtitle" });
    expect(heading.tagName).toBe("H2");
  });

  it("should create an h3 element", () => {
    const heading = createHeading(container, { level: "h3", text: "Section" });
    expect(heading.tagName).toBe("H3");
  });

  it("should create an h4 element", () => {
    const heading = createHeading(container, { level: "h4", text: "Subsection" });
    expect(heading.tagName).toBe("H4");
  });

  it("should append to container", () => {
    const heading = createHeading(container, { level: "h2", text: "Test" });
    expect(container.contains(heading)).toBe(true);
  });

  it("should apply css class", () => {
    const heading = createHeading(container, {
      level: "h3",
      text: "Styled",
      cls: "my-heading",
    });
    expect(heading.className).toBe("ai-agents-heading my-heading");
  });

  it("should work without cls", () => {
    const heading = createHeading(container, { level: "h1", text: "Plain" });
    expect(heading.className).toBe("ai-agents-heading");
  });
});
