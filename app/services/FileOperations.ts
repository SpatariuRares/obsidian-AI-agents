/**
 * @fileoverview FileOperations - Wraps Obsidian valid operations with PermissionGuard
 */

import { App, TFile, TFolder } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";
import { PermissionGuard, FileOperationType } from "@app/services/PermissionGuard";
import { PermissionModal } from "@app/features/common/PermissionModal";
import { t } from "@app/i18n";

export class FileOperations {
  /**
   * Reads a file from the vault.
   */
  static async readFile(app: App, config: AgentConfig, path: string): Promise<string> {
    PermissionGuard.assertPermission(config, "read", path);

    const file = app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found or is not a file: ${path}`);
    }

    return await app.vault.read(file);
  }

  /**
   * Writes to an existing file in the vault.
   */
  static async writeFile(
    app: App,
    config: AgentConfig,
    path: string,
    content: string,
    mode: "overwrite" | "append" | "prepend" = "overwrite",
  ): Promise<void> {
    PermissionGuard.assertPermission(config, "write", path);

    // Ask for UI confirmation if necessary
    if (config.confirm_destructive) {
      const allowed = await FileOperations.requestUserConfirmation(app, config.name, "write", path);
      if (!allowed) throw new Error("Operation rejected by user.");
    }

    const file = app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found or is not a file: ${path}`);
    }

    if (mode === "overwrite") {
      await app.vault.modify(file, content);
    } else if (mode === "append") {
      const existingContent = await app.vault.read(file);
      await app.vault.modify(file, existingContent + "\n" + content);
    } else if (mode === "prepend") {
      const existingContent = await app.vault.read(file);
      await app.vault.modify(file, content + "\n" + existingContent);
    }
  }

  /**
   * Creates a new file in the vault.
   */
  static async createFile(
    app: App,
    config: AgentConfig,
    path: string,
    content: string,
  ): Promise<void> {
    PermissionGuard.assertPermission(config, "create", path);

    if (config.confirm_destructive) {
      const allowed = await FileOperations.requestUserConfirmation(
        app,
        config.name,
        "create",
        path,
      );
      if (!allowed) throw new Error("Operation rejected by user.");
    }

    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      throw new Error(`Path already exists: ${path}`);
    }

    // Ensure we create parent folders if they dont exist
    await this.ensureParentFolders(app, path);
    await app.vault.create(path, content);
  }

  /**
   * Moves or renames a file.
   */
  static async moveFile(
    app: App,
    config: AgentConfig,
    fromPath: string,
    toPath: string,
  ): Promise<void> {
    // Requires both read and move on the source? Usually just move on source and create/move on target.
    // The design doc specifies permissions.move for moving. We check move on the destination folder.
    // Let's check move on both.
    PermissionGuard.assertPermission(config, "move", fromPath);
    PermissionGuard.assertPermission(config, "move", toPath);

    if (config.confirm_destructive) {
      const allowed = await FileOperations.requestUserConfirmation(
        app,
        config.name,
        "move",
        t("permission.movePath", { from: fromPath, to: toPath }),
      );
      if (!allowed) throw new Error("Operation rejected by user.");
    }

    const file = app.vault.getAbstractFileByPath(fromPath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`Source file not found or is not a file: ${fromPath}`);
    }

    await this.ensureParentFolders(app, toPath);
    await app.fileManager.renameFile(file, toPath);
  }

  /**
   * Deletes a file.
   */
  static async deleteFile(app: App, config: AgentConfig, path: string): Promise<void> {
    PermissionGuard.assertPermission(config, "delete", path);

    if (config.confirm_destructive) {
      const allowed = await FileOperations.requestUserConfirmation(
        app,
        config.name,
        "delete",
        path,
      );
      if (!allowed) throw new Error("Operation rejected by user.");
    }

    const file = app.vault.getAbstractFileByPath(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    await app.fileManager.trashFile(file);
  }

  /**
   * Lists files in a directory.
   */
  static async listFiles(
    app: App,
    config: AgentConfig,
    path: string,
    recursive: boolean = false,
  ): Promise<string[]> {
    // Global check: agent must have at least some read permissions
    PermissionGuard.assertPermission(config, "read", null);

    const isRoot = path === "/" || path === "";
    const folder = isRoot
      ? app.vault.getRoot()
      : app.vault.getAbstractFileByPath(path);

    if (!folder || !(folder instanceof TFolder)) {
      throw new Error(`Directory not found or is not a directory: ${path}`);
    }

    const results: string[] = [];
    if (recursive) {
      for (const file of app.vault.getFiles()) {
        const inFolder =
          isRoot || file.path.startsWith(folder.path + "/");
        if (inFolder && PermissionGuard.hasPermission(config, "read", file.path)) {
          results.push(file.path);
        }
      }
    } else {
      for (const child of folder.children) {
        if (PermissionGuard.hasPermission(config, "read", child.path)) {
          results.push(child.path);
        }
      }
    }
    return results;
  }

  /**
   * Utility to request UI confirmation from the user.
   */
  private static async requestUserConfirmation(
    app: App,
    agentName: string,
    operation: FileOperationType,
    path: string,
  ): Promise<boolean> {
    const modal = new PermissionModal(app, agentName, operation, path);
    return await modal.requestPermission();
  }

  /**
   * Utility to ensure parent folders exist before creating a file.
   */
  private static async ensureParentFolders(app: App, path: string): Promise<void> {
    const parts = path.split("/");
    parts.pop(); // Remove the filename
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folder = app.vault.getAbstractFileByPath(currentPath);
      if (!folder) {
        await app.vault.createFolder(currentPath);
      } else if (!(folder instanceof TFolder)) {
        throw new Error(`Path component is not a folder: ${currentPath}`);
      }
    }
  }
}
