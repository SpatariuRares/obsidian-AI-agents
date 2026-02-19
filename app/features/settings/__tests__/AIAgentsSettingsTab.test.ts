/**
 * @fileoverview AIAgentsSettingsTab.test.ts
 *
 * Tests the AIAgentsSettingsTab settings UI:
 *   - Construction and plugin reference storage
 *   - display() clears and rebuilds the panel without throwing
 *   - Re-rendering works correctly (idempotent)
 */

import { App } from "obsidian";
import { AIAgentsSettingsTab } from "../AIAgentsSettingsTab";
import { DEFAULT_SETTINGS, PluginSettings } from "@app/types/PluginTypes";

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
      expect(
        () => new AIAgentsSettingsTab(new App(), makePlugin()),
      ).not.toThrow();
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
      expect(
        (tab.containerEl as unknown as { empty: jest.Mock }).empty,
      ).toHaveBeenCalledTimes(1);
    });

    it("should not throw with default settings values", () => {
      expect(() => render()).not.toThrow();
    });

    it("should not throw when ollama is enabled", () => {
      expect(
        () => render({ ollama: { enabled: true, baseUrl: "http://localhost:11434" } }),
      ).not.toThrow();
    });

    it("should not throw when openRouter is enabled with API key", () => {
      expect(
        () => render({ openRouter: { enabled: true, apiKey: "sk-or-test" } }),
      ).not.toThrow();
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
      expect(
        (tab.containerEl as unknown as { empty: jest.Mock }).empty,
      ).toHaveBeenCalledTimes(2);
    });
  });
});
