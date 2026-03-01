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
    getFiles: jest.fn().mockReturnValue([]),
    getAbstractFileByPath: jest.fn().mockReturnValue(null),
    getFileByPath: jest.fn().mockReturnValue(null),
    read: jest.fn().mockResolvedValue(""),
    cachedRead: jest.fn().mockResolvedValue(""),
    create: jest.fn().mockResolvedValue(new TFile()),
    createFolder: jest.fn().mockResolvedValue(undefined),
  };
  workspace = {
    detachLeavesOfType: jest.fn(),
    getLeavesOfType: jest.fn().mockReturnValue([]),
    getRightLeaf: jest.fn().mockReturnValue({
      setViewState: jest.fn().mockResolvedValue(undefined),
    }),
    revealLeaf: jest.fn(),
    onLayoutReady: jest.fn((cb: () => void) => {
      cb();
    }),
  };
  metadataCache = {
    getTags: jest.fn().mockReturnValue({}),
  };
  fileManager = {
    trashFile: jest.fn().mockResolvedValue(undefined),
  };
}

/** Stub for WorkspaceLeaf. */
export class WorkspaceLeaf {
  view: unknown = null;
}

/** Stub for Modal. */
export class Modal {
  app: App;
  contentEl: HTMLElement;
  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement("div");
  }
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
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
  extension: string;
  name: string;
  stat = { mtime: 0, ctime: 0, size: 0 };
  constructor(path = "") {
    this.path = path;
    const nameWithExt = path.split("/").pop() ?? path;
    this.name = nameWithExt;
    const parts = nameWithExt.split(".");
    if (parts.length > 1) {
      this.extension = parts.pop()!;
      this.basename = parts.join(".");
    } else {
      this.extension = "";
      this.basename = nameWithExt;
    }
  }
}

/** Stub for AbstractInputSuggest — base class for input autocomplete. */
export class AbstractInputSuggest<T> {
  app: App;
  constructor(app: App, _inputEl: HTMLInputElement) {
    this.app = app;
  }
  getSuggestions(_query: string): T[] {
    return [];
  }
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

  addButton(
    cb: (btn: {
      setButtonText(text: string): unknown;
      setCta(): unknown;
      onClick(handler: () => void): unknown;
    }) => unknown,
  ): this {
    const control = {
      setButtonText: (_text: string) => control,
      setCta: () => control,
      onClick: (_handler: () => void) => control,
    };
    cb(control);
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
 * ItemView — base class for sidebar/tab views.
 */
export class ItemView {
  app: App;
  containerEl: HTMLElement;
  leaf: WorkspaceLeaf;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = new App();
    this.containerEl = document.createElement("div");
    // Obsidian uses children[1] as the content container
    this.containerEl.appendChild(document.createElement("div")); // [0] header
    this.containerEl.appendChild(document.createElement("div")); // [1] content
  }

  getViewType(): string {
    return "";
  }
  getDisplayText(): string {
    return "";
  }
  getIcon(): string {
    return "";
  }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

/** setIcon — sets a Lucide icon on an element. Stubbed as no-op. */
export function setIcon(_el: HTMLElement, _icon: string): void {}

/**
 * Plugin — base class for Obsidian plugins.
 * Methods are mocked with jest.fn() so tests can assert they were called.
 */
export class Plugin {
  app: App = new App();
  addCommand = jest.fn();
  addSettingTab = jest.fn();
  addRibbonIcon = jest.fn().mockReturnValue({});
  registerView = jest.fn();
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
const jsYaml = require("js-yaml");
export const parseYaml = jest.fn().mockImplementation((text: string): Record<string, unknown> => {
  if (!text?.trim()) return {};
  return jsYaml.load(text) as Record<string, unknown>;
});
