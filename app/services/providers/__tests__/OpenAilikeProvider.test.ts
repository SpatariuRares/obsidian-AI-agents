import { OpenAilikeProvider } from "../OpenAilikeProvider";
import { ChatMessage, AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings, DEFAULT_SETTINGS } from "@app/types/PluginTypes";
import { requestUrl } from "obsidian";

jest.mock("obsidian", () => ({
    requestUrl: jest.fn(),
    Modal: class { },
    Setting: class {
        addButton() { return this; }
        setButtonText() { return this; }
        setCta() { return this; }
        onClick() { return this; }
        setWarning() { return this; }
    }
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
        if (global.fetch && typeof (global.fetch as any).mockReset === 'function') {
            (global.fetch as jest.Mock).mockReset();
        }
    });

    it("should use requestUrl when stream is false", async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: {
                choices: [{ message: { content: "Hello from OpenRouter!" } }]
            }
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
                controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"content\":\"Chunk 1\"}}]}\n\n"));
                controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"content\":\" Chunk 2\"}}]}\n\n"));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
            }
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            body: stream
        });

        const response = await provider.chat(mockMessages, mockConfig, mockSettings, mockOnStream);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(requestUrl).not.toHaveBeenCalled();
        expect(mockOnStream).toHaveBeenCalledTimes(2);
        expect(mockOnStream).toHaveBeenNthCalledWith(1, "Chunk 1");
        expect(mockOnStream).toHaveBeenNthCalledWith(2, " Chunk 2");
        expect(response.text).toBe("Chunk 1 Chunk 2");
    });
});
