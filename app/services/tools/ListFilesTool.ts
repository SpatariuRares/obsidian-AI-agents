/**
 * @fileoverview ListFilesTool - list_files tool implementation.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { FileOperations } from "@app/services/FileOperations";
import { BaseTool } from "@app/services/tools/BaseTool";

export const ListFilesTool: BaseTool = {
  definition: {
    name: "list_files",
    description: "List files within a folder",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Folder path. Use '/' for root" },
        recursive: { type: "boolean", description: "If true, list subdirectories recursively" },
      },
      required: ["path"],
    },
  },

  isAvailable(config: AgentConfig): boolean {
    return config.read && config.read.length > 0;
  },

  async execute(app: App, config: AgentConfig, args: Record<string, unknown>): Promise<unknown> {
    const files = await FileOperations.listFiles(
      app,
      config,
      args.path as string,
      args.recursive === true,
    );
    return { success: true, files };
  },
};
