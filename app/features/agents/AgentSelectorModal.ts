import { App, SuggestModal } from "obsidian";
import { ParsedAgent, AgentConfig } from "@app/types/AgentTypes";
import { t } from "@app/i18n";
import { createText } from "@app/components/atoms/Text";

export const CREATE_AGENT_ID = "__CREATE__";

export class AgentSelectorModal extends SuggestModal<ParsedAgent> {
  private agents: ParsedAgent[];
  private onChoose: (agent: ParsedAgent) => void;

  constructor(app: App, agents: ParsedAgent[], onChoose: (agent: ParsedAgent) => void) {
    super(app);
    this.agents = agents;
    this.onChoose = onChoose;

    this.setPlaceholder(t("agentSelector.searchPlaceholder"));
  }

  getSuggestions(query: string): ParsedAgent[] {
    const lowerQuery = query.toLowerCase();
    const filtered = this.agents.filter(
      (agent) =>
        agent.config.name.toLowerCase().includes(lowerQuery) ||
        agent.config.description.toLowerCase().includes(lowerQuery),
    );

    const createDummy: ParsedAgent = {
      id: CREATE_AGENT_ID,
      folderPath: "",
      filePath: "",
      config: {
        name: t("agentSelector.createNewAgent"),
        avatar: "➕",
        description: t("agentSelector.createNewAgentDesc"),
      } as AgentConfig,
      promptTemplate: "",
    };

    return [createDummy, ...filtered];
  }

  renderSuggestion(agent: ParsedAgent, el: HTMLElement) {
    el.addClass("ai-agents-chat__suggestion-item");

    if (agent.id === CREATE_AGENT_ID) {
      el.addClass("ai-agents-chat__suggestion-item--create");
    }

    const titleContainer = el.createDiv({ cls: "ai-agents-chat__suggestion-title" });
    createText(titleContainer, { text: agent.config.avatar ? `${agent.config.avatar} ` : "🤖 " });
    createText(titleContainer, { text: agent.config.name, cls: "ai-agents-chat__suggestion-name" });

    if (agent.config.description) {
      createText(el, {
        tag: "div",
        text: agent.config.description,
        cls: "ai-agents-chat__suggestion-desc",
      });
    }
  }

  onChooseSuggestion(agent: ParsedAgent, _evt: MouseEvent | KeyboardEvent) {
    this.onChoose(agent);
  }
}
