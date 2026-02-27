/**
 * @fileoverview CreateFileTool - create_file tool implementation.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { FileOperations } from "@app/services/FileOperations";
import { BaseTool } from "@app/services/tools/BaseTool";

export const CreateFileTool: BaseTool = {
  definition: {
    name: "create_file",
    description: "Create a new file in the vault",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },

  isAvailable(config: AgentConfig): boolean {
    return config.create && config.create.length > 0;
  },

  async execute(app: App, config: AgentConfig, args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;
    const content = args.content as string;
    await FileOperations.createFile(app, config, path, content);
    return { success: true, message: `File created successfully at ${path}` };
  },
};
