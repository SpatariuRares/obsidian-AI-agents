import { App, normalizePath, Notice } from "obsidian";
import { t } from "@app/i18n";

export class ExampleGenerator {
  static async generateMockData(app: App): Promise<void> {
    try {
      const folders = ["Inbox", "Projects", "Daily Notes"];

      for (const folder of folders) {
        await this.ensureFolder(app, folder);
      }

      let generatedCount = 0;

      // Create some mock files
      const ideaCreated = await this.createFileIfNotExists(
        app,
        "Inbox/Idea for new plugin.md",
        "---\ntags: [idea, plugin]\n---\n\nNeed to create a plugin that helps with daily organization.\n\nTodo:\n- [ ] Research Obsidian API\n- [ ] Create UI mockups\n",
      );
      if (ideaCreated) generatedCount++;

      const projectCreated = await this.createFileIfNotExists(
        app,
        "Projects/Website Redesign.md",
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
        `Daily Notes/${dateStr}.md`,
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
