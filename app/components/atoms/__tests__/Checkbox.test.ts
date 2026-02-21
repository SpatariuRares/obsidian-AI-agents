/**
 * @jest-environment jsdom
 */

import { createCheckbox, CheckboxOptions } from "@app/components/atoms/Checkbox";

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

describe("createCheckbox", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a checkbox input and append to container", () => {
    const cb = createCheckbox(container, {});
    expect(cb.tagName).toBe("INPUT");
    expect(cb.getAttribute("type")).toBe("checkbox");
    expect(container.contains(cb)).toBe(true);
  });

  it("should apply css class", () => {
    const cb = createCheckbox(container, { cls: "my-cb" });
    expect(cb.className).toBe("my-cb");
  });

  it("should set checked when specified", () => {
    const cb = createCheckbox(container, { checked: true });
    expect(cb.checked).toBe(true);
  });

  it("should not be checked by default", () => {
    const cb = createCheckbox(container, {});
    expect(cb.checked).toBe(false);
  });

  it("should set disabled when specified", () => {
    const cb = createCheckbox(container, { disabled: true });
    expect(cb.disabled).toBe(true);
  });

  it("should not be disabled by default", () => {
    const cb = createCheckbox(container, {});
    expect(cb.disabled).toBe(false);
  });

  it("should call onChange with checked state on change event", () => {
    const onChange = jest.fn();
    const cb = createCheckbox(container, { onChange });
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("should not attach listener when onChange not provided", () => {
    const cb = createCheckbox(container, {});
    cb.dispatchEvent(new Event("change"));
    // Should not throw
  });
});
