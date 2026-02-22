export interface TextareaOptions {
  placeholder?: string;
  value?: string;
  rows?: number;
  cls?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

const BASE_CLS = "ai-agents-textarea";

export function createTextarea(
  container: HTMLElement,
  options: TextareaOptions,
): HTMLTextAreaElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const textarea = container.createEl("textarea", {
    cls,
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
