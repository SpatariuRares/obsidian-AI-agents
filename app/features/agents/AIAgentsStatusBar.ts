/**
 * @fileoverview AIAgentsStatusBar - Displays the active agent and its token usage in Obsidian's status bar.
 */

import { Plugin } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { t } from "@app/i18n";

export class AIAgentsStatusBar {
  private el: HTMLElement;
  private chatManager: ChatManager;
  private plugin: Plugin;

  constructor(plugin: Plugin, el: HTMLElement, chatManager: ChatManager) {
    this.plugin = plugin;
    this.el = el;
    this.chatManager = chatManager;

    this.el.addClass("ai-agents-status-bar");
    this.update();

    // Listen for updates instead of polling
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("ai-agents:update" as any, () => {
        this.update();
      }),
    );
  }

  public update(): void {
    const settings = this.chatManager.getSettings();

    if (!settings.showStatusBar) {
      this.el.addClass("ai-agents-hidden");
      return;
    }

    this.el.removeClass("ai-agents-hidden");
    this.el.empty();

    const agent = this.chatManager.getActiveAgent();
    if (!agent) {
      this.el.setText(t("statusBar.noAgentWithIcon"));
      return;
    }

    let text = t("statusBar.noAgentWithIcon", {
      icon: agent.config.avatar || t("icons.defaultAgent"),
    });

    if (settings.showTokenCount) {
      const tokens = this.chatManager.tokenTracker.getTotalTokens(agent.id);
      text += t("statusBar.tokenFormat", { icon: t("icons.token"), tokens });
    }

    this.el.setText(text);
  }
}
