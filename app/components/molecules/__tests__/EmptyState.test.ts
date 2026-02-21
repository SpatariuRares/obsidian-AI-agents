/**
 * @jest-environment jsdom
 */

import * as obsidian from "obsidian";
import { EmptyState, EmptyStateOptions } from "@app/components/molecules/EmptyState";

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

describe("EmptyState", () => {
  let parent: HTMLElement;
  let setIconSpy: jest.SpyInstance;

  beforeEach(() => {
    parent = document.createElement("div");
    setIconSpy = jest.spyOn(obsidian, "setIcon");
  });

  afterEach(() => {
    setIconSpy.mockRestore();
  });

  it("should create a container and append to parent", () => {
    new EmptyState(parent, { message: "No items" });
    const container = parent.querySelector(".ai-agents-empty-state");
    expect(container).not.toBeNull();
  });

  it("should use custom cls when provided", () => {
    new EmptyState(parent, { message: "No items", cls: "custom-empty" });
    const container = parent.querySelector(".custom-empty");
    expect(container).not.toBeNull();
  });

  it("should display message text", () => {
    new EmptyState(parent, { message: "Nothing here" });
    const p = parent.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe("Nothing here");
  });

  it("should render icon when provided", () => {
    new EmptyState(parent, { message: "No items", icon: "inbox" });
    expect(setIconSpy).toHaveBeenCalledWith(expect.any(HTMLElement), "inbox");
  });

  it("should not render icon when not provided", () => {
    new EmptyState(parent, { message: "No items" });
    expect(setIconSpy).not.toHaveBeenCalled();
  });

  it("should toggle visibility with setVisible", () => {
    const emptyState = new EmptyState(parent, { message: "No items" });
    const container = parent.querySelector(".ai-agents-empty-state") as HTMLElement;

    emptyState.setVisible(false);
    expect(container.style.display).toBe("none");

    emptyState.setVisible(true);
    expect(container.style.display).toBe("flex");
  });
});
