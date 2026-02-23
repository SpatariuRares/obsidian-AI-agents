/**
 * @jest-environment jsdom
 */

import * as obsidian from "obsidian";
import { ChatHeader, ChatHeaderProps } from "@app/components/molecules/ChatHeader";
import { ParsedAgent, AgentType, AgentStrategy } from "@app/types/AgentTypes";

jest.mock("@app/i18n", () => ({
  t: (key: string) => key,
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

function createAgent(overrides: Partial<ParsedAgent> = {}): ParsedAgent {
  return {
    id: "writer",
    folderPath: "agents/writer",
    filePath: "agents/writer/agent.md",
    config: {
      language: "en",
      name: "Writer",
      description: "Writes things",
      author: "tester",
      avatar: "✍️",
      enabled: true,
      type: AgentType.CONVERSATIONAL,
      provider: "openai",
      model: "gpt-4",
      stream: true,
      sources: [],
      strategy: AgentStrategy.INJECT_ALL,
      max_context_tokens: 4096,
      tools: [],
      read: [],
      write: [],
      create: [],
      move: [],
      delete: [],
      vault_root_access: false,
      confirm_destructive: true,
      memory: false,
    },
    promptTemplate: "",
    ...overrides,
  };
}

function createProps(overrides: Partial<ChatHeaderProps> = {}): ChatHeaderProps {
  return {
    onSelectAgent: jest.fn(),
    onEditAgent: jest.fn(),
    onOpenHistory: jest.fn(),
    onRenameSession: jest.fn(),
    onNewSession: jest.fn(),
    ...overrides,
  };
}

describe("ChatHeader", () => {
  let parent: HTMLElement;
  let setIconSpy: jest.SpyInstance;

  beforeEach(() => {
    parent = document.createElement("div");
    setIconSpy = jest.spyOn(obsidian, "setIcon");
  });

  afterEach(() => {
    setIconSpy.mockRestore();
  });

  it("should create a header container", () => {
    new ChatHeader(parent, createProps());
    const header = parent.querySelector(".ai-agents-chat__header");
    expect(header).not.toBeNull();
  });

  it("should create agent select button with default text", () => {
    new ChatHeader(parent, createProps());
    const btn = parent.querySelector(".ai-agents-chat__agent-select-btn");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("chat.chooseAgent");
  });

  it("should create edit agent button (hidden by default)", () => {
    new ChatHeader(parent, createProps());
    const btn = parent.querySelector(".ai-agents-chat__edit-agent") as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.style.display).toBe("none");
  });

  it("should create history button (hidden by default)", () => {
    new ChatHeader(parent, createProps());
    const btn = parent.querySelector(".ai-agents-chat__history-btn") as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.style.display).toBe("none");
  });

  it("should create rename button (hidden by default)", () => {
    new ChatHeader(parent, createProps());
    const btn = parent.querySelector(".ai-agents-chat__rename-btn") as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.style.display).toBe("none");
  });

  it("should create new session button (visible)", () => {
    new ChatHeader(parent, createProps());
    const btn = parent.querySelector(".ai-agents-chat__new-session");
    expect(btn).not.toBeNull();
  });

  it("should call onSelectAgent when agent select button is clicked", () => {
    const props = createProps();
    new ChatHeader(parent, props);
    const btn = parent.querySelector(".ai-agents-chat__agent-select-btn") as HTMLButtonElement;
    btn.click();
    expect(props.onSelectAgent).toHaveBeenCalledTimes(1);
  });

  it("should call onNewSession when new session button is clicked", () => {
    const props = createProps();
    new ChatHeader(parent, props);
    const btn = parent.querySelector(".ai-agents-chat__new-session") as HTMLButtonElement;
    btn.click();
    expect(props.onNewSession).toHaveBeenCalledTimes(1);
  });

  describe("refreshAgentSelectBtn", () => {
    it("should show agent name and avatar when agent is set", () => {
      const header = new ChatHeader(parent, createProps());
      header.refreshAgentSelectBtn(createAgent());
      const btn = parent.querySelector(".ai-agents-chat__agent-select-btn");
      expect(btn!.textContent).toBe("✍️ Writer");
    });

    it("should show edit button when agent is set", () => {
      const header = new ChatHeader(parent, createProps());
      header.refreshAgentSelectBtn(createAgent());
      const editBtn = parent.querySelector(".ai-agents-chat__edit-agent") as HTMLElement;
      expect(editBtn.style.display).toBe("flex");
    });

    it("should reset to default text when agent is null", () => {
      const header = new ChatHeader(parent, createProps());
      header.refreshAgentSelectBtn(createAgent());
      header.refreshAgentSelectBtn(null);
      const btn = parent.querySelector(".ai-agents-chat__agent-select-btn");
      expect(btn!.textContent).toBe("chat.chooseAgent");
    });

    it("should hide edit button when agent is null", () => {
      const header = new ChatHeader(parent, createProps());
      header.refreshAgentSelectBtn(createAgent());
      header.refreshAgentSelectBtn(null);
      const editBtn = parent.querySelector(".ai-agents-chat__edit-agent") as HTMLElement;
      expect(editBtn.style.display).toBe("none");
    });

    it("should handle agent with no avatar", () => {
      const agent = createAgent({ config: { ...createAgent().config, avatar: "" } });
      const header = new ChatHeader(parent, createProps());
      header.refreshAgentSelectBtn(agent);
      const btn = parent.querySelector(".ai-agents-chat__agent-select-btn");
      expect(btn!.textContent).toBe("Writer");
    });
  });

  describe("setSessionActive", () => {
    it("should show history and rename buttons when active", () => {
      const header = new ChatHeader(parent, createProps());
      header.setSessionActive(true);
      const historyBtn = parent.querySelector(".ai-agents-chat__history-btn") as HTMLElement;
      const renameBtn = parent.querySelector(".ai-agents-chat__rename-btn") as HTMLElement;
      expect(historyBtn.style.display).toBe("flex");
      expect(renameBtn.style.display).toBe("flex");
    });

    it("should hide history and rename buttons when not active", () => {
      const header = new ChatHeader(parent, createProps());
      header.setSessionActive(true);
      header.setSessionActive(false);
      const historyBtn = parent.querySelector(".ai-agents-chat__history-btn") as HTMLElement;
      const renameBtn = parent.querySelector(".ai-agents-chat__rename-btn") as HTMLElement;
      expect(historyBtn.style.display).toBe("none");
      expect(renameBtn.style.display).toBe("none");
    });
  });

  describe("hide and show", () => {
    it("should hide the header container", () => {
      const header = new ChatHeader(parent, createProps());
      header.hide();
      const container = parent.querySelector(".ai-agents-chat__header") as HTMLElement;
      expect(container.style.display).toBe("none");
    });

    it("should show the header container", () => {
      const header = new ChatHeader(parent, createProps());
      header.hide();
      header.show();
      const container = parent.querySelector(".ai-agents-chat__header") as HTMLElement;
      expect(container.style.display).toBe("flex");
    });
  });
});
