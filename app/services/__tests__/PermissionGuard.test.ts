import { PermissionGuard, PermissionError } from "@app/services/PermissionGuard";
import { AgentConfig, DEFAULT_CONFIG } from "@app/types/AgentTypes";

describe("PermissionGuard", () => {
  let config: AgentConfig;

  beforeEach(() => {
    // Basic setup config
    config = {
      ...DEFAULT_CONFIG,
      name: "TestAgent",
      vault_root_access: false,
      read: ["docs/**", "logs/*.txt"],
      write: ["docs/**"],
      create: ["docs/**"],
      move: ["docs/**"],
      delete: ["docs/**"],
    };
  });

  describe("hasPermission", () => {
    it("should allow reading allowed paths", () => {
      expect(PermissionGuard.hasPermission(config, "read", "docs/api.md")).toBe(true);
      expect(PermissionGuard.hasPermission(config, "read", "logs/today.txt")).toBe(true);
    });

    it("should deny reading disallowed paths", () => {
      expect(PermissionGuard.hasPermission(config, "read", "secret/passwords.txt")).toBe(false);
      expect(PermissionGuard.hasPermission(config, "read", "logs/today.md")).toBe(false);
    });

    it("should deny operations with empty arrays", () => {
      config.write = [];
      expect(PermissionGuard.hasPermission(config, "write", "docs/api.md")).toBe(false);
    });

    it("should deny vault root access if vault_root_access is false", () => {
      config.read = ["**/*"]; // Even if the glob allows it
      expect(PermissionGuard.hasPermission(config, "read", "root_file.md")).toBe(false);
    });

    it("should allow vault root access if vault_root_access is true", () => {
      config.vault_root_access = true;
      config.read = ["**/*"];
      expect(PermissionGuard.hasPermission(config, "read", "root_file.md")).toBe(true);
    });

    it("should allow global operations if path is null and array is non-empty", () => {
      expect(PermissionGuard.hasPermission(config, "read", null)).toBe(true);
      config.read = [];
      expect(PermissionGuard.hasPermission(config, "read", null)).toBe(false);
    });
  });

  describe("assertPermission", () => {
    it("should throw PermissionError when access is denied", () => {
      expect(() => {
        PermissionGuard.assertPermission(config, "write", "secret.txt");
      }).toThrow(PermissionError);
      expect(() => {
        PermissionGuard.assertPermission(config, "write", "secret.txt");
      }).toThrow(/Permission denied/);
    });

    it("should not throw when access is allowed", () => {
      expect(() => {
        PermissionGuard.assertPermission(config, "write", "docs/api.md");
      }).not.toThrow();
    });
  });
});
