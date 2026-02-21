/**
 * @fileoverview ReadFileTool - read_file tool implementation.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { FileOperations } from "@app/services/FileOperations";
import { BaseTool } from "@app/services/tools/BaseTool";

export const ReadFileTool: BaseTool = {
  definition: {
    name: "read_file",
    description: "Read the content of a file from the vault",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to vault root (e.g. note.md)" },
      },
      required: ["path"],
    },
  },

  isAvailable(config: AgentConfig): boolean {
    return config.read && config.read.length > 0;
  },

  async execute(app: App, config: AgentConfig, args: Record<string, unknown>): Promise<unknown> {
    const content = await FileOperations.readFile(app, config, args.path as string);
    return { success: true, content };
  },
};
