import { App } from "obsidian";
import { t } from "@app/i18n";
import { createIconButton } from "@app/components/atoms/IconButton";
import { InlineMentionSuggest } from "@app/components/molecules/InlineMentionSuggest";
import {
  createFileMentionTrigger,
  createTagMentionTrigger,
} from "@app/features/chat/ChatMentionTriggers";

export interface ChatInputAreaProps {
  onSendMessage: (text: string) => void;
  onStopGeneration?: () => void;
}

export class ChatInputArea {
  public containerEl: HTMLElement;
  public inputEl: HTMLTextAreaElement;
  private mentionSuggest: InlineMentionSuggest | null = null;
  private props: ChatInputAreaProps;
  private sendBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;

  constructor(app: App, parent: HTMLElement, props: ChatInputAreaProps) {
    this.props = props;
    this.containerEl = parent.createDiv({ cls: "ai-agents-chat__input-area" });

    this.inputEl = this.containerEl.createEl("textarea", {
      cls: "ai-agents-chat__input",
      attr: {
        placeholder: t("chat.inputPlaceholder"),
        rows: "1",
      },
    });

    // Auto-resize textarea as user types
    this.inputEl.addEventListener("input", () => {
      this.inputEl.setCssProps({ height: "auto" });
      this.inputEl.setCssProps({ height: Math.min(this.inputEl.scrollHeight, 120) + "px" });
    });

    // Send on Enter (Shift+Enter for newline)
    this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        // Don't send if the mention suggest dropdown is open
        if (this.mentionSuggest?.isOpen()) return;
        e.preventDefault();
        this.submit();
      }
    });

    this.sendBtn = createIconButton(this.containerEl, {
      icon: "send",
      cls: "ai-agents-chat__send",
      ariaLabel: t("chat.sendMessage") || "Send message",
      onClick: () => this.submit(),
    });

    this.stopBtn = createIconButton(this.containerEl, {
      icon: "square",
      cls: "ai-agents-chat__stop",
      ariaLabel: t("chat.stopGeneration") || "Stop generation",
      onClick: () => this.props.onStopGeneration?.(),
    });
    this.stopBtn.style.display = "none";

    // Inline @file and #tag mention suggest
    this.mentionSuggest = new InlineMentionSuggest(app, this.inputEl, this.containerEl, [
      createFileMentionTrigger(),
      createTagMentionTrigger(),
    ]);
    this.mentionSuggest.attach();
  }

  private submit() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.props.onSendMessage(text);
  }

  public clear() {
    this.inputEl.value = "";
    this.inputEl.setCssProps({ height: "auto" });
  }

  public focus() {
    this.inputEl.focus();
  }

  public setVisible(visible: boolean) {
    this.containerEl.setCssProps({ display: visible ? "flex" : "none" });
  }

  public detach() {
    this.mentionSuggest?.detach();
    this.mentionSuggest = null;
  }

  public setGenerating(isGenerating: boolean) {
    if (isGenerating) {
      this.sendBtn.style.display = "none";
      this.stopBtn.style.display = "";
    } else {
      this.sendBtn.style.display = "";
      this.stopBtn.style.display = "none";
    }
  }
}
