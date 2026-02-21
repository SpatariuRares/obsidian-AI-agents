/**
 * @jest-environment jsdom
 */

import { createButton, ButtonOptions } from "@app/components/atoms/Button";

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

describe("createButton", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a button with text and append to container", () => {
    const onClick = jest.fn();
    const btn = createButton(container, { text: "Click me", onClick });

    expect(btn.tagName).toBe("BUTTON");
    expect(btn.textContent).toBe("Click me");
    expect(container.contains(btn)).toBe(true);
  });

  it("should apply css class", () => {
    const btn = createButton(container, {
      text: "Styled",
      cls: "mod-cta",
      onClick: jest.fn(),
    });

    expect(btn.className).toBe("mod-cta");
  });

  it("should attach click handler", () => {
    const onClick = jest.fn();
    const btn = createButton(container, { text: "Go", onClick });

    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should set disabled when specified", () => {
    const btn = createButton(container, {
      text: "Disabled",
      disabled: true,
      onClick: jest.fn(),
    });

    expect(btn.disabled).toBe(true);
  });

  it("should not be disabled by default", () => {
    const btn = createButton(container, { text: "Enabled", onClick: jest.fn() });

    expect(btn.disabled).toBe(false);
  });

  it("should set aria-label when specified", () => {
    const btn = createButton(container, {
      text: "Save",
      ariaLabel: "Save document",
      onClick: jest.fn(),
    });

    expect(btn.getAttribute("aria-label")).toBe("Save document");
  });

  it("should not set aria-label when not specified", () => {
    const btn = createButton(container, { text: "Save", onClick: jest.fn() });

    expect(btn.hasAttribute("aria-label")).toBe(false);
  });

  it("should set tooltip (title) when specified", () => {
    const btn = createButton(container, {
      text: "Info",
      tooltip: "More information",
      onClick: jest.fn(),
    });

    expect(btn.getAttribute("title")).toBe("More information");
  });

  it("should not set tooltip when not specified", () => {
    const btn = createButton(container, { text: "Info", onClick: jest.fn() });

    expect(btn.hasAttribute("title")).toBe(false);
  });
});
