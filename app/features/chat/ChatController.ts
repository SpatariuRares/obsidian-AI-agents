import { App, Notice, TFile } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { ApiRouter } from "@app/services/ApiRouter";
import { ToolHandler } from "@app/services/ToolHandler";
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

  public async handleUserMessage(text: string): Promise<void> {
    if (!text) return;
    if (!this.chatManager.hasActiveSession()) return;

    // Inject referenced file contents for @path/to/file.md mentions
    const messageWithContext = await this.injectFileReferences(text);

    this.chatManager.addMessage("user", messageWithContext);
    await this.onRenderMessages();

    const activeAgent = this.chatManager.getActiveAgent();
    if (!activeAgent) return;

    try {
      let isToolLoop = true;
      let usageResponse;
      const initialUserMsg =
        this.chatManager.getMessages()[this.chatManager.getMessages().length - 1];

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
            async (chunk: string) => {
              if (firstChunk) {
                firstChunk = false;
                // Hide the dots, append the first chunk, then do a full
                // render to create the real assistant bubble in the DOM.
                this.onHideTypingIndicator?.();
                this.chatManager.appendChunkToLastMessage(chunk);
                await this.onRenderMessages();
                return;
              }
              // Subsequent chunks: faster incremental patch
              this.chatManager.appendChunkToLastMessage(chunk);
              await this.onUpdateLastMessage();
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
          // If we streamed, the assistant message is already there but empty text.
          // If not streamed, we added it above with text.
          // Let's ensure the assistant message actually reflects the tool_calls for future requests.
          const msgs = this.chatManager.getMessages();
          const lastMsg = msgs[msgs.length - 1];
          lastMsg.tool_calls = response.tool_calls;

          // Process tool calls
          for (const call of response.tool_calls) {
            const toolName = call.function.name;
            let args = {};
            try {
              args = JSON.parse(call.function.arguments);
            } catch {
              // console.warn("[ChatView] Failed to parse tool arguments:", call.function.arguments);
            }

            const toolResult = await ToolHandler.executeTool(
              this.app,
              activeAgent.config,
              toolName,
              args,
            );

            // Add tool response to history
            this.chatManager.addMessage("tool", JSON.stringify(toolResult), {
              name: toolName,
              tool_call_id: call.id,
            });
          }
          await this.onRenderMessages();

          // Loop continues to send tool results back to LLM...
        } else {
          isToolLoop = false;
        }
      }

      const visibleMsgs = this.chatManager.getVisibleMessages();
      const asstMsg = visibleMsgs[visibleMsgs.length - 1];

      await this.chatManager.logTurn(initialUserMsg, asstMsg, usageResponse);
    } catch (error: unknown) {
      // Always hide the typing indicator on any error or abort path.
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

      // Clean up the empty assistant message if we added it for streaming
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

  public abortGeneration(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

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
        // eslint-disable-next-line i18next/no-literal-string
        contextBlocks.push(`--- @${file.path} ---\n[Binary file]\n--- END ---`);
        continue;
      }

      try {
        const content = await this.app.vault.cachedRead(file);
        // eslint-disable-next-line i18next/no-literal-string
        contextBlocks.push(`--- @${file.path} ---\n${content}\n--- END ---`);
      } catch {
        // eslint-disable-next-line i18next/no-literal-string
        contextBlocks.push(`--- @${file.path} ---\n[Could not read file]\n--- END ---`);
      }
    }

    if (contextBlocks.length === 0) return text;

    // eslint-disable-next-line i18next/no-literal-string
    return `[Referenced files]\n${contextBlocks.join("\n\n")}\n\n${text}`;
  }
}
