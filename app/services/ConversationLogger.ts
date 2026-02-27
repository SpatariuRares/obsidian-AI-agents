import { App, TFile, normalizePath, TFolder } from "obsidian";
import { ParsedAgent, ChatMessage } from "@app/types/AgentTypes";

export interface ChatSessionMeta {
  file: string;
  title: string;
  date: string;
  timestamp: number;
}

export class ConversationLogger {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Saves the entire message array to a JSON-only Markdown file.
   * Returns the path to the saved file.
   */
  async saveSession(
    agent: ParsedAgent,
    sessionFile: string | null,
    messages: ChatMessage[],
    title: string,
  ): Promise<string> {
    const logFolderName = "logs";
    const agentFolder = agent.folderPath;
    const logFolderPath = normalizePath(`${agentFolder}/${logFolderName}`);

    await this.ensureFolder(logFolderPath);

    let filePath = sessionFile;
    const dateStr = this.formatDate(new Date());

    // If no session file exists or the title changed, we need a new file name.
    if (!filePath) {
      // Remove invalid path characters for Obsidian filenames
      const safeTitle = title.replace(/[\\/:"*?<>|]/g, "").trim() || "New Chat";
      filePath = normalizePath(`${logFolderPath}/${safeTitle}.md`);

      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(filePath)) {
        filePath = normalizePath(`${logFolderPath}/${safeTitle} ${counter}.md`);
        counter++;
      }
    } else {
      const safeTitle = title.replace(/[\\/:"*?<>|]/g, "").trim() || "New Chat";
      const oldName = filePath.split("/").pop()?.replace(".md", "");

      if (oldName !== safeTitle) {
        const newPath = normalizePath(`${logFolderPath}/${safeTitle}.md`);
        let finalNewPath = newPath;
        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(finalNewPath) && finalNewPath !== filePath) {
          finalNewPath = normalizePath(`${logFolderPath}/${safeTitle} ${counter}.md`);
          counter++;
        }
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile instanceof TFile && finalNewPath !== filePath) {
          await this.app.fileManager.renameFile(existingFile, finalNewPath);
          filePath = finalNewPath;
        }
      }
    }

    const jsonString = JSON.stringify(messages, null, 2);
    const safeTitleStr = title.replace(/"/g, '\\"');
    const content =
      `---\n` +
      `title: "${safeTitleStr}"\n` +
      `date: ${dateStr}\n` +
      `schema_version: 1\n` +
      `---\n\n` +
      `\`\`\`json\n` +
      `${jsonString}\n` +
      `\`\`\`\n`;

    const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (abstractFile instanceof TFile) {
      await this.app.vault.modify(abstractFile, content);
    } else {
      await this.app.vault.create(filePath, content);
    }

    return filePath;
  }

  /**
   * Reads the logs folder for an agent and returns a list of sessions.
   */
  getLogHistory(agent: ParsedAgent): Promise<ChatSessionMeta[]> {
    const logFolderPath = normalizePath(`${agent.folderPath}/logs`);
    const folder = this.app.vault.getAbstractFileByPath(logFolderPath);
    if (!folder || !Object.prototype.hasOwnProperty.call(folder, "children"))
      return Promise.resolve([]);

    const sessions: ChatSessionMeta[] = [];
    const children = folder instanceof TFolder ? folder.children : [];

    for (const child of children) {
      if (child instanceof TFile && child.extension === "md") {
        const cache = this.app.metadataCache.getFileCache(child);
        const title = cache?.frontmatter?.title || child.basename;
        const date = cache?.frontmatter?.date || this.formatDate(new Date(child.stat.ctime));

        sessions.push({
          file: child.path,
          title: String(title),
          date: String(date),
          timestamp: child.stat.mtime,
        });
      }
    }

    return Promise.resolve(sessions.sort((a, b) => b.timestamp - a.timestamp));
  }

  /**
   * Loads a session from a file, extracting the JSON messages.
   */
  async loadSession(filePath: string): Promise<ChatMessage[]> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.app.vault.read(file);

    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]) as ChatMessage[];
      } catch (_e) {
        return [];
      }
    }

    return [];
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/");
    let current = "";
    for (const part of parts) {
      if (!part) continue;
      current = current ? `${current}/${part}` : part;
      const normalized = normalizePath(current);
      const folder = this.app.vault.getAbstractFileByPath(normalized);
      if (!folder) {
        await this.app.vault.createFolder(normalized);
      }
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
