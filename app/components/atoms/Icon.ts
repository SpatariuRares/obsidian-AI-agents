import { setIcon } from "obsidian";

export interface IconOptions {
  icon: string;
  cls?: string;
  ariaLabel?: string;
}

const BASE_CLS = "ai-agents-icon";

export function createIcon(
  container: HTMLElement,
  options: IconOptions,
): HTMLSpanElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const span = container.createSpan({ cls });

  setIcon(span, options.icon);

  if (options.ariaLabel) {
    span.setAttribute("aria-label", options.ariaLabel);
  }

  return span;
}
