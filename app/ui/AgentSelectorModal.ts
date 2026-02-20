import { App, SuggestModal } from "obsidian";
import { ParsedAgent } from "@app/types/AgentTypes";

export class AgentSelectorModal extends SuggestModal<ParsedAgent> {
    private agents: ParsedAgent[];
    private onChoose: (agent: ParsedAgent) => void;

    constructor(app: App, agents: ParsedAgent[], onChoose: (agent: ParsedAgent) => void) {
        super(app);
        this.agents = agents;
        this.onChoose = onChoose;

        this.setPlaceholder("Cerca un agente...");
    }

    getSuggestions(query: string): ParsedAgent[] {
        const lowerQuery = query.toLowerCase();
        return this.agents.filter((agent) =>
            agent.config.name.toLowerCase().includes(lowerQuery) ||
            agent.config.description.toLowerCase().includes(lowerQuery)
        );
    }

    renderSuggestion(agent: ParsedAgent, el: HTMLElement) {
        el.addClass("ai-agents-chat__suggestion-item");

        const titleContainer = el.createDiv({ cls: "ai-agents-chat__suggestion-title" });
        titleContainer.createSpan({ text: agent.config.avatar ? `${agent.config.avatar} ` : "🤖 " });
        titleContainer.createSpan({ text: agent.config.name, cls: "ai-agents-chat__suggestion-name" });

        if (agent.config.description) {
            el.createDiv({ text: agent.config.description, cls: "ai-agents-chat__suggestion-desc" });
        }
    }

    onChooseSuggestion(agent: ParsedAgent, _evt: MouseEvent | KeyboardEvent) {
        this.onChoose(agent);
    }
}
