import { App, normalizePath, Notice } from "obsidian";
import { t } from "@app/i18n";
import { LocalizationService } from "@app/i18n/LocalizationService";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { CONSTANTS } from "@app/types/constants";

/** Default agent.md generator used by the "Create default agent" button. */
export function getDefaultAgentMd(): string {
  const language = LocalizationService.getInstance().getCurrentLocale();
  const getKey = (key: string) => t(`editor.${key}`) || key;

  const inboxFolder = t("mockData.inboxFolder") || "Inbox";
  const projectsFolder = t("mockData.projectsFolder") || "Projects";
  const dailyNotesFolder = t("mockData.dailyNotesFolder") || "Daily Notes";

  return `---
language: "${language}"
${getKey("name").toLowerCase()}: "${t("exampleAgent.name") || "Obsidian Copilot"}"
${getKey("description").toLowerCase()}: "${t("exampleAgent.description") || "An advanced, fully-featured AI assistant capable of managing notes, summarizing content, and organizing your vault."}"
${getKey("author").toLowerCase()}: "${t("exampleAgent.author") || "AI Agents"}"
${getKey("avatar").toLowerCase()}: "🧠"
${getKey("enabled").toLowerCase()}: true
${getKey("type").toLowerCase()}: "conversational"
${getKey("provider").toLowerCase()}: "ollama"
${getKey("model").toLowerCase()}: "llama3"
${getKey("stream").toLowerCase()}: true
${getKey("sources").toLowerCase()}:
  - "${inboxFolder}/"
  - "${projectsFolder}/"
${getKey("strategy").toLowerCase()}: "inject_all"
${getKey("maxContextTokensYaml").toLowerCase()}: 8000
${getKey("readPermissions").toLowerCase()}:
  - "/"
${getKey("writePermissions").toLowerCase()}:
  - "${inboxFolder}/"
  - "${dailyNotesFolder}/"
${getKey("createPermissions").toLowerCase()}:
  - "${inboxFolder}/"
  - "${dailyNotesFolder}/"
${getKey("movePermissions").toLowerCase()}: []
${getKey("deletePermissions").toLowerCase()}: []
${getKey("vaultRootAccessYaml").toLowerCase()}: false
${getKey("confirmDestructiveYaml").toLowerCase()}: true
${getKey("memory").toLowerCase()}: true
---

${t("exampleAgent.promptBody") || "You are **{{agent_name}}**, an advanced AI assistant embedded directly within the user's Obsidian vault.\nYour goal is to help the user manage their personal knowledge base, summarize notes, brainstorm ideas, and write content.\n\n## Context\n- **User:** {{user_name}}\n- **Current Date:** {{date}}\n\n## Guidelines\n1. **Be Concise & Markdown-Native:** Always format your responses using rich Markdown (headers, lists, bold, italics, code blocks) to make them look beautiful in Obsidian.\n2. **Leverage Memory:** You have the `memory` flag enabled, which means you have access to the context of previous chats. Refer back to past conversations if it helps answer the current query.\n3. **Drafting Notes:** When asked to write a note, provide a clear, well-structured output.\n4. **Tools & Operations:** When proposing changes to files or creating new notes, clearly explain what you are going to do.\n\nHow can I assist you with your vault today?\n"}`;
}

/** Basic agent.md generator with only mandatory fields used by the "Create default agent" button. */
export function getBasicAgentMd(): string {
  const language = LocalizationService.getInstance().getCurrentLocale();
  const getKey = (key: string) => t(`editor.${key}`) || key;

  return `---
language: "${language}"
${getKey("name").toLowerCase()}: "${t("basicAgent.name") || "Basic Assistant"}"
${getKey("readPermissions").toLowerCase()}:
  - "/"
${getKey("vaultRootAccess").toLowerCase()}: true
---

${t("basicAgent.promptBody") || "You are a helpful AI assistant.\nRespond concisely.\nIf the user asks about their files or vault, use the available tools to read or list them.\n"}`;
}

