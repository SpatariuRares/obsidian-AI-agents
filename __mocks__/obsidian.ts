/**
 * @fileoverview Obsidian API mock for Jest tests.
 *
 * Maps the 'obsidian' module (which only exists at runtime inside Obsidian)
 * to lightweight class stubs so tests can import plugin code without errors.
 *
 * Jest picks up this file automatically because jest.config.js contains:
 *   moduleNameMapper: { "^obsidian$": "<rootDir>/__mocks__/obsidian.ts" }
 *
 * --- How to extend these mocks ---
 * Add new classes or methods here as you import more of the Obsidian API.
 * Keep mocks minimal — only stub what your tests actually need.
 */

/** Minimal App stub. */
export class App {
  vault = {
    getAllLoadedFiles: jest.fn().mockReturnValue([]),
    getMarkdownFiles: jest.fn().mockReturnValue([]),
    getAbstractFileByPath: jest.fn().mockReturnValue(null),
    read: jest.fn().mockResolvedValue(""),
  };
  workspace = {};
}

/** normalizePath — cleans up vault-relative paths. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

/** Stub for TFolder — represents a vault folder. */
export class TFolder {
  path: string;
  children: (TFolder | TFile)[] = [];
  constructor(path = "") {
    this.path = path;
  }
}

/** Stub for TFile — represents a vault file. */
export class TFile {
  path: string;
  basename: string;
  stat = { mtime: 0 };
  constructor(path = "") {
    this.path = path;
    this.basename = path.split("/").pop() ?? path;
  }
}

/** Stub for AbstractInputSuggest — base class for input autocomplete. */
export class AbstractInputSuggest<T> {
  app: App;
  constructor(app: App, _inputEl: HTMLInputElement) {
    this.app = app;
  }
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: HTMLElement): void {}
  selectSuggestion(_item: T): void {}
  close(): void {}
}

/**
 * Notice — shows a toast notification in Obsidian.
 * Tests can verify it was called without needing the real UI.
 */
export class Notice {
  constructor(_message: string, _timeout?: number) {}
  hide(): void {}
}

/**
 * Setting — fluent builder used to create rows in a settings tab.
 *
 * Each method returns `this` so chaining works the same as in production.
 * Callback-accepting methods (addToggle, addText, addDropdown) immediately
 * invoke their outer builder callback AND call onChange with a representative
 * test value so that onChange handler bodies execute during tests.
 */
export class Setting {
  constructor(_containerEl: unknown) {}

  setName(_name: string): this {
    return this;
  }

  setDesc(_desc: string | DocumentFragment): this {
    return this;
  }

  setHeading(): this {
    return this;
  }

  addToggle(
    cb: (toggle: {
      setValue(v: boolean): unknown;
      onChange(handler: (v: boolean) => unknown): unknown;
    }) => unknown,
  ): this {
    // Build a mock toggle control whose onChange immediately fires the handler.
    // This exercises the onChange bodies in settings tabs during tests.
    const control = {
      setValue: (_v: boolean) => control,
      onChange: (handler: (v: boolean) => unknown) => {
        void handler(false); // invoke with a safe default value
        return control;
      },
    };
    cb(control);
    return this;
  }

  addText(
    cb: (text: {
      inputEl: HTMLInputElement;
      setPlaceholder(p: string): unknown;
      setValue(v: string): unknown;
      onChange(handler: (v: string) => unknown): unknown;
    }) => unknown,
  ): this {
    const control = {
      inputEl: {} as HTMLInputElement,
      setPlaceholder: (_p: string) => control,
      setValue: (_v: string) => control,
      onChange: (handler: (v: string) => unknown) => {
        void handler(""); // invoke with a safe default value
        return control;
      },
    };
    cb(control);
    return this;
  }

  addDropdown(
    cb: (dropdown: {
      addOptions(opts: Record<string, string>): unknown;
      setValue(v: string): unknown;
      onChange(handler: (v: string) => unknown): unknown;
    }) => unknown,
  ): this {
    const control = {
      addOptions: (_opts: Record<string, string>) => control,
      setValue: (_v: string) => control,
      onChange: (handler: (v: string) => unknown) => {
        void handler("option1"); // invoke with a safe default value
        return control;
      },
    };
    cb(control);
    return this;
  }

  addButton(_cb: (btn: unknown) => unknown): this {
    return this;
  }
}

/**
 * PluginSettingTab — base class for settings tabs.
 * `containerEl` is stubbed as an empty object cast to HTMLElement
 * so it can be extended without a real DOM (node test environment).
 */
export class PluginSettingTab {
  app: App;
  containerEl = {} as HTMLElement;

  constructor(app: App, _plugin: unknown) {
    this.app = app;
  }

  display(): void {}
  hide(): void {}
}

/**
 * Plugin — base class for Obsidian plugins.
 * Methods are mocked with jest.fn() so tests can assert they were called.
 */
export class Plugin {
  app: App = new App();
  addCommand = jest.fn();
  addSettingTab = jest.fn();
  addRibbonIcon = jest.fn().mockReturnValue({});
  registerMarkdownCodeBlockProcessor = jest.fn();
  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  registerEvent = jest.fn();
}

/**
 * MarkdownRenderChild — base class for code block views.
 * Stores the container element; onload/onunload are no-ops by default.
 */
export class MarkdownRenderChild {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  onload(): void {}
  onunload(): void {}
  register(_cb: () => void): void {}
  registerEvent = jest.fn();
}

/**
 * parseYaml — parse a YAML string into a plain object.
 * Uses js-yaml (same library Obsidian uses internally) for full YAML support.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsYaml = require("js-yaml");
export const parseYaml = jest
  .fn()
  .mockImplementation((text: string): Record<string, unknown> => {
    if (!text?.trim()) return {};
    return jsYaml.load(text) as Record<string, unknown>;
  });
