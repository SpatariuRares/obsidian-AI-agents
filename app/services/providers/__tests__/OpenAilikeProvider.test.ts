import { OpenAilikeProvider } from "../OpenAilikeProvider";
import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings, DEFAULT_SETTINGS } from "@app/types/PluginTypes";
import { requestUrl } from "obsidian";

jest.mock("obsidian", () => ({
  requestUrl: jest.fn(),
  Modal: class {},
  Setting: class {
    addButton() {
      return this;
    }
    setButtonText() {
      return this;
    }
    setCta() {
      return this;
    }
    onClick() {
      return this;
    }
    setWarning() {
      return this;
    }
  },
}));

describe("OpenAilikeProvider", () => {
  let provider: OpenAilikeProvider;
  let mockSettings: PluginSettings;
  let mockConfig: AgentConfig;
  let mockMessages: ChatMessage[];

  beforeEach(() => {
    provider = new OpenAilikeProvider();
    mockSettings = { ...DEFAULT_SETTINGS };
    mockConfig = {
      name: "Test",
      provider: "openrouter",
      model: "test-model",
      stream: false,
    };
    mockMessages = [{ role: "user", content: "Hello", timestamp: Date.now() }];

    // Reset requestUrl mock
    (requestUrl as jest.Mock).mockClear();

    // Reset fetch mock if it exists
    if (global.fetch && typeof (global.fetch as any).mockReset === "function") {
      (global.fetch as jest.Mock).mockReset();
    }
  });

  it("should use requestUrl when stream is false", async () => {
    (requestUrl as jest.Mock).mockResolvedValue({
      status: 200,
      json: {
        choices: [{ message: { content: "Hello from OpenRouter!" } }],
      },
    });

    const response = await provider.chat(mockMessages, mockConfig, mockSettings);

    expect(requestUrl).toHaveBeenCalledTimes(1);
    expect(response.text).toBe("Hello from OpenRouter!");
  });

  it("should use fetch when stream is true and onStream is provided", async () => {
    mockConfig.stream = true;

    const mockOnStream = jest.fn();

    // Mock a ReadableStream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Chunk 1"}}]}\n\n'),
        );
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":" Chunk 2"}}]}\n\n'),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const response = await provider.chat(mockMessages, mockConfig, mockSettings, mockOnStream);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(requestUrl).not.toHaveBeenCalled();
    expect(mockOnStream).toHaveBeenCalledTimes(2);
    expect(mockOnStream).toHaveBeenNthCalledWith(1, "Chunk 1");
    expect(mockOnStream).toHaveBeenNthCalledWith(2, " Chunk 2");
    expect(response.text).toBe("Chunk 1 Chunk 2");
  });

  it("should include tool_choice 'auto' in payload when tools are available", async () => {
    mockConfig.read = ["*"];

    (requestUrl as jest.Mock).mockResolvedValue({
      status: 200,
      json: {
        choices: [{ message: { content: "Ok" } }],
      },
    });

    await provider.chat(mockMessages, mockConfig, mockSettings);

    const calledPayload = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
    expect(calledPayload.tools).toBeDefined();
    expect(calledPayload.tool_choice).toBe("auto");
  });

  it("should not include tool_choice when no tools are available", async () => {
    (requestUrl as jest.Mock).mockResolvedValue({
      status: 200,
      json: {
        choices: [{ message: { content: "Ok" } }],
      },
    });

    await provider.chat(mockMessages, mockConfig, mockSettings);

    const calledPayload = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
    expect(calledPayload.tools).toBeUndefined();
    expect(calledPayload.tool_choice).toBeUndefined();
  });

  describe("extractToolCallsFromText", () => {
    it("should extract a single tool call from text", () => {
      const text = 'Here is the result: {"name":"read_file","arguments":{"path":"note.md"}}';
      const result = OpenAilikeProvider.extractToolCallsFromText(text, ["read_file", "list_files"]);

      expect(result).not.toBeNull();
      expect(result!.tool_calls).toHaveLength(1);
      expect(result!.tool_calls[0].function.name).toBe("read_file");
      expect(JSON.parse(result!.tool_calls[0].function.arguments)).toEqual({ path: "note.md" });
      expect(result!.cleanedText).toBe("Here is the result:");
    });

    it("should extract tool calls from a JSON array", () => {
      const text =
        '[{"name":"read_file","arguments":{"path":"a.md"}},{"name":"list_files","arguments":{"path":"/"}}]';
      const result = OpenAilikeProvider.extractToolCallsFromText(text, ["read_file", "list_files"]);

      expect(result).not.toBeNull();
      expect(result!.tool_calls).toHaveLength(2);
      expect(result!.tool_calls[0].function.name).toBe("read_file");
      expect(result!.tool_calls[1].function.name).toBe("list_files");
    });

    it("should return null when no matching tool names are found", () => {
      const text = '{"name":"unknown_tool","arguments":{"path":"note.md"}}';
      const result = OpenAilikeProvider.extractToolCallsFromText(text, ["read_file"]);

      expect(result).toBeNull();
    });

    it("should return null for empty text", () => {
      const result = OpenAilikeProvider.extractToolCallsFromText("", ["read_file"]);
      expect(result).toBeNull();
    });

    it("should return null for empty tool names", () => {
      const result = OpenAilikeProvider.extractToolCallsFromText("some text", []);
      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      const text = '{"name":"read_file","arguments":{"path":}}}';
      const result = OpenAilikeProvider.extractToolCallsFromText(text, ["read_file"]);
      expect(result).toBeNull();
    });
  });

  it("should use fallback parser when model returns tool calls as text (non-streaming)", async () => {
    mockConfig.read = ["*"];

    (requestUrl as jest.Mock).mockResolvedValue({
      status: 200,
      json: {
        choices: [
          {
            message: {
              content:
                'I will read that file for you. {"name":"read_file","arguments":{"path":"note.md"}}',
            },
          },
        ],
      },
    });

    const response = await provider.chat(mockMessages, mockConfig, mockSettings);

    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls).toHaveLength(1);
    expect(response.tool_calls![0].function.name).toBe("read_file");
    expect(response.text).toBe("I will read that file for you.");
  });
});
