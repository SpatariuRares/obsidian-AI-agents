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

import { App, TFile, normalizePath } from "obsidian";
import { parseAgentFile, AgentConfigError, AgentParseDefaults } from "@app/services/AgentConfig";
import { ParsedAgent } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";

export class AgentRegistry {
  private agents: Map<string, ParsedAgent> = new Map();
  private app: App;
  private settings: () => PluginSettings;

  constructor(app: App, settings: () => PluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Scan the agents folder for agent.md files.
   *
   * Uses getMarkdownFiles() to find all markdown files in the vault, then
   * filters for files matching `<agentsFolder>/`agent.md`.
   * This avoids relying on getAbstractFileByPath for folders, which can
   * fail in some Obsidian environments.
   */
  async scan(agentsFolder: string): Promise<void> {
    this.agents.clear();

    const prefix = normalizePath(agentsFolder) + "/";
    const agentFiles = this.findAgentFiles(prefix);

    if (agentFiles.length === 0) {
      // console.warn(`[AI Agents] No agent.md files found in: ${prefix}`);
      return;
    }

    for (const file of agentFiles) {
      // Extract folder path: "agents/writer/agent.md" → "agents/writer"
      const folderPath = file.path.substring(0, file.path.lastIndexOf("/"));

      try {
        const agent = await this.parseAgentAt(folderPath, file);
        this.agents.set(agent.id, agent);
      } catch (error) {
        const _msg = error instanceof Error ? error.message : String(error);
        // console.warn(`[AI Agents] Skipping ${folderPath}: ${_msg}`);
      }
    }
  }

  /**
   * Reload a single agent by its id.
   * Reads the agent.md file again and replaces the registry entry.
   * Throws if the agent file no longer exists.
   */
  async reloadAgent(id: string, agentsFolder: string): Promise<void> {
    const folderPath = normalizePath(`${agentsFolder}/${id}`);
    const agentFilePath = normalizePath(`${folderPath}/agent.md`);

    const file = this.app.vault.getMarkdownFiles().find((f) => f.path === agentFilePath);

    if (!file) {
      this.agents.delete(id);
      throw new AgentConfigError(`Agent file not found: ${agentFilePath}`);
    }

    const agent = await this.parseAgentAt(folderPath, file);
    this.agents.set(agent.id, agent);
  }

  /**
   * Find all agent.md files that are direct children of the agents folder.
   * Matches pattern: <prefix><agentId>/agent.md (exactly one level deep).
   */
  private findAgentFiles(prefix: string): TFile[] {
    return this.app.vault.getMarkdownFiles().filter((f) => {
      if (!f.path.startsWith(prefix)) return false;
      // remainder after prefix should be "<id>/agent.md" (one slash only)
      const remainder = f.path.substring(prefix.length);
      const parts = remainder.split("/");
      return parts.length === 2 && parts[1] === "agent.md";
    });
  }

  getAgent(id: string): ParsedAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): ParsedAgent[] {
    return Array.from(this.agents.values());
  }

  getEnabledAgents(): ParsedAgent[] {
    return this.getAllAgents().filter((a) => a.config.enabled);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async parseAgentAt(folderPath: string, file: TFile): Promise<ParsedAgent> {
    const raw = await this.app.vault.read(file);
    const s = this.settings();
    const defaults: AgentParseDefaults = {
      model: s.defaultModel,
      provider: s.defaultProvider,
      userName: s.userName,
    };
    const { config, promptTemplate } = parseAgentFile(raw, defaults);

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
