import { App, SuggestModal } from "obsidian";
import { ChatSessionMeta } from "@app/services/ConversationLogger";
import { t } from "@app/i18n";

export class ChatHistoryModal extends SuggestModal<ChatSessionMeta> {
  private sessions: ChatSessionMeta[];
  private onSelect: (session: ChatSessionMeta) => void;

  constructor(
    app: App,
    agentName: string,
    sessions: ChatSessionMeta[],
    onSelect: (session: ChatSessionMeta) => void,
  ) {
    super(app);
    this.sessions = sessions;
    this.onSelect = onSelect;

    this.setPlaceholder(t("historyModal.searchPlaceholder"));

    // We can set instructions or modify the modal if needed
    this.setInstructions([
      { command: "↑↓", purpose: "to navigate" },
      { command: "↵", purpose: "to load session" },
      { command: "esc", purpose: "to dismiss" },
    ]);
  }

  getSuggestions(query: string): ChatSessionMeta[] {
    if (!query) return this.sessions;
    const lowerQuery = query.toLowerCase();
    return this.sessions.filter(
      (s) => s.title.toLowerCase().includes(lowerQuery) || s.date.includes(lowerQuery),
    );
  }

  renderSuggestion(session: ChatSessionMeta, el: HTMLElement) {
    el.createEl("div", {
      text: session.title,
      cls: "ai-agents-history-title",
      attr: { style: "font-weight: bold;" },
    });
    el.createEl("small", {
      text: session.date,
      cls: "ai-agents-history-date",
      attr: { style: "color: var(--text-muted);" },
    });
  }

  onChooseSuggestion(item: ChatSessionMeta, _evt: MouseEvent | KeyboardEvent) {
    this.onSelect(item);
  }
}
