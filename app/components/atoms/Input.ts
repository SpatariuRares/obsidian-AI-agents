export interface InputOptions {
  type?: "text" | "password" | "email" | "number" | "url";
  placeholder?: string;
  value?: string;
  cls?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onEnter?: () => void;
}

export function createInput(
  container: HTMLElement,
  options: InputOptions,
): HTMLInputElement {
  const input = container.createEl("input", {
    cls: options.cls,
    attr: {
      type: options.type ?? "text",
      ...(options.placeholder ? { placeholder: options.placeholder } : {}),
    },
  });

  if (options.value !== undefined) {
    input.value = options.value;
  }

  if (options.disabled) {
    input.disabled = true;
  }

  if (options.onChange) {
    const handler = options.onChange;
    input.addEventListener("input", () => handler(input.value));
  }

  if (options.onEnter) {
    const handler = options.onEnter;
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") handler();
    });
  }

  return input;
}
