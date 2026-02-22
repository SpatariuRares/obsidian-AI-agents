import { createIcon } from "@app/components/atoms/Icon";
import { createText } from "@app/components/atoms/Text";

export interface EmptyStateOptions {
  message: string;
  icon?: string;
  cls?: string;
}

export class EmptyState {
  private containerEl: HTMLElement;

  static readonly BASE_CLS = "ai-agents-empty-state";

  constructor(parent: HTMLElement, options: EmptyStateOptions) {
    const cls = options.cls
      ? `${EmptyState.BASE_CLS} ${options.cls}`
      : EmptyState.BASE_CLS;
    this.containerEl = parent.createDiv({ cls });

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
