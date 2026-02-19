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
import { ChatMessage, ParsedAgent } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { resolveTemplate } from "@app/core/TemplateEngine";

export class ChatManager {
  private messages: ChatMessage[] = [];
  private activeAgent: ParsedAgent | null = null;
  private app: App;
  private settings: PluginSettings;

  constructor(app: App, settings: PluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Start a new chat session with the given agent.
   * Resolves the prompt template and initialises the messages array
   * with the system prompt.
   */
  async startSession(agent: ParsedAgent): Promise<void> {
    this.messages = [];
    this.activeAgent = agent;

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

  hasActiveSession(): boolean {
    return this.activeAgent !== null && this.messages.length > 0;
  }

  clearSession(): void {
    this.messages = [];
    this.activeAgent = null;
  }

  /**
   * Update the settings reference (called when settings change).
   */
  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }
}
