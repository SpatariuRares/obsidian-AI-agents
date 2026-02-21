/**
 * @jest-environment jsdom
 */

import { createSelect, SelectOptions } from "@app/components/atoms/Select";

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

describe("createSelect", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a select and append to container", () => {
    const select = createSelect(container, { options: [] });
    expect(select.tagName).toBe("SELECT");
    expect(container.contains(select)).toBe(true);
  });

  it("should apply css class", () => {
    const select = createSelect(container, { options: [], cls: "my-select" });
    expect(select.className).toBe("my-select");
  });

  it("should add placeholder option when specified", () => {
    const select = createSelect(container, {
      options: [],
      placeholder: "Choose...",
    });
    const opts = select.querySelectorAll("option");
    expect(opts).toHaveLength(1);
    expect(opts[0].textContent).toBe("Choose...");
    expect(opts[0].getAttribute("value")).toBe("");
    expect(opts[0].hasAttribute("disabled")).toBe(true);
    expect(opts[0].hasAttribute("selected")).toBe(true);
  });

  it("should create option elements from options array", () => {
    const select = createSelect(container, {
      options: [
        { value: "a", text: "Alpha" },
        { value: "b", text: "Beta" },
      ],
    });
    const opts = select.querySelectorAll("option");
    expect(opts).toHaveLength(2);
    expect(opts[0].getAttribute("value")).toBe("a");
    expect(opts[0].textContent).toBe("Alpha");
    expect(opts[1].getAttribute("value")).toBe("b");
    expect(opts[1].textContent).toBe("Beta");
  });

  it("should set disabled and title attributes on options", () => {
    const select = createSelect(container, {
      options: [{ value: "x", text: "X", disabled: true, title: "Tooltip" }],
    });
    const opt = select.querySelector("option")!;
    expect(opt.hasAttribute("disabled")).toBe(true);
    expect(opt.getAttribute("title")).toBe("Tooltip");
  });

  it("should set value when specified", () => {
    const select = createSelect(container, {
      options: [
        { value: "a", text: "A" },
        { value: "b", text: "B" },
      ],
      value: "b",
    });
    expect(select.value).toBe("b");
  });

  it("should call onChange on change event", () => {
    const onChange = jest.fn();
    const select = createSelect(container, {
      options: [
        { value: "a", text: "A" },
        { value: "b", text: "B" },
      ],
      onChange,
    });
    select.value = "b";
    select.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("should not attach listener when onChange not provided", () => {
    const select = createSelect(container, { options: [] });
    select.dispatchEvent(new Event("change"));
    // Should not throw
  });
});
