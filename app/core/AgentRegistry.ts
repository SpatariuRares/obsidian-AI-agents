/**
 * @fileoverview AgentRegistry - Scans the agents folder and manages agent lifecycle
 *
 * Startup flow:
 *   AgentRegistry.scan(agentsFolder)
 *     → for each subfolder containing agent.md
 *       → read file → AgentConfig.parseAgentFile() → store in registry
 *
 * Provides lookup by id, listing, and hot-reload per agent.
 */

import { App, TFile, TFolder, normalizePath } from "obsidian";
import { parseAgentFile, AgentConfigError } from "@app/core/AgentConfig";
import { ParsedAgent } from "@app/types/AgentTypes";

export class AgentRegistry {
  private agents: Map<string, ParsedAgent> = new Map();
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Scan the agents folder for subfolders that contain an agent.md file.
   * Each valid agent is parsed and stored in the registry.
   * Invalid agents are logged to console and skipped.
   */
  async scan(agentsFolder: string): Promise<void> {
    this.agents.clear();

    const folderPath = normalizePath(agentsFolder);
    const folder = this.app.vault.getAbstractFileByPath(folderPath);

    if (!(folder instanceof TFolder)) {
      console.warn(`[AI Agents] Agents folder not found: ${folderPath}`);
      return;
    }

    for (const child of folder.children) {
      if (!(child instanceof TFolder)) continue;

      const agentFilePath = normalizePath(`${child.path}/agent.md`);
      const agentFile = this.app.vault.getAbstractFileByPath(agentFilePath);

      if (!(agentFile instanceof TFile)) continue;

      try {
        const agent = await this.parseAgentAt(child.path, agentFile);
        this.agents.set(agent.id, agent);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[AI Agents] Skipping ${child.path}: ${msg}`);
      }
    }
  }

  /**
   * Reload a single agent by its id.
   * Reads the agent.md file again and replaces the registry entry.
   * Throws if the agent folder or file no longer exists.
   */
  async reloadAgent(id: string, agentsFolder: string): Promise<void> {
    const folderPath = normalizePath(`${agentsFolder}/${id}`);
    const agentFilePath = normalizePath(`${folderPath}/agent.md`);
    const agentFile = this.app.vault.getAbstractFileByPath(agentFilePath);

    if (!(agentFile instanceof TFile)) {
      this.agents.delete(id);
      throw new AgentConfigError(`Agent file not found: ${agentFilePath}`);
    }

    const agent = await this.parseAgentAt(folderPath, agentFile);
    this.agents.set(agent.id, agent);
  }

  getAgent(id: string): ParsedAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): ParsedAgent[] {
    return Array.from(this.agents.values());
  }

  getEnabledAgents(): ParsedAgent[] {
    return this.getAllAgents().filter((a) => a.config.agent.enabled);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async parseAgentAt(
    folderPath: string,
    file: TFile,
  ): Promise<ParsedAgent> {
    const raw = await this.app.vault.read(file);
    const { config, promptTemplate } = parseAgentFile(raw);

    // id = last segment of the folder path (e.g. "agents/writer" → "writer")
    const id = folderPath.split("/").pop() ?? folderPath;

    return {
      id,
      folderPath,
      filePath: file.path,
      config,
      promptTemplate,
    };
  }
}
