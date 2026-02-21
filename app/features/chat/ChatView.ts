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

import { ItemView, WorkspaceLeaf, setIcon, Notice, TFile } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { MessageRenderer } from "@app/utils/MessageRenderer";
import { AgentSelectorModal, CREATE_AGENT_ID } from "@app/features/agents/AgentSelectorModal";
import { AgentEditor } from "@app/features/agents/AgentEditor";
import { t } from "@app/i18n";
import { ChatHistoryModal } from "@app/features/chat/ChatHistoryModal";
import { Modal, Setting } from "obsidian";
import { ChatHeader } from "@app/components/molecules/ChatHeader";
import { ChatInputArea } from "@app/components/molecules/ChatInputArea";
import { ChatEmptyState } from "@app/components/molecules/ChatEmptyState";
import { ChatController } from "@app/features/chat/ChatController";

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
  private editorWrapperEl!: HTMLElement;

  private header!: ChatHeader;
  private inputArea!: ChatInputArea;
  private emptyState!: ChatEmptyState;
  private chatController!: ChatController;

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
    return t("chat.title");
  }

  getIcon(): string {
    // eslint-disable-next-line i18next/no-literal-string
    return "bot";
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("ai-agents-chat");
    this.chatController = new ChatController({
      app: this.app,
      chatManager: this.host.chatManager,
      onRenderMessages: async () => this.renderMessages(),
      onUpdateLastMessage: async () => this.updateLastMessage(),
    });

    this.buildHeader(container);
    this.buildMessageArea(container);
    this.buildInputArea(container);
    this.refreshAgentSelectBtn();
    await this.renderMessages();
  }

  async onClose(): Promise<void> {
    this.inputArea?.detach();
  }

  // -------------------------------------------------------------------------
  // Header: agent selector + new session
  // -------------------------------------------------------------------------

  private buildHeader(container: HTMLElement): void {
    this.header = new ChatHeader(container, {
      onSelectAgent: () => this.openAgentModal(),
      onEditAgent: () => {
        const activeAgent = this.host.chatManager.getActiveAgent();
        if (activeAgent) this.showEditor(activeAgent);
      },
      onOpenHistory: () => {
        this.openHistoryModal().catch(() => {});
      },
      onRenameSession: () => this.promptRenameSession(),
      onNewSession: () => {
        this.onNewSession().catch(() => {});
      },
    });
  }

  // -------------------------------------------------------------------------
  // Message area
  // -------------------------------------------------------------------------

  private buildMessageArea(container: HTMLElement): void {
    const wrapper = container.createDiv({ cls: "ai-agents-chat__messages-wrapper" });

    this.emptyState = new ChatEmptyState(wrapper);

    this.messageListEl = wrapper.createDiv({ cls: "ai-agents-chat__messages" });

    this.editorWrapperEl = container.createDiv({ cls: "ai-agents-chat__editor-wrapper" });
    this.editorWrapperEl.setCssProps({ display: "none" });
  }

  // -------------------------------------------------------------------------
  // Input area
  // -------------------------------------------------------------------------

  private buildInputArea(container: HTMLElement): void {
    this.inputArea = new ChatInputArea(this.app, container, {
      onSendMessage: (text) => {
        this.chatController.handleUserMessage(text).catch(() => {});
      },
    });
  }

  // -------------------------------------------------------------------------
  // Agent selector
  // -------------------------------------------------------------------------

  refreshAgentSelectBtn(): void {
    const activeAgent = this.host.chatManager.getActiveAgent();
    this.header.refreshAgentSelectBtn(activeAgent);
  }

  private openAgentModal(): void {
    const agents = this.host.agentRegistry.getEnabledAgents();

    if (agents.length === 0) {
      // Could show a notice here
      // console.warn("[ChatView] No enabled agents found.");
      return;
    }

    const modal = new AgentSelectorModal(this.app, agents, (agent) => {
      this.onAgentSelected(agent).catch((_e: Error) => {
        /* no-op */
      });
    });
    modal.open();
  }

  private async openHistoryModal(): Promise<void> {
    const activeAgent = this.host.chatManager.getActiveAgent();
    if (!activeAgent) return;

    const logs = await this.host.chatManager.logger.getLogHistory(activeAgent);
    if (logs.length === 0) {
      new Notice(t("historyModal.empty"));
      return;
    }

    new ChatHistoryModal(this.app, activeAgent.config.name, logs, async (sessionMeta) => {
      try {
        const msgs = await this.host.chatManager.logger.loadSession(sessionMeta.file);
        if (msgs.length > 0) {
          await this.host.chatManager.loadHistoricalSession(
            activeAgent,
            sessionMeta.file,
            sessionMeta.title,
            msgs,
          );
          await this.renderMessages();
          this.refreshAgentSelectBtn();
        } else {
          new Notice("Failed to load session logic: File might be corrupted.");
        }
      } catch (e) {
        new Notice("Failed to load session.");
        // console.error(e);
      }
    }).open();
  }

  private promptRenameSession(): void {
    const manager = this.host.chatManager;
    const currentTitle = manager.currentSessionTitle;

    const modal = new Modal(this.app);
    modal.titleEl.setText(t("chat.renameSession"));

    new Setting(modal.contentEl).setName(t("chat.renamePrompt")).addText((text) => {
      text.setValue(currentTitle);
      const inputEl = text.inputEl;

      inputEl.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          const val = text.getValue().trim();
          if (val && val !== currentTitle) {
            await manager.renameCurrentSession(val);
          }
          modal.close();
        } else if (e.key === "Escape") {
          modal.close();
        }
      });

      const saveBtn = modal.contentEl.createEl("button", { text: "Save", cls: "mod-cta" });
      saveBtn.style.marginTop = "10px";
      saveBtn.addEventListener("click", async () => {
        const val = text.getValue().trim();
        if (val && val !== currentTitle) {
          await manager.renameCurrentSession(val);
        }
        modal.close();
      });

      // Focus input
      setTimeout(() => inputEl.focus(), 50);
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
    this.inputArea.focus();
  }

  private showEditor(agent: ParsedAgent | null): void {
    this.viewMode = "edit";
    // Hide chat elements
    this.emptyState.setVisible(false);
    this.messageListEl.setCssProps({ display: "none" });
    this.inputArea.setVisible(false);

    // Show editor
    this.editorWrapperEl.setCssProps({ display: "block" });
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
          this.renderMessages().catch((_e: Error) => {
            /* no-op */
          });
        }
      },
    );
    editor.render();
  }

  private showChat(): void {
    this.viewMode = "chat";
    this.editorWrapperEl.setCssProps({ display: "none" });
    this.editorWrapperEl.empty();

    this.inputArea.setVisible(true);

    this.renderMessages().catch((_e: Error) => {
      /* no-op */
    });
  }

  private async onNewSession(): Promise<void> {
    const activeAgent = this.host.chatManager.getActiveAgent();
    if (activeAgent) {
      await this.host.chatManager.startSession(activeAgent);
      await this.renderMessages();
      this.inputArea.focus();
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  async renderMessages(): Promise<void> {
    const hasSession = this.host.chatManager.hasActiveSession();

    if (this.viewMode === "chat") {
      // Toggle empty state vs message list
      this.emptyState.setVisible(!hasSession);
      this.messageListEl.setCssProps({ display: hasSession ? "flex" : "none" });

      // Toggle history & rename buttons
      this.header.setSessionActive(hasSession);
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
    // Skip assistant messages that only dispatch tool calls (no user-facing text)
    if (msg.role === "assistant" && msg.tool_calls?.length && !msg.content.trim()) {
      return;
    }

    // Tool messages render as collapsible blocks
    if (msg.role === "tool") {
      this.renderToolMessage(msg);
      return;
    }

    const bubble = this.messageListEl.createDiv({
      cls: `ai-agents-chat__message ai-agents-chat__message--${msg.role}`,
    });

    const label = bubble.createDiv({ cls: "ai-agents-chat__message-label" });
    const agent = this.host.chatManager.getActiveAgent();

    if (msg.role === "user") {
      label.textContent = t("chat.youLabel");
    } else if (msg.role === "assistant") {
      label.textContent = agent?.config.name ?? t("chat.assistantLabel");
    }

    const content = bubble.createDiv({ cls: "ai-agents-chat__message-content" });
    await MessageRenderer.render(this.app, msg.content, content, "", this);
  }

  // ---------------------------------------------------------------------------
  // Tool message rendering
  // ---------------------------------------------------------------------------

  private renderToolMessage(msg: ChatMessage): void {
    const wrapper = this.messageListEl.createDiv({
      cls: "ai-agents-chat__message ai-agents-chat__message--tool",
    });

    const details = wrapper.createEl("details", {
      cls: "ai-agents-chat__tool-block",
    });

    const toolArgs = this.findToolCallArgs(msg.tool_call_id);
    const toolName = msg.name || t("chat.toolUnknown");

    // Collapsed header
    const summary = details.createEl("summary", {
      cls: "ai-agents-chat__tool-summary",
    });

    const chevronEl = summary.createSpan({ cls: "ai-agents-chat__tool-chevron" });
    setIcon(chevronEl, "chevron-right");

    const iconEl = summary.createSpan({ cls: "ai-agents-chat__tool-icon" });
    setIcon(iconEl, "wrench");

    summary.createSpan({ text: toolName, cls: "ai-agents-chat__tool-name" });

    if (toolArgs) {
      const preview = this.formatArgPreview(toolArgs);
      if (preview) {
        summary.createSpan({
          text: " " + preview,
          cls: "ai-agents-chat__tool-arg-preview",
        });
      }
    }

    // Expanded body
    const body = details.createDiv({ cls: "ai-agents-chat__tool-body" });

    // Input section (arguments sent to the tool)
    if (toolArgs && Object.keys(toolArgs).length > 0) {
      body.createDiv({
        text: t("chat.toolInput"),
        cls: "ai-agents-chat__tool-section-label",
      });
      const argsBlock = body.createEl("pre", { cls: "ai-agents-chat__tool-code" });
      argsBlock.createEl("code", { text: JSON.stringify(toolArgs, null, 2) });
    }

    // Output section (result returned by the tool)
    body.createDiv({
      text: t("chat.toolOutput"),
      cls: "ai-agents-chat__tool-section-label",
    });
    const resultBlock = body.createEl("pre", { cls: "ai-agents-chat__tool-code" });
    try {
      const parsed = JSON.parse(msg.content);
      resultBlock.createEl("code", { text: JSON.stringify(parsed, null, 2) });
    } catch {
      resultBlock.createEl("code", { text: msg.content });
    }
  }

  /**
   * Looks up the arguments that were passed to a tool call by matching the tool_call_id
   * against assistant messages in the conversation history.
   */
  private findToolCallArgs(toolCallId?: string): Record<string, any> | null {
    if (!toolCallId) return null;
    const messages = this.host.chatManager.getMessages();
    for (const m of messages) {
      if (m.role === "assistant" && m.tool_calls) {
        const call = m.tool_calls.find((c: any) => c.id === toolCallId);
        if (call) {
          try {
            return JSON.parse(call.function.arguments);
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  /**
   * Creates a short inline preview of tool arguments for the collapsed header.
   * e.g. (path: "notes/todo.md", content: "Hello wo...")
   */
  private formatArgPreview(args: Record<string, any>): string {
    const entries = Object.entries(args);
    if (entries.length === 0) return "";
    const preview = entries
      .slice(0, 2)
      .map(([k, v]) => {
        const val = typeof v === "string" ? `"${v}"` : JSON.stringify(v);
        const truncated = val.length > 30 ? val.slice(0, 27) + "..." : val;
        return `${k}: ${truncated}`;
      })
      .join(", ");
    const suffix = entries.length > 2 ? ", ..." : "";
    return `(${preview}${suffix})`;
  }
}
