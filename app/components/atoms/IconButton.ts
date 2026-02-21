import { setIcon } from "obsidian";

export interface IconButtonOptions {
  icon: string;
  ariaLabel?: string;
  cls?: string;
  onClick: (e: MouseEvent) => void;
  tooltip?: string;
}

export function createIconButton(
  container: HTMLElement,
  options: IconButtonOptions,
): HTMLButtonElement {
  const btn = container.createEl("button", {
    cls: options.cls ? `clickable-icon ${options.cls}` : "clickable-icon",
  });

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
