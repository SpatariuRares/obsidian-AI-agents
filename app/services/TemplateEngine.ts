/**
 * @fileoverview TemplateEngine - Resolves {{variables}} in agent prompt templates
 *
 * Supported variables:
 *   {{agent_name}}           — name from agent config
 *   {{user_name}}            — from plugin settings
 *   {{date}}                 — current date YYYY-MM-DD
 *   {{time}}                 — current time HH:MM
 *   {{datetime}}             — full ISO-ish date + time
 *   {{READ: path/to/file}}   — inline file content (permission-checked)
 *   {{knowledge_context}}    — all sources files concatenated
 *   {{conversation_summary}} — placeholder (resolved externally, empty for now)
 *   {{vault_structure}}      — placeholder (resolved externally, empty for now)
 */

import { App, TFile, normalizePath } from "obsidian";
import * as micromatch from "micromatch";
import { AgentConfig } from "@app/types/AgentTypes";
import { PluginSettings } from "@app/types/PluginTypes";
import { loadKnowledgeContent, wrapBlock } from "@app/services/KnowledgeResolver";

// ---------------------------------------------------------------------------
// Context passed to the resolver
// ---------------------------------------------------------------------------

export interface TemplateContext {
  agentConfig: AgentConfig;
  settings: PluginSettings;
  app: App;
  /** Optional overrides for testing or future features */
  conversationSummary?: string;
  vaultStructure?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve all {{variables}} in a prompt template string.
 * Returns the fully expanded prompt ready to send to the LLM.
 */
export async function resolveTemplate(
  template: string,
  ctx: TemplateContext,
): Promise<string> {
  let result = template;

  // 1. Simple scalar variables (synchronous)
  result = replaceScalarVariables(result, ctx);

  // 2. {{knowledge_context}} — async, loads files from vault
  if (result.includes("{{knowledge_context}}")) {
    const knowledgeContent = await loadKnowledgeContent(
      ctx.agentConfig.sources,
      ctx.app,
      ctx.agentConfig.max_context_tokens,
    );
    result = result.replace(/\{\{knowledge_context\}\}/g, knowledgeContent);
  }

  // 3. {{READ: path}} — async, each occurrence loads a file
  result = await resolveReadDirectives(result, ctx);

  return result;
}

// ---------------------------------------------------------------------------
// Scalar variables
// ---------------------------------------------------------------------------

function replaceScalarVariables(
  template: string,
  ctx: TemplateContext,
): string {
  const now = new Date();
  const date = formatDate(now);
  const time = formatTime(now);

  const replacements: Record<string, string> = {
    "{{agent_name}}": ctx.agentConfig.name,
    "{{user_name}}": ctx.settings.userName,
    "{{date}}": date,
    "{{time}}": time,
    "{{datetime}}": `${date} ${time}`,
    "{{conversation_summary}}": ctx.conversationSummary ?? "",
    "{{vault_structure}}": ctx.vaultStructure ?? "",
  };

  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// {{READ: path}} resolution
// ---------------------------------------------------------------------------

const READ_PATTERN = /\{\{READ:\s*(.+?)\}\}/g;

async function resolveReadDirectives(
  template: string,
  ctx: TemplateContext,
): Promise<string> {
  // Collect all matches first (regex is stateful)
  const matches: { full: string; path: string }[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(READ_PATTERN.source, READ_PATTERN.flags);

  while ((match = re.exec(template)) !== null) {
    matches.push({ full: match[0], path: match[1].trim() });
  }

  if (matches.length === 0) return template;

  let result = template;

  for (const { full, path } of matches) {
    const content = await readFileChecked(path, ctx);
    result = result.replace(full, content);
  }

  return result;
}

/**
 * Read a file from the vault after verifying the path is allowed.
 * Allowed means: listed in read OR in sources.
 */
async function readFileChecked(
  rawPath: string,
  ctx: TemplateContext,
): Promise<string> {
  const filePath = normalizePath(rawPath);

  // Build the list of allowed patterns
  const allowedPatterns = [
    ...ctx.agentConfig.read,
    ...ctx.agentConfig.sources,
  ];

  if (allowedPatterns.length > 0 && !micromatch.isMatch(filePath, allowedPatterns)) {
    return `[READ denied: ${filePath} is not in read or sources]`;
  }

  const file = ctx.app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) {
    return `[READ failed: ${filePath} not found]`;
  }

  const content = await ctx.app.vault.read(file);
  return wrapBlock(filePath, content);
}

// ---------------------------------------------------------------------------
// Date/time helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}
