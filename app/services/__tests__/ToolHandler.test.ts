import { ToolHandler } from "@app/services/ToolHandler";
import { AgentConfig, DEFAULT_CONFIG } from "@app/types/AgentTypes";

jest.mock("obsidian", () => ({
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

describe("ToolHandler", () => {
  it("should return empty list if no permissions are granted", () => {
    const config: AgentConfig = {
      ...DEFAULT_CONFIG,
      name: "Test",
      tools: ["*"],
      read: [],
      write: [],
      create: [],
      move: [],
      delete: [],
    };
    const tools = ToolHandler.getAvailableTools(config);
    expect(tools.length).toBe(0);
  });

  it("should return read and list tools when read is permitted", () => {
    const config: AgentConfig = { ...DEFAULT_CONFIG, name: "Test", tools: ["*"], read: ["**/*"] };
    const tools = ToolHandler.getAvailableTools(config);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("list_files");
    expect(names).not.toContain("write_file");
  });

  it("should return all tools when all permissions are granted", () => {
    const config: AgentConfig = {
      ...DEFAULT_CONFIG,
      name: "Test",
      tools: ["*"],
      read: ["*"],
      write: ["*"],
      create: ["*"],
      move: ["*"],
      delete: ["*"],
    };
    const tools = ToolHandler.getAvailableTools(config);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("create_file");
    expect(names).toContain("move_file");
    expect(names).toContain("delete_file");
    expect(names).toContain("list_files");
  });

  it("should have all tool descriptions in English", () => {
    const config: AgentConfig = {
      ...DEFAULT_CONFIG,
      name: "Test",
      tools: ["*"],
      read: ["*"],
      write: ["*"],
      create: ["*"],
      move: ["*"],
      delete: ["*"],
    };
    const tools = ToolHandler.getAvailableTools(config);
    for (const tool of tools) {
      // Descriptions must not contain Italian words
      expect(tool.description).not.toMatch(/\b(Leggi|Lista|Scrivi|Crea|Sposta|Elimina|dal|nel)\b/);
      // Descriptions must be in English
      expect(tool.description).toMatch(/^[A-Z][a-zA-Z\s]+/);
    }
  });
});
