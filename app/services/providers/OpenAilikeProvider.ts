import { requestUrl, RequestUrlParam } from "obsidian";
import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { BaseProvider, ProviderResponse } from "@app/services/providers/BaseProvider";

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

        const payload: Record<string, unknown> = {
            model: config.model || "llama3",
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            temperature: config.temperature ?? 0.7,
            max_tokens: config.max_tokens ?? 2000,
            top_p: config.top_p ?? 0.9,
            stream: config.stream === true
        };

        if (config.stream) {
            payload.stream_options = { include_usage: true };
        }

        if (config.stream && onStream) {
            try {
                const response = await fetch(baseUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(`API Error ${response.status}: ${response.statusText}`);
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error("No ReadableStream in response");

                const decoder = new TextDecoder("utf-8");
                let fullText = "";
                let buffer = "";
                let usage: import("@app/types/AgentTypes").TokenUsage | undefined;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === "data: [DONE]") continue;

                        if (trimmed.startsWith("data: ")) {
                            try {
                                const dataStr = trimmed.slice(6);
                                // console.log("[OpenAilikeProvider] raw data string:", dataStr);
                                const data = JSON.parse(dataStr);
                                const chunkContent = data.choices?.[0]?.delta?.content || "";
                                if (chunkContent) {
                                    fullText += chunkContent;
                                    onStream(chunkContent);
                                }
                                if (data.usage) {
                                    usage = {
                                        promptTokens: data.usage.prompt_tokens || 0,
                                        completionTokens: data.usage.completion_tokens || 0,
                                        totalTokens: data.usage.total_tokens || 0
                                    };
                                }
                            } catch (err) {
                                console.warn("[OpenAilikeProvider] Failed to parse SSE line:", line, err);
                            }
                        }
                    }
                }

                // Flush remaining buffer
                if (buffer.trim().startsWith("data: ")) {
                    try {
                        const data = JSON.parse(buffer.trim().slice(6));
                        const chunkContent = data.choices?.[0]?.delta?.content || "";
                        if (chunkContent) {
                            fullText += chunkContent;
                            onStream(chunkContent);
                        }
                        if (data.usage) {
                            usage = {
                                promptTokens: data.usage.prompt_tokens || 0,
                                completionTokens: data.usage.completion_tokens || 0,
                                totalTokens: data.usage.total_tokens || 0
                            };
                        }
                    } catch (err) {
                        // ignore
                    }
                }

                return { text: fullText, usage };
            } catch (error) {
                console.error("[OpenAilikeProvider] Streaming request failed:", error);
                throw error;
            }
        }

        // --- Non-streaming fallback using Obsidian's requestUrl (bypasses CORS) ---
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

            let usage: import("@app/types/AgentTypes").TokenUsage | undefined;
            if (data.usage) {
                usage = {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0
                };
            }

            return { text, usage };
        } catch (error) {
            console.error("[OpenAilikeProvider] Chat request failed:", error);
            throw error;
        }
    }
}
