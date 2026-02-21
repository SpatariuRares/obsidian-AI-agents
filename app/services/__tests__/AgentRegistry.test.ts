/**
 * @fileoverview AgentRegistry.test.ts
 *
 * Tests the agent registry:
 *   - scan: discovers agents in subfolders via getMarkdownFiles()
 *   - getAgent / getAllAgents / getEnabledAgents
 *   - reloadAgent
 *   - graceful handling of missing folders and invalid agents
 */

import { App, TFile } from "obsidian";
import { AgentRegistry } from "@app/services/AgentRegistry";

// ---------------------------------------------------------------------------
// Sample agent.md contents
// ---------------------------------------------------------------------------

const ECHO_AGENT_MD = `---
language: "en"
name: "Echo"
avatar: "🔊"
enabled: "true"
model: "gpt_oss_free"
sources: []
---

You are an echo bot.`;

const DISABLED_AGENT_MD = `---
language: "en"
name: "Disabled Agent"
enabled: "false"
model: "llama3"
---

I am disabled.`;

const INVALID_AGENT_MD = `---
language: "en"
avatar: "💀"
---

Missing name and model.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVault(
  agents: { name: string; content: string }[],
  extraFiles: TFile[] = [],
): { files: TFile[]; fileContents: Map<string, string> } {
  const files: TFile[] = [...extraFiles];
  const fileContents = new Map<string, string>();

  for (const agent of agents) {
    const agentFile = new TFile(`agents/${agent.name}/agent.md`);
    files.push(agentFile);
    fileContents.set(agentFile.path, agent.content);
  }

  return { files, fileContents };
}

function makeApp(files: TFile[], fileContents: Map<string, string>): App {
  const app = new App();
  app.vault.getMarkdownFiles = jest.fn(() => [...files]);
  app.vault.read = jest.fn(async (file: TFile) => fileContents.get(file.path) ?? "");
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentRegistry", () => {
  describe("scan()", () => {
    it("should discover and parse all valid agents", async () => {
      const { files, fileContents } = buildVault([
        { name: "echo", content: ECHO_AGENT_MD },
        { name: "disabled", content: DISABLED_AGENT_MD },
      ]);

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("agents");

      expect(registry.getAllAgents()).toHaveLength(2);
    });

    it("should skip agents with invalid config", async () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const { files, fileContents } = buildVault([
        { name: "echo", content: ECHO_AGENT_MD },
        { name: "broken", content: INVALID_AGENT_MD },
      ]);

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("agents");

      expect(registry.getAllAgents()).toHaveLength(1);
      expect(registry.getAgent("echo")).toBeDefined();
      expect(registry.getAgent("broken")).toBeUndefined();

      spy.mockRestore();
    });

    it("should handle empty vault gracefully", async () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const app = makeApp([], new Map());
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("nonexistent");

      expect(registry.getAllAgents()).toHaveLength(0);

      spy.mockRestore();
    });

    it("should clear previous agents on re-scan", async () => {
      const { files, fileContents } = buildVault([{ name: "echo", content: ECHO_AGENT_MD }]);

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);

      await registry.scan("agents");
      expect(registry.getAllAgents()).toHaveLength(1);

      // Simulate removing all agents by returning empty file list
      app.vault.getMarkdownFiles = jest.fn().mockReturnValue([]);
      await registry.scan("agents");
      expect(registry.getAllAgents()).toHaveLength(0);
    });

    it("should ignore files not matching <agentsFolder>/*/agent.md pattern", async () => {
      const strayFile = new TFile("agents/readme.md");
      const deepFile = new TFile("agents/nested/deep/agent.md");

      const { files, fileContents } = buildVault(
        [{ name: "echo", content: ECHO_AGENT_MD }],
        [strayFile, deepFile],
      );

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("agents");

      expect(registry.getAllAgents()).toHaveLength(1);
      expect(registry.getAgent("echo")).toBeDefined();
    });
  });

  describe("getAgent()", () => {
    it("should return the agent by its folder id", async () => {
      const { files, fileContents } = buildVault([{ name: "echo", content: ECHO_AGENT_MD }]);

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("agents");

      const agent = registry.getAgent("echo");
      expect(agent).toBeDefined();
      expect(agent!.id).toBe("echo");
      expect(agent!.config.name).toBe("Echo");
      expect(agent!.filePath).toBe("agents/echo/agent.md");
      expect(agent!.folderPath).toBe("agents/echo");
      expect(agent!.promptTemplate).toBe("You are an echo bot.");
    });

    it("should return undefined for unknown id", () => {
      const app = makeApp([], new Map());
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      expect(registry.getAgent("nonexistent")).toBeUndefined();
    });
  });

  describe("getEnabledAgents()", () => {
    it("should filter out disabled agents", async () => {
      const { files, fileContents } = buildVault([
        { name: "echo", content: ECHO_AGENT_MD },
        { name: "disabled", content: DISABLED_AGENT_MD },
      ]);

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("agents");

      const enabled = registry.getEnabledAgents();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe("echo");
    });
  });

  describe("reloadAgent()", () => {
    it("should reload a single agent from disk", async () => {
      const { files, fileContents } = buildVault([{ name: "echo", content: ECHO_AGENT_MD }]);

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("agents");

      expect(registry.getAgent("echo")!.config.name).toBe("Echo");

      // Simulate file change
      fileContents.set("agents/echo/agent.md", ECHO_AGENT_MD.replace("Echo", "Echo v2"));

      await registry.reloadAgent("echo", "agents");
      expect(registry.getAgent("echo")!.config.name).toBe("Echo v2");
    });

    it("should remove agent and throw when file is deleted", async () => {
      const { files, fileContents } = buildVault([{ name: "echo", content: ECHO_AGENT_MD }]);

      const app = makeApp(files, fileContents);
      const registry = new AgentRegistry(app, () => ({ defaultModel: "gpt-mock" }) as any);
      await registry.scan("agents");

      // Simulate file deletion — return empty list
      app.vault.getMarkdownFiles = jest.fn().mockReturnValue([]);

      await expect(registry.reloadAgent("echo", "agents")).rejects.toThrow("Agent file not found");
      expect(registry.getAgent("echo")).toBeUndefined();
    });
  });
});
