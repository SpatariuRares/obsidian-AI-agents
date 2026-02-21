/**
 * @jest-environment jsdom
 */

import { createTextarea, TextareaOptions } from "@app/components/atoms/Textarea";

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string; attr?: Record<string, string> },
    ): HTMLElementTagNameMap[K];
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

describe("createTextarea", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a textarea and append to container", () => {
    const ta = createTextarea(container, {});
    expect(ta.tagName).toBe("TEXTAREA");
    expect(container.contains(ta)).toBe(true);
  });

  it("should set placeholder", () => {
    const ta = createTextarea(container, { placeholder: "Type here" });
    expect(ta.getAttribute("placeholder")).toBe("Type here");
  });

  it("should set rows", () => {
    const ta = createTextarea(container, { rows: 4 });
    expect(ta.getAttribute("rows")).toBe("4");
  });

  it("should set value", () => {
    const ta = createTextarea(container, { value: "some text" });
    expect(ta.value).toBe("some text");
  });

  it("should apply css class", () => {
    const ta = createTextarea(container, { cls: "my-textarea" });
    expect(ta.className).toBe("my-textarea");
  });

  it("should set disabled when specified", () => {
    const ta = createTextarea(container, { disabled: true });
    expect(ta.disabled).toBe(true);
  });

  it("should not be disabled by default", () => {
    const ta = createTextarea(container, {});
    expect(ta.disabled).toBe(false);
  });

  it("should call onChange on input event", () => {
    const onChange = jest.fn();
    const ta = createTextarea(container, { onChange });
    ta.value = "new text";
    ta.dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith("new text");
  });

  it("should not attach listener when onChange not provided", () => {
    const ta = createTextarea(container, {});
    ta.dispatchEvent(new Event("input"));
    // Should not throw
  });
});
