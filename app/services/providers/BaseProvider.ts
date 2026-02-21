import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";

export interface ProviderResponse {
  text: string;
  usage?: import("@app/types/AgentTypes").TokenUsage;
  tool_calls?: any[];
}

/**
 * Base abstract class for LLM providers.
 */
export abstract class BaseProvider {
  /**
   * Send a chat request to the provider's LLM endpoint.
   *
   * @param messages The chat history (including system prompt)
   * @param config The agent's specific configuration
   * @param settings The global plugin settings (contains API keys/URLs)
   * @param onStream Optional callback for streaming responses
   */
  abstract chat(
    messages: ChatMessage[],
    config: AgentConfig,
    settings: PluginSettings,
    onStream?: (chunk: string) => void,
    abortSignal?: AbortSignal,
  ): Promise<ProviderResponse>;
}
