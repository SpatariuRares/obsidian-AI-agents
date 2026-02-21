/**
 * @fileoverview BaseTool - Interface that every tool must implement.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { ToolDefinition } from "@app/services/ToolHandler";

export interface BaseTool {
  definition: ToolDefinition;
  isAvailable(config: AgentConfig): boolean;
  execute(app: App, config: AgentConfig, args: Record<string, unknown>): Promise<unknown>;
}
