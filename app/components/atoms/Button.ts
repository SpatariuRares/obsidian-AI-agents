export interface ButtonOptions {
  text: string;
  cls?: string;
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
  ariaLabel?: string;
  tooltip?: string;
}

export function createButton(
  container: HTMLElement,
  options: ButtonOptions,
): HTMLButtonElement {
  const btn = container.createEl("button", {
    text: options.text,
    cls: options.cls,
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
