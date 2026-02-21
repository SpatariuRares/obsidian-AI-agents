import { createIcon } from "@app/components/atoms/Icon";
import { createText } from "@app/components/atoms/Text";

export interface EmptyStateOptions {
  message: string;
  icon?: string;
  cls?: string;
}

export class EmptyState {
  private containerEl: HTMLElement;

  constructor(parent: HTMLElement, options: EmptyStateOptions) {
    this.containerEl = parent.createDiv({
      cls: options.cls ?? "ai-agents-empty-state",
    });

    if (options.icon) {
      createIcon(this.containerEl, { icon: options.icon });
    }

    createText(this.containerEl, {
      tag: "p",
      text: options.message,
    });
  }

  public setVisible(visible: boolean) {
    this.containerEl.setCssProps({ display: visible ? "flex" : "none" });
  }
}
