import { ToolHandler } from "@app/services/ToolHandler";
import { AgentConfig, DEFAULT_CONFIG } from "@app/types/AgentTypes";

describe("ToolHandler", () => {
    it("should return empty list if no permissions are granted", () => {
        const config: AgentConfig = { ...DEFAULT_CONFIG, name: "Test", read: [], write: [], create: [], move: [], delete: [] };
        const tools = ToolHandler.getAvailableTools(config);
        expect(tools.length).toBe(0);
    });

    it("should return read and list tools when read is permitted", () => {
        const config: AgentConfig = { ...DEFAULT_CONFIG, name: "Test", read: ["**/*"] };
        const tools = ToolHandler.getAvailableTools(config);
        const names = tools.map((t: any) => t.name);
        expect(names).toContain("read_file");
        expect(names).toContain("list_files");
        expect(names).not.toContain("write_file");
    });

    it("should return all tools when all permissions are granted", () => {
        const config: AgentConfig = { ...DEFAULT_CONFIG, name: "Test", read: ["*"], write: ["*"], create: ["*"], move: ["*"], delete: ["*"] };
        const tools = ToolHandler.getAvailableTools(config);
        const names = tools.map((t: any) => t.name);
        expect(names).toContain("read_file");
        expect(names).toContain("write_file");
        expect(names).toContain("create_file");
        expect(names).toContain("move_file");
        expect(names).toContain("delete_file");
        expect(names).toContain("list_files");
    });
});
