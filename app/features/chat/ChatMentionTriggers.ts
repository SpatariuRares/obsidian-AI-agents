import { App } from "obsidian";
import { MentionTrigger } from "@app/components/molecules/InlineMentionSuggest";
import { t } from "@app/i18n";

export function createFileMentionTrigger(): MentionTrigger {
  return {
    char: "@",
    icon: "file-text",
    getSuggestions: (app: App) => {
      return app.vault
        .getFiles()
        .sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0))
        .map((file) => ({
          label: file.basename,
          description: file.path,
          value: file.path,
        }));
    },
    formatInsertion: (item) => `@${item.value} `,
  };
}

export function createTagMentionTrigger(): MentionTrigger {
  return {
    char: "#",
    icon: "hash",
    getSuggestions: (app: App) => {
      const tagsRecord: Record<string, number> = (app.metadataCache as any)?.getTags?.() ?? {};
      return Object.entries(tagsRecord)
        .sort(([, a], [, b]) => b - a)
        .map(([tag, count]) => ({
          label: tag,
          description: t("mentions.tagCount", { count: String(count) }),
          value: tag,
        }));
    },
    formatInsertion: (item) => `${item.value} `,
  };
}
