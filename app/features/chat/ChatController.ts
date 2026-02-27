import { App, Notice, TFile } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { ApiRouter } from "@app/services/ApiRouter";
import { ToolHandler } from "@app/services/ToolHandler";
import { ParsedAgent, ChatMessage, TokenUsage, AgentStrategy } from "@app/types/AgentTypes";
import * as RAGPipeline from "@app/services/RAGPipeline";
import { t } from "@app/i18n";

export interface ChatControllerOptions {
  app: App;
  chatManager: ChatManager;
  onRenderMessages: () => Promise<void>;
  onUpdateLastMessage: () => Promise<void>;
  onShowTypingIndicator?: (agentName?: string) => void;
  onHideTypingIndicator?: () => void;
}

export class ChatController {
  private app: App;
  private chatManager: ChatManager;
  private onRenderMessages: () => Promise<void>;
  private onUpdateLastMessage: () => Promise<void>;
  private onShowTypingIndicator: ((agentName?: string) => void) | undefined;
  private onHideTypingIndicator: (() => void) | undefined;
  private currentAbortController: AbortController | null = null;

  constructor(options: ChatControllerOptions) {
    this.app = options.app;
    this.chatManager = options.chatManager;
    this.onRenderMessages = options.onRenderMessages;
    this.onUpdateLastMessage = options.onUpdateLastMessage;
    this.onShowTypingIndicator = options.onShowTypingIndicator;
    this.onHideTypingIndicator = options.onHideTypingIndicator;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public async handleUserMessage(text: string): Promise<void> {
    if (!text) return;
    if (!this.chatManager.hasActiveSession()) return;

    const activeAgent = this.chatManager.getActiveAgent();
    if (!activeAgent) return;

    // Inject referenced file contents for @path/to/file.md mentions
    let messageWithContext = await this.injectFileReferences(text);

    // RAG context injection: use the original text for semantic search,
    // then prepend retrieved context to the full message
    if (activeAgent.config.strategy === AgentStrategy.RAG) {
      try {
        const ragContext = await RAGPipeline.query(
          text,
          activeAgent,
          this.chatManager.getSettings(),
          this.app,
        );
        if (ragContext) {
          // eslint-disable-next-line i18next/no-literal-string -- LLM context injection marker, not user-facing text
          messageWithContext = `[Relevant knowledge from vault]\n${ragContext}\n\n${messageWithContext}`;
        }
      } catch {
        // RAG query failed — continue without context
      }
    }

    this.chatManager.addMessage("user", messageWithContext);
    await this.onRenderMessages();

    const msgs = this.chatManager.getMessages();
    const initialUserMsg = msgs[msgs.length - 1];
    await this._executeGeneration(activeAgent, initialUserMsg);
  }

  public abortGeneration(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Removes the last assistant reply (and any trailing tool messages) from
   * history, then re-runs generation from the last user message.
   */
  public async regenerateLastResponse(): Promise<void> {
    const messages = this.chatManager.getMessages();

    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }

    // Nothing to regenerate if no user message or nothing after it.
    if (lastUserIdx === -1 || lastUserIdx === messages.length - 1) return;

    this.chatManager.truncateHistory(lastUserIdx + 1);

    const activeAgent = this.chatManager.getActiveAgent();
    if (!activeAgent) return;

    await this.onRenderMessages();

    const msgs2 = this.chatManager.getMessages();
    const initialUserMsg = msgs2[msgs2.length - 1];
    await this._executeGeneration(activeAgent, initialUserMsg);
  }

  /**
   * Updates the content of a visible user message at `visibleIndex`,
   * truncates everything that came after it, then re-runs generation.
   */
  public async editAndResend(visibleIndex: number, newContent: string): Promise<void> {
    this.chatManager.updateVisibleMessageContent(visibleIndex, newContent);
    this.chatManager.truncateHistoryAfterVisible(visibleIndex);

    const activeAgent = this.chatManager.getActiveAgent();
    if (!activeAgent) return;

    await this.onRenderMessages();

    const msgs = this.chatManager.getMessages();
    const initialUserMsg = msgs[msgs.length - 1];
    await this._executeGeneration(activeAgent, initialUserMsg);
  }

  // ---------------------------------------------------------------------------
  // Private: core generation loop (shared by all public methods above)
  // ---------------------------------------------------------------------------

  /**
   * Runs the streaming/non-streaming generation loop (including tool calls)
   * for the given agent, starting from the current chatManager state.
   * `initialUserMsg` is stored for logging purposes at the end.
   */
  private async _executeGeneration(
    activeAgent: ParsedAgent,
    initialUserMsg: ChatMessage,
  ): Promise<void> {
    try {
      let isToolLoop = true;
      let usageResponse: TokenUsage | undefined;

      this.currentAbortController = new AbortController();

      while (isToolLoop) {
        const messagesForApi = this.chatManager.getMessages();

        let response;
        if (activeAgent.config.stream) {
          this.onShowTypingIndicator?.(activeAgent.config.name);
          this.chatManager.addMessage("assistant", "");

          let firstChunk = true;
          response = await ApiRouter.send(
            messagesForApi,
            activeAgent.config,
            this.chatManager.getSettings(),
            (chunk: string) => {
              if (firstChunk) {
                firstChunk = false;
                // Hide dots, append first chunk, do a full render to create the bubble.
                this.onHideTypingIndicator?.();
                this.chatManager.appendChunkToLastMessage(chunk);
                void this.onRenderMessages();
                return;
              }
              // Subsequent chunks: faster incremental patch
              this.chatManager.appendChunkToLastMessage(chunk);
              void this.onUpdateLastMessage();
            },
            this.currentAbortController.signal,
          );
        } else {
          response = await ApiRouter.send(
            messagesForApi,
            activeAgent.config,
            this.chatManager.getSettings(),
            undefined,
            this.currentAbortController.signal,
          );
          this.chatManager.addMessage("assistant", response.text);
          await this.onRenderMessages();
        }

        usageResponse = response?.usage;

        if (response.tool_calls && response.tool_calls.length > 0) {
          // Attach tool_calls to the last assistant message for future requests.
          const msgs = this.chatManager.getMessages();
          const lastMsg = msgs[msgs.length - 1];
          lastMsg.tool_calls = response.tool_calls;

          for (const call of response.tool_calls) {
            const toolName = call.function.name;
            let args = {};
            try {
              args = JSON.parse(call.function.arguments);
            } catch {
              // ignore parse errors
            }

            const toolResult = await ToolHandler.executeTool(
              this.app,
              activeAgent.config,
              toolName,
              args,
            );

            this.chatManager.addMessage("tool", JSON.stringify(toolResult), {
              name: toolName,
              tool_call_id: call.id,
            });
          }
          await this.onRenderMessages();
          // Loop continues so tool results go back to the LLM.
        } else {
          isToolLoop = false;
        }
      }

      const visibleMsgs = this.chatManager.getVisibleMessages();
      const asstMsg = visibleMsgs[visibleMsgs.length - 1];
      await this.chatManager.logTurn(initialUserMsg, asstMsg, usageResponse);
    } catch (error: unknown) {
      this.onHideTypingIndicator?.();

      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.message.includes("aborted"))
      ) {
        new Notice(t("notices.aiAgentGenerationStopped"), 3000);
        await this.onRenderMessages();
      } else {
        const errMessage = error instanceof Error ? error.message : String(error);
        if (errMessage.includes("does not support tools")) {
          new Notice(t("notices.aiAgentErrorNoTools"), 8000);
        } else {
          new Notice(t("notices.aiAgentError", { message: errMessage }), 5000);
        }
      }

      // Clean up the empty assistant message if we added it for streaming.
      const msgs = this.chatManager.getMessages();
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.role === "assistant" && !lastMsg.content.trim()) {
        this.chatManager.removeLastMessage();
      }

