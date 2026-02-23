/**
 * @fileoverview PluginTypes - Core type definitions for obsidian-ai-agents
 *
 * Defines settings interfaces for AI providers (Ollama, OpenRouter),
 * agent configuration, and plugin behaviour.
 */

// ---------------------------------------------------------------------------
// Provider settings
// ---------------------------------------------------------------------------

export interface OllamaSettings {
  enabled: boolean;
  baseUrl: string;
}

export interface OpenRouterSettings {
  enabled: boolean;
  apiKey: string;
}

// ---------------------------------------------------------------------------
// Plugin settings
// ---------------------------------------------------------------------------

export interface PluginSettings {
  // --- Providers ---
  ollama: OllamaSettings;
  openRouter: OpenRouterSettings;
  defaultProvider: "ollama" | "openrouter";

  // --- General ---
  agentsFolder: string;
  userName: string;

  // --- Behaviour ---
  defaultModel: string;

  // --- RAG defaults ---
  defaultEmbeddingProvider: "ollama" | "openrouter";
  defaultEmbeddingModel: string;

  maxHistoryMessages: number;
  autoSaveInterval: number;
  confirmDestructiveOps: boolean;
  maxFileOpsPerMessage: number;

  // --- UI ---
  chatPosition: "right" | "left" | "tab";
  showStatusBar: boolean;
  showTokenCount: boolean;

  // --- Tracking ---
  agentUsage: Record<string, number>;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  ollama: {
    enabled: false,
    baseUrl: "http://localhost:11434",
  },
  openRouter: {
    enabled: false,
    apiKey: "",
  },
  defaultProvider: "ollama",

  agentsFolder: "agents",
  userName: "",

  defaultModel: "",
  defaultEmbeddingProvider: "ollama",
  defaultEmbeddingModel: "nomic-embed-text",
  maxHistoryMessages: 50,
  autoSaveInterval: 30,
  confirmDestructiveOps: true,
  maxFileOpsPerMessage: 10,

  chatPosition: "right",
  showStatusBar: true,
  showTokenCount: true,

  agentUsage: {},
};
