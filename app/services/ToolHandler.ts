/**
 * @fileoverview ToolHandler - Thin dispatcher that delegates to individual tool implementations.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { allTools } from "@app/services/tools/allTools";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export class ToolHandler {
  /**
   * Returns a list of tools available to the given agent based on their configured permissions.
   * If an agent lacks a permission (e.g. `write: []`), the corresponding tool is entirely omitted.
   */
  static getAvailableTools(config: AgentConfig): ToolDefinition[] {
    return allTools.filter((t) => t.isAvailable(config)).map((t) => t.definition);
  }

  /**
   * Translates a raw tool call from the LLM into the actual underlying Obsidian logic.
   * Relies on FileOperations which in turn relies on PermissionGuard and UI Modals.
   */
  static async executeTool(
    app: App,
    config: AgentConfig,
    toolName: string,
    args: any,
  ): Promise<any> {
    const tool = allTools.find((t) => t.definition.name === toolName);
    if (!tool) {
      return { success: false, error: `Tool ${toolName} not recognized.` };
    }
    try {
      return await tool.execute(app, config, args);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
