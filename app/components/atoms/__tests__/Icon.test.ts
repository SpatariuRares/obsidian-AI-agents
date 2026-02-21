/**
 * @jest-environment jsdom
 */

import * as obsidian from "obsidian";
import { createIcon } from "@app/components/atoms/Icon";

// Polyfill Obsidian's createSpan on HTMLElement
declare global {
  interface HTMLElement {
    createSpan(o?: { cls?: string }): HTMLSpanElement;
  }
}

HTMLElement.prototype.createSpan = function (o?: { cls?: string }): HTMLSpanElement {
  const span = document.createElement("span");
  if (o?.cls) span.className = o.cls;
  this.appendChild(span);
  return span;
};

describe("createIcon", () => {
  let container: HTMLElement;
  let setIconSpy: jest.SpyInstance;

  beforeEach(() => {
    container = document.createElement("div");
    setIconSpy = jest.spyOn(obsidian, "setIcon");
  });

  afterEach(() => {
    setIconSpy.mockRestore();
  });

  it("should create a span and call setIcon", () => {
    const span = createIcon(container, { icon: "chevron-right" });

    expect(span.tagName).toBe("SPAN");
    expect(container.contains(span)).toBe(true);
    expect(setIconSpy).toHaveBeenCalledWith(span, "chevron-right");
  });

  it("should apply css class", () => {
    const span = createIcon(container, { icon: "wrench", cls: "tool-icon" });

    expect(span.className).toBe("tool-icon");
  });

  it("should set aria-label when specified", () => {
    const span = createIcon(container, {
      icon: "settings",
      ariaLabel: "Open settings",
    });

    expect(span.getAttribute("aria-label")).toBe("Open settings");
  });

  it("should not set aria-label when not specified", () => {
    const span = createIcon(container, { icon: "settings" });

    expect(span.hasAttribute("aria-label")).toBe(false);
  });

  it("should work without optional cls", () => {
    const span = createIcon(container, { icon: "star" });

    expect(span.className).toBe("");
    expect(setIconSpy).toHaveBeenCalledWith(span, "star");
  });
});
