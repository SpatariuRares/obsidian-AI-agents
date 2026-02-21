/**
 * @fileoverview AgentSidebar - ItemView representing a list of all agents.
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { ParsedAgent } from "@app/types/AgentTypes";
import { t } from "@app/i18n";
import { AgentListItem } from "@app/components/molecules/AgentListItem";

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
      AgentListItem.render({
        container,
        agent,
        onClick: (a: ParsedAgent) => {
          if (a.config.enabled) {
            this.host.startSessionAndOpenChat(a).catch(() => {
              /* no-op */
            });
          }
        },
      });
    }
  }
}
