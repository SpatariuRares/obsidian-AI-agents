export type TextTag = "span" | "p" | "div" | "label";

export interface TextOptions {
  tag?: TextTag;
  text: string;
  cls?: string;
}

export function createText(
  container: HTMLElement,
  options: TextOptions,
): HTMLElement {
  const tag = options.tag ?? "span";
  return container.createEl(tag, {
    text: options.text,
    cls: options.cls,
  });
}
