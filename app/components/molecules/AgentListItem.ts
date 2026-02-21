import { ParsedAgent } from "@app/types/AgentTypes";
import { t } from "@app/i18n";
import { createText } from "@app/components/atoms/Text";

export interface AgentListItemProps {
  container: HTMLElement;
  agent: ParsedAgent;
  onClick: (agent: ParsedAgent) => void;
}

export class AgentListItem {
  static render(props: AgentListItemProps): void {
    const { container, agent, onClick } = props;

    const item = container.createDiv({ cls: "ai-agents-sidebar__item" });
    if (!agent.config.enabled) {
      item.addClass("ai-agents-sidebar__item--disabled");
    }

    const header = item.createDiv({ cls: "ai-agents-sidebar__item-header" });

    const avatar = header.createDiv({ cls: "ai-agents-sidebar__avatar" });
    avatar.setText(agent.config.avatar || t("icons.defaultAvatar"));

    const info = header.createDiv({ cls: "ai-agents-sidebar__info" });
    createText(info, { tag: "div", text: agent.config.name, cls: "ai-agents-sidebar__name" });

    const status = header.createDiv({ cls: "ai-agents-sidebar__status" });
    if (agent.config.enabled) {
      status.setText(t("icons.enabled"));
    } else {
      status.setText(t("icons.disabled"));
    }

    if (agent.config.description) {
      createText(item, { tag: "div", text: agent.config.description, cls: "ai-agents-sidebar__desc" });
    }

    item.addEventListener("click", () => {
      onClick(agent);
    });
  }
}
