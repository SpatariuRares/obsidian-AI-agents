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
import { ChatManager } from "@app/chat/ChatManager";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";
import { AgentRegistry } from "@app/core/AgentRegistry";

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
  private agentSelectEl!: HTMLSelectElement;
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
    this.refreshAgentSelect();
    this.renderMessages();
  }

  async onClose(): Promise<void> {
    // Nothing to clean up — Obsidian removes the DOM.
  }

  // -------------------------------------------------------------------------
  // Header: agent selector + new session
  // -------------------------------------------------------------------------

  private buildHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "ai-agents-chat__header" });

    this.agentSelectEl = header.createEl("select", {
      cls: "ai-agents-chat__agent-select dropdown",
    });
    this.agentSelectEl.addEventListener("change", () => {
      this.onAgentSelected();
    });

    const newSessionBtn = header.createEl("button", {
      cls: "ai-agents-chat__new-session clickable-icon",
      attr: { "aria-label": "New session" },
    });
    setIcon(newSessionBtn, "rotate-ccw");
    newSessionBtn.addEventListener("click", () => {
      this.onNewSession();
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
        this.onSendMessage();
      }
    });

    const sendBtn = inputArea.createEl("button", {
      cls: "ai-agents-chat__send clickable-icon",
      attr: { "aria-label": "Send message" },
    });
    setIcon(sendBtn, "send");
    sendBtn.addEventListener("click", () => {
      this.onSendMessage();
    });
  }

  // -------------------------------------------------------------------------
  // Agent selector
  // -------------------------------------------------------------------------

  refreshAgentSelect(): void {
    this.agentSelectEl.empty();

    // Placeholder option
    const placeholder = this.agentSelectEl.createEl("option", {
      text: "Choose an agent...",
      attr: { value: "", disabled: "true" },
    });

    const agents = this.host.agentRegistry.getEnabledAgents();
    const activeAgent = this.host.chatManager.getActiveAgent();

    if (agents.length === 0) {
      placeholder.textContent = "No agents found";
      return;
    }

    // If no active agent, keep placeholder selected
    if (!activeAgent) {
      placeholder.selected = true;
    }

    for (const agent of agents) {
      const opt = this.agentSelectEl.createEl("option", {
        text: `${agent.config.metadata.avatar ?? ""} ${agent.config.metadata.name}`.trim(),
        attr: { value: agent.id },
      });
      if (activeAgent && activeAgent.id === agent.id) {
        opt.selected = true;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  private async onAgentSelected(): Promise<void> {
    const agentId = this.agentSelectEl.value;
    if (!agentId) return;

    const agent = this.host.agentRegistry.getAgent(agentId);
    if (!agent) return;

    await this.host.chatManager.startSession(agent);
    this.renderMessages();
    this.inputEl.focus();
  }

  private async onNewSession(): Promise<void> {
    const activeAgent = this.host.chatManager.getActiveAgent();
    if (activeAgent) {
      await this.host.chatManager.startSession(activeAgent);
      this.renderMessages();
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
    this.renderMessages();

    // TODO: Phase 3 — send to ApiRouter and get assistant response
    // For now, just show the user message.
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  renderMessages(): void {
    const hasSession = this.host.chatManager.hasActiveSession();

    // Toggle empty state vs message list
    this.emptyStateEl.style.display = hasSession ? "none" : "flex";
    this.messageListEl.style.display = hasSession ? "flex" : "none";

    if (!hasSession) return;

    this.messageListEl.empty();

    const messages = this.host.chatManager.getVisibleMessages();

    for (const msg of messages) {
      this.renderMessage(msg);
    }

    // Scroll to bottom
    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private renderMessage(msg: ChatMessage): void {
    const bubble = this.messageListEl.createDiv({
      cls: `ai-agents-chat__message ai-agents-chat__message--${msg.role}`,
    });

    const label = bubble.createDiv({ cls: "ai-agents-chat__message-label" });
    const agent = this.host.chatManager.getActiveAgent();

    if (msg.role === "user") {
      label.textContent = "You";
    } else if (msg.role === "assistant") {
      label.textContent = agent?.config.metadata.name ?? "Assistant";
    }

    const content = bubble.createDiv({ cls: "ai-agents-chat__message-content" });
    content.textContent = msg.content;
  }
}
