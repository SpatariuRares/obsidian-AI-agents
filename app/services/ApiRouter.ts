import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { BaseProvider, ProviderResponse } from "@app/services/providers/BaseProvider";
import { OpenAilikeProvider } from "@app/services/providers/OpenAilikeProvider";

export class ApiRouter {
    /**
     * Routes the chat request to the appropriate provider based on the agent config.
     */
    static async send(
        messages: ChatMessage[],
        config: AgentConfig,
        settings: PluginSettings,
        onStream?: (chunk: string) => void
    ): Promise<ProviderResponse> {
        const providerName = config.provider?.toLowerCase() || settings.defaultProvider;
        let provider: BaseProvider;

        if (providerName === "ollama" || providerName === "openrouter") {
            provider = new OpenAilikeProvider();
        } else {
            throw new Error(`Unsupported provider configured: ${providerName}. Supported: ollama, openrouter.`);
        }

        return provider.chat(messages, config, settings, onStream);
    }
}
