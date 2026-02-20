/**
 * @fileoverview ChatManager.test.ts
 *
 * Tests session management: startSession, addMessage, getMessages,
 * getVisibleMessages, clearSession, and settings update.
 */

import { App } from "obsidian";
import { ChatManager } from "@app/services/ChatManager";
import { ParsedAgent } from "@app/types/AgentTypes";
import { DEFAULT_SETTINGS, PluginSettings } from "@app/types/PluginTypes";
import { DEFAULT_CONFIG } from "@app/services/AgentConfig";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp(): App {
  const app = new App();
  app.vault.getFiles = jest.fn().mockReturnValue([]);
  app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
  app.vault.read = jest.fn().mockResolvedValue("");
  return app;
}

function makeAgent(overrides: Partial<ParsedAgent> = {}): ParsedAgent {
  return {
    id: "echo",
    folderPath: "agents/echo",
    filePath: "agents/echo/agent.md",
    config: {
      ...DEFAULT_CONFIG,
      name: "Echo",
      model: "llama3",
    },
    promptTemplate: "You are {{agent_name}}. User: {{user_name}}",
    ...overrides,
  };
}

function makeSettings(overrides: Partial<PluginSettings> = {}): PluginSettings {
  return { ...DEFAULT_SETTINGS, userName: "Rares", ...overrides } as PluginSettings;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatManager", () => {
  describe("initial state", () => {
    it("should have no active session", () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      expect(mgr.hasActiveSession()).toBe(false);
      expect(mgr.getActiveAgent()).toBeNull();
      expect(mgr.getMessages()).toEqual([]);
    });
  });

  describe("startSession()", () => {
    it("should initialise messages with a resolved system prompt", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      await mgr.startSession(makeAgent());

      expect(mgr.hasActiveSession()).toBe(true);
      expect(mgr.getActiveAgent()?.id).toBe("echo");

      const messages = mgr.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("You are Echo");
      expect(messages[0].content).toContain("User: Rares");
    });

    it("should clear previous session when starting a new one", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      await mgr.startSession(makeAgent());
      mgr.addMessage("user", "hello");

      expect(mgr.getMessages()).toHaveLength(2);

      await mgr.startSession(makeAgent({ id: "writer" }));
      expect(mgr.getMessages()).toHaveLength(1);
      expect(mgr.getActiveAgent()?.id).toBe("writer");
    });
  });

  describe("addMessage()", () => {
    it("should append user and assistant messages", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      await mgr.startSession(makeAgent());

      mgr.addMessage("user", "Hello");
      mgr.addMessage("assistant", "Hi there!");

      const messages = mgr.getMessages();
      expect(messages).toHaveLength(3); // system + user + assistant
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toBe("Hello");
      expect(messages[2].role).toBe("assistant");
      expect(messages[2].content).toBe("Hi there!");
    });

    it("should set a timestamp on each message", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      await mgr.startSession(makeAgent());
      mgr.addMessage("user", "test");

      const msg = mgr.getMessages()[1];
      expect(msg.timestamp).toBeGreaterThan(0);
    });
  });

  describe("getVisibleMessages()", () => {
    it("should exclude the system prompt", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      await mgr.startSession(makeAgent());
      mgr.addMessage("user", "Hello");
      mgr.addMessage("assistant", "Hi!");

      const visible = mgr.getVisibleMessages();
      expect(visible).toHaveLength(2);
      expect(visible.every((m) => m.role !== "system")).toBe(true);
    });
  });

  describe("clearSession()", () => {
    it("should reset all state", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      await mgr.startSession(makeAgent());
      mgr.addMessage("user", "Hello");

      mgr.clearSession();

      expect(mgr.hasActiveSession()).toBe(false);
      expect(mgr.getActiveAgent()).toBeNull();
      expect(mgr.getMessages()).toEqual([]);
    });
  });

  describe("getMessages() immutability", () => {
    it("should return a copy, not the internal array", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings());
      await mgr.startSession(makeAgent());

      const msgs = mgr.getMessages();
      msgs.push({ role: "user", content: "injected", timestamp: 0 });

      // Internal array should not be affected
      expect(mgr.getMessages()).toHaveLength(1);
    });
  });

  describe("updateSettings()", () => {
    it("should update the settings reference", async () => {
      const mgr = new ChatManager(makeApp(), makeSettings({ userName: "Alice" }));
      await mgr.startSession(makeAgent());

      expect(mgr.getMessages()[0].content).toContain("User: Alice");

      mgr.updateSettings(makeSettings({ userName: "Bob" }));
      await mgr.startSession(makeAgent());

      expect(mgr.getMessages()[0].content).toContain("User: Bob");
    });
  });
});
