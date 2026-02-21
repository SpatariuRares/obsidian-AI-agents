import { createText } from "@app/components/atoms/Text";

export interface BadgeOptions {
  text: string;
  cls?: string;
  removable?: boolean;
  onRemove?: () => void;
}

export function createBadge(
  container: HTMLElement,
  options: BadgeOptions,
): HTMLElement {
  const badge = container.createDiv({ cls: options.cls });

  createText(badge, { text: options.text });

  if (options.removable) {
    const removeBtn = badge.createSpan({ text: "\u2715" });
    if (options.onRemove) {
      const handler = options.onRemove;
      removeBtn.addEventListener("click", handler);
    }
  }

  return badge;
}
