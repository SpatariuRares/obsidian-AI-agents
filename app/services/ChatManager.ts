import { App } from "obsidian";
import { ChatMessage, ParsedAgent, TokenUsage } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { resolveTemplate } from "@app/services/TemplateEngine";
import { ConversationLogger } from "@app/services/ConversationLogger";
import { TokenTracker } from "@app/services/TokenTracker";
import { ApiRouter } from "@app/services/ApiRouter";

export class ChatManager {
  private messages: ChatMessage[] = [];
  private activeAgent: ParsedAgent | null = null;
  private app: App;
  private settings: PluginSettings;

  public logger: ConversationLogger;
  public tokenTracker: TokenTracker;
  private isNewSessionLog: boolean = false;

  public currentSessionFile: string | null = null;
  public currentSessionTitle: string = "New Chat";

  constructor(app: App, settings: PluginSettings, saveSettings: () => Promise<void>) {
    this.app = app;
    this.settings = settings;
    this.logger = new ConversationLogger(app);
    this.tokenTracker = new TokenTracker(settings, saveSettings);
  }

  async startSession(agent: ParsedAgent): Promise<void> {
    this.messages = [];
    this.activeAgent = agent;
    this.isNewSessionLog = true;
    this.currentSessionFile = null;
    this.currentSessionTitle = "New Chat";

    let systemPrompt = await resolveTemplate(agent.promptTemplate, {
      agentConfig: agent.config,
      settings: this.settings,
      app: this.app,
    });

    if (agent.config.memory) {
      try {
        const histories = await this.logger.getLogHistory(agent);
        const recent = histories.slice(0, 5);
        if (recent.length > 0) {
          let memoryContext =
            "\n\n--- PAST CHAT MEMORY ---\nHere is context from previous conversations. Use it if relevant:\n";
          for (const hist of recent) {
            const pastMsgs = await this.logger.loadSession(hist.file);
            if (pastMsgs.length > 1) {
              memoryContext += `\nChat: ${hist.title} (${hist.date})\n`;
              for (const m of pastMsgs) {
                if (m.role === "user" || m.role === "assistant") {
                  memoryContext += `[${m.role.toUpperCase()}]: ${m.content}\n`;
                }
              }
            }
          }
          systemPrompt += memoryContext + "\n--- END PAST CHAT MEMORY ---\n";
        }
      } catch (_e) {
        // Ignore error
      }
    }

    this.app.workspace.trigger("ai-agents:update" as any);

    this.messages.push({
      role: "system",
      content: systemPrompt,
      timestamp: Date.now(),
    });
  }

  addMessage(
    role: "user" | "assistant" | "tool",
    content: string,
    extra?: Partial<ChatMessage>,
  ): void {
    this.messages.push({ role, content, timestamp: Date.now(), ...extra });
  }

  removeLastMessage(): void {
    if (this.messages.length > 0) {
      this.messages.pop();
    }
  }

  appendChunkToLastMessage(chunk: string): void {
    if (this.messages.length === 0) return;
    const lastMsg = this.messages[this.messages.length - 1];
    if (lastMsg.role === "assistant") {
      lastMsg.content += chunk;
    }
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getVisibleMessages(): ChatMessage[] {
    return this.messages.filter((m) => m.role !== "system");
  }

  getActiveAgent(): ParsedAgent | null {
    return this.activeAgent;
  }

  async updateActiveAgent(agent: ParsedAgent): Promise<void> {
    if (!this.activeAgent || this.activeAgent.id !== agent.id) return;
    this.activeAgent = agent;
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
    this.currentSessionFile = null;
    this.currentSessionTitle = "New Chat";
    this.app.workspace.trigger("ai-agents:update" as any);
  }

  async loadHistoricalSession(
    agent: ParsedAgent,
    file: string,
    title: string,
    msgs: ChatMessage[],
  ): Promise<void> {
    this.activeAgent = agent;
    this.currentSessionFile = file;
    this.currentSessionTitle = title;
    this.messages = msgs;
    this.isNewSessionLog = false;
    this.app.workspace.trigger("ai-agents:update" as any);
  }

  async renameCurrentSession(newTitle: string): Promise<void> {
    if (this.activeAgent && this.currentSessionFile) {
      this.currentSessionTitle = newTitle;
      this.currentSessionFile = await this.logger.saveSession(
        this.activeAgent,
        this.currentSessionFile,
        this.messages,
        this.currentSessionTitle,
      );
      this.app.workspace.trigger("ai-agents:update" as any);
    }
  }

  async logTurn(userMsg: ChatMessage, asstMsg: ChatMessage, usage?: TokenUsage): Promise<void> {
    if (!this.activeAgent) return;

    const vis = this.getVisibleMessages();
    if (this.currentSessionTitle === "New Chat" && vis.length <= 2) {
      try {
        const prompt: ChatMessage[] = [
          {
            role: "system",
            content:
              "You are a title generator. Generate a very short 3-5 word title for the following conversation. Reply ONLY with the title text itself, without any quotes or explanations.",
            timestamp: Date.now(),
          },
          {
            role: "user",
            content: `User: ${userMsg.content}\nAssistant: ${asstMsg.content}`,
            timestamp: Date.now(),
          },
        ];

        const tempConfig = { ...this.activeAgent.config, stream: false };
        const titleRes = await ApiRouter.send(prompt, tempConfig, this.settings);
        const title = titleRes.text.trim().replace(/^["']|["']$/g, "");
        if (title) {
          this.currentSessionTitle = title;
        }
      } catch (_e) {
        this.currentSessionTitle = "Chat " + new Date().toLocaleTimeString();
      }
    }

    this.isNewSessionLog = false;

    try {
      this.currentSessionFile = await this.logger.saveSession(
        this.activeAgent,
        this.currentSessionFile,
        this.messages,
        this.currentSessionTitle,
      );
    } catch (_e) {
      // Ignore save error
    }

    if (usage) {
      await this.tokenTracker.update(this.activeAgent.id, usage);
      this.app.workspace.trigger("ai-agents:update" as any);
    }
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  getSettings(): PluginSettings {
    return this.settings;
  }
}
