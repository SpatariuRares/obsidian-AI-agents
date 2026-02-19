/**
 * @fileoverview ExampleSettingsTab.test.ts
 *
 * Tests the ExampleSettingsTab settings UI:
 *   - Construction and plugin reference storage
 *   - display() clears and rebuilds the panel without throwing
 *   - Re-rendering works correctly (idempotent)
 *
 * Note: Obsidian's Setting class and Plugin base are provided by
 * __mocks__/obsidian.ts. The container element is a plain stub so
 * we avoid needing a real DOM in the node test environment.
 */

import { App } from "obsidian";
import { ExampleSettingsTab } from "../ExampleSettingsTab";
import { DEFAULT_SETTINGS, PluginSettings } from "@app/types/PluginTypes";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal plugin stub that satisfies PluginWithSettings. */
function makePlugin(overrides: Partial<PluginSettings> = {}) {
  return {
    app: new App(),
    settings: { ...DEFAULT_SETTINGS, ...overrides } as PluginSettings,
    saveSettings: jest.fn().mockResolvedValue(undefined),
    addCommand: jest.fn(),
    addSettingTab: jest.fn(),
    addRibbonIcon: jest.fn().mockReturnValue({}),
    registerMarkdownCodeBlockProcessor: jest.fn(),
    loadData: jest.fn().mockResolvedValue({}),
    saveData: jest.fn().mockResolvedValue(undefined),
    registerEvent: jest.fn(),
  } as unknown as Parameters<typeof ExampleSettingsTab>[1];
}

/** Minimal container stub with a spied empty() method. */
function makeContainerEl() {
  return { empty: jest.fn() } as unknown as HTMLElement;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ExampleSettingsTab", () => {
  // ── Constructor ───────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should create an instance without throwing", () => {
      expect(
        () => new ExampleSettingsTab(new App(), makePlugin()),
      ).not.toThrow();
    });

    it("should store the plugin reference on this.plugin", () => {
      const plugin = makePlugin();
      const tab = new ExampleSettingsTab(new App(), plugin);
      expect(tab.plugin).toBe(plugin);
    });

    it("should expose an app property from the base class", () => {
      const app = new App();
      const tab = new ExampleSettingsTab(app, makePlugin());
      expect(tab.app).toBe(app);
    });
  });

  // ── display() ────────────────────────────────────────────────────────────

  describe("display()", () => {
    /** Helper: build, attach a mock container, and call display(). */
    function render(overrides: Partial<PluginSettings> = {}) {
      const plugin = makePlugin(overrides);
      const tab = new ExampleSettingsTab(new App(), plugin);
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

    it("should not throw when exampleToggle is true", () => {
      expect(() => render({ exampleToggle: true })).not.toThrow();
    });

    it("should not throw with non-default exampleText", () => {
      expect(() => render({ exampleText: "custom text" })).not.toThrow();
    });

    it("should not throw when exampleDropdown is set to option2", () => {
      expect(() => render({ exampleDropdown: "option2" })).not.toThrow();
    });

    it("should not throw when exampleDropdown is set to option3", () => {
      expect(() => render({ exampleDropdown: "option3" })).not.toThrow();
    });

    it("should call containerEl.empty() twice when display() is called twice", () => {
      const plugin = makePlugin();
      const tab = new ExampleSettingsTab(new App(), plugin);
      tab.containerEl = makeContainerEl();
      tab.display();
      tab.display();
      expect(
        (tab.containerEl as unknown as { empty: jest.Mock }).empty,
      ).toHaveBeenCalledTimes(2);
    });
  });
});
