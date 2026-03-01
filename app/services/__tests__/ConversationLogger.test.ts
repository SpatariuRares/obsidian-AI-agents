import { ConversationLogger } from "../ConversationLogger";
import { App, TFile, TFolder } from "obsidian";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";

describe("ConversationLogger", () => {
  let mockApp: Partial<App>;
  let logger: ConversationLogger;
  let mockVault: any;
  let mockFileManager: any;
  let mockMetadataCache: any;

  beforeEach(() => {
    mockVault = {
      getAbstractFileByPath: jest.fn(),
      create: jest.fn(),
      createFolder: jest.fn(),
      modify: jest.fn(),
      read: jest.fn(),
    };
    mockFileManager = {
      renameFile: jest.fn(),
    };
    mockMetadataCache = {
      getFileCache: jest.fn(),
    };
    mockApp = {
      vault: mockVault as any,
      fileManager: mockFileManager as any,
      metadataCache: mockMetadataCache as any,
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
      model: "test-model",
    } as any,
  };

  const mockMessages: ChatMessage[] = [
    { role: "user", content: "hello", timestamp: 0 },
    { role: "assistant", content: "world", timestamp: 1 },
  ];

  describe("saveSession", () => {
    it("should create new log file if sessionFile is null", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockResolvedValue({});

      const result = await logger.saveSession(mockAgent, null, mockMessages, "Test Chat");

      expect(mockVault.createFolder).toHaveBeenCalledWith("agents/test/logs");
      expect(mockVault.create).toHaveBeenCalled();
      const createArgs = mockVault.create.mock.calls[0];
      expect(createArgs[1]).toContain(JSON.stringify(mockMessages, null, 2));
      expect(result).toBe("agents/test/logs/Test Chat.md");
    });

    it("should modify existing file if sessionFile is provided", async () => {
      const mockFile = Object.create(TFile.prototype);
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

      await logger.saveSession(
        mockAgent,
        "agents/test/logs/Test Chat.md",
        mockMessages,
        "Test Chat",
      );

      expect(mockVault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining(JSON.stringify(mockMessages, null, 2)),
      );
    });

    it("should rename file if title changed", async () => {
      const mockFile = Object.create(TFile.prototype);
      // First call for the session path, second for checking new path existence
      mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "agents/test/logs/Old Chat.md") return mockFile;
        return null;
      });

      await logger.saveSession(mockAgent, "agents/test/logs/Old Chat.md", mockMessages, "New Chat");

      expect(mockFileManager.renameFile).toHaveBeenCalledWith(
        mockFile,
        "agents/test/logs/New Chat.md",
      );
    });
  });

  describe("loadSession", () => {
    it("should parse and return json messages from file", async () => {
      const mockFile = Object.create(TFile.prototype);
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      const jsonContent = JSON.stringify(mockMessages);
      mockVault.read.mockResolvedValue(
        `---\ntitle: "Test"\n---\n\n\`\`\`json\n${jsonContent}\n\`\`\``,
      );

      const result = await logger.loadSession("agents/test/logs/Test Chat.md");
      expect(result).toEqual(mockMessages);
    });

    it("should throw error if file not found", async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      await expect(logger.loadSession("missing.md")).rejects.toThrow();
    });
  });

  describe("getLogHistory", () => {
    it("should return sorted sessions", async () => {
      const file1 = new TFile("agents/test/logs/Session1.md", "agents/test/logs");
      file1.extension = "md";
      file1.stat = { ctime: 100, mtime: 200, size: 0, type: "file" };

      const file2 = new TFile("agents/test/logs/Session2.md", "agents/test/logs");
      file2.extension = "md";
      file2.stat = { ctime: 150, mtime: 100, size: 0, type: "file" } as any;

      const mockFolder = new TFolder("agents/test/logs");
      mockFolder.children = [file1, file2];

      mockVault.getAbstractFileByPath.mockReturnValue(mockFolder);
      mockMetadataCache.getFileCache.mockReturnValue({
        frontmatter: { title: "Custom Title", date: "2024-01-01" },
      });

      const history = await logger.getLogHistory(mockAgent);
      expect(history).toHaveLength(2);
      expect(history[0].file).toBe("agents/test/logs/Session1.md"); // Since mtime 200 > 100
      expect(history[0].title).toBe("Custom Title");
    });
  });
});
