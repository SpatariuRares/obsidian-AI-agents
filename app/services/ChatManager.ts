/**
 * @fileoverview ChatManager - Manages chat sessions and message history
 *
 * Lifecycle:
 *   1. startSession(agent) → resolves prompt template → system message
 *   2. addMessage(role, content) → appends to messages array
 *   3. getMessages() → returns the full conversation (for API calls)
 *   4. clearSession() → resets
 *
 * The ChatManager does NOT call the AI provider — that responsibility
 * belongs to the ApiRouter (Phase 3). ChatManager only manages state.
 */

import { App } from "obsidian";
import { ChatMessage, ParsedAgent, TokenUsage } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { resolveTemplate } from "@app/services/TemplateEngine";
import { ConversationLogger } from "@app/services/ConversationLogger";
import { TokenTracker } from "@app/services/TokenTracker";

export class ChatManager {
  private messages: ChatMessage[] = [];
  private activeAgent: ParsedAgent | null = null;
  private app: App;
  private settings: PluginSettings;

  public logger: ConversationLogger;
  public tokenTracker: TokenTracker;
  private isNewSessionLog: boolean = false;

  constructor(app: App, settings: PluginSettings, saveSettings: () => Promise<void>) {
    this.app = app;
    this.settings = settings;
    this.logger = new ConversationLogger(app);
    this.tokenTracker = new TokenTracker(settings, saveSettings);
  }

  /**
   * Start a new chat session with the given agent.
   * Resolves the prompt template and initialises the messages array
   * with the system prompt.
   */
  async startSession(agent: ParsedAgent): Promise<void> {
    this.messages = [];
    this.activeAgent = agent;
    this.isNewSessionLog = true;

    this.app.workspace.trigger("ai-agents:update" as any);

    const systemPrompt = await resolveTemplate(agent.promptTemplate, {
      agentConfig: agent.config,
      settings: this.settings,
      app: this.app,
    });

    this.messages.push({
      role: "system",
      content: systemPrompt,
      timestamp: Date.now(),
    });
  }

  /**
   * Append a message to the conversation.
   */
  addMessage(role: "user" | "assistant", content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Removes the most recent message. Useful for cleaning up a failed empty assistant message.
   */
  removeLastMessage(): void {
    if (this.messages.length > 0) {
      this.messages.pop();
    }
  }

  /**
   * Append a chunk of text to the last message in the conversation.
   * Useful for streaming responses.
   */
  appendChunkToLastMessage(chunk: string): void {
    if (this.messages.length === 0) return;
    const lastMsg = this.messages[this.messages.length - 1];
    if (lastMsg.role === "assistant") {
      lastMsg.content += chunk;
    }
  }

  /**
   * Return all messages in the conversation.
   * The first message is always the system prompt.
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Return only user/assistant messages (no system prompt).
   * Used by the UI to display the chat history.
   */
  getVisibleMessages(): ChatMessage[] {
    return this.messages.filter((m) => m.role !== "system");
  }

  getActiveAgent(): ParsedAgent | null {
    return this.activeAgent;
  }

  /**
   * Updates the active agent config without restarting the session.
   * Useful for hot-reloading when the agent.md file is modified mid-chat.
   */
  async updateActiveAgent(agent: ParsedAgent): Promise<void> {
    if (!this.activeAgent || this.activeAgent.id !== agent.id) return;

    this.activeAgent = agent;

    // We could update the system prompt in the messages array here,
    // but typically history is immutable. Updating the active agent 
    // ensures the next messages use the new config/prompt rules.
    const systemPrompt = await resolveTemplate(agent.promptTemplate, {
      agentConfig: agent.config,
      settings: this.settings,
      app: this.app,
    });

    if (this.messages.length > 0 && this.messages[0].role === "system") {
      this.messages[0].content = systemPrompt;
    }
  }

  hasActiveSession(): boolean {
    return this.activeAgent !== null && this.messages.length > 0;
  }

  clearSession(): void {
    this.messages = [];
    this.activeAgent = null;
    this.isNewSessionLog = false;

    this.app.workspace.trigger("ai-agents:update" as any);
  }

  /**
   * Logs a single turn (user + assistant) to the markdown log file
   * and tracks token usage.
   */
  async logTurn(userMsg: ChatMessage, asstMsg: ChatMessage, usage?: TokenUsage): Promise<void> {
    if (!this.activeAgent) return;

    const isNew = this.isNewSessionLog;
    this.isNewSessionLog = false;

    await this.logger.appendLog(this.activeAgent, userMsg, asstMsg, usage, isNew);

    if (usage) {
      await this.tokenTracker.update(this.activeAgent.id, usage);
      this.app.workspace.trigger("ai-agents:update" as any);
    }
  }

  /**
   * Update the settings reference (called when settings change).
   */
  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  getSettings(): PluginSettings {
    return this.settings;
  }
}
