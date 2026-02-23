/**
 * @jest-environment jsdom
 */

import { App, Component } from "obsidian";
import { ChatMessageBubble } from "@app/components/molecules/ChatMessageBubble";
import { ChatMessage } from "@app/types/AgentTypes";

jest.mock("@app/i18n", () => ({
  t: (key: string) => key,
}));

jest.mock("@app/utils/MessageRenderer", () => ({
  MessageRenderer: {
    render: jest.fn().mockResolvedValue(undefined),
  },
}));

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string; attr?: Record<string, string> },
    ): HTMLElementTagNameMap[K];
    createDiv(o?: { cls?: string }): HTMLDivElement;
    createSpan(o?: { cls?: string; text?: string }): HTMLSpanElement;
    setCssProps(props: Record<string, string>): void;
    empty(): void;
  }
}

HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  o?: { text?: string; cls?: string; attr?: Record<string, string> },
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (o?.text) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  if (o?.attr) {
    for (const [key, val] of Object.entries(o.attr)) {
      el.setAttribute(key, val);
    }
  }
  this.appendChild(el);
  return el;
};

HTMLElement.prototype.createDiv = function (o?: { cls?: string }): HTMLDivElement {
  return this.createEl("div", o);
};

HTMLElement.prototype.createSpan = function (o?: { cls?: string; text?: string }): HTMLSpanElement {
  return this.createEl("span", o);
};

HTMLElement.prototype.setCssProps = function (props: Record<string, string>): void {
  for (const [key, val] of Object.entries(props)) {
    this.style.setProperty(key, val);
  }
};

HTMLElement.prototype.empty = function (): void {
  this.innerHTML = "";
};

function createMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role: "user",
    content: "Hello world",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("ChatMessageBubble", () => {
  let app: App;
  let container: HTMLElement;
  let component: Component;

  beforeEach(() => {
    app = new App();
    container = document.createElement("div");
    component = {} as Component;
  });

  describe("user messages", () => {
    it("should render a user message bubble", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "user", content: "Hi" }),
        component,
      });
      const bubble = container.querySelector(".ai-agents-chat__message--user");
      expect(bubble).not.toBeNull();
    });

    it("should display 'you' label for user messages", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "user" }),
        component,
      });
      const label = container.querySelector(".ai-agents-chat__message-label");
      expect(label!.textContent).toBe("chat.youLabel");
    });
  });

  describe("assistant messages", () => {
    it("should render an assistant message bubble", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "assistant", content: "Hello!" }),
        component,
      });
      const bubble = container.querySelector(".ai-agents-chat__message--assistant");
      expect(bubble).not.toBeNull();
    });

    it("should display agent name as label when provided", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "assistant", content: "Hi" }),
        agentName: "Writer",
        component,
      });
      const label = container.querySelector(".ai-agents-chat__message-label");
      expect(label!.textContent).toBe("Writer");
    });

    it("should display default label when no agent name", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "assistant", content: "Hi" }),
        component,
      });
      const label = container.querySelector(".ai-agents-chat__message-label");
      expect(label!.textContent).toBe("chat.assistantLabel");
    });

    it("should skip assistant messages with only tool_calls and no content", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({
          role: "assistant",
          content: "",
          tool_calls: [{ id: "tc1", function: { name: "test" } }],
        }),
        component,
      });
      expect(container.children.length).toBe(0);
    });

    it("should render assistant messages with tool_calls when content exists", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({
          role: "assistant",
          content: "Here is the result",
          tool_calls: [{ id: "tc1" }],
        }),
        component,
      });
      const bubble = container.querySelector(".ai-agents-chat__message--assistant");
      expect(bubble).not.toBeNull();
    });
  });

  describe("tool messages", () => {
    it("should render tool message as a collapsible block", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: '{"result": "ok"}', name: "search" }),
        component,
      });
      const details = container.querySelector("details.ai-agents-chat__tool-block");
      expect(details).not.toBeNull();
    });

    it("should display tool name in summary", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "result", name: "vault_read" }),
        component,
      });
      const toolName = container.querySelector(".ai-agents-chat__tool-name");
      expect(toolName!.textContent).toBe("vault_read");
    });

    it("should use fallback label when tool name is missing", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "result" }),
        component,
      });
      const toolName = container.querySelector(".ai-agents-chat__tool-name");
      expect(toolName!.textContent).toBe("chat.toolUnknown");
    });

    it("should render tool args preview when findToolCallArgs provides args", async () => {
      const findToolCallArgs = jest.fn().mockReturnValue({ path: "notes/todo.md" });
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "read", tool_call_id: "tc1" }),
        component,
        findToolCallArgs,
      });
      expect(findToolCallArgs).toHaveBeenCalledWith("tc1");
      const preview = container.querySelector(".ai-agents-chat__tool-arg-preview");
      expect(preview).not.toBeNull();
      expect(preview!.textContent).toContain("path");
    });

    it("should render tool input section when args exist", async () => {
      const findToolCallArgs = jest.fn().mockReturnValue({ path: "test.md" });
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "read" }),
        component,
        findToolCallArgs,
      });
      const inputLabel = container.querySelector(".ai-agents-chat__tool-section-label");
      expect(inputLabel).not.toBeNull();
    });

    it("should render JSON content formatted in output section", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: '{"status":"ok"}', name: "test" }),
        component,
      });
      const codeBlocks = container.querySelectorAll(".ai-agents-chat__tool-code code");
      expect(codeBlocks.length).toBeGreaterThan(0);
      expect(codeBlocks[codeBlocks.length - 1].textContent).toContain('"status"');
    });

    it("should render non-JSON content as raw text in output section", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "plain text result", name: "test" }),
        component,
      });
      const codeBlocks = container.querySelectorAll(".ai-agents-chat__tool-code code");
      expect(codeBlocks[codeBlocks.length - 1].textContent).toBe("plain text result");
    });

    it("should not render arg preview when findToolCallArgs returns null", async () => {
      const findToolCallArgs = jest.fn().mockReturnValue(null);
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "test" }),
        component,
        findToolCallArgs,
      });
      const preview = container.querySelector(".ai-agents-chat__tool-arg-preview");
      expect(preview).toBeNull();
    });

    it("should not render arg preview when no findToolCallArgs provided", async () => {
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "test" }),
        component,
      });
      const preview = container.querySelector(".ai-agents-chat__tool-arg-preview");
      expect(preview).toBeNull();
    });
  });

  describe("formatArgPreview", () => {
    it("should truncate long values", async () => {
      const longVal = "a".repeat(50);
      const findToolCallArgs = jest.fn().mockReturnValue({ content: longVal });
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "test" }),
        component,
        findToolCallArgs,
      });
      const preview = container.querySelector(".ai-agents-chat__tool-arg-preview");
      expect(preview!.textContent).toContain("...");
    });

    it("should format non-string values with JSON.stringify", async () => {
      const findToolCallArgs = jest.fn().mockReturnValue({ count: 42, active: true });
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "test" }),
        component,
        findToolCallArgs,
      });
      const preview = container.querySelector(".ai-agents-chat__tool-arg-preview");
      expect(preview!.textContent).toContain("42");
    });

    it("should show ellipsis suffix when more than 2 args", async () => {
      const findToolCallArgs = jest.fn().mockReturnValue({ a: "1", b: "2", c: "3" });
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "test" }),
        component,
        findToolCallArgs,
      });
      const preview = container.querySelector(".ai-agents-chat__tool-arg-preview");
      expect(preview!.textContent).toContain(", ...");
    });

    it("should not render preview for empty args", async () => {
      const findToolCallArgs = jest.fn().mockReturnValue({});
      await ChatMessageBubble.render({
        app,
        container,
        msg: createMsg({ role: "tool", content: "ok", name: "test" }),
        component,
        findToolCallArgs,
      });
      const preview = container.querySelector(".ai-agents-chat__tool-arg-preview");
      expect(preview).toBeNull();
    });
  });
});
