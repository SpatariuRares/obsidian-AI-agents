export interface SelectOption {
  value: string;
  text: string;
  disabled?: boolean;
  title?: string;
}

export interface SelectOptions {
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  cls?: string;
  onChange?: (value: string) => void;
}

const BASE_CLS = "ai-agents-select";

export function createSelect(
  container: HTMLElement,
  options: SelectOptions,
): HTMLSelectElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const select = container.createEl("select", { cls });

  if (options.placeholder) {
    select.createEl("option", {
      text: options.placeholder,
      attr: { value: "", disabled: "true", selected: "true" },
    });
  }

  for (const opt of options.options) {
    const attrs: Record<string, string> = { value: opt.value };
    if (opt.disabled) attrs.disabled = "true";
    if (opt.title) attrs.title = opt.title;

    select.createEl("option", { text: opt.text, attr: attrs });
  }

  if (options.value !== undefined) {
    select.value = options.value;
  }

  if (options.onChange) {
    const handler = options.onChange;
    select.addEventListener("change", () => handler(select.value));
  }

  return select;
}
