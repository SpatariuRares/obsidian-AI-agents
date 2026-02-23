/**
 * @jest-environment jsdom
 */

import { ChatEmptyState } from "@app/components/molecules/ChatEmptyState";

jest.mock("@app/i18n", () => ({
  t: (key: string) => key,
}));

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string; attr?: Record<string, string> },
    ): HTMLElementTagNameMap[K];
    createDiv(o?: { cls?: string }): HTMLDivElement;
    createSpan(o?: { cls?: string; text?: string }): HTMLSpanElement;
    setCssProps(props: Record<string, string>): void;
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

HTMLElement.prototype.setCssProps = function (props: Record<string, string>): void {
  for (const [key, val] of Object.entries(props)) {
    this.style.setProperty(key, val);
  }
};

describe("ChatEmptyState", () => {
  let parent: HTMLElement;

  beforeEach(() => {
    parent = document.createElement("div");
  });

  it("should create a container and append to parent", () => {
    new ChatEmptyState(parent);
    const container = parent.querySelector(".ai-agents-chat__empty-state");
    expect(container).not.toBeNull();
  });

  it("should display translated prompt text", () => {
    new ChatEmptyState(parent);
    const text = parent.querySelector("p");
    expect(text).not.toBeNull();
    expect(text!.textContent).toBe("chat.selectAgentPrompt");
  });

  it("should set display to flex when setVisible(true)", () => {
    const emptyState = new ChatEmptyState(parent);
    emptyState.setVisible(true);
    const container = parent.querySelector(".ai-agents-chat__empty-state") as HTMLElement;
    expect(container.style.display).toBe("flex");
  });

  it("should set display to none when setVisible(false)", () => {
    const emptyState = new ChatEmptyState(parent);
    emptyState.setVisible(false);
    const container = parent.querySelector(".ai-agents-chat__empty-state") as HTMLElement;
    expect(container.style.display).toBe("none");
  });
});
