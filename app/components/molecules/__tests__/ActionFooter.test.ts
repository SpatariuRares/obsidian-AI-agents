/**
 * @jest-environment jsdom
 */

import { createActionFooter, ActionFooterOptions } from "@app/components/molecules/ActionFooter";

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string; attr?: Record<string, string> },
    ): HTMLElementTagNameMap[K];
    createDiv(o?: { cls?: string }): HTMLDivElement;
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

describe("createActionFooter", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a footer and append to container", () => {
    const footer = createActionFooter(container, { buttons: [] });
    expect(container.contains(footer)).toBe(true);
    expect(footer.className).toBe("ai-agents-action-footer");
  });

  it("should use custom cls when provided", () => {
    const footer = createActionFooter(container, {
      buttons: [],
      cls: "custom-footer",
    });
    expect(footer.className).toBe("ai-agents-action-footer custom-footer");
  });

  it("should create buttons for each entry", () => {
    const footer = createActionFooter(container, {
      buttons: [
        { text: "Cancel", onClick: jest.fn() },
        { text: "Save", variant: "primary", onClick: jest.fn() },
      ],
    });
    const buttons = footer.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe("Cancel");
    expect(buttons[1].textContent).toBe("Save");
    expect(buttons[1].className).toBe("ai-agents-btn ai-agents-btn--primary");
  });

  it("should call onClick when a button is clicked", () => {
    const onClick1 = jest.fn();
    const onClick2 = jest.fn();
    const footer = createActionFooter(container, {
      buttons: [
        { text: "Cancel", onClick: onClick1 },
        { text: "Save", onClick: onClick2 },
      ],
    });
    const buttons = footer.querySelectorAll("button");
    buttons[0].click();
    expect(onClick1).toHaveBeenCalledTimes(1);
    expect(onClick2).not.toHaveBeenCalled();

    buttons[1].click();
    expect(onClick2).toHaveBeenCalledTimes(1);
  });

  it("should handle empty buttons array", () => {
    const footer = createActionFooter(container, { buttons: [] });
    const buttons = footer.querySelectorAll("button");
    expect(buttons).toHaveLength(0);
  });
});
