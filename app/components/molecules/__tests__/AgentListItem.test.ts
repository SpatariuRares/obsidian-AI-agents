/**
 * @jest-environment jsdom
 */

import { AgentListItem } from "@app/components/molecules/AgentListItem";
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
    setText(text: string): void;
    addClass(cls: string): void;
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

HTMLElement.prototype.setText = function (text: string): void {
  this.textContent = text;
};

HTMLElement.prototype.addClass = function (cls: string): void {
  this.classList.add(cls);
};

function createAgent(overrides: Partial<ParsedAgent> = {}): ParsedAgent {
  return {
    id: "test-agent",
    folderPath: "agents/test-agent",
    filePath: "agents/test-agent/agent.md",
    config: {
      language: "en",
      name: "Test Agent",
      description: "A test agent",
      author: "tester",
      avatar: "🤖",
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
    promptTemplate: "You are a test agent.",
    ...overrides,
  };
}

describe("AgentListItem", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create a list item and append to container", () => {
    AgentListItem.render({ container, agent: createAgent(), onClick: jest.fn() });
    const item = container.querySelector(".ai-agents-sidebar__item");
    expect(item).not.toBeNull();
  });

  it("should add disabled modifier when agent is disabled", () => {
    const agent = createAgent({ config: { ...createAgent().config, enabled: false } });
    AgentListItem.render({ container, agent, onClick: jest.fn() });
    const item = container.querySelector(".ai-agents-sidebar__item");
    expect(item!.classList.contains("ai-agents-sidebar__item--disabled")).toBe(true);
  });

  it("should not add disabled modifier when agent is enabled", () => {
    AgentListItem.render({ container, agent: createAgent(), onClick: jest.fn() });
    const item = container.querySelector(".ai-agents-sidebar__item");
    expect(item!.classList.contains("ai-agents-sidebar__item--disabled")).toBe(false);
  });

  it("should render agent avatar", () => {
    AgentListItem.render({ container, agent: createAgent(), onClick: jest.fn() });
    const avatar = container.querySelector(".ai-agents-sidebar__avatar");
    expect(avatar).not.toBeNull();
    expect(avatar!.textContent).toBe("🤖");
  });

  it("should render agent name", () => {
    AgentListItem.render({ container, agent: createAgent(), onClick: jest.fn() });
    const name = container.querySelector(".ai-agents-sidebar__name");
    expect(name).not.toBeNull();
    expect(name!.textContent).toBe("Test Agent");
  });

  it("should show enabled status when agent is enabled", () => {
    AgentListItem.render({ container, agent: createAgent(), onClick: jest.fn() });
    const status = container.querySelector(".ai-agents-sidebar__status");
    expect(status).not.toBeNull();
    expect(status!.textContent).toBe("icons.enabled");
  });

  it("should show disabled status when agent is disabled", () => {
    const agent = createAgent({ config: { ...createAgent().config, enabled: false } });
    AgentListItem.render({ container, agent, onClick: jest.fn() });
    const status = container.querySelector(".ai-agents-sidebar__status");
    expect(status!.textContent).toBe("icons.disabled");
  });

  it("should render description when present", () => {
    AgentListItem.render({ container, agent: createAgent(), onClick: jest.fn() });
    const desc = container.querySelector(".ai-agents-sidebar__desc");
    expect(desc).not.toBeNull();
    expect(desc!.textContent).toBe("A test agent");
  });

  it("should not render description when absent", () => {
    const agent = createAgent({ config: { ...createAgent().config, description: "" } });
    AgentListItem.render({ container, agent, onClick: jest.fn() });
    const desc = container.querySelector(".ai-agents-sidebar__desc");
    expect(desc).toBeNull();
  });

  it("should call onClick with the agent when item is clicked", () => {
    const onClick = jest.fn();
    const agent = createAgent();
    AgentListItem.render({ container, agent, onClick });
    const item = container.querySelector(".ai-agents-sidebar__item") as HTMLElement;
    item.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(agent);
  });

  it("should use fallback avatar when emoji is empty", () => {
    const agent = createAgent({ config: { ...createAgent().config, avatar: "" } });
    AgentListItem.render({ container, agent, onClick: jest.fn() });
    const avatar = container.querySelector(".ai-agents-sidebar__avatar");
    expect(avatar!.textContent).toBe("icons.defaultAvatar");
  });
});
