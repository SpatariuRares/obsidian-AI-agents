/**
 * @fileoverview ChatView - Obsidian sidebar ItemView for agent chat
 *
 * Renders in the right sidebar as a panel with:
 *   - Header: agent selector dropdown + new session button
 *   - Message list: scrollable area with user/assistant bubbles
 *   - Input area: textarea + send button
 *
 * DOM is built exclusively with createEl/createDiv (no innerHTML).
 * Styled with Obsidian CSS variables (see _chat.scss).
 */

import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { MessageRenderer } from "@app/utils/MessageRenderer";
import { ApiRouter } from "@app/services/ApiRouter";
import { AgentSelectorModal } from "@app/ui/AgentSelectorModal";

export const VIEW_TYPE_CHAT = "ai-agents-chat";

/**
 * Interface for the plugin reference passed to the view.
 * Avoids importing the concrete plugin class (no circular deps).
 */
export interface ChatViewHost {
  agentRegistry: AgentRegistry;
  chatManager: ChatManager;
}

export class ChatView extends ItemView {
  private host: ChatViewHost;
  private messageListEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private agentSelectBtnEl!: HTMLButtonElement;
  private emptyStateEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, host: ChatViewHost) {
    super(leaf);
    this.host = host;
  }

  getViewType(): string {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText(): string {
    return "AI agents";
  }

  getIcon(): string {
    return "bot";
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("ai-agents-chat");

    this.buildHeader(container);
    this.buildMessageArea(container);
    this.buildInputArea(container);
    this.refreshAgentSelectBtn();
    await this.renderMessages();
  }

  async onClose(): Promise<void> {
    // Nothing to clean up — Obsidian removes the DOM.
  }

  // -------------------------------------------------------------------------
  // Header: agent selector + new session
  // -------------------------------------------------------------------------

  private buildHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "ai-agents-chat__header" });

    this.agentSelectBtnEl = header.createEl("button", {
      cls: "ai-agents-chat__agent-select-btn",
      text: "Choose an agent...",
    });

    this.agentSelectBtnEl.addEventListener("click", () => {
      this.openAgentModal();
    });

    const newSessionBtn = header.createEl("button", {
      cls: "ai-agents-chat__new-session clickable-icon",
      attr: { "aria-label": "New session" },
    });
    setIcon(newSessionBtn, "rotate-ccw");
    newSessionBtn.addEventListener("click", () => {
      this.onNewSession().catch((e: Error) => console.error("New session error:", e));
    });
  }

  // -------------------------------------------------------------------------
  // Message area
  // -------------------------------------------------------------------------

  private buildMessageArea(container: HTMLElement): void {
    const wrapper = container.createDiv({ cls: "ai-agents-chat__messages-wrapper" });

    this.emptyStateEl = wrapper.createDiv({ cls: "ai-agents-chat__empty-state" });
    this.emptyStateEl.createEl("p", {
      text: "Select an agent to start chatting.",
      cls: "ai-agents-chat__empty-text",
    });

    this.messageListEl = wrapper.createDiv({ cls: "ai-agents-chat__messages" });
  }

  // -------------------------------------------------------------------------
  // Input area
  // -------------------------------------------------------------------------

  private buildInputArea(container: HTMLElement): void {
    const inputArea = container.createDiv({ cls: "ai-agents-chat__input-area" });

    this.inputEl = inputArea.createEl("textarea", {
      cls: "ai-agents-chat__input",
      attr: {
        placeholder: "Type a message...",
        rows: "1",
      },
    });

    // Auto-resize textarea as user types
    this.inputEl.addEventListener("input", () => {
      this.inputEl.style.height = "auto";
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + "px";
    });

    // Send on Enter (Shift+Enter for newline)
    this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.onSendMessage().catch((err: Error) => console.error("Send message error:", err));
      }
    });

    const sendBtn = inputArea.createEl("button", {
      cls: "ai-agents-chat__send clickable-icon",
      attr: { "aria-label": "Send message" },
    });
    setIcon(sendBtn, "send");
    sendBtn.addEventListener("click", () => {
      this.onSendMessage().catch((err: Error) => console.error("Send message error:", err));
    });
  }

  // -------------------------------------------------------------------------
  // Agent selector
  // -------------------------------------------------------------------------

  refreshAgentSelectBtn(): void {
    const activeAgent = this.host.chatManager.getActiveAgent();

    if (activeAgent) {
      this.agentSelectBtnEl.textContent = `${activeAgent.config.avatar || ""} ${activeAgent.config.name}`.trim();
    } else {
      this.agentSelectBtnEl.textContent = "Choose an agent...";
    }
  }

  private openAgentModal(): void {
    const agents = this.host.agentRegistry.getEnabledAgents();

    if (agents.length === 0) {
      // Could show a notice here
      console.warn("[ChatView] No enabled agents found.");
      return;
    }

    const modal = new AgentSelectorModal(this.app, agents, (agent) => {
      this.onAgentSelected(agent).catch((e: Error) => console.error("Agent select error:", e));
    });
    modal.open();
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  private async onAgentSelected(agent: ParsedAgent): Promise<void> {
    await this.host.chatManager.startSession(agent);
    this.refreshAgentSelectBtn();
    await this.renderMessages();
    this.inputEl.focus();
  }

  private async onNewSession(): Promise<void> {
    const activeAgent = this.host.chatManager.getActiveAgent();
    if (activeAgent) {
      await this.host.chatManager.startSession(activeAgent);
      await this.renderMessages();
      this.inputEl.focus();
    }
  }

  private async onSendMessage(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;
    if (!this.host.chatManager.hasActiveSession()) return;

    this.host.chatManager.addMessage("user", text);
    this.inputEl.value = "";
    this.inputEl.style.height = "auto";
    await this.renderMessages();

    const activeAgent = this.host.chatManager.getActiveAgent();
    if (!activeAgent) return;

    try {
      const messages = this.host.chatManager.getMessages();
      const response = await ApiRouter.send(
        messages,
        activeAgent.config,
        this.host.chatManager.getSettings()
      );

      this.host.chatManager.addMessage("assistant", response.text);
      await this.renderMessages();
    } catch (error: unknown) {
      console.error("[ChatView] API Error:", error);
      const errMessage = error instanceof Error ? error.message : String(error);
      this.host.chatManager.addMessage("assistant", `**Error:** ${errMessage}`);
      await this.renderMessages();
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  async renderMessages(): Promise<void> {
    const hasSession = this.host.chatManager.hasActiveSession();

    // Toggle empty state vs message list
    this.emptyStateEl.style.display = hasSession ? "none" : "flex";
    this.messageListEl.style.display = hasSession ? "flex" : "none";

    if (!hasSession) return;

    this.messageListEl.empty();

    const messages = this.host.chatManager.getVisibleMessages();

    for (const msg of messages) {
      await this.renderMessage(msg);
    }

    // Scroll to bottom
    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private async renderMessage(msg: ChatMessage): Promise<void> {
    const bubble = this.messageListEl.createDiv({
      cls: `ai-agents-chat__message ai-agents-chat__message--${msg.role}`,
    });

    const label = bubble.createDiv({ cls: "ai-agents-chat__message-label" });
    const agent = this.host.chatManager.getActiveAgent();

    if (msg.role === "user") {
      label.textContent = "You";
    } else if (msg.role === "assistant") {
      label.textContent = agent?.config.name ?? "Assistant";
    }

    const content = bubble.createDiv({ cls: "ai-agents-chat__message-content" });
    await MessageRenderer.render(this.app, msg.content, content, "", this);
  }
}
