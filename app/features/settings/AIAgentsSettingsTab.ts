/**
 * @fileoverview AIAgentsSettingsTab - Plugin settings UI
 *
 * Sections:
 *  1. AI Providers  — Ollama and OpenRouter configuration
 *  2. General       — Agents folder, user name
 *  3. Behaviour     — Default model, history, file ops limits
 *  4. Interface     — Chat position, status bar, token count
 */

import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { PluginSettings } from "@app/types/PluginTypes";
import { FolderSuggest } from "@app/features/common/suggest/FolderSuggest";

interface PluginWithSettings extends Plugin {
  settings: PluginSettings;
  saveSettings(): Promise<void>;
}

export class AIAgentsSettingsTab extends PluginSettingTab {
  plugin: PluginWithSettings;

  constructor(app: App, plugin: PluginWithSettings) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // =======================================================================
    // SECTION: AI Providers
    // =======================================================================
    new Setting(containerEl).setHeading().setName("AI providers");

    // --- Ollama -----------------------------------------------------------
    new Setting(containerEl)
      .setName("Enable Ollama")
      .setDesc("Use a local Ollama instance for AI inference.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ollama.enabled)
          .onChange(async (value) => {
            this.plugin.settings.ollama.enabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Ollama server URL")
      .setDesc("Base URL of your Ollama server.")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:11434")
          .setValue(this.plugin.settings.ollama.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollama.baseUrl = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- OpenRouter -------------------------------------------------------
    new Setting(containerEl)
      .setName("Enable OpenRouter")
      .setDesc(
        "Use OpenRouter to access multiple AI models via a single API key.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openRouter.enabled)
          .onChange(async (value) => {
            this.plugin.settings.openRouter.enabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("OpenRouter API key")
      .setDesc("Your OpenRouter API key. Stored locally in the plugin data.")
      .addText((text) =>
        text
          .setPlaceholder("sk-or-...")
          .setValue(this.plugin.settings.openRouter.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.openRouter.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- Default provider -------------------------------------------------
    new Setting(containerEl)
      .setName("Default provider")
      .setDesc("Provider used when an agent does not specify one.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            ollama: "Ollama",
            openrouter: "OpenRouter",
          })
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value) => {
            this.plugin.settings.defaultProvider = value as
              | "ollama"
              | "openrouter";
            await this.plugin.saveSettings();
          }),
      );

    // =======================================================================
    // SECTION: General
    // =======================================================================
    new Setting(containerEl).setHeading().setName("General");

    new Setting(containerEl)
      .setName("Agents folder")
      .setDesc(
        "Path relative to vault root where agent definitions are stored.",
      )
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder("agents")
          .setValue(this.plugin.settings.agentsFolder)
          .onChange(async (value) => {
            this.plugin.settings.agentsFolder = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("User name")
      .setDesc("Your name, available as {{user_name}} in agent prompts.")
      .addText((text) =>
        text
          .setPlaceholder("Enter your name")
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            this.plugin.settings.userName = value;
            await this.plugin.saveSettings();
          }),
      );

    // =======================================================================
    // SECTION: Behaviour
    // =======================================================================
    new Setting(containerEl).setHeading().setName("Behaviour");

    new Setting(containerEl)
      .setName("Default model")
      .setDesc(
        "Model identifier used when an agent does not specify one (e.g. llama3, mistral).",
      )
      .addText((text) =>
        text
          .setPlaceholder("llama3")
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => {
            this.plugin.settings.defaultModel = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max history messages")
      .setDesc("Number of messages to keep in the conversation context.")
      .addText((text) =>
        text
          .setPlaceholder("50")
          .setValue(String(this.plugin.settings.maxHistoryMessages))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 0) {
              this.plugin.settings.maxHistoryMessages = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Auto-save interval")
      .setDesc("Seconds between automatic log saves (0 to disable).")
      .addText((text) =>
        text
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.autoSaveInterval))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed >= 0) {
              this.plugin.settings.autoSaveInterval = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Confirm destructive operations")
      .setDesc(
        "Show a confirmation modal before agents write, move, or delete files.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.confirmDestructiveOps)
          .onChange(async (value) => {
            this.plugin.settings.confirmDestructiveOps = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max file operations per message")
      .setDesc("Rate limit: maximum file operations an agent can perform per message.")
      .addText((text) =>
        text
          .setPlaceholder("10")
          .setValue(String(this.plugin.settings.maxFileOpsPerMessage))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 0) {
              this.plugin.settings.maxFileOpsPerMessage = parsed;
              await this.plugin.saveSettings();
            }
          }),
      );

    // =======================================================================
    // SECTION: Interface
    // =======================================================================
    new Setting(containerEl).setHeading().setName("Interface");

    new Setting(containerEl)
      .setName("Chat position")
      .setDesc("Where the chat panel opens in the workspace.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            right: "Right sidebar",
            left: "Left sidebar",
            tab: "New tab",
          })
          .setValue(this.plugin.settings.chatPosition)
          .onChange(async (value) => {
            this.plugin.settings.chatPosition = value as
              | "right"
              | "left"
              | "tab";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show status bar")
      .setDesc("Display active agent info in the status bar.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showStatusBar)
          .onChange(async (value) => {
            this.plugin.settings.showStatusBar = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Show token count")
      .setDesc("Display token usage in the status bar.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTokenCount)
          .onChange(async (value) => {
            this.plugin.settings.showTokenCount = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
