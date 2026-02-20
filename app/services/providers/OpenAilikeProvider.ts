import { requestUrl, RequestUrlParam } from "obsidian";
import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { BaseProvider, ProviderResponse } from "@app/services/providers/BaseProvider";
import { ToolHandler } from "@app/services/ToolHandler";

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
            // eslint-disable-next-line i18next/no-literal-string
            baseUrl = settings.ollama.baseUrl.replace(/\/$/, "") + "/v1/chat/completions";
            // eslint-disable-next-line i18next/no-literal-string
            apiKey = "ollama"; // Any value works for local Ollama
        } else {
            // eslint-disable-next-line i18next/no-literal-string
            baseUrl = "https://openrouter.ai/api/v1/chat/completions";
            apiKey = settings.openRouter.apiKey;
        }

        const payload: Record<string, unknown> = {
            model: config.model || "llama3",
            messages: messages.map((m) => {
                const msg: any = {
                    role: m.role,
                    content: m.content,
                };
                if (m.tool_calls) msg.tool_calls = m.tool_calls;
                if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
                if (m.name) msg.name = m.name;
                return msg;
            }),
            temperature: config.temperature ?? 0.7,
            max_tokens: config.max_tokens ?? 2000,
            top_p: config.top_p ?? 0.9,
            stream: config.stream === true
        };

        const availableTools = ToolHandler.getAvailableTools(config);
        if (availableTools.length > 0) {
            payload.tools = availableTools.map((t) => ({ type: "function", function: t }));
        }

        if (config.stream) {
            payload.stream_options = { include_usage: true };
        }

        if (config.stream && onStream) {
            const response = await fetch(baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error ${response.status}: ${response.statusText} - ${errText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No ReadableStream in response");

            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let buffer = "";
            let usage: import("@app/types/AgentTypes").TokenUsage | undefined;
            const toolCallsMap: Record<number, any> = {};

            const processData = (data: any) => {
                const delta = data.choices?.[0]?.delta;
                const chunkContent = delta?.content || "";
                if (chunkContent) {
                    fullText += chunkContent;
                    onStream(chunkContent);
                }

                if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        const index = toolCall.index;
                        if (!toolCallsMap[index]) {
                            toolCallsMap[index] = {
                                id: toolCall.id || `call_${index}`,
                                type: "function",
                                function: { name: toolCall.function?.name || "", arguments: "" }
                            };
                        }
                        if (toolCall.function?.arguments) {
                            toolCallsMap[index].function.arguments += toolCall.function.arguments;
                        }
                    }
                }

                if (data.usage) {
                    usage = {
                        promptTokens: data.usage.prompt_tokens || 0,
                        completionTokens: data.usage.completion_tokens || 0,
                        totalTokens: data.usage.total_tokens || 0
                    };
                }
            };

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
                            const data = JSON.parse(dataStr);
                            processData(data);
                        } catch {
                            // console.warn("[OpenAilikeProvider] Failed to parse SSE line:", line, _err);
                        }
                    }
                }
            }

            // Flush remaining buffer
            if (buffer.trim().startsWith("data: ")) {
                try {
                    const data = JSON.parse(buffer.trim().slice(6));
                    processData(data);
                } catch {
                    // ignore
                }
            }

            const tool_calls = Object.keys(toolCallsMap).length > 0 ? Object.values(toolCallsMap) : undefined;

            return { text: fullText, usage, tool_calls };
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

        const response = await requestUrl(requestParams);

        if (response.status !== 200) {
            // console.error("[OpenAilikeProvider] API Error Body:", response.text);
            // console.error("[OpenAilikeProvider] Sent Payload:", JSON.stringify(payload, null, 2));
            throw new Error(`API Error ${response.status}: ${response.text}`);
        }

        const data = response.json;
        const text = data.choices?.[0]?.message?.content || "";
        const tool_calls = data.choices?.[0]?.message?.tool_calls;

        let usage: import("@app/types/AgentTypes").TokenUsage | undefined;
        if (data.usage) {
            usage = {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
            };
        }

        return { text, usage, tool_calls };
    }
}
