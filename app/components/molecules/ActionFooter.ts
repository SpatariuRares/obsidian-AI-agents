import { createButton, ButtonVariant } from "@app/components/atoms/Button";

export interface ActionFooterButton {
  text: string;
  variant?: ButtonVariant;
  cls?: string;
  onClick: () => void;
}

export interface ActionFooterOptions {
  buttons: ActionFooterButton[];
  cls?: string;
}

const BASE_CLS = "ai-agents-action-footer";

export function createActionFooter(
  container: HTMLElement,
  options: ActionFooterOptions,
): HTMLElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const footer = container.createDiv({ cls });

  for (const btn of options.buttons) {
    createButton(footer, {
      text: btn.text,
      variant: btn.variant,
      cls: btn.cls,
      onClick: () => btn.onClick(),
    });
  }

  return footer;
}
