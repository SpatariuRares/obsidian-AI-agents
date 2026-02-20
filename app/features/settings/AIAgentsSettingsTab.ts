/**
 * @fileoverview AIAgentsSettingsTab - Plugin settings UI
 *
 * Sections:
 *  1. AI Providers  — Ollama and OpenRouter configuration
 *  2. General       — Agents folder, user name
 *  3. Behaviour     — Default model, history, file ops limits
 *  4. Interface     — Chat position, status bar, token count
 */

import { App, Notice, Plugin, PluginSettingTab, Setting, normalizePath } from "obsidian";
import { PluginSettings } from "@app/types/PluginTypes";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { FolderSuggest } from "@app/features/common/suggest/FolderSuggest";
import { t } from "@app/i18n";
import { CONSTANTS } from "@app/constants/constants";
import { ExampleGenerator } from "@app/services/ExampleGenerator";

interface PluginWithSettings extends Plugin {
  settings: PluginSettings;
  agentRegistry: AgentRegistry;
  saveSettings(): Promise<void>;
}

/** Typed subset of Obsidian's ButtonComponent used by addButton. */
interface ButtonApi {
  setButtonText(text: string): ButtonApi;
  setCta(): ButtonApi;
  onClick(cb: () => void): ButtonApi;
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
    new Setting(containerEl).setHeading().setName(t("settings.providers.heading"));

    // --- Ollama -----------------------------------------------------------
    new Setting(containerEl)
      .setName(t("settings.providers.ollamaEnable"))
      .setDesc(t("settings.providers.ollamaEnableDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ollama.enabled).onChange(async (value) => {
          this.plugin.settings.ollama.enabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.providers.ollamaUrl"))
      .setDesc(t("settings.providers.ollamaUrlDesc"))
      .addText((text) =>
        text
          .setPlaceholder(t("settings.providers.ollamaUrlPlaceholder"))
          .setValue(this.plugin.settings.ollama.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollama.baseUrl = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- OpenRouter -------------------------------------------------------
    new Setting(containerEl)
      .setName(t("settings.providers.openrouterEnable"))
      .setDesc(t("settings.providers.openrouterEnableDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.openRouter.enabled).onChange(async (value) => {
          this.plugin.settings.openRouter.enabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.providers.openrouterApiKey"))
      .setDesc(t("settings.providers.openrouterApiKeyDesc"))
      .addText((text) =>
        text
          .setPlaceholder(t("settings.providers.openrouterApiKeyPlaceholder"))
          .setValue(this.plugin.settings.openRouter.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.openRouter.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- Default provider -------------------------------------------------
    new Setting(containerEl)
      .setName(t("settings.providers.defaultProvider"))
      .setDesc(t("settings.providers.defaultProviderDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            ollama: t("settings.providers.providerOllama"),
            openrouter: t("settings.providers.providerOpenRouter"),
          })
          .setValue(this.plugin.settings.defaultProvider)
          .onChange(async (value) => {
            this.plugin.settings.defaultProvider = value as "ollama" | "openrouter";
            await this.plugin.saveSettings();
          }),
      );

    // =======================================================================
    // SECTION: General
    // =======================================================================
    new Setting(containerEl).setHeading().setName(t("settings.general.heading"));

    new Setting(containerEl)
      .setName(t("settings.general.agentsFolder"))
      .setDesc(t("settings.general.agentsFolderDesc"))
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder(t("settings.general.agentsFolderPlaceholder"))
          .setValue(this.plugin.settings.agentsFolder)
          .onChange(async (value) => {
            this.plugin.settings.agentsFolder = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.general.userName"))
      .setDesc(t("settings.general.userNameDesc"))
      .addText((text) =>
        text
          .setPlaceholder(t("settings.general.userNamePlaceholder"))
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            this.plugin.settings.userName = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.general.createDefaultAgent"))
      .setDesc(t("settings.general.createDefaultAgentDesc"))
      .addButton((btn) =>
        (btn as unknown as ButtonApi)
          .setButtonText(t("settings.general.createDefaultAgentBtn"))
          .setCta()
          .onClick(() => {
            void ExampleGenerator.createDefaultAgent(
              this.app,
              this.plugin.settings.agentsFolder,
              this.plugin.agentRegistry,
            );
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.general.generateMockData"))
      .setDesc(t("settings.general.generateMockDataDesc"))
      .addButton((btn) =>
        (btn as unknown as ButtonApi)
          .setButtonText(t("settings.general.generateMockDataBtn"))
          .onClick(() => {
            void ExampleGenerator.generateMockData(
              this.app,
              this.plugin.settings.agentsFolder,
              this.plugin.agentRegistry,
            );
          }),
      );

    // =======================================================================
    // SECTION: Behaviour
    // =======================================================================
    new Setting(containerEl).setHeading().setName(t("settings.behaviour.heading"));

    new Setting(containerEl)
      .setName(t("settings.behaviour.defaultModel"))
      .setDesc(t("settings.behaviour.defaultModelDesc"))
      .addText((text) =>
        text
          .setPlaceholder(
            t("settings.behaviour.defaultModelPlaceholder", { defaultValue: "llama3" } as any) ||
              "llama3",
          )
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => {
            this.plugin.settings.defaultModel = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.behaviour.maxHistory"))
      .setDesc(t("settings.behaviour.maxHistoryDesc"))
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
      .setName(t("settings.behaviour.autoSave"))
      .setDesc(t("settings.behaviour.autoSaveDesc"))
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
      .setName(t("settings.behaviour.confirmDestructive"))
      .setDesc(t("settings.behaviour.confirmDestructiveDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.confirmDestructiveOps).onChange(async (value) => {
          this.plugin.settings.confirmDestructiveOps = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.behaviour.maxFileOps"))
      .setDesc(t("settings.behaviour.maxFileOpsDesc"))
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
    new Setting(containerEl).setHeading().setName(t("settings.interface.heading"));

    new Setting(containerEl)
      .setName(t("settings.interface.chatPosition"))
      .setDesc(t("settings.interface.chatPositionDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            right: t("settings.interface.chatPositionRight"),
            left: t("settings.interface.chatPositionLeft"),
            tab: t("settings.interface.chatPositionTab"),
          })
          .setValue(this.plugin.settings.chatPosition)
          .onChange(async (value) => {
            this.plugin.settings.chatPosition = value as "right" | "left" | "tab";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.interface.showStatusBar"))
      .setDesc(t("settings.interface.showStatusBarDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.interface.showTokenCount"))
      .setDesc(t("settings.interface.showTokenCountDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showTokenCount).onChange(async (value) => {
          this.plugin.settings.showTokenCount = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
