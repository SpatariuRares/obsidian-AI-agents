import { ConversationLogger } from "../ConversationLogger";
import { App } from "obsidian";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";

describe("ConversationLogger", () => {
    let mockApp: Partial<App>;
    let logger: ConversationLogger;
    let mockVault: any;
    let mockFileManager: any;

    beforeEach(() => {
        mockVault = {
            getAbstractFileByPath: jest.fn(),
            create: jest.fn(),
            createFolder: jest.fn(),
            append: jest.fn()
        };
        mockFileManager = {
            processFrontMatter: jest.fn(async (file, cb) => {
                const fm = { sessions: 1, total_tokens: 0 };
                cb(fm);
            })
        };
        mockApp = {
            vault: mockVault as any,
            fileManager: mockFileManager as any
        };
        logger = new ConversationLogger(mockApp as App);
    });

    const mockAgent: ParsedAgent = {
        id: "test",
        folderPath: "agents/test",
        filePath: "agents/test/agent.md",
        promptTemplate: "",
        config: {
            name: "Test Agent",
            logging_enabled: true,
            logging_path: "logs",
            model: "test-model"
        } as any
    };

    const mockUserMsg: ChatMessage = { role: "user", content: "hello", timestamp: 0 };
    const mockAsstMsg: ChatMessage = { role: "assistant", content: "world", timestamp: 0, tool_calls: [{ name: "test_tool" }] } as any;

    it("should abort if logging is disabled", async () => {
        const disabledAgent = { ...mockAgent, config: { ...mockAgent.config, logging_enabled: false } };
        await logger.appendLog(disabledAgent, mockUserMsg, mockAsstMsg);
        expect(mockVault.create).not.toHaveBeenCalled();
    });

    it("should create new log file if it doesn't exist", async () => {
        mockVault.getAbstractFileByPath.mockReturnValue(null);
        mockVault.create.mockResolvedValue({});

        await logger.appendLog(mockAgent, mockUserMsg, mockAsstMsg, { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, true);

        expect(mockVault.createFolder).toHaveBeenCalledWith('agents/test/logs');
        expect(mockVault.create).toHaveBeenCalled();
        const createArgs = mockVault.create.mock.calls[0];
        expect(createArgs[1]).toContain("total_tokens: 15");
        expect(mockVault.append).toHaveBeenCalled();
        const appendArgs = mockVault.append.mock.calls[0];
        expect(appendArgs[1]).toContain("🔧 Tool calls: test_tool");
    });

    it("should append to existing file and update frontmatter", async () => {
        const mockFile = {};
        // Simulate folder exists, file exists
        mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
            if (path.includes("logs/")) return mockFile;
            return {}; // folder exists
        });

        await logger.appendLog(mockAgent, mockUserMsg, mockAsstMsg, undefined, false);

        expect(mockVault.create).not.toHaveBeenCalled();
        expect(mockFileManager.processFrontMatter).toHaveBeenCalledWith(mockFile, expect.any(Function));
        expect(mockVault.append).toHaveBeenCalled();
    });
});
