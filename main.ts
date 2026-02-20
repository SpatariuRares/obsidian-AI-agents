/**
 * @fileoverview main.ts - Obsidian AI Agents Plugin Entry Point
 *
 * Registers settings tab, chat view, commands, and ribbon icon.
 */

import { Plugin } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "@app/types/PluginTypes";
import { AIAgentsSettingsTab } from "@app/features/settings/AIAgentsSettingsTab";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { ChatManager } from "@app/services/ChatManager";
import { ChatView, VIEW_TYPE_CHAT } from "@app/features/chat/ChatView";
import { LocalizationService } from "@app/i18n";
import { AIAgentsStatusBar } from "@app/features/agents/AIAgentsStatusBar";
import { AgentSidebar, VIEW_TYPE_AGENT_SIDEBAR } from "@app/features/agents/AgentSidebar";
import { TFile } from "obsidian";

export default class AIAgentsPlugin extends Plugin {
  settings!: PluginSettings;
  agentRegistry!: AgentRegistry;
  chatManager!: ChatManager;

  async onload(): Promise<void> {
    await this.loadSettings();
    LocalizationService.initialize(this.app);

    // Core services
    this.agentRegistry = new AgentRegistry(this.app);
    this.chatManager = new ChatManager(this.app, this.settings, () => this.saveSettings());

    // Defer agent scan until vault is fully indexed
    this.app.workspace.onLayoutReady(async () => {
      await this.agentRegistry.scan(this.settings.agentsFolder);
    });

    // Status bar
    const statusBarEl = this.addStatusBarItem();
    new AIAgentsStatusBar(this, statusBarEl, this.chatManager);

    // Chat sidebar view
    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, {
      agentRegistry: this.agentRegistry,
      chatManager: this.chatManager,
    }));

    // Agent list sidebar view
    this.registerView(VIEW_TYPE_AGENT_SIDEBAR, (leaf) => new AgentSidebar(leaf, {
      agentRegistry: this.agentRegistry,
      startSessionAndOpenChat: async (agent) => {
        await this.chatManager.startSession(agent);
        await this.activateChatView();
      }
    }));

    // Hot reload agents on file modification
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (file instanceof TFile && file.path.startsWith(this.settings.agentsFolder + "/") && file.name === "agent.md") {
          const folderPath = file.path.substring(0, file.path.lastIndexOf("/"));
          const id = folderPath.split("/").pop();
          if (id) {
            try {
              await this.agentRegistry.reloadAgent(id, this.settings.agentsFolder);

              const activeAgent = this.chatManager.getActiveAgent();
              if (activeAgent && activeAgent.id === id) {
                const updated = this.agentRegistry.getAgent(id);
                if (updated) {
                  await this.chatManager.updateActiveAgent(updated);
                }
              }

              this.app.workspace.trigger("ai-agents:update" as any);
            } catch (e) {
              console.error(`[AI Agents] Hot reload failed for ${id}:`, e);
            }
          }
        }
      })
    );

    // Settings tab
    this.addSettingTab(new AIAgentsSettingsTab(this.app, this));

    // Ribbon icon — opens the chat panel
    this.addRibbonIcon("bot", "Open AI agents chat", () => {
      this.activateChatView().catch((e: Error) => console.error("Failed to activate chat view", e));
    });

    // Commands
    this.addCommand({
      id: "open-chat",
      name: "Open agent chat",
      callback: () => {
        this.activateChatView().catch((e: Error) => console.error("Failed to activate chat view", e));
      },
    });

    this.addCommand({
      id: "open-agent-sidebar",
      name: "Open agent list sidebar",
      callback: () => {
        this.activateSidebarView().catch((e: Error) => console.error("Failed to activate sidebar view", e));
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
    // L'interfaccia utente verrà gestita da Obsidian: this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
    LocalizationService.getInstance()?.destroy();
  }

  // -----------------------------------------------------------------------
  // Chat view activation
  // -----------------------------------------------------------------------

  async activateChatView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT);

    if (existing.length > 0) {
      // Already open — just reveal it
      this.app.workspace.revealLeaf(existing[0]).catch((e: Error) => console.error("Reveal leaf error:", e));
      return;
    }

    // Open in the right sidebar
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
      this.app.workspace.revealLeaf(leaf).catch((e: Error) => console.error("Reveal leaf error:", e));
    }
  }

  async activateSidebarView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_SIDEBAR);

    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]).catch((e: Error) => console.error("Reveal leaf error:", e));
      return;
    }

    // Open in the left sidebar
    const leaf = this.app.workspace.getLeftLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_AGENT_SIDEBAR, active: true });
      this.app.workspace.revealLeaf(leaf).catch((e: Error) => console.error("Reveal leaf error:", e));
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
