export interface CheckboxOptions {
  checked?: boolean;
  cls?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export function createCheckbox(
  container: HTMLElement,
  options: CheckboxOptions,
): HTMLInputElement {
  const checkbox = container.createEl("input", {
    cls: options.cls,
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
