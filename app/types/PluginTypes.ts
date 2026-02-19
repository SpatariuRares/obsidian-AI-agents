/**
 * @fileoverview PluginTypes - Core plugin type definitions
 *
 * Defines the settings interface and default configuration for the plugin.
 * Import these types in main.ts and the settings tab to ensure consistency.
 *
 * Usage:
 * ```typescript
 * import { PluginSettings, DEFAULT_SETTINGS } from '@app/types/PluginTypes';
 * ```
 */

/**
 * Plugin settings interface.
 *
 * Add new setting fields here as your plugin grows.
 * Each field should have a corresponding entry in DEFAULT_SETTINGS below.
 */
export interface PluginSettings {
  /** Example: a boolean toggle setting */
  exampleToggle: boolean;

  /** Example: a free-text input setting */
  exampleText: string;

  /**
   * Example: a dropdown/select setting.
   * Constrain valid values with a union type for stricter safety.
   */
  exampleDropdown: string;
}

/**
 * Default values for all plugin settings.
 *
 * Used in main.ts when loading settings for the first time:
 * ```typescript
 * this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
 * ```
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  exampleToggle: false,
  exampleText: "Hello, Obsidian!",
  exampleDropdown: "option1",
};