      await this.onRenderMessages();
    } finally {
      this.currentAbortController = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: file reference injection
  // ---------------------------------------------------------------------------

  /**
   * Parses @path/to/file.md mentions from the message text, loads each file's
   * content via cachedRead, and prepends a context block to the user message.
   */
  private async injectFileReferences(text: string): Promise<string> {
    // Match @filepath patterns — filepath ends at whitespace or end-of-string
    const mentionRegex = /(?:^|\s)@(\S+)/g;
    const paths: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      paths.push(match[1]);
    }

    if (paths.length === 0) return text;

    const contextBlocks: string[] = [];

    for (const filePath of paths) {
      const file = this.app.vault.getFileByPath(filePath);
      if (!file || !(file instanceof TFile)) continue;

      // Skip binary files (non-text extensions)
      const textExtensions = [
        "md",
        "txt",
        "json",
        "csv",
        "yaml",
        "yml",
        "xml",
        "html",
        "css",
        "js",
        "ts",
        "py",
        "sh",
        "cfg",
        "ini",
        "toml",
        "log",
      ];
      const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
      if (!textExtensions.includes(ext)) {
        // eslint-disable-next-line i18next/no-literal-string -- LLM context injection marker, not user-facing text
        contextBlocks.push(`--- @${file.path} ---\n[Binary file]\n--- END ---`);
        continue;
      }

      try {
        const content = await this.app.vault.cachedRead(file);
        // eslint-disable-next-line i18next/no-literal-string -- LLM context injection marker, not user-facing text
        contextBlocks.push(`--- @${file.path} ---\n${content}\n--- END ---`);
      } catch {
        // eslint-disable-next-line i18next/no-literal-string -- LLM context injection marker, not user-facing text
        contextBlocks.push(`--- @${file.path} ---\n[Could not read file]\n--- END ---`);
      }
    }

    if (contextBlocks.length === 0) return text;

    // eslint-disable-next-line i18next/no-literal-string -- LLM context injection marker, not user-facing text
    return `[Referenced files]\n${contextBlocks.join("\n\n")}\n\n${text}`;
  }
}
