/**
 * @fileoverview AIAgentsStatusBar - Displays the active agent and its token usage in Obsidian's status bar.
 */

import { App, Plugin } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { PluginSettings } from "@app/types/PluginTypes";

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
            })
        );
    }

    public update(): void {
        const settings = this.chatManager.getSettings();

        if (!settings.showStatusBar) {
            this.el.style.display = "none";
            return;
        }

        this.el.style.display = ""; // Reset to default (e.g. inline-block for status bar items)
        this.el.empty();

        const agent = this.chatManager.getActiveAgent();
        if (!agent) {
            // Either show nothing or "🤖 No Agent"
            this.el.setText("🤖 No Agent");
            return;
        }

        let text = `${agent.config.avatar || "🤖"} ${agent.config.name}`;

        if (settings.showTokenCount) {
            const tokens = this.chatManager.tokenTracker.getTotalTokens(agent.id);
            text += ` | 🪙 ${tokens}`;
        }

        this.el.setText(text);
    }
}
