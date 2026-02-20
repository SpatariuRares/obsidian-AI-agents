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

import { ItemView, WorkspaceLeaf, setIcon, Notice } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { MessageRenderer } from "@app/utils/MessageRenderer";
import { ApiRouter } from "@app/services/ApiRouter";
import { AgentSelectorModal, CREATE_AGENT_ID } from "@app/ui/AgentSelectorModal";
import { AgentEditor } from "@app/ui/AgentEditor";

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
  private editAgentBtnEl!: HTMLButtonElement;
  private emptyStateEl!: HTMLElement;
  private editorWrapperEl!: HTMLElement;

  private viewMode: "chat" | "edit" = "chat";

  // Streaming render queue state
  private isRenderingLastMessage = false;
  private renderLastMessageQueued = false;

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

    this.editAgentBtnEl = header.createEl("button", {
      cls: "ai-agents-chat__edit-agent clickable-icon",
      attr: { "aria-label": "Edit agent" },
    });
    setIcon(this.editAgentBtnEl, "pencil");
    this.editAgentBtnEl.style.display = "none";
    this.editAgentBtnEl.addEventListener("click", () => {
      const activeAgent = this.host.chatManager.getActiveAgent();
      if (activeAgent) this.showEditor(activeAgent);
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

    this.editorWrapperEl = container.createDiv({ cls: "ai-agents-chat__editor-wrapper" });
    this.editorWrapperEl.style.display = "none";
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
      this.editAgentBtnEl.style.display = "flex";
    } else {
      this.agentSelectBtnEl.textContent = "Choose an agent...";
      this.editAgentBtnEl.style.display = "none";
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
    if (agent.id === CREATE_AGENT_ID) {
      this.showEditor(null);
      return;
    }

    if (this.viewMode === "edit") {
      this.showChat();
    }

    await this.host.chatManager.startSession(agent);
    this.refreshAgentSelectBtn();
    await this.renderMessages();
    this.inputEl.focus();
  }

  private showEditor(agent: ParsedAgent | null): void {
    this.viewMode = "edit";
    // Hide chat elements
    this.emptyStateEl.style.display = "none";
    this.messageListEl.style.display = "none";
    const inputArea = this.containerEl.querySelector(".ai-agents-chat__input-area") as HTMLElement;
    if (inputArea) inputArea.style.display = "none";

    // Show editor 
    this.editorWrapperEl.style.display = "block";
    const editor = new AgentEditor(
      this.app,
      this.editorWrapperEl,
      this.host.agentRegistry,
      this.host.chatManager.getSettings(),
      agent,
      async (newAgentId) => {
        // On save success
        this.showChat();
        const newAgent = this.host.agentRegistry.getAgent(newAgentId);
        if (newAgent) {
          await this.onAgentSelected(newAgent);
        }
      },
      () => {
        // On cancel
        this.showChat();
        if (!this.host.chatManager.getActiveAgent()) {
          this.refreshAgentSelectBtn();
          this.renderMessages();
        }
      }
    );
    editor.render();
  }

  private showChat(): void {
    this.viewMode = "chat";
    this.editorWrapperEl.style.display = "none";
    this.editorWrapperEl.empty();

    const inputArea = this.containerEl.querySelector(".ai-agents-chat__input-area") as HTMLElement;
    if (inputArea) inputArea.style.display = "flex";

    this.renderMessages();
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
      const messagesForApi = this.host.chatManager.getMessages();
      const userMsg = messagesForApi[messagesForApi.length - 1]; // user message we just added
      let usageResponse;

      if (activeAgent.config.stream) {
        this.host.chatManager.addMessage("assistant", "");
        await this.renderMessages();

        const response = await ApiRouter.send(
          messagesForApi,
          activeAgent.config,
          this.host.chatManager.getSettings(),
          async (chunk: string) => {
            this.host.chatManager.appendChunkToLastMessage(chunk);
            await this.updateLastMessage();
          }
        );
        usageResponse = response?.usage;
      } else {
        const response = await ApiRouter.send(
          messagesForApi,
          activeAgent.config,
          this.host.chatManager.getSettings()
        );
        this.host.chatManager.addMessage("assistant", response.text);
        await this.renderMessages();
        usageResponse = response?.usage;
      }

      const visibleMsgs = this.host.chatManager.getVisibleMessages();
      const asstMsg = visibleMsgs[visibleMsgs.length - 1];

      await this.host.chatManager.logTurn(userMsg, asstMsg, usageResponse);
    } catch (error: unknown) {
      console.error("[ChatView] API Error:", error);
      const errMessage = error instanceof Error ? error.message : String(error);

      new Notice(`AI Agent Error: ${errMessage}`, 5000);

      // Clean up the empty assistant message if we added it for streaming
      const msgs = this.host.chatManager.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content.trim()) {
        this.host.chatManager.removeLastMessage();
      }

      await this.renderMessages();
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  async renderMessages(): Promise<void> {
    const hasSession = this.host.chatManager.hasActiveSession();

    if (this.viewMode === "chat") {
      // Toggle empty state vs message list
      this.emptyStateEl.style.display = hasSession ? "none" : "flex";
      this.messageListEl.style.display = hasSession ? "flex" : "none";
    }

    if (!hasSession || this.viewMode === "edit") return;

    this.messageListEl.empty();

    const messages = this.host.chatManager.getVisibleMessages();

    for (const msg of messages) {
      await this.renderMessage(msg);
    }

    // Scroll to bottom
    this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
  }

  private async updateLastMessage(): Promise<void> {
    if (this.isRenderingLastMessage) {
      this.renderLastMessageQueued = true;
      return;
    }

    this.isRenderingLastMessage = true;
    try {
      const messages = this.host.chatManager.getVisibleMessages();
      if (messages.length === 0) return;

      const lastMsg = messages[messages.length - 1];
      const lastBubble = this.messageListEl.lastElementChild;

      if (!lastBubble || !lastBubble.classList.contains("ai-agents-chat__message--assistant")) {
        await this.renderMessages();
        return;
      }

      const contentEl = lastBubble.querySelector(".ai-agents-chat__message-content") as HTMLElement;
      if (contentEl) {
        contentEl.empty();
        await MessageRenderer.render(this.app, lastMsg.content, contentEl, "", this);
        this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
      } else {
        await this.renderMessages();
      }
    } finally {
      this.isRenderingLastMessage = false;
      if (this.renderLastMessageQueued) {
        this.renderLastMessageQueued = false;
        await this.updateLastMessage();
      }
    }
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
