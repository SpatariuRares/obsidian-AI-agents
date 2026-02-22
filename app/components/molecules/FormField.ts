import { createText } from "@app/components/atoms/Text";

export interface FormFieldOptions {
  label: string;
  required?: boolean;
  description?: string;
  cls?: string;
  renderInput: (container: HTMLElement) => void;
}

const BASE_CLS = "ai-agents-form-field";

export function createFormField(
  container: HTMLElement,
  options: FormFieldOptions,
): HTMLElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const wrapper = container.createDiv({ cls });

  const labelRow = wrapper.createDiv({ cls: "ai-agents-form-field__label" });
  createText(labelRow, { text: options.label });
  if (options.required) {
    createText(labelRow, { text: "*", cls: "ai-agents-form-field__required" });
  }

  if (options.description) {
    createText(wrapper, {
      tag: "div",
      text: options.description,
      cls: "ai-agents-form-field__hint",
    });
  }

  const inputContainer = wrapper.createDiv({ cls: "ai-agents-form-field__input" });
  options.renderInput(inputContainer);

  return wrapper;
}
