import { setIcon } from "obsidian";

export interface IconOptions {
  icon: string;
  cls?: string;
  ariaLabel?: string;
}

export function createIcon(
  container: HTMLElement,
  options: IconOptions,
): HTMLSpanElement {
  const span = container.createSpan({ cls: options.cls });

  setIcon(span, options.icon);

  if (options.ariaLabel) {
    span.setAttribute("aria-label", options.ariaLabel);
  }

  return span;
}
