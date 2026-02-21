/**
 * @jest-environment jsdom
 */

import { createBadge, BadgeOptions } from "@app/components/atoms/Badge";

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string; attr?: Record<string, string> },
    ): HTMLElementTagNameMap[K];
    createDiv(o?: { cls?: string }): HTMLDivElement;
    createSpan(o?: { cls?: string; text?: string }): HTMLSpanElement;
  }
}

HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  o?: { text?: string; cls?: string; attr?: Record<string, string> },
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (o?.text) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  if (o?.attr) {
    for (const [key, val] of Object.entries(o.attr)) {
      el.setAttribute(key, val);
    }
  }
  this.appendChild(el);
  return el;
};

HTMLElement.prototype.createDiv = function (o?: { cls?: string }): HTMLDivElement {
  return this.createEl("div", o);
};

HTMLElement.prototype.createSpan = function (o?: { cls?: string; text?: string }): HTMLSpanElement {
  return this.createEl("span", o);
};

describe("createBadge", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a badge with text and append to container", () => {
    const badge = createBadge(container, { text: "Tag" });
    expect(container.contains(badge)).toBe(true);
    expect(badge.textContent).toContain("Tag");
  });

  it("should apply css class", () => {
    const badge = createBadge(container, { text: "Tag", cls: "my-badge" });
    expect(badge.className).toBe("my-badge");
  });

  it("should add remove button when removable", () => {
    const badge = createBadge(container, { text: "Tag", removable: true });
    const spans = badge.querySelectorAll("span");
    const removeBtn = Array.from(spans).find((s) => s.textContent === "\u2715");
    expect(removeBtn).not.toBeUndefined();
  });

  it("should not add remove button when not removable", () => {
    const badge = createBadge(container, { text: "Tag" });
    const spans = badge.querySelectorAll("span");
    // Only the text span from createText, no remove button
    const hasRemoveBtn = Array.from(spans).some((s) => s.textContent === "\u2715");
    expect(hasRemoveBtn).toBe(false);
  });

  it("should call onRemove when remove button is clicked", () => {
    const onRemove = jest.fn();
    const badge = createBadge(container, { text: "Tag", removable: true, onRemove });
    const spans = badge.querySelectorAll("span");
    const removeBtn = Array.from(spans).find((s) => s.textContent === "\u2715")!;
    removeBtn.click();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("should handle removable without onRemove callback", () => {
    const badge = createBadge(container, { text: "Tag", removable: true });
    const spans = badge.querySelectorAll("span");
    const removeBtn = Array.from(spans).find((s) => s.textContent === "\u2715")!;
    // Should not throw
    removeBtn.click();
  });
});
