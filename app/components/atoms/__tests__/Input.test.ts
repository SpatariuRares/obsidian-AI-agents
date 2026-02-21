/**
 * @jest-environment jsdom
 */

import { createInput, InputOptions } from "@app/components/atoms/Input";

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

describe("createInput", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create an input and append to container", () => {
    const input = createInput(container, {});
    expect(input.tagName).toBe("INPUT");
    expect(container.contains(input)).toBe(true);
  });

  it("should default to type text", () => {
    const input = createInput(container, {});
    expect(input.getAttribute("type")).toBe("text");
  });

  it("should set type attribute", () => {
    const input = createInput(container, { type: "email" });
    expect(input.getAttribute("type")).toBe("email");
  });

  it("should set placeholder", () => {
    const input = createInput(container, { placeholder: "Enter name" });
    expect(input.getAttribute("placeholder")).toBe("Enter name");
  });

  it("should set value", () => {
    const input = createInput(container, { value: "hello" });
    expect(input.value).toBe("hello");
  });

  it("should apply css class", () => {
    const input = createInput(container, { cls: "my-input" });
    expect(input.className).toBe("my-input");
  });

  it("should set disabled when specified", () => {
    const input = createInput(container, { disabled: true });
    expect(input.disabled).toBe(true);
  });

  it("should not be disabled by default", () => {
    const input = createInput(container, {});
    expect(input.disabled).toBe(false);
  });

  it("should call onChange on input event", () => {
    const onChange = jest.fn();
    const input = createInput(container, { onChange });
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith("test");
  });

  it("should call onEnter when Enter key is pressed", () => {
    const onEnter = jest.fn();
    const input = createInput(container, { onEnter });
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("should not call onEnter for other keys", () => {
    const onEnter = jest.fn();
    const input = createInput(container, { onEnter });
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("should not attach listeners when callbacks not provided", () => {
    const input = createInput(container, {});
    // Should not throw
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  });
});
