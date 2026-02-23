/**
 * @jest-environment jsdom
 */

import { PillListControl, PillListControlProps } from "@app/components/molecules/PillListControl";

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string; attr?: Record<string, string> },
    ): HTMLElementTagNameMap[K];
    createDiv(o?: { cls?: string }): HTMLDivElement;
    createSpan(o?: { cls?: string; text?: string }): HTMLSpanElement;
    addClass(cls: string): void;
    empty(): void;
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

HTMLElement.prototype.addClass = function (cls: string): void {
  this.classList.add(cls);
};

HTMLElement.prototype.empty = function (): void {
  this.innerHTML = "";
};

describe("PillListControl", () => {
  let container: HTMLElement;
  let onChange: jest.Mock;

  beforeEach(() => {
    container = document.createElement("div");
    onChange = jest.fn();
  });

  function createControl(overrides: Partial<PillListControlProps> = {}): PillListControl {
    return new PillListControl({
      container,
      items: ["read", "write"],
      onChange,
      ...overrides,
    });
  }

  it("should add control class to container", () => {
    createControl();
    expect(container.classList.contains("ai-agents-chat__editor-permissions-control")).toBe(true);
  });

  it("should create a list container", () => {
    createControl();
    const list = container.querySelector(".ai-agents-chat__editor-permissions-list");
    expect(list).not.toBeNull();
  });

  it("should render initial items as badges", () => {
    createControl();
    const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
    expect(badges.length).toBe(2);
  });

  it("should display item text in badges", () => {
    createControl();
    const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
    expect(badges[0].textContent).toContain("read");
    expect(badges[1].textContent).toContain("write");
  });

  it("should use formatPillText when provided", () => {
    createControl({ formatPillText: (item) => item.toUpperCase() });
    const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
    expect(badges[0].textContent).toContain("READ");
    expect(badges[1].textContent).toContain("WRITE");
  });

  it("should call onChange when a pill is removed", () => {
    createControl();
    const removeBtn = container.querySelector(
      ".ai-agents-badge__remove",
    ) as HTMLElement;
    removeBtn.click();
    expect(onChange).toHaveBeenCalledWith(["write"]);
  });

  it("should re-render after removing a pill", () => {
    createControl();
    const removeBtn = container.querySelector(
      ".ai-agents-badge__remove",
    ) as HTMLElement;
    removeBtn.click();
    const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
    expect(badges.length).toBe(1);
  });

  it("should not create input container when renderInput is not provided", () => {
    createControl();
    const inputContainer = container.querySelector(
      ".ai-agents-chat__editor-permissions-input-container",
    );
    expect(inputContainer).toBeNull();
  });

  it("should create input container when renderInput is provided", () => {
    createControl({ renderInput: jest.fn() });
    const inputContainer = container.querySelector(
      ".ai-agents-chat__editor-permissions-input-container",
    );
    expect(inputContainer).not.toBeNull();
  });

  it("should call renderInput on initial render", () => {
    const renderInput = jest.fn();
    createControl({ renderInput });
    expect(renderInput).toHaveBeenCalled();
  });

  describe("handleAdd (via renderInput)", () => {
    it("should add a new item when triggered through renderInput", () => {
      let addFn: (val: string) => void = () => {};
      createControl({
        renderInput: (_container, onAdd) => {
          addFn = onAdd;
        },
      });
      addFn("delete");
      expect(onChange).toHaveBeenCalledWith(["read", "write", "delete"]);
    });

    it("should not add duplicate items", () => {
      let addFn: (val: string) => void = () => {};
      createControl({
        renderInput: (_container, onAdd) => {
          addFn = onAdd;
        },
      });
      addFn("read");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should not add empty string", () => {
      let addFn: (val: string) => void = () => {};
      createControl({
        renderInput: (_container, onAdd) => {
          addFn = onAdd;
        },
      });
      addFn("");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("should re-render after adding an item", () => {
      let addFn: (val: string) => void = () => {};
      createControl({
        renderInput: (_container, onAdd) => {
          addFn = onAdd;
        },
      });
      addFn("create");
      const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
      expect(badges.length).toBe(3);
    });
  });

  describe("setItems", () => {
    it("should replace items and re-render", () => {
      const control = createControl();
      control.setItems(["a", "b", "c"]);
      const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
      expect(badges.length).toBe(3);
    });

    it("should handle empty items array", () => {
      const control = createControl();
      control.setItems([]);
      const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
      expect(badges.length).toBe(0);
    });
  });

  it("should render empty list when items is empty", () => {
    createControl({ items: [] });
    const badges = container.querySelectorAll(".ai-agents-chat__editor-permissions-pill");
    expect(badges.length).toBe(0);
  });
});
