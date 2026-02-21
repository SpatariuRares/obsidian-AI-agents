/**
 * @fileoverview MoveFileTool - move_file tool implementation.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { FileOperations } from "@app/services/FileOperations";
import { BaseTool } from "@app/services/tools/BaseTool";

export const MoveFileTool: BaseTool = {
  definition: {
    name: "move_file",
    description: "Move or rename a file",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },

  isAvailable(config: AgentConfig): boolean {
    return config.move && config.move.length > 0;
  },

  async execute(app: App, config: AgentConfig, args: Record<string, unknown>): Promise<unknown> {
    await FileOperations.moveFile(app, config, args.from as string, args.to as string);
    return { success: true, message: `File moved from ${args.from} to ${args.to}` };
  },
};
