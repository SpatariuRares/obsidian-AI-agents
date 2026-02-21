import { App, Component } from "obsidian";
import { ChatMessage } from "@app/types/AgentTypes";
import { MessageRenderer } from "@app/utils/MessageRenderer";
import { t } from "@app/i18n";
import { createIcon } from "@app/components/atoms/Icon";
import { createText } from "@app/components/atoms/Text";

export interface ChatMessageBubbleProps {
  app: App;
  container: HTMLElement;
  msg: ChatMessage;
  agentName?: string;
  component: Component;
  findToolCallArgs?: (toolCallId?: string) => Record<string, any> | null;
}

export class ChatMessageBubble {
  static async render(props: ChatMessageBubbleProps): Promise<void> {
    const { app, container, msg, agentName, component, findToolCallArgs } = props;

    // Skip assistant messages that only dispatch tool calls (no user-facing text)
    if (msg.role === "assistant" && msg.tool_calls?.length && !msg.content.trim()) {
      return;
    }

    // Tool messages render as collapsible blocks
    if (msg.role === "tool") {
      ChatMessageBubble.renderToolMessage(container, msg, findToolCallArgs);
      return;
    }

    const bubble = container.createDiv({
      cls: `ai-agents-chat__message ai-agents-chat__message--${msg.role}`,
    });

    const label = bubble.createDiv({ cls: "ai-agents-chat__message-label" });

    if (msg.role === "user") {
      label.textContent = t("chat.youLabel");
    } else if (msg.role === "assistant") {
      label.textContent = agentName ?? t("chat.assistantLabel");
    }

    const content = bubble.createDiv({ cls: "ai-agents-chat__message-content" });
    await MessageRenderer.render(app, msg.content, content, "", component);
  }

  private static renderToolMessage(
    container: HTMLElement,
    msg: ChatMessage,
    findToolCallArgs?: (toolCallId?: string) => Record<string, any> | null,
  ): void {
    const wrapper = container.createDiv({
      cls: "ai-agents-chat__message ai-agents-chat__message--tool",
    });

    const details = wrapper.createEl("details", {
      cls: "ai-agents-chat__tool-block",
    });

    const toolArgs = findToolCallArgs ? findToolCallArgs(msg.tool_call_id) : null;
    const toolName = msg.name || t("chat.toolUnknown");

    // Collapsed header
    const summary = details.createEl("summary", {
      cls: "ai-agents-chat__tool-summary",
    });

    createIcon(summary, { icon: "chevron-right", cls: "ai-agents-chat__tool-chevron" });
    createIcon(summary, { icon: "wrench", cls: "ai-agents-chat__tool-icon" });

    createText(summary, { text: toolName, cls: "ai-agents-chat__tool-name" });

    if (toolArgs) {
      const preview = ChatMessageBubble.formatArgPreview(toolArgs);
      if (preview) {
        createText(summary, {
          text: " " + preview,
          cls: "ai-agents-chat__tool-arg-preview",
        });
      }
    }

    // Expanded body
    const body = details.createDiv({ cls: "ai-agents-chat__tool-body" });

    // Input section (arguments sent to the tool)
    if (toolArgs && Object.keys(toolArgs).length > 0) {
      createText(body, {
        tag: "div",
        text: t("chat.toolInput"),
        cls: "ai-agents-chat__tool-section-label",
      });
      const argsBlock = body.createEl("pre", { cls: "ai-agents-chat__tool-code" });
      argsBlock.createEl("code", { text: JSON.stringify(toolArgs, null, 2) });
    }

    // Output section (result returned by the tool)
    createText(body, {
      tag: "div",
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
   * Creates a short inline preview of tool arguments for the collapsed header.
   * e.g. (path: "notes/todo.md", content: "Hello wo...")
   */
  private static formatArgPreview(args: Record<string, any>): string {
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
