/**
 * @fileoverview ToolHandler - Thin dispatcher that delegates to individual tool implementations.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { allTools } from "@app/services/tools/allTools";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export class ToolHandler {
  /**
   * Returns a list of tools available to the given agent based on their configured permissions.
   * If an agent lacks a permission (e.g. `write: []`), the corresponding tool is entirely omitted.
   */
  static getAvailableTools(config: AgentConfig): ToolDefinition[] {
    const explicitlyEnabled = config.tools || [];
    const hasWildcard = explicitlyEnabled.includes("*");

    return allTools
      .filter(
        (t) =>
          (hasWildcard || explicitlyEnabled.includes(t.definition.name)) && t.isAvailable(config),
      )
      .map((t) => t.definition);
  }

  /**
   * Translates a raw tool call from the LLM into the actual underlying Obsidian logic.
   * Relies on FileOperations which in turn relies on PermissionGuard and UI Modals.
   */
  static async executeTool(
    app: App,
    config: AgentConfig,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<any> {
    const tool = allTools.find((t) => t.definition.name === toolName);
    if (!tool) {
      return { success: false, error: `Tool ${toolName} not recognized.` };
    }
    try {
      return await tool.execute(app, config, args);
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
