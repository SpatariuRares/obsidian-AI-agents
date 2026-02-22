import { setIcon } from "obsidian";

export interface IconButtonOptions {
  icon: string;
  ariaLabel?: string;
  cls?: string;
  onClick: (e: MouseEvent) => void;
  tooltip?: string;
}

const BASE_CLS = "ai-agents-icon-btn";

export function createIconButton(
  container: HTMLElement,
  options: IconButtonOptions,
): HTMLButtonElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const btn = container.createEl("button", { cls });

  if (options.ariaLabel) {
    btn.setAttribute("aria-label", options.ariaLabel);
  }

  if (options.tooltip) {
    btn.setAttribute("title", options.tooltip);
  }

  setIcon(btn, options.icon);
  btn.addEventListener("click", options.onClick);
  return btn;
}
