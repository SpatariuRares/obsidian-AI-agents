export interface TextareaOptions {
  placeholder?: string;
  value?: string;
  rows?: number;
  cls?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export function createTextarea(
  container: HTMLElement,
  options: TextareaOptions,
): HTMLTextAreaElement {
  const textarea = container.createEl("textarea", {
    cls: options.cls,
    attr: {
      ...(options.placeholder ? { placeholder: options.placeholder } : {}),
      ...(options.rows !== undefined ? { rows: String(options.rows) } : {}),
    },
  });

  if (options.value !== undefined) {
    textarea.value = options.value;
  }

  if (options.disabled) {
    textarea.disabled = true;
  }

  if (options.onChange) {
    const handler = options.onChange;
    textarea.addEventListener("input", () => handler(textarea.value));
  }

  return textarea;
}
