import { t } from "@app/i18n";
import { createIconButton } from "@app/components/atoms/IconButton";
import { ParsedAgent } from "@app/types/AgentTypes";

export interface ChatHeaderProps {
  onSelectAgent: () => void;
  onEditAgent: () => void;
  onOpenHistory: () => void;
  onRenameSession: () => void;
  onNewSession: () => void;
}

export class ChatHeader {
  private containerEl: HTMLElement;
  private agentSelectBtnEl: HTMLButtonElement;
  private editAgentBtnEl: HTMLButtonElement;
  private historyBtnEl: HTMLButtonElement;
  private renameBtnEl: HTMLButtonElement;
  private newSessionBtnEl: HTMLButtonElement;

  constructor(parent: HTMLElement, props: ChatHeaderProps) {
    this.containerEl = parent.createDiv({ cls: "ai-agents-chat__header" });

    this.agentSelectBtnEl = this.containerEl.createEl("button", {
      cls: "ai-agents-chat__agent-select-btn",
      text: t("chat.chooseAgent"),
    });
    this.agentSelectBtnEl.addEventListener("click", props.onSelectAgent);

    this.editAgentBtnEl = createIconButton(this.containerEl, {
      icon: "settings",
      cls: "ai-agents-chat__edit-agent",
      ariaLabel: t("chat.editAgent"),
      onClick: props.onEditAgent,
    });
    this.editAgentBtnEl.setCssProps({ display: "none" });

    this.historyBtnEl = createIconButton(this.containerEl, {
      icon: "history",
      cls: "ai-agents-chat__history-btn",
      ariaLabel: t("chat.history"),
      onClick: props.onOpenHistory,
    });
    this.historyBtnEl.setCssProps({ display: "none" });

    this.renameBtnEl = createIconButton(this.containerEl, {
      icon: "pencil",
      cls: "ai-agents-chat__rename-btn",
      ariaLabel: t("chat.renameSession"),
      onClick: props.onRenameSession,
    });
    this.renameBtnEl.setCssProps({ display: "none" });

    this.newSessionBtnEl = createIconButton(this.containerEl, {
      icon: "rotate-ccw",
      cls: "ai-agents-chat__new-session",
      ariaLabel: t("chat.newSession"),
      onClick: props.onNewSession,
    });
  }

  public refreshAgentSelectBtn(activeAgent: ParsedAgent | null): void {
    if (activeAgent) {
      this.agentSelectBtnEl.textContent =
        `${activeAgent.config.avatar || ""} ${activeAgent.config.name}`.trim();
      this.editAgentBtnEl.setCssProps({ display: "flex" });
    } else {
      this.agentSelectBtnEl.textContent = t("chat.chooseAgent");
      this.editAgentBtnEl.setCssProps({ display: "none" });
    }
  }

  public setSessionActive(hasSession: boolean): void {
    this.historyBtnEl.setCssProps({ display: hasSession ? "flex" : "none" });
    this.renameBtnEl.setCssProps({ display: hasSession ? "flex" : "none" });
  }

  public hide(): void {
    this.containerEl.setCssProps({ display: "none" });
  }

  public show(): void {
    this.containerEl.setCssProps({ display: "flex" });
  }
}
