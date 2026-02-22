import { createText } from "@app/components/atoms/Text";

export interface BadgeOptions {
  text: string;
  cls?: string;
  removable?: boolean;
  onRemove?: () => void;
}

const BASE_CLS = "ai-agents-badge";

export function createBadge(
  container: HTMLElement,
  options: BadgeOptions,
): HTMLElement {
  const clsParts = [BASE_CLS];
  // eslint-disable-next-line i18next/no-literal-string
  if (options.removable) clsParts.push(`${BASE_CLS}--removable`);
  if (options.cls) clsParts.push(options.cls);
  const badge = container.createDiv({ cls: clsParts.join(" ") });

  createText(badge, { text: options.text });

  if (options.removable) {
    const removeBtn = badge.createSpan({
      text: "\u2715",
      cls: `${BASE_CLS}__remove`,
    });
    if (options.onRemove) {
      const handler = options.onRemove;
      removeBtn.addEventListener("click", handler);
    }
  }

  return badge;
}
