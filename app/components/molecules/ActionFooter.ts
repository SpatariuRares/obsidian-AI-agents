import { createButton } from "@app/components/atoms/Button";

export interface ActionFooterButton {
  text: string;
  cls?: string;
  onClick: () => void;
}

export interface ActionFooterOptions {
  buttons: ActionFooterButton[];
  cls?: string;
}

export function createActionFooter(
  container: HTMLElement,
  options: ActionFooterOptions,
): HTMLElement {
  const footer = container.createDiv({ cls: options.cls ?? "ai-agents-action-footer" });

  for (const btn of options.buttons) {
    createButton(footer, {
      text: btn.text,
      cls: btn.cls,
      onClick: () => btn.onClick(),
    });
  }

  return footer;
}
