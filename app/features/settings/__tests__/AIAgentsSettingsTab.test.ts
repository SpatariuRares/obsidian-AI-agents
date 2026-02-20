/**
 * @fileoverview AIAgentsSettingsTab.test.ts
 *
 * Tests the AIAgentsSettingsTab settings UI:
 *   - Construction and plugin reference storage
 *   - display() clears and rebuilds the panel without throwing
 *   - Re-rendering works correctly (idempotent)
 */

import { App, TFile } from "obsidian";
import { AIAgentsSettingsTab } from "../AIAgentsSettingsTab";
import { DEFAULT_SETTINGS, PluginSettings } from "@app/types/PluginTypes";

// Spy on Notice to verify toast messages
const noticeSpy = jest.fn();
jest.mock("obsidian", () => {
  const actual = jest.requireActual("obsidian");
  return {
    ...actual,
    Notice: class {
      constructor(msg: string) {
        noticeSpy(msg);
      }
      hide() {}
    },
  };
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlugin(overrides: Partial<PluginSettings> = {}) {
  const base = {
    ...DEFAULT_SETTINGS,
    ...overrides,
    ollama: {
      ...DEFAULT_SETTINGS.ollama,
      ...(overrides.ollama ?? {}),
    },
    openRouter: {
      ...DEFAULT_SETTINGS.openRouter,
      ...(overrides.openRouter ?? {}),
    },
  } as PluginSettings;

  return {
    app: new App(),
    settings: base,
    agentRegistry: { scan: jest.fn().mockResolvedValue(undefined) },
    saveSettings: jest.fn().mockResolvedValue(undefined),
    addCommand: jest.fn(),
    addSettingTab: jest.fn(),
    addRibbonIcon: jest.fn().mockReturnValue({}),
    registerMarkdownCodeBlockProcessor: jest.fn(),
    loadData: jest.fn().mockResolvedValue({}),
    saveData: jest.fn().mockResolvedValue(undefined),
    registerEvent: jest.fn(),
  } as unknown as Parameters<typeof AIAgentsSettingsTab>[1];
}

function makeContainerEl() {
  return { empty: jest.fn() } as unknown as HTMLElement;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AIAgentsSettingsTab", () => {
  describe("constructor", () => {
    it("should create an instance without throwing", () => {
      expect(() => new AIAgentsSettingsTab(new App(), makePlugin())).not.toThrow();
    });

    it("should store the plugin reference on this.plugin", () => {
      const plugin = makePlugin();
      const tab = new AIAgentsSettingsTab(new App(), plugin);
      expect(tab.plugin).toBe(plugin);
    });

    it("should expose an app property from the base class", () => {
      const app = new App();
      const tab = new AIAgentsSettingsTab(app, makePlugin());
      expect(tab.app).toBe(app);
    });
  });

  describe("display()", () => {
    function render(overrides: Partial<PluginSettings> = {}) {
      const plugin = makePlugin(overrides);
      const tab = new AIAgentsSettingsTab(new App(), plugin);
      tab.containerEl = makeContainerEl();
      tab.display();
      return { plugin, tab };
    }

    it("should call containerEl.empty() once to reset the panel", () => {
      const { tab } = render();
      expect((tab.containerEl as unknown as { empty: jest.Mock }).empty).toHaveBeenCalledTimes(1);
    });

    it("should not throw with default settings values", () => {
      expect(() => render()).not.toThrow();
    });

    it("should not throw when ollama is enabled", () => {
      expect(() =>
        render({ ollama: { enabled: true, baseUrl: "http://localhost:11434" } }),
      ).not.toThrow();
    });

    it("should not throw when openRouter is enabled with API key", () => {
      expect(() => render({ openRouter: { enabled: true, apiKey: "sk-or-test" } })).not.toThrow();
    });

    it("should not throw with custom agents folder", () => {
      expect(() => render({ agentsFolder: "my-agents" })).not.toThrow();
    });

    it("should not throw with custom chat position", () => {
      expect(() => render({ chatPosition: "left" })).not.toThrow();
    });

    it("should call containerEl.empty() twice when display() is called twice", () => {
      const plugin = makePlugin();
      const tab = new AIAgentsSettingsTab(new App(), plugin);
      tab.containerEl = makeContainerEl();
      tab.display();
      tab.display();
      expect((tab.containerEl as unknown as { empty: jest.Mock }).empty).toHaveBeenCalledTimes(2);
    });
  });

  describe("createDefaultAgent()", () => {
    function makeTab(overrides: Partial<PluginSettings> = {}) {
      const app = new App();
      const plugin = makePlugin(overrides);
      const tab = new AIAgentsSettingsTab(app, plugin);
      tab.containerEl = makeContainerEl();
      return { app, plugin, tab };
    }

    beforeEach(() => {
      noticeSpy.mockClear();
    });

    it("should create the agent folder and file, then rescan registry", async () => {
      const { app, plugin, tab } = makeTab({ agentsFolder: "agents" });

      await (tab as unknown as { createDefaultAgent(): Promise<void> }).createDefaultAgent();

      expect(app.vault.createFolder).toHaveBeenCalledWith("agents");
      expect(app.vault.createFolder).toHaveBeenCalledWith("agents/assistant");
      expect(app.vault.create).toHaveBeenCalledWith(
        "agents/assistant/agent.md",
        expect.stringContaining("name:"),
      );
      expect((plugin.agentRegistry as unknown as { scan: jest.Mock }).scan).toHaveBeenCalledWith(
        "agents",
      );
      expect(noticeSpy).toHaveBeenCalledWith("notices.defaultAgentCreated");
    });

    it("should not create if agent file already exists", async () => {
      const { app, tab } = makeTab({ agentsFolder: "agents" });
      app.vault.getAbstractFileByPath = jest
        .fn()
        .mockReturnValue(new TFile("agents/assistant/agent.md"));

      await (tab as unknown as { createDefaultAgent(): Promise<void> }).createDefaultAgent();

      expect(app.vault.create).not.toHaveBeenCalled();
      expect(noticeSpy).toHaveBeenCalledWith("notices.defaultAgentExists");
    });

    it("should show error notice when vault.create fails", async () => {
      const { app, tab } = makeTab({ agentsFolder: "agents" });
      app.vault.create = jest.fn().mockRejectedValue(new Error("disk full"));

      await (tab as unknown as { createDefaultAgent(): Promise<void> }).createDefaultAgent();

      expect(noticeSpy).toHaveBeenCalledWith("notices.defaultAgentFailed");
    });

    it("should use default folder when agentsFolder is empty", async () => {
      const { app, tab } = makeTab({ agentsFolder: "" });

      await (tab as unknown as { createDefaultAgent(): Promise<void> }).createDefaultAgent();

      expect(app.vault.createFolder).toHaveBeenCalledWith("agents");
      expect(app.vault.createFolder).toHaveBeenCalledWith("agents/assistant");
    });
  });
});
