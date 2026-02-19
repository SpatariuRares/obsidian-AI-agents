/**
 * @fileoverview AgentRegistry.test.ts
 *
 * Tests the agent registry:
 *   - scan: discovers agents in subfolders
 *   - getAgent / getAllAgents / getEnabledAgents
 *   - reloadAgent
 *   - graceful handling of missing folders and invalid agents
 */

import { App, TFolder, TFile } from "obsidian";
import { AgentRegistry } from "../AgentRegistry";

// ---------------------------------------------------------------------------
// Sample agent.md contents
// ---------------------------------------------------------------------------

const ECHO_AGENT_MD = `---
metadata:
  name: "Echo"
  avatar: "🔊"
agent:
  enabled: true
  model:
    primary: "gpt_oss_free"
  parameters:
    temperature: 0
    max_tokens: 500
knowledge:
  sources: []
permissions: {}
logging:
  enabled: false
---

You are an echo bot.`;

const DISABLED_AGENT_MD = `---
metadata:
  name: "Disabled Agent"
agent:
  enabled: false
  model:
    primary: "llama3"
---

I am disabled.`;

const INVALID_AGENT_MD = `---
metadata:
  avatar: "💀"
---

Missing name and agent section.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVaultTree(
  agents: { name: string; content: string }[],
): { rootFolder: TFolder; fileMap: Map<string, TFolder | TFile>; fileContents: Map<string, string> } {
  const rootFolder = new TFolder("agents");
  const fileMap = new Map<string, TFolder | TFile>();
  const fileContents = new Map<string, string>();

  fileMap.set("agents", rootFolder);

  for (const agent of agents) {
    const subFolder = new TFolder(`agents/${agent.name}`);
    const agentFile = new TFile(`agents/${agent.name}/agent.md`);

    subFolder.children = [agentFile];
    rootFolder.children.push(subFolder);

    fileMap.set(subFolder.path, subFolder);
    fileMap.set(agentFile.path, agentFile);
    fileContents.set(agentFile.path, agent.content);
  }

  return { rootFolder, fileMap, fileContents };
}

function makeApp(
  fileMap: Map<string, TFolder | TFile>,
  fileContents: Map<string, string>,
): App {
  const app = new App();
  app.vault.getAbstractFileByPath = jest.fn((path: string) => fileMap.get(path) ?? null);
  app.vault.read = jest.fn(async (file: TFile) => fileContents.get(file.path) ?? "");
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentRegistry", () => {
  describe("scan()", () => {
    it("should discover and parse all valid agents", async () => {
      const { rootFolder, fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
        { name: "disabled", content: DISABLED_AGENT_MD },
      ]);
      // rootFolder is already in fileMap
      void rootFolder;

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);
      await registry.scan("agents");

      expect(registry.getAllAgents()).toHaveLength(2);
    });

    it("should skip agents with invalid config", async () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const { rootFolder, fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
        { name: "broken", content: INVALID_AGENT_MD },
      ]);
      void rootFolder;

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);
      await registry.scan("agents");

      expect(registry.getAllAgents()).toHaveLength(1);
      expect(registry.getAgent("echo")).toBeDefined();
      expect(registry.getAgent("broken")).toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Skipping agents/broken"));

      spy.mockRestore();
    });

    it("should handle missing agents folder gracefully", async () => {
      const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const app = new App();
      app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);

      const registry = new AgentRegistry(app);
      await registry.scan("nonexistent");

      expect(registry.getAllAgents()).toHaveLength(0);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("not found"));

      spy.mockRestore();
    });

    it("should clear previous agents on re-scan", async () => {
      const { rootFolder, fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
      ]);
      void rootFolder;

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);

      await registry.scan("agents");
      expect(registry.getAllAgents()).toHaveLength(1);

      // Simulate removing all agents
      (fileMap.get("agents") as TFolder).children = [];
      await registry.scan("agents");
      expect(registry.getAllAgents()).toHaveLength(0);
    });

    it("should skip non-folder children in agents directory", async () => {
      const { rootFolder, fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
      ]);

      // Add a stray file directly in agents/
      const strayFile = new TFile("agents/readme.md");
      rootFolder.children.push(strayFile);
      fileMap.set(strayFile.path, strayFile);

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);
      await registry.scan("agents");

      expect(registry.getAllAgents()).toHaveLength(1);
    });
  });

  describe("getAgent()", () => {
    it("should return the agent by its folder id", async () => {
      const { fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
      ]);

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);
      await registry.scan("agents");

      const agent = registry.getAgent("echo");
      expect(agent).toBeDefined();
      expect(agent!.id).toBe("echo");
      expect(agent!.config.metadata.name).toBe("Echo");
      expect(agent!.filePath).toBe("agents/echo/agent.md");
      expect(agent!.folderPath).toBe("agents/echo");
      expect(agent!.promptTemplate).toBe("You are an echo bot.");
    });

    it("should return undefined for unknown id", async () => {
      const app = new App();
      app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);

      const registry = new AgentRegistry(app);
      expect(registry.getAgent("nonexistent")).toBeUndefined();
    });
  });

  describe("getEnabledAgents()", () => {
    it("should filter out disabled agents", async () => {
      const { fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
        { name: "disabled", content: DISABLED_AGENT_MD },
      ]);

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);
      await registry.scan("agents");

      const enabled = registry.getEnabledAgents();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe("echo");
    });
  });

  describe("reloadAgent()", () => {
    it("should reload a single agent from disk", async () => {
      const { fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
      ]);

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);
      await registry.scan("agents");

      expect(registry.getAgent("echo")!.config.metadata.name).toBe("Echo");

      // Simulate file change
      fileContents.set(
        "agents/echo/agent.md",
        ECHO_AGENT_MD.replace("Echo", "Echo v2"),
      );

      await registry.reloadAgent("echo", "agents");
      expect(registry.getAgent("echo")!.config.metadata.name).toBe("Echo v2");
    });

    it("should remove agent and throw when file is deleted", async () => {
      const { fileMap, fileContents } = buildVaultTree([
        { name: "echo", content: ECHO_AGENT_MD },
      ]);

      const app = makeApp(fileMap, fileContents);
      const registry = new AgentRegistry(app);
      await registry.scan("agents");

      // Simulate file deletion
      fileMap.delete("agents/echo/agent.md");

      await expect(registry.reloadAgent("echo", "agents")).rejects.toThrow(
        "Agent file not found",
      );
      expect(registry.getAgent("echo")).toBeUndefined();
    });
  });
});
