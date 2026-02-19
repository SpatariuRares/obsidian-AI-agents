/**
 * @fileoverview ExampleSettingsTab - Plugin Settings UI
 *
 * Demonstrates Obsidian's settings API patterns.
 * Extend or replace these examples with your own plugin settings.
 *
 * Usage in main.ts:
 * ```typescript
 * this.addSettingTab(new ExampleSettingsTab(this.app, this));
 * ```
 */

import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { PluginSettings } from "@app/types/PluginTypes";

/**
 * Minimal interface for the host plugin.
 *
 * Using an interface (rather than importing the concrete class) keeps
 * ExampleSettingsTab independent of main.ts, avoids circular dependencies,
 * and makes the tab easily testable in isolation.
 *
 * Any Plugin subclass that exposes `settings` + `saveSettings()` satisfies
 * this contract — which is exactly what main.ts will provide in US-010.
 */
interface PluginWithSettings extends Plugin {
  settings: PluginSettings;
  saveSettings(): Promise<void>;
}

/**
 * ExampleSettingsTab - Demonstrates three core Obsidian settings patterns.
 *
 * Pattern 1: Toggle   — boolean on/off switch
 * Pattern 2: Text     — free-form string input
 * Pattern 3: Dropdown — constrained selection from a set of options
 *
 * All patterns follow the same rhythm:
 *   new Setting(containerEl)
 *     .setName(...)           // The visible label
 *     .setDesc(...)           // Helper text shown below the label
 *     .addXxx(control => ...) // The interactive control
 */
export class ExampleSettingsTab extends PluginSettingTab {
  // Store a typed reference to the plugin so TypeScript knows about
  // `plugin.settings` and `plugin.saveSettings()`.
  plugin: PluginWithSettings;

  constructor(app: App, plugin: PluginWithSettings) {
    // Pass both app and the plugin instance to the base class.
    // Obsidian uses the plugin reference to manage tab lifecycle.
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * display() is called by Obsidian each time the settings tab is opened.
   * Rebuild the UI from scratch on every call — Obsidian clears the container
   * before calling display(), so there is no need to clean up old elements.
   */
  display(): void {
    // `containerEl` is the root element provided by PluginSettingTab.
    // Always use `containerEl.empty()` at the top to ensure a clean slate,
    // even though Obsidian also does it — defensive programming here is cheap.
    const { containerEl } = this;
    containerEl.empty();

    // --- Section heading ---
    // Use setHeading() (not createEl("h2") or innerHTML) — Obsidian styles
    // setHeading() correctly across all themes and accessibility tools.
    new Setting(containerEl).setHeading().setName("General");

    // ----------------------------------------------------------------
    // Pattern 1: Toggle
    //
    // addToggle() is the right control for any true/false setting.
    // The `onChange` callback fires immediately when the user flips the
    // toggle, so we save settings right there — no "Save" button needed.
    // ----------------------------------------------------------------
    new Setting(containerEl)
      .setName("Example toggle")
      .setDesc("Enable or disable an example feature.")
      .addToggle((toggle) =>
        toggle
          // Seed the control with the current persisted value.
          .setValue(this.plugin.settings.exampleToggle)
          .onChange(async (value) => {
            // Write the new value into the in-memory settings object…
            this.plugin.settings.exampleToggle = value;
            // …then persist it to disk with saveSettings().
            await this.plugin.saveSettings();
          }),
      );

    // ----------------------------------------------------------------
    // Pattern 2: Text input
    //
    // addText() gives the user a single-line text field.
    // `setPlaceholder()` shows ghost text when the field is empty.
    // `onChange` fires on every keystroke; use `onChanged` for blur-only.
    // ----------------------------------------------------------------
    new Setting(containerEl)
      .setName("Example text")
      .setDesc("A free-form text setting. Customize this for your use case.")
      .addText((text) =>
        text
          .setPlaceholder("Enter some text…")
          .setValue(this.plugin.settings.exampleText)
          .onChange(async (value) => {
            this.plugin.settings.exampleText = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- Section heading for a second group of settings ---
    new Setting(containerEl).setHeading().setName("Advanced");

    // ----------------------------------------------------------------
    // Pattern 3: Dropdown (select)
    //
    // addDropdown() renders a <select> element.
    // Pass options as { value: label } pairs to addOptions().
    // The value stored in settings is the option *key*, not the label.
    // ----------------------------------------------------------------
    new Setting(containerEl)
      .setName("Example dropdown")
      .setDesc(
        "Choose one of several predefined options. " +
          "Add more entries to the addOptions() call below.",
      )
      .addDropdown((dropdown) =>
        dropdown
          // addOptions() accepts a plain object: { storedValue: "Display Label" }
          .addOptions({
            option1: "Option 1",
            option2: "Option 2",
            option3: "Option 3",
          })
          .setValue(this.plugin.settings.exampleDropdown)
          .onChange(async (value) => {
            this.plugin.settings.exampleDropdown = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
