/**
 * @fileoverview PermissionGuard - Validates file operations against AgentConfig
 *
 * Determines if a specific agent is allowed to perform a requested file
 * operation on a target path, based on its YAML configuration.
 */

import { AgentConfig } from "@app/types/AgentTypes";
import { GlobMatcher } from "@app/utils/GlobMatcher";

export type FileOperationType = "read" | "write" | "create" | "move" | "delete";

export class PermissionError extends Error {
  constructor(operation: FileOperationType, path: string, agentName: string) {
    super(`Permission denied: Agent '${agentName}' is not allowed to ${operation} '${path}'`);
    this.name = "PermissionError";
  }
}

export class PermissionGuard {
  /**
   * Checks if the agent has permission to perform the operation on the path.
   * Throws a PermissionError if not allowed.
   */
  static assertPermission(
    config: AgentConfig,
    operation: FileOperationType,
    path: string | null,
  ): void {
    if (!this.hasPermission(config, operation, path)) {
      throw new PermissionError(operation, path || "global", config.name);
    }
  }

  /**
   * Returns true if the operation is allowed, false otherwise.
   *
   * If path is null, it checks for global permission (e.g. creating files in root
   * when vault_root_access is false is blocked).
   */
  static hasPermission(
    config: AgentConfig,
    operation: FileOperationType,
    path: string | null,
  ): boolean {
    // 1. Is the operation permitted at all based on the presence of patterns?
    const patterns = this.getPatternsForOperation(config, operation);

    if (!patterns || patterns.length === 0) {
      return false; // No permissions defined for this operation
    }

    // 2. Are we trying to access the vault root directly?
    if (path && !config.vault_root_access && this.isVaultRootPath(path)) {
      // Allowed only if the patterns explicitly match it, but usually vault_root_access
      // is a global switch. We will strictly match it against the patterns below,
      // but if the path is literally just in the root (no slashes), we restrict it
      // unless vault_root_access is true.

      // For a stricter approach, if it's in root and vault_root_access is false, block.
      // E.g. path = "some-file.md"
      return false;
    }

    // 3. Match against the patterns
    if (path) {
      return GlobMatcher.isMatch(path, patterns);
    }

    // If no specific path is given but the operation arrays have elements,
    // we consider the agent has general permission for the operation type.
    return true;
  }

  /**
   * Checks if a path is in the vault root (no directories).
   */
  private static isVaultRootPath(path: string): boolean {
    // If there's no slash, it's in the root
    return !path.includes("/") && !path.includes("\\");
  }

  /**
   * Retrieves the corresponding glob patterns array from the config for a given operation.
   */
  private static getPatternsForOperation(
    config: AgentConfig,
    operation: FileOperationType,
  ): string[] {
    switch (operation) {
      case "read":
        return config.read;
      case "write":
        return config.write;
      case "create":
        return config.create;
      case "move":
        return config.move;
      case "delete":
        return config.delete;
      default:
        return [];
    }
  }
}
