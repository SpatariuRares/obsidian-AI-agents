/**
 * @fileoverview allTools - Central registry of all available tools.
 */

import { BaseTool } from "@app/services/tools/BaseTool";
import { ReadFileTool } from "@app/services/tools/ReadFileTool";
import { ListFilesTool } from "@app/services/tools/ListFilesTool";
import { WriteFileTool } from "@app/services/tools/WriteFileTool";
import { CreateFileTool } from "@app/services/tools/CreateFileTool";
import { MoveFileTool } from "@app/services/tools/MoveFileTool";
import { DeleteFileTool } from "@app/services/tools/DeleteFileTool";

export const allTools: BaseTool[] = [
  ReadFileTool,
  ListFilesTool,
  WriteFileTool,
  CreateFileTool,
  MoveFileTool,
  DeleteFileTool,
];
