/**
 * @fileoverview AgentSidebar - ItemView representing a list of all agents.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { ParsedAgent } from "@app/types/AgentTypes";
import { t } from "@app/i18n";

export const VIEW_TYPE_AGENT_SIDEBAR = "ai-agents-sidebar";

export interface AgentSidebarHost {
    agentRegistry: AgentRegistry;
    startSessionAndOpenChat: (agent: ParsedAgent) => Promise<void>;
}

export class AgentSidebar extends ItemView {
    private host: AgentSidebarHost;

    constructor(leaf: WorkspaceLeaf, host: AgentSidebarHost) {
        super(leaf);
        this.host = host;
    }

    getViewType(): string {
        return VIEW_TYPE_AGENT_SIDEBAR;
    }

    getDisplayText(): string {
        return t("sidebar.title");
    }

    getIcon(): string {
        return "users";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("ai-agents-sidebar");

        container.createEl("h3", { text: t("sidebar.heading"), cls: "ai-agents-sidebar__title" });

        const agentsList = container.createDiv({ cls: "ai-agents-sidebar__list" });
        this.renderAgents(agentsList);
    }

    async onClose(): Promise<void> {
        // Cleanup if needed
    }

    private renderAgents(container: HTMLElement) {
        const agents = this.host.agentRegistry.getAllAgents();

        if (agents.length === 0) {
            container.createEl("p", { text: t("sidebar.noAgents"), cls: "ai-agents-sidebar__empty" });
            return;
        }

        for (const agent of agents) {
            const item = container.createDiv({ cls: "ai-agents-sidebar__item" });
            if (!agent.config.enabled) {
                item.addClass("ai-agents-sidebar__item--disabled");
            }

            const header = item.createDiv({ cls: "ai-agents-sidebar__item-header" });

            const avatar = header.createDiv({ cls: "ai-agents-sidebar__avatar" });
            avatar.setText(agent.config.avatar || t("icons.defaultAvatar"));

            const info = header.createDiv({ cls: "ai-agents-sidebar__info" });
            info.createDiv({ cls: "ai-agents-sidebar__name", text: agent.config.name });

            const status = header.createDiv({ cls: "ai-agents-sidebar__status" });
            if (agent.config.enabled) {
                status.setText(t("icons.enabled"));
            } else {
                status.setText(t("icons.disabled"));
            }

            if (agent.config.description) {
                item.createDiv({ cls: "ai-agents-sidebar__desc", text: agent.config.description });
            }

            item.addEventListener("click", () => {
                if (agent.config.enabled) {
                    this.host.startSessionAndOpenChat(agent).catch(() => { /* no-op */ });
                }
            });
        }
    }
}
