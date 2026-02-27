/**
 * @fileoverview WriteFileTool - write_file tool implementation.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { FileOperations } from "@app/services/FileOperations";
import { BaseTool } from "@app/services/tools/BaseTool";

export const WriteFileTool: BaseTool = {
  definition: {
    name: "write_file",
    description: "Write or modify a file in the vault",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        mode: { type: "string", enum: ["overwrite", "append", "prepend"] },
      },
      required: ["path", "content"],
    },
  },

  isAvailable(config: AgentConfig): boolean {
    return config.write && config.write.length > 0;
  },

  async execute(app: App, config: AgentConfig, args: Record<string, unknown>): Promise<unknown> {
    const path = args.path as string;
    const content = args.content as string;
    const mode = (args.mode as "overwrite" | "append" | "prepend") || "overwrite";
    await FileOperations.writeFile(app, config, path, content, mode);
    return { success: true, message: `File wrote successfully to ${path}` };
  },
};
