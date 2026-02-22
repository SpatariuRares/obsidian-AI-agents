/**
 * @jest-environment jsdom
 */

import { createText, TextTag } from "@app/components/atoms/Text";

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

describe("createText", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should default to span when no tag is specified", () => {
    const el = createText(container, { text: "hello" });
    expect(el.tagName).toBe("SPAN");
    expect(el.textContent).toBe("hello");
  });

  it("should create a span element", () => {
    const el = createText(container, { tag: "span", text: "inline" });
    expect(el.tagName).toBe("SPAN");
    expect(el.textContent).toBe("inline");
  });

  it("should create a p element", () => {
    const el = createText(container, { tag: "p", text: "paragraph" });
    expect(el.tagName).toBe("P");
    expect(el.textContent).toBe("paragraph");
  });

  it("should create a div element", () => {
    const el = createText(container, { tag: "div", text: "block" });
    expect(el.tagName).toBe("DIV");
    expect(el.textContent).toBe("block");
  });

  it("should create a label element", () => {
    const el = createText(container, { tag: "label", text: "Field" });
    expect(el.tagName).toBe("LABEL");
    expect(el.textContent).toBe("Field");
  });

  it("should append to container", () => {
    const el = createText(container, { text: "child" });
    expect(container.contains(el)).toBe(true);
  });

  it("should apply css class", () => {
    const el = createText(container, { text: "styled", cls: "my-text" });
    expect(el.className).toBe("ai-agents-text my-text");
  });

  it("should work without cls", () => {
    const el = createText(container, { tag: "p", text: "plain" });
    expect(el.className).toBe("ai-agents-text");
  });
});