export class ExampleGenerator {
  static async createDefaultAgent(
    app: App,
    agentsFolder: string,
    agentRegistry: AgentRegistry,
  ): Promise<boolean> {
    const folder = agentsFolder || CONSTANTS.DEFAULT_AGENTS_FOLDER;
    const agentFolder = normalizePath(`${folder}/assistant`);
    const agentFile = normalizePath(`${agentFolder}/agent.md`);

    const basicFolder = normalizePath(`${folder}/basic-assistant`);
    const basicFile = normalizePath(`${basicFolder}/agent.md`);

    // Check if the file already exists
    const existing = app.vault.getAbstractFileByPath(agentFile);
    if (existing) {
      new Notice(t("notices.defaultAgentExists") || "Default agent already exists.");
      return false;
    }

    try {
      await this.ensureFolder(app, folder);

      await this.ensureFolder(app, agentFolder);
      await app.vault.create(agentFile, getDefaultAgentMd().trimStart());

      const existingBasic = app.vault.getAbstractFileByPath(basicFile);
      if (!existingBasic) {
        await this.ensureFolder(app, basicFolder);
        await app.vault.create(basicFile, getBasicAgentMd().trimStart());
      }

      await agentRegistry.scan(folder);

      // Trigger workspace update so the UI and StatusBar catch the new agent
      app.workspace.trigger("ai-agents:update" as any);

      new Notice(t("notices.defaultAgentCreated") || "Default agent created.");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(
        t("notices.defaultAgentFailed", { message: msg }) ||
          `Failed to create default agent: ${msg}`,
      );
      return false;
    }
  }

  static async generateMockData(
    app: App,
    agentsFolder: string,
    agentRegistry: AgentRegistry,
  ): Promise<void> {
    try {
      // Include default agent creation
      await this.createDefaultAgent(app, agentsFolder, agentRegistry);

      const inboxFolder = t("mockData.inboxFolder") || "Inbox";
      const projectsFolder = t("mockData.projectsFolder") || "Projects";
      const dailyNotesFolder = t("mockData.dailyNotesFolder") || "Daily Notes";

      const folders = [inboxFolder, projectsFolder, dailyNotesFolder];

      for (const folder of folders) {
        await this.ensureFolder(app, folder);
      }

      let generatedCount = 0;

      // Create some mock files
      const ideaCreated = await this.createFileIfNotExists(
        app,
        `${inboxFolder}/${t("mockData.ideaTitle") || "Idea for new plugin.md"}`,
        t("mockData.ideaContent") ||
          "---\ntags: [idea, plugin]\n---\n\nNeed to create a plugin that helps with daily organization.\n\nTodo:\n- [ ] Research Obsidian API\n- [ ] Create UI mockups\n",
      );
      if (ideaCreated) generatedCount++;

      const projectCreated = await this.createFileIfNotExists(
        app,
        `${projectsFolder}/${t("mockData.projectTitle") || "Website Redesign.md"}`,
        t("mockData.projectContent") ||
          "---\nstatus: in-progress\ndeadline: 2026-12-31\n---\n\n# Website Redesign\n\nWe need to migrate to the new UI framework.\n\n## Goals\n- Better performance\n- Mobile responsive\n",
      );
      if (projectCreated) generatedCount++;

      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;

      const dailyCreated = await this.createFileIfNotExists(
        app,
        `${dailyNotesFolder}/${t("mockData.dailyTitle", { date: dateStr }) || `${dateStr}.md`}`,
        t("mockData.dailyContent", { date: dateStr }) ||
          `# ${dateStr}\n\n## Log\n- Started working on the new AI agent workflow.\n- Need to ask the Copilot to summarize my project goals.\n`,
      );
      if (dailyCreated) generatedCount++;

      if (generatedCount > 0) {
        new Notice(
          t("notices.mockDataCreated", { count: String(generatedCount) }) ||
            `Generated ${generatedCount} mock files!`,
        );
      } else {
        new Notice(t("notices.mockDataExists") || "Mock data folders and files already exist.");
      }
    } catch (e) {
      console.error("Failed to generate mock data", e);
      new Notice("Failed to generate mock data. Check console for details.");
    }
  }

  private static async ensureFolder(app: App, path: string): Promise<void> {
    const normalized = normalizePath(path);
    const existing = app.vault.getAbstractFileByPath(normalized);
    if (!existing) {
      await app.vault.createFolder(normalized);
    }
  }

  private static async createFileIfNotExists(
    app: App,
    path: string,
    content: string,
  ): Promise<boolean> {
    const normalized = normalizePath(path);
    const existing = app.vault.getAbstractFileByPath(normalized);
    if (!existing) {
      await app.vault.create(normalized, content);
      return true;
    }
    return false;
  }
}
