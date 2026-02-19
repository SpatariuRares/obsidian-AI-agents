/**
 * @fileoverview main.ts - Obsidian Plugin Template Entry Point
 *
 * This is the root of your plugin. Obsidian calls onload() when the plugin is
 * enabled and onunload() when it is disabled or Obsidian closes.
 *
 * What this template demonstrates:
 *  - Loading and saving typed settings (PluginSettings / DEFAULT_SETTINGS)
 *  - Registering a command that fires a Notice
 *  - Adding a ribbon icon with a click handler
 *  - Attaching a settings tab (ExampleSettingsTab)
 *  - Registering a code block processor (ExampleView / 'example-block')
 *  - Initialising and tearing down LocalizationService
 */

import { Notice, Plugin } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "@app/types/PluginTypes";
import { ExampleSettingsTab } from "@app/features/settings/ExampleSettingsTab";
import { ExampleView } from "@app/features/example/ExampleView";
import { LocalizationService } from "@app/i18n";

// ---------------------------------------------------------------------------
// Plugin class
// ---------------------------------------------------------------------------

export default class ObsidianPluginTemplate extends Plugin {
  /**
   * Typed settings object, populated in loadSettings().
   * Declared with `!` because it is always assigned before any public method
   * runs (Obsidian calls onload() immediately after construction).
   */
  settings!: PluginSettings;

  /**
   * Reference to the ribbon icon element so we can remove it in onunload().
   * `null` when no ribbon icon has been added yet.
   */
  private ribbonIconEl: HTMLElement | null = null;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async onload(): Promise<void> {
    // 1. Load persisted settings (merge with defaults for forward-compat).
    await this.loadSettings();

    // 2. Initialise i18n — must happen before any code that calls t().
    //    LocalizationService auto-detects the user's Obsidian locale and
    //    loads the matching JSON from app/i18n/locales/.
    LocalizationService.initialize(this.app);

    // 3. Register an example command.
    //    Commands appear in the Command Palette (Ctrl/Cmd+P).
    //    See CLAUDE.md → "Commands" for callback type guidance.
    this.addCommand({
      id: "example",
      // Sentence case — Obsidian convention for command names.
      name: "Run example",
      callback: () => {
        // Notice() shows a transient toast notification.
        // Replace with your real command logic.
        new Notice("Example command fired!");
      },
    });

    // 4. Add a ribbon icon (left sidebar).
    //    The first argument is a Lucide icon name (see https://lucide.dev/).
    //    The second is the accessible tooltip text.
    this.ribbonIconEl = this.addRibbonIcon(
      "star", // Replace with an icon that matches your plugin's purpose
      "Obsidian plugin template",
      () => {
        // Replace this handler with your plugin's primary action.
        new Notice("Ribbon icon clicked!");
      },
    );

    // 5. Register the example settings tab.
    //    Obsidian calls ExampleSettingsTab.display() each time the tab opens.
    this.addSettingTab(new ExampleSettingsTab(this.app, this));

    // 6. Register the 'example-block' code block processor.
    //
    //    Users create blocks in notes like:
    //    ```example-block
    //    title: My Title
    //    color: accent
    //    ```
    //
    //    Obsidian calls this callback for every matching fenced code block.
    //    We hand off lifecycle management to ExampleView (a MarkdownRenderChild)
    //    via ctx.addChild() so onload/onunload are called at the right times.
    this.registerMarkdownCodeBlockProcessor(
      "example-block",
      (source, el, ctx) => {
        const view = new ExampleView(source, el);
        ctx.addChild(view); // Registers with Obsidian's render lifecycle
      },
    );
  }

  onunload(): void {
    // 1. Remove the ribbon icon (if one was added).
    if (this.ribbonIconEl) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }

    // 2. Tear down LocalizationService (clears loaded translations from memory).
    LocalizationService.getInstance()?.destroy();

    // Note: commands and the settings tab are cleaned up automatically by
    // Obsidian when the plugin is unloaded — no manual removal needed.
  }

  // -------------------------------------------------------------------------
  // Settings helpers
  // -------------------------------------------------------------------------

  /**
   * Load settings from Obsidian's data store.
   *
   * Object.assign merges stored data on top of DEFAULT_SETTINGS so that any
   * new fields added to PluginSettings always have sensible initial values,
   * even if the stored data predates those fields.
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Persist the current settings to Obsidian's data store.
   *
   * Call this from ExampleSettingsTab (or any other code that mutates
   * `this.settings`) to make changes survive plugin reloads.
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
