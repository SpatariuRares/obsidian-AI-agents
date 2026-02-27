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

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { MessageRenderer } from "@app/utils/MessageRenderer";
import { AgentSelectorModal, CREATE_AGENT_ID } from "@app/features/agents/AgentSelectorModal";
import { AgentEditor } from "@app/features/agents/AgentEditor";
import { t } from "@app/i18n";
import { VIEW_TYPE_RAG } from "@app/features/rag/RAGView";
import { ChatHistoryModal } from "@app/features/chat/ChatHistoryModal";
import { Modal, Setting } from "obsidian";
import { ChatHeader } from "@app/components/molecules/ChatHeader";
import { ChatInputArea } from "@app/components/molecules/ChatInputArea";
import { ChatEmptyState } from "@app/components/molecules/ChatEmptyState";
import { ChatController } from "@app/features/chat/ChatController";
import { ChatMessageBubble } from "@app/components/molecules/ChatMessageBubble";
import { TypingIndicator } from "@app/components/molecules/TypingIndicator";
import { createButton } from "@app/components/atoms/Button";

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
  private typingIndicator!: TypingIndicator;

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
    // eslint-disable-next-line i18next/no-literal-string -- Lucide icon name, not user-facing text
    return "bot";
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("ai-agents");
    container.addClass("ai-agents-chat");
    this.chatController = new ChatController({
      app: this.app,
      chatManager: this.host.chatManager,
      onRenderMessages: async () => this.renderMessages(),
      onUpdateLastMessage: async () => this.updateLastMessage(),
      onShowTypingIndicator: (agentName?: string) => {
        this.typingIndicator.show(agentName);
        // Scroll so the indicator is visible
        this.messageListEl.scrollTop = this.messageListEl.scrollHeight;
      },
      onHideTypingIndicator: () => {
        this.typingIndicator.hide();
      },
    });

    this.buildHeader(container);
    this.buildMessageArea(container);
    this.buildInputArea(container);
    this.refreshAgentSelectBtn();
    await this.renderMessages();
  }

  onClose(): Promise<void> {
    this.inputArea?.detach();
    return Promise.resolve();
  }

  // -------------------------------------------------------------------------
  // Header: agent selector + new session
  // -------------------------------------------------------------------------

  private buildHeader(container: HTMLElement): void {
    this.header = new ChatHeader(container, {
      onSelectAgent: () => {
        void this.openAgentModal();
      },
      onEditAgent: () => {
        const activeAgent = this.host.chatManager.getActiveAgent();
        if (activeAgent) this.showEditor(activeAgent);
      },
      onOpenHistory: () => {
        void this.openHistoryModal().catch(() => {});
      },
      onRenameSession: () => {
        void this.promptRenameSession();
      },
      onNewSession: () => {
        void this.onNewSession().catch(() => {});
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
    // Attach typing indicator to the message list so it appears inline with messages
    this.typingIndicator = new TypingIndicator(this.messageListEl);

    this.editorWrapperEl = container.createDiv({ cls: "ai-agents-chat__editor-wrapper" });
    this.editorWrapperEl.setCssProps({ display: "none" });
  }

  // -------------------------------------------------------------------------
  // Input area
  // -------------------------------------------------------------------------

  private buildInputArea(container: HTMLElement): void {
    this.inputArea = new ChatInputArea(this.app, container, {
      onSendMessage: async (text) => {
        this.inputArea.setGenerating(true);
        try {
          await this.chatController.handleUserMessage(text);
        } finally {
          this.inputArea.setGenerating(false);
        }
      },
      onStopGeneration: () => {
        if (this.chatController) void this.chatController.abortGeneration();
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
      void this.onAgentSelected(agent).catch((_e: Error) => {
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
          new Notice(t("chatView.failedLoadSessionLogic"));
        }
      } catch (_e) {
        new Notice(t("chatView.failedLoadSession"));
        // console.error(e);
      }
    }).open();
  }

  private promptRenameSession(): void {
    const manager = this.host.chatManager;
    const currentTitle = manager.currentSessionTitle;

    const modal = new Modal(this.app);
    modal.contentEl.addClass("ai-agents");
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

      const saveBtn = createButton(modal.contentEl, {
        text: "Save",
        variant: "primary",
        onClick: async () => {
          const val = text.getValue().trim();
          if (val && val !== currentTitle) {
            await manager.renameCurrentSession(val);
          }
          modal.close();
        },
      });
      saveBtn.setCssProps({ marginTop: "10px" });

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
          void this.renderMessages().catch((_e: Error) => {
            /* no-op */
          });
        }
      },
      () => {
        // Open RAG manager view
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(VIEW_TYPE_RAG);
        if (existing.length > 0) {
          void workspace.revealLeaf(existing[0]).catch(() => {});
          return;
        }
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
          void leaf.setViewState({ type: VIEW_TYPE_RAG, active: true });
          void workspace.revealLeaf(leaf).catch(() => {});
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

    void this.renderMessages().catch((_e: Error) => {
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

    // When rebuilding the entire list, hide any stale typing indicator
    this.typingIndicator.hide();
    this.messageListEl.empty();

    const messages = this.host.chatManager.getVisibleMessages();

    for (let i = 0; i < messages.length; i++) {
      const isLast = i === messages.length - 1;
      await this.renderMessage(messages[i], i, isLast);
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
      // The last DOM child is now a __message-row wrapper, not the bubble itself.
      const lastRow = this.messageListEl.lastElementChild;

      if (!lastRow || !lastRow.classList.contains("ai-agents-chat__message-row--assistant")) {
        await this.renderMessages();
        return;
      }

      const contentEl = lastRow.querySelector(".ai-agents-chat__message-content") as HTMLElement;
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

  private async renderMessage(msg: ChatMessage, msgIndex: number, isLast: boolean): Promise<void> {
    const agent = this.host.chatManager.getActiveAgent();
    const canRegenerate = isLast && msg.role === "assistant";
    const canEdit = msg.role === "user";

    await ChatMessageBubble.render({
      app: this.app,
      container: this.messageListEl,
      msg,
      agentName: agent?.config.name,
      component: this,
      findToolCallArgs: (id: string | undefined) => this.findToolCallArgs(id),
      msgIndex,
      isLast,
      onRegenerate: canRegenerate
        ? () => {
            this.inputArea.setGenerating(true);
            void this.chatController
              .regenerateLastResponse()
              .finally(() => this.inputArea.setGenerating(false));
          }
        : undefined,
      onEdit: canEdit
        ? (visibleIndex: number, newContent: string) => {
            this.inputArea.setGenerating(true);
            void this.chatController
              .editAndResend(visibleIndex, newContent)
              .finally(() => this.inputArea.setGenerating(false));
          }
        : undefined,
    });
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
        const call = m.tool_calls.find((c) => c.id === toolCallId);
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
}
