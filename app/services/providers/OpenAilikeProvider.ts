import { requestUrl, RequestUrlParam } from "obsidian";
import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { BaseProvider, ProviderResponse } from "@app/api/providers/BaseProvider";

export class OpenAilikeProvider extends BaseProvider {
    async chat(
        messages: ChatMessage[],
        config: AgentConfig,
        settings: PluginSettings,
        onStream?: (chunk: string) => void
    ): Promise<ProviderResponse> {
        const isOllama = config.provider?.toLowerCase() === "ollama";

        let baseUrl = "";
        let apiKey = "";

        if (isOllama) {
            baseUrl = settings.ollama.baseUrl.replace(/\/$/, "") + "/v1/chat/completions";
            apiKey = "ollama"; // Any value works for local Ollama
        } else {
            baseUrl = "https://openrouter.ai/api/v1/chat/completions";
            apiKey = settings.openRouter.apiKey;
        }

        const payload: any = {
            model: config.model || "llama3",
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            temperature: config.temperature ?? 0.7,
            max_tokens: config.max_tokens ?? 2000,
            top_p: config.top_p ?? 0.9,
        };

        if (config.stream && onStream) {
            console.warn("[OpenAilikeProvider] Streaming is requested but currently disabled in favor of default requestUrl for CORS bypass.");
        }

        // For obsidian requestUrl, streaming is not natively supported in an easy iteration manner.
        payload.stream = false;

        const requestParams: RequestUrlParam = {
            url: baseUrl,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        };

        try {
            const response = await requestUrl(requestParams);

            if (response.status !== 200) {
                throw new Error(`API Error ${response.status}: ${response.text}`);
            }

            const data = response.json;
            const text = data.choices?.[0]?.message?.content || "";

            return { text };
        } catch (error) {
            console.error("[OpenAilikeProvider] Chat request failed:", error);
            throw error;
        }
    }
}
