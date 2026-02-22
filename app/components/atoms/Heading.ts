export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface HeadingOptions {
  level: HeadingLevel;
  text: string;
  cls?: string;
}

const BASE_CLS = "ai-agents-heading";

export function createHeading(
  container: HTMLElement,
  options: HeadingOptions,
): HTMLHeadingElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  return container.createEl(options.level, {
    text: options.text,
    cls,
  });
}
