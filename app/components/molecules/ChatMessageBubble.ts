import { App, Component, Notice } from "obsidian";
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
  findToolCallArgs?: (toolCallId?: string) => Record<string, unknown> | null;
  msgIndex?: number;
  isLast?: boolean;
  onEdit?: (visibleIndex: number, newContent: string) => void;
  onRegenerate?: () => void;
}

export class ChatMessageBubble {
  static async render(props: ChatMessageBubbleProps): Promise<void> {
    const {
      app,
      container,
      msg,
      agentName,
      component,
      findToolCallArgs,
      msgIndex,
      isLast,
      onEdit,
      onRegenerate,
    } = props;

    // Skip assistant messages that only dispatch tool calls (no user-facing text)
    if (msg.role === "assistant" && msg.tool_calls?.length && !msg.content.trim()) {
      return;
    }

    // Tool messages render as collapsible blocks — no action strip needed
    if (msg.role === "tool") {
      ChatMessageBubble.renderToolMessage(container, msg, findToolCallArgs);
      return;
    }

    // ── Row wrapper: bubble + action strip side by side ─────────────────
    // CSS positions them with flexbox; user rows have actions on the LEFT via
    // CSS `order: -1`, assistant rows have actions on the RIGHT (default).
    const row = container.createDiv({
      cls: `ai-agents-chat__message-row ai-agents-chat__message-row--${msg.role}`,
    });

    // ── Bubble ──────────────────────────────────────────────────────────
    const bubble = row.createDiv({
      cls: `ai-agents-chat__message ai-agents-chat__message--${msg.role}`,
    });

    const label = bubble.createDiv({ cls: "ai-agents-chat__message-label" });
    if (msg.role === "user") {
      label.textContent = t("chat.youLabel");
    } else {
      label.textContent = agentName ?? t("chat.assistantLabel");
    }

    const contentEl = bubble.createDiv({ cls: "ai-agents-chat__message-content" });
    await MessageRenderer.render(app, msg.content, contentEl, "", component);

    // ── Action strip ─────────────────────────────────────────────────────
    // Created AFTER the bubble in DOM; CSS `order` property handles visual position.
    const actions = row.createDiv({ cls: "ai-agents-chat__message-actions" });

    // Build (or rebuild) the default button set — extracted so edit-mode can restore it.
    const buildDefaultActions = () => {
      actions.empty();

      // Copy — available on all bubbles
      const copyBtn = actions.createEl("button", {
        cls: "ai-agents-chat__msg-action-btn",
        attr: { "aria-label": t("chat.copyMessage"), title: t("chat.copyMessage") },
      });
      createIcon(copyBtn, { icon: "copy" });
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard
          .writeText(msg.content)
          .then(() => new Notice(t("chat.copiedNotice"), 1500))
          .catch(() => new Notice(t("chat.copyFailed"), 2000));
      });

