/**
 * @jest-environment jsdom
 */

import { createFormField, FormFieldOptions } from "@app/components/molecules/FormField";

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

describe("createFormField", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a form field wrapper and append to container", () => {
    const field = createFormField(container, {
      label: "Name",
      renderInput: () => {},
    });
    expect(container.contains(field)).toBe(true);
    expect(field.className).toBe("ai-agents-form-field");
  });

  it("should use custom cls when provided", () => {
    const field = createFormField(container, {
      label: "Name",
      cls: "custom-field",
      renderInput: () => {},
    });
    expect(field.className).toBe("custom-field");
  });

  it("should render label text", () => {
    const field = createFormField(container, {
      label: "Email",
      renderInput: () => {},
    });
    const labelRow = field.querySelector(".ai-agents-form-field__label");
    expect(labelRow).not.toBeNull();
    expect(labelRow!.textContent).toContain("Email");
  });

  it("should show required marker when required", () => {
    const field = createFormField(container, {
      label: "Email",
      required: true,
      renderInput: () => {},
    });
    const required = field.querySelector(".ai-agents-form-field__required");
    expect(required).not.toBeNull();
    expect(required!.textContent).toBe("*");
  });

  it("should not show required marker when not required", () => {
    const field = createFormField(container, {
      label: "Email",
      renderInput: () => {},
    });
    const required = field.querySelector(".ai-agents-form-field__required");
    expect(required).toBeNull();
  });

  it("should render description when provided", () => {
    const field = createFormField(container, {
      label: "Name",
      description: "Enter your full name",
      renderInput: () => {},
    });
    const hint = field.querySelector(".ai-agents-form-field__hint");
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toBe("Enter your full name");
  });

  it("should not render description when not provided", () => {
    const field = createFormField(container, {
      label: "Name",
      renderInput: () => {},
    });
    const hint = field.querySelector(".ai-agents-form-field__hint");
    expect(hint).toBeNull();
  });

  it("should call renderInput with input container", () => {
    const renderInput = jest.fn();
    createFormField(container, {
      label: "Name",
      renderInput,
    });
    expect(renderInput).toHaveBeenCalledTimes(1);
    const inputContainer = renderInput.mock.calls[0][0];
    expect(inputContainer.className).toBe("ai-agents-form-field__input");
  });
});
