/**
 * @fileoverview main.ts - Obsidian AI Agents Plugin Entry Point
 *
 * Registers settings tab, commands, and UI components.
 */

import { Plugin } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "@app/types/PluginTypes";
import { AIAgentsSettingsTab } from "@app/features/settings/AIAgentsSettingsTab";
import { AgentRegistry } from "@app/core/AgentRegistry";
import { LocalizationService } from "@app/i18n";

export default class AIAgentsPlugin extends Plugin {
  settings!: PluginSettings;
  agentRegistry!: AgentRegistry;

  async onload(): Promise<void> {
    await this.loadSettings();
    LocalizationService.initialize(this.app);

    this.agentRegistry = new AgentRegistry(this.app);
    await this.agentRegistry.scan(this.settings.agentsFolder);

    this.addSettingTab(new AIAgentsSettingsTab(this.app, this));

    this.addCommand({
      id: "reload-agents",
      name: "Reload agents",
      callback: async () => {
        await this.agentRegistry.scan(this.settings.agentsFolder);
      },
    });
  }

  onunload(): void {
    LocalizationService.getInstance()?.destroy();
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      ollama: { ...DEFAULT_SETTINGS.ollama, ...stored.ollama },
      openRouter: { ...DEFAULT_SETTINGS.openRouter, ...stored.openRouter },
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
