export type ButtonVariant = "default" | "primary" | "ghost" | "danger";

export interface ButtonOptions {
  text: string;
  variant?: ButtonVariant;
  cls?: string;
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
  ariaLabel?: string;
  tooltip?: string;
}

const BASE_CLS = "ai-agents-btn";

export function createButton(
  container: HTMLElement,
  options: ButtonOptions,
): HTMLButtonElement {
  const clsParts = [BASE_CLS];
  if (options.variant && options.variant !== "default") {
    // eslint-disable-next-line i18next/no-literal-string
    clsParts.push(`${BASE_CLS}--${options.variant}`);
  }
  if (options.cls) clsParts.push(options.cls);
  const btn = container.createEl("button", {
    text: options.text,
    cls: clsParts.join(" "),
  });

  if (options.ariaLabel) {
    btn.setAttribute("aria-label", options.ariaLabel);
  }

  if (options.tooltip) {
    btn.setAttribute("title", options.tooltip);
  }

  if (options.disabled) {
    btn.disabled = true;
  }

  btn.addEventListener("click", options.onClick);
  return btn;
}
