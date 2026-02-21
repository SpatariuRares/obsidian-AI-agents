export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface HeadingOptions {
  level: HeadingLevel;
  text: string;
  cls?: string;
}

export function createHeading(
  container: HTMLElement,
  options: HeadingOptions,
): HTMLHeadingElement {
  return container.createEl(options.level, {
    text: options.text,
    cls: options.cls,
  });
}
