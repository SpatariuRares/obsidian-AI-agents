/**
 * @fileoverview DeleteFileTool - delete_file tool implementation.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { FileOperations } from "@app/services/FileOperations";
import { BaseTool } from "@app/services/tools/BaseTool";

export const DeleteFileTool: BaseTool = {
  definition: {
    name: "delete_file",
    description: "Delete a file from the vault",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },

  isAvailable(config: AgentConfig): boolean {
    return config.delete && config.delete.length > 0;
  },

  async execute(app: App, config: AgentConfig, args: Record<string, unknown>): Promise<unknown> {
    await FileOperations.deleteFile(app, config, args.path as string);
    return { success: true, message: `File deleted successfully: ${args.path}` };
  },
};
