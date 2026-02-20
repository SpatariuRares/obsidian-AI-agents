/**
 * @fileoverview ToolHandler - Maps LLM tool calls to file operations automatically, with permission checks.
 */

import { App } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { FileOperations } from "@app/services/FileOperations";

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
        const tools: ToolDefinition[] = [];

        if (config.read && config.read.length > 0) {
            tools.push({
                name: "read_file",
                description: "Leggi il contenuto di un file dal vault",
                parameters: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "Path relativo al vault root (es: note.md)" }
                    },
                    required: ["path"]
                }
            });

            tools.push({
                name: "list_files",
                description: "Lista file all'interno di una cartella",
                parameters: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "Path della cartella. Usa '/' per il root" },
                        recursive: { type: "boolean", description: "Se true, lista anche le sottocartelle" }
                    },
                    required: ["path"]
                }
            });

            // search_vault logic can be similarly mapped once FileOperations adds support
        }

        if (config.write && config.write.length > 0) {
            tools.push({
                name: "write_file",
                description: "Scrivi o modifica un file nel vault",
                parameters: {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                        content: { type: "string" },
                        mode: { type: "string", enum: ["overwrite", "append", "prepend"] }
                    },
                    required: ["path", "content"]
                }
            });
        }

        if (config.create && config.create.length > 0) {
            tools.push({
                name: "create_file",
                description: "Crea un nuovo file nel vault",
                parameters: {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                        content: { type: "string" }
                    },
                    required: ["path", "content"]
                }
            });
        }

        if (config.move && config.move.length > 0) {
            tools.push({
                name: "move_file",
                description: "Sposta o rinomina un file",
                parameters: {
                    type: "object",
                    properties: {
                        from: { type: "string" },
                        to: { type: "string" }
                    },
                    required: ["from", "to"]
                }
            });
        }

        if (config.delete && config.delete.length > 0) {
            tools.push({
                name: "delete_file",
                description: "Elimina un file dal vault",
                parameters: {
                    type: "object",
                    properties: {
                        path: { type: "string" }
                    },
                    required: ["path"]
                }
            });
        }

        return tools;
    }

    /**
     * Translates a raw tool call from the LLM into the actual underlying Obsidian logic.
     * Relies on FileOperations which in turn relies on PermissionGuard and UI Modals.
     */
    static async executeTool(app: App, config: AgentConfig, toolName: string, args: any): Promise<any> {
        try {
            switch (toolName) {
                case "read_file": {
                    const content = await FileOperations.readFile(app, config, args.path);
                    return { success: true, content };
                }

                case "write_file":
                    await FileOperations.writeFile(app, config, args.path, args.content, args.mode || "overwrite");
                    return { success: true, message: `File wrote successfully to ${args.path}` };

                case "create_file":
                    await FileOperations.createFile(app, config, args.path, args.content);
                    return { success: true, message: `File created successfully at ${args.path}` };

                case "move_file":
                    await FileOperations.moveFile(app, config, args.from, args.to);
                    return { success: true, message: `File moved from ${args.from} to ${args.to}` };

                case "delete_file":
                    await FileOperations.deleteFile(app, config, args.path);
                    return { success: true, message: `File deleted successfully: ${args.path}` };

                case "list_files": {
                    const files = await FileOperations.listFiles(app, config, args.path, args.recursive === true);
                    return { success: true, files };
                }

                default:
                    return { success: false, error: `Tool ${toolName} not recognized.` };
            }
        } catch (e: any) {
            // console.error(`Tool execution error [${toolName}]:`, e);
            return { success: false, error: e.message };
        }
    }
}