      // Edit — user messages only
      if (msg.role === "user" && msgIndex !== undefined && onEdit) {
        const editBtn = actions.createEl("button", {
          cls: "ai-agents-chat__msg-action-btn",
          attr: { "aria-label": t("chat.editMessage"), title: t("chat.editMessage") },
        });
        createIcon(editBtn, { icon: "pencil" });
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          enterEditMode();
        });
      }

      // Regenerate — last assistant bubble only
      if (msg.role === "assistant" && isLast && onRegenerate) {
        const regenBtn = actions.createEl("button", {
          cls: "ai-agents-chat__msg-action-btn",
          attr: { "aria-label": t("chat.regenerate"), title: t("chat.regenerate") },
        });
        createIcon(regenBtn, { icon: "refresh-cw" });
        regenBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          onRegenerate();
        });
      }
    };

    // Edit-mode: replace content with a textarea + save/cancel buttons.
    const enterEditMode = () => {
      // Force actions visible while editing
      row.addClass("is-editing");

      // Replace content with textarea
      contentEl.empty();
      const textarea = contentEl.createEl("textarea", {
        cls: "ai-agents-chat__msg-edit-textarea",
      });
      textarea.value = msg.content;

      // Keyboard shortcuts inside textarea
      textarea.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          saveEdit();
        } else if (e.key === "Escape") {
          exitEditMode().catch(() => { /* no-op */ });
        }
      });

      // Swap action buttons to Save + Cancel
      actions.empty();

      const saveBtn = actions.createEl("button", {
        cls: "ai-agents-chat__msg-action-btn ai-agents-chat__msg-action-btn--success",
        attr: { "aria-label": t("chat.saveEdit"), title: t("chat.saveEdit") },
      });
      createIcon(saveBtn, { icon: "check" });
      saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        saveEdit();
      });

      const cancelBtn = actions.createEl("button", {
        cls: "ai-agents-chat__msg-action-btn",
        attr: { "aria-label": t("chat.cancelEdit"), title: t("chat.cancelEdit") },
      });
      createIcon(cancelBtn, { icon: "x" });
      cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exitEditMode().catch(() => { /* no-op */ });
      });

      textarea.focus();
      textarea.select();
    };

    const saveEdit = () => {
      const textarea = contentEl.querySelector("textarea") as HTMLTextAreaElement | null;
      const newContent = textarea?.value.trim() ?? "";
      // onEdit triggers a full renderMessages cycle — don't restore manually.
      if (newContent && onEdit && msgIndex !== undefined) {
        onEdit(msgIndex, newContent);
      }
    };

    const exitEditMode = async () => {
      row.removeClass("is-editing");
      contentEl.empty();
      await MessageRenderer.render(app, msg.content, contentEl, "", component);
      buildDefaultActions();
    };

    buildDefaultActions();
  }

  // ---------------------------------------------------------------------------
  // Tool message block
  // ---------------------------------------------------------------------------

  private static renderToolMessage(
    container: HTMLElement,
    msg: ChatMessage,
    findToolCallArgs?: (toolCallId?: string) => Record<string, unknown> | null,
  ): void {
    const wrapper = container.createDiv({
      cls: "ai-agents-chat__message ai-agents-chat__message--tool",
    });

    const details = wrapper.createEl("details", {
      cls: "ai-agents-chat__tool-block",
    });

    const toolArgs = findToolCallArgs ? findToolCallArgs(msg.tool_call_id) : null;
    const toolName = msg.name || t("chat.toolUnknown");

    const summary = details.createEl("summary", {
      cls: "ai-agents-chat__tool-summary",
    });

    createIcon(summary, { icon: "chevron-right", cls: "ai-agents-chat__tool-chevron" });
    createIcon(summary, { icon: "wrench", cls: "ai-agents-chat__tool-icon" });
    createText(summary, { text: toolName, cls: "ai-agents-chat__tool-name" });

    if (toolArgs) {
      const preview = ChatMessageBubble.formatArgPreview(toolArgs);
      if (preview) {
        createText(summary, { text: " " + preview, cls: "ai-agents-chat__tool-arg-preview" });
      }
    }

    const body = details.createDiv({ cls: "ai-agents-chat__tool-body" });

    if (toolArgs && Object.keys(toolArgs).length > 0) {
      createText(body, { tag: "div", text: t("chat.toolInput"), cls: "ai-agents-chat__tool-section-label" });
      const argsBlock = body.createEl("pre", { cls: "ai-agents-chat__tool-code" });
      argsBlock.createEl("code", { text: JSON.stringify(toolArgs, null, 2) });
    }

    createText(body, { tag: "div", text: t("chat.toolOutput"), cls: "ai-agents-chat__tool-section-label" });
    const resultBlock = body.createEl("pre", { cls: "ai-agents-chat__tool-code" });
    try {
      const parsed = JSON.parse(msg.content);
      resultBlock.createEl("code", { text: JSON.stringify(parsed, null, 2) });
    } catch {
      resultBlock.createEl("code", { text: msg.content });
    }
  }

  private static formatArgPreview(args: Record<string, unknown>): string {
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
