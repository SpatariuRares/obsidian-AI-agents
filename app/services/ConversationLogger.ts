/**
 * @fileoverview ConversationLogger - Writes chat logs to markdown files in the vault.
 */

import { App, TFile, normalizePath } from "obsidian";
import { ParsedAgent, ChatMessage, TokenUsage } from "@app/types/AgentTypes";

export class ConversationLogger {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Appends a message exchange to the daily log file.
     * Updates frontmatter usage statistics as needed.
     */
    async appendLog(
        agent: ParsedAgent,
        userMessage: ChatMessage,
        assistantMessage: ChatMessage,
        usage?: TokenUsage,
        isNewSession: boolean = false
    ): Promise<void> {
        // Only log if enabled
        if (String(agent.config.logging_enabled) !== "true") return;

        const dateStr = this.formatDate(new Date());
        const timeStr = this.formatTime(new Date());

        const logFolderName = agent.config.logging_path || "logs";
        const agentFolder = agent.folderPath;
        const logFolderPath = normalizePath(`${agentFolder}/${logFolderName}`);
        const logFilePath = normalizePath(`${logFolderPath}/${dateStr}.md`);

        await this.ensureFolder(logFolderPath);

        let file = this.app.vault.getFileByPath(logFilePath) as TFile;
        let sessionNum = 1;
        let isNewFile = false;

        if (!file) {
            isNewFile = true;
            const initialContent = `---
agent: "${agent.config.name}"
model: "${agent.config.model}"
date: ${dateStr}
sessions: 1
total_tokens: ${usage?.totalTokens || 0}
---

# ${agent.config.name} — ${dateStr}

`;
            file = await this.app.vault.create(logFilePath, initialContent);
            isNewSession = true;
        } else {
            // Update frontmatter
            try {
                await this.app.fileManager.processFrontMatter(file, (fm) => {
                    if (isNewSession) {
                        fm.sessions = (fm.sessions || 1) + 1;
                    }
                    sessionNum = fm.sessions || 1;
                    if (usage) {
                        fm.total_tokens = (fm.total_tokens || 0) + usage.totalTokens;
                    }
                });
            } catch (e) {
                console.error("[ConversationLogger] Failed to update frontmatter:", e);
            }
        }

        // Prepare append string
        let appendStr = "";

        if (isNewSession && !isNewFile) {
            appendStr += `---\n\n`;
        }

        if (isNewSession) {
            appendStr += `## Session ${sessionNum} — ${timeStr}\n\n`;
        }

        appendStr += `> **User** (${timeStr}): ${this.formatContent(userMessage.content)}\n`;
        appendStr += `> **${agent.config.name}** (${timeStr}): ${this.formatContent(assistantMessage.content)}\n\n`;

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            const toolNames = assistantMessage.tool_calls.map(tc => tc.name).join(", ");
            appendStr += `**🔧 Tool calls:** ${toolNames}\n\n`;
        }

        try {
            await this.app.vault.append(file, appendStr);
        } catch (e) {
            console.error("[ConversationLogger] Failed to append to log:", e);
        }
    }

    private async ensureFolder(path: string): Promise<void> {
        const parts = path.split('/');
        let current = '';
        for (const part of parts) {
            if (!part) continue;
            current = current ? `${current}/${part}` : part;
            const normalized = normalizePath(current);
            const folder = this.app.vault.getFolderByPath(normalized);
            if (!folder) {
                try {
                    await this.app.vault.createFolder(normalized);
                } catch (e) {
                    console.error(`[ConversationLogger] Failed to create folder ${normalized}:`, e);
                }
            }
        }
    }

    private formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private formatTime(date: Date): string {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    private formatContent(content: string): string {
        if (!content) return "";
        // Replace newlines with blockquote prefixes to keep formatting in quote block
        return content.split('\n').join('\n> ');
    }
}
