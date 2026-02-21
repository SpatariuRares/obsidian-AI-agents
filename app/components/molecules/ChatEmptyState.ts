import { t } from "@app/i18n";

export class ChatEmptyState {
  private containerEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.containerEl = parent.createDiv({ cls: "ai-agents-chat__empty-state" });
    this.containerEl.createEl("p", {
      text: t("chat.selectAgentPrompt"),
      cls: "ai-agents-chat__empty-text",
    });
  }

  public setVisible(visible: boolean) {
    this.containerEl.setCssProps({ display: visible ? "flex" : "none" });
  }
}
