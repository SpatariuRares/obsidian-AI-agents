/**
 * @fileoverview main.ts - Obsidian AI Agents Plugin Entry Point
 *
 * Registers settings tab, chat view, commands, and ribbon icon.
 */

import { Plugin } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "@app/types/PluginTypes";
import { AIAgentsSettingsTab } from "@app/features/settings/AIAgentsSettingsTab";
import { AgentRegistry } from "@app/core/AgentRegistry";
import { ChatManager } from "@app/chat/ChatManager";
import { ChatView, VIEW_TYPE_CHAT } from "@app/chat/ChatView";
import { LocalizationService } from "@app/i18n";

export default class AIAgentsPlugin extends Plugin {
  settings!: PluginSettings;
  agentRegistry!: AgentRegistry;
  chatManager!: ChatManager;

  async onload(): Promise<void> {
    await this.loadSettings();
    LocalizationService.initialize(this.app);

    // Core services
    this.agentRegistry = new AgentRegistry(this.app);
    await this.agentRegistry.scan(this.settings.agentsFolder);

    this.chatManager = new ChatManager(this.app, this.settings);

    // Chat sidebar view
    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, {
      agentRegistry: this.agentRegistry,
      chatManager: this.chatManager,
    }));

    // Settings tab
    this.addSettingTab(new AIAgentsSettingsTab(this.app, this));

    // Ribbon icon — opens the chat panel
    this.addRibbonIcon("bot", "Open AI agents chat", () => {
      this.activateChatView();
    });

    // Commands
    this.addCommand({
      id: "open-chat",
      name: "Open agent chat",
      callback: () => {
        this.activateChatView();
      },
    });

    this.addCommand({
      id: "reload-agents",
      name: "Reload agents",
      callback: async () => {
        await this.agentRegistry.scan(this.settings.agentsFolder);
      },
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
    LocalizationService.getInstance()?.destroy();
  }

  // -----------------------------------------------------------------------
  // Chat view activation
  // -----------------------------------------------------------------------

  async activateChatView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    if (existing.length > 0) {
      // Already open — just reveal it
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    // Open in the right sidebar
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  // -----------------------------------------------------------------------
  // Settings helpers
  // -----------------------------------------------------------------------

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
    this.chatManager?.updateSettings(this.settings);
  }
}
