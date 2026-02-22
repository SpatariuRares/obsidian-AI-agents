export interface CheckboxOptions {
  checked?: boolean;
  cls?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

const BASE_CLS = "ai-agents-checkbox";

export function createCheckbox(
  container: HTMLElement,
  options: CheckboxOptions,
): HTMLInputElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const checkbox = container.createEl("input", {
    cls,
    attr: { type: "checkbox" },
  });

  if (options.checked) {
    checkbox.checked = true;
  }

  if (options.disabled) {
    checkbox.disabled = true;
  }

  if (options.onChange) {
    const handler = options.onChange;
    checkbox.addEventListener("change", () => handler(checkbox.checked));
  }

  return checkbox;
}
