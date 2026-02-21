import { requestUrl, RequestUrlParam } from "obsidian";
import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { BaseProvider, ProviderResponse } from "@app/services/providers/BaseProvider";
import { ToolHandler } from "@app/services/ToolHandler";

interface ExtractedToolCalls {
  tool_calls: any[];
  cleanedText: string;
}

export class OpenAilikeProvider extends BaseProvider {
  /**
   * Attempts to extract tool calls from response text when the model outputs them
   * as plain JSON instead of using the structured tool_calls field.
   * Only matches tool names that were actually sent in the request to avoid false positives.
   */
  static extractToolCallsFromText(
    text: string,
    toolNames: string[],
  ): ExtractedToolCalls | null {
    if (!text || toolNames.length === 0) return null;

    // Quick check: does the text contain any known tool name?
    const hasToolName = toolNames.some((name) => text.includes(`"${name}"`));
    if (!hasToolName) return null;

    // Find JSON structures by scanning for [ or { and using balanced bracket counting
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== "[" && text[i] !== "{") continue;

      const jsonStr = OpenAilikeProvider.findBalancedJson(text, i);
      if (!jsonStr) continue;

      try {
        let parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) parsed = [parsed];

        const validCalls = parsed.filter(
          (item: any) =>
            item &&
            typeof item.name === "string" &&
            toolNames.includes(item.name) &&
            item.arguments !== undefined,
        );

        if (validCalls.length === 0) continue;

        const tool_calls = validCalls.map((call: any, index: number) => ({
          id: `fallback_${Date.now()}_${index}`,
          type: "function" as const,
          function: {
            name: call.name,
            arguments:
              typeof call.arguments === "string"
                ? call.arguments
                : JSON.stringify(call.arguments),
          },
        }));

        const end = i + jsonStr.length;
        const cleanedText = (text.substring(0, i) + text.substring(end)).trim();
        return { tool_calls, cleanedText };
      } catch {
        // Not valid JSON at this position, try next
      }
    }

    return null;
  }

  /**
   * Finds a balanced JSON structure (object or array) starting at the given position.
   * Handles nested braces/brackets and string escaping.
   */
  private static findBalancedJson(text: string, start: number): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const c = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === "\\" && inString) {
        escaped = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (c === "{" || c === "[") depth++;
      if (c === "}" || c === "]") depth--;

      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    }

    return null;
  }

  async chat(
    messages: ChatMessage[],
    config: AgentConfig,
    settings: PluginSettings,
    onStream?: (chunk: string) => void,
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
      stream: config.stream === true,
    };

    const availableTools = ToolHandler.getAvailableTools(config);
    const toolNames = availableTools.map((t) => t.name);
    if (availableTools.length > 0) {
      payload.tools = availableTools.map((t) => ({ type: "function", function: t }));
      payload.tool_choice = "auto";
    }

    if (config.stream) {
      payload.stream_options = { include_usage: true };
    }

    if (config.stream && onStream) {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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
                function: { name: toolCall.function?.name || "", arguments: "" },
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
            totalTokens: data.usage.total_tokens || 0,
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

      let tool_calls: any[] | undefined =
        Object.keys(toolCallsMap).length > 0 ? Object.values(toolCallsMap) : undefined;

      // Fallback: if model output tool calls as plain text instead of structured calls
      if (!tool_calls && toolNames.length > 0) {
        const extracted = OpenAilikeProvider.extractToolCallsFromText(fullText, toolNames);
        if (extracted) {
          tool_calls = extracted.tool_calls;
          fullText = extracted.cleanedText;
        }
      }

      return { text: fullText, usage, tool_calls };
    }

    // --- Non-streaming fallback using Obsidian's requestUrl (bypasses CORS) ---
    payload.stream = false;

    const requestParams: RequestUrlParam = {
      url: baseUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
    let text: string = data.choices?.[0]?.message?.content || "";
    let tool_calls: any[] | undefined = data.choices?.[0]?.message?.tool_calls;

    // Fallback: if model output tool calls as plain text instead of structured calls
    if (!tool_calls && toolNames.length > 0) {
      const extracted = OpenAilikeProvider.extractToolCallsFromText(text, toolNames);
      if (extracted) {
        tool_calls = extracted.tool_calls;
        text = extracted.cleanedText;
      }
    }

    let usage: import("@app/types/AgentTypes").TokenUsage | undefined;
    if (data.usage) {
      usage = {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      };
    }

    return { text, usage, tool_calls };
  }
}
