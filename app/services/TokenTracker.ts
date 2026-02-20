/**
 * @fileoverview TokenTracker - Tracks LLM token usage across sessions for agents.
 */

import { TokenUsage } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";

export class TokenTracker {
  private settings: PluginSettings;
  private saveSettings: () => Promise<void>;

  constructor(settings: PluginSettings, saveSettings: () => Promise<void>) {
    this.settings = settings;
    this.saveSettings = saveSettings;

    if (!this.settings.agentUsage) {
      this.settings.agentUsage = {};
    }
  }

  /**
   * Updates the total tokens used by an agent and persists the settings.
   */
  async update(agentId: string, usage: TokenUsage): Promise<void> {
    if (!agentId || !usage || typeof usage.totalTokens !== "number") return;

    if (!this.settings.agentUsage[agentId]) {
      this.settings.agentUsage[agentId] = 0;
    }

    this.settings.agentUsage[agentId] += usage.totalTokens;
    await this.saveSettings();
  }

  /**
   * Retrieves the total tokens used by an agent.
   */
  getTotalTokens(agentId: string): number {
    return this.settings.agentUsage[agentId] || 0;
  }
}
