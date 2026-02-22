export type TextTag = "span" | "p" | "div" | "label";

export interface TextOptions {
  tag?: TextTag;
  text: string;
  cls?: string;
}

const BASE_CLS = "ai-agents-text";

export function createText(
  container: HTMLElement,
  options: TextOptions,
): HTMLElement {
  const tag = options.tag ?? "span";
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  return container.createEl(tag, {
    text: options.text,
    cls,
  });
}
