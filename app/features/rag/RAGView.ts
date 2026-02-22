/**
 * @fileoverview RAGView - Management view for RAG vector indices
 *
 * Provides a UI to select RAG-enabled agents, view index stats,
 * build/rebuild/clear indices, and browse indexed chunks.
 */

import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { ParsedAgent, AgentStrategy } from "@app/types/AgentTypes";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { PluginSettings } from "@app/types/PluginTypes";
import * as RAGPipeline from "@app/services/RAGPipeline";
import { createHeading } from "@app/components/atoms/Heading";
import { createButton } from "@app/components/atoms/Button";
import { createText } from "@app/components/atoms/Text";
import { createSelect } from "@app/components/atoms/Select";
import { createInput } from "@app/components/atoms/Input";
import { t } from "@app/i18n/LocalizationService";

export const VIEW_TYPE_RAG = "ai-agents-rag";

const CLS = "ai-agents-rag";

export interface RAGViewHost {
  agentRegistry: AgentRegistry;
  settings: () => PluginSettings;
}

export class RAGView extends ItemView {
  private host: RAGViewHost;
  private selectedAgent: ParsedAgent | null = null;
  private statsEl!: HTMLElement;
  private progressEl!: HTMLElement;
  private progressBarFill!: HTMLElement;
  private progressText!: HTMLElement;
  private chunkListEl!: HTMLElement;
  private actionsEl!: HTMLElement;
  private isIndexing = false;

  constructor(leaf: WorkspaceLeaf, host: RAGViewHost) {
    super(leaf);
    this.host = host;
  }

  getViewType(): string {
    return VIEW_TYPE_RAG;
  }

  getDisplayText(): string {
    return t("rag.viewTitle");
  }

  getIcon(): string {
    // eslint-disable-next-line i18next/no-literal-string
    return "database";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("ai-agents");
    container.addClass(CLS);

    // Header
    createHeading(container, {
      level: "h4",
      text: t("rag.viewTitle"),
      cls: `${CLS}__title`,
    });

    // Agent selector
    const selectorRow = container.createDiv({ cls: `${CLS}__selector` });
    createText(selectorRow, { tag: "label", text: t("rag.selectAgent"), cls: `${CLS}__label` });

    const ragAgents = this.getRAGAgents();
    const options = ragAgents.map((a) => ({
      value: a.id,
      text: `${a.config.avatar || ""} ${a.config.name}`.trim(),
    }));

    createSelect(selectorRow, {
      options,
      placeholder: t("rag.selectAgentPlaceholder"),
      cls: `${CLS}__select`,
      onChange: (value) => this.onAgentSelected(value),
    });

    // Stats panel
    this.statsEl = container.createDiv({ cls: `${CLS}__stats` });
    this.renderEmptyStats();

    // Progress bar
    this.progressEl = container.createDiv({ cls: `${CLS}__progress` });
    this.progressEl.setCssProps({ display: "none" });
    this.progressBarFill = this.progressEl.createDiv({ cls: `${CLS}__progress-bar` });
    const progressBarInner = this.progressBarFill.createDiv({ cls: `${CLS}__progress-bar-fill` });
    this.progressBarFill = progressBarInner;
    this.progressText = this.progressEl.createDiv({ cls: `${CLS}__progress-text` });

    // Actions
    this.actionsEl = container.createDiv({ cls: `${CLS}__actions` });
    this.renderActions();

    // Chunk browser
    const browserHeader = container.createDiv({ cls: `${CLS}__browser-header` });
    createText(browserHeader, { tag: "label", text: t("rag.chunkBrowser"), cls: `${CLS}__label` });

    const filterInput = createInput(browserHeader, {
      placeholder: t("rag.filterPlaceholder"),
      cls: `${CLS}__filter`,
    });
    filterInput.addEventListener("input", () => this.filterChunks(filterInput.value));

    this.chunkListEl = container.createDiv({ cls: `${CLS}__chunk-list` });
    createText(this.chunkListEl, {
      text: t("rag.selectAgentFirst"),
      cls: `${CLS}__empty-message`,
    });
  }

  async onClose(): Promise<void> {
    // No cleanup needed
  }

  // ---------------------------------------------------------------------------
  // Agent selection
  // ---------------------------------------------------------------------------

  private getRAGAgents(): ParsedAgent[] {
    return this.host.agentRegistry
      .getAllAgents()
      .filter((a) => a.config.strategy === AgentStrategy.RAG);
  }

  private async onAgentSelected(agentId: string): Promise<void> {
    const agent = this.host.agentRegistry.getAgent(agentId);
    if (!agent) return;
    this.selectedAgent = agent;
    await this.refreshStats();
    await this.refreshChunkList();
    this.renderActions();
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  private renderEmptyStats(): void {
    this.statsEl.empty();
    createText(this.statsEl, {
      text: t("rag.noStats"),
      cls: `${CLS}__empty-message`,
    });
  }

  private async refreshStats(): Promise<void> {
    if (!this.selectedAgent) {
      this.renderEmptyStats();
      return;
    }

    const store = RAGPipeline.getStoreForAgent(this.app, this.selectedAgent);
    await store.load();
    const stats = store.getStats();

    this.statsEl.empty();
    const grid = this.statsEl.createDiv({ cls: `${CLS}__stats-grid` });

    const items = [
      { label: t("rag.statsChunks"), value: String(stats.totalChunks) },
      { label: t("rag.statsFiles"), value: String(stats.totalFiles) },
      { label: t("rag.statsModel"), value: stats.embeddingModel || "-" },
      {
        label: t("rag.statsLastIndexed"),
        value: stats.lastIndexed ? new Date(stats.lastIndexed).toLocaleString() : "-",
      },
      {
        label: t("rag.statsSize"),
        value: stats.indexSizeBytes > 0 ? formatBytes(stats.indexSizeBytes) : "-",
      },
    ];

    for (const item of items) {
      const cell = grid.createDiv({ cls: `${CLS}__stats-item` });
      createText(cell, { tag: "span", text: item.label, cls: `${CLS}__stats-label` });
      createText(cell, { tag: "span", text: item.value, cls: `${CLS}__stats-value` });
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private renderActions(): void {
    this.actionsEl.empty();
    if (!this.selectedAgent) return;

    createButton(this.actionsEl, {
      text: t("rag.buildIndex"),
      cls: `${CLS}__action-btn mod-cta`,
      disabled: this.isIndexing,
      onClick: () => this.handleBuildIndex(false),
    });

    createButton(this.actionsEl, {
      text: t("rag.rebuildIndex"),
      cls: `${CLS}__action-btn`,
      disabled: this.isIndexing,
      onClick: () => this.handleBuildIndex(true),
    });

    createButton(this.actionsEl, {
      text: t("rag.clearIndex"),
      cls: `${CLS}__action-btn mod-warning`,
      disabled: this.isIndexing,
      onClick: () => this.handleClearIndex(),
    });
  }

  private async handleBuildIndex(rebuild: boolean): Promise<void> {
    if (!this.selectedAgent || this.isIndexing) return;

    this.isIndexing = true;
    this.renderActions();
    this.progressEl.setCssProps({ display: "" });

    try {
      if (rebuild) {
        // Clear the store first for a full rebuild
        const store = RAGPipeline.getStoreForAgent(this.app, this.selectedAgent);
        await store.clear();
        RAGPipeline.clearStoreCache(this.selectedAgent.folderPath);
      }

      const result = await RAGPipeline.buildIndex(
        this.selectedAgent,
        this.host.settings(),
        this.app,
        (progress) => {
          const pct =
            progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
          this.progressBarFill.setCssProps({ width: `${pct}%` });
          this.progressText.setText(`${progress.phase}: ${progress.message}`);
        },
      );

      new Notice(
        t("rag.indexComplete", {
          chunks: String(result.chunksIndexed),
          files: String(result.filesProcessed),
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(t("rag.indexFailed", { message: msg }));
    } finally {
      this.isIndexing = false;
      this.progressEl.setCssProps({ display: "none" });
      this.renderActions();
      await this.refreshStats();
      await this.refreshChunkList();
    }
  }

  private async handleClearIndex(): Promise<void> {
    if (!this.selectedAgent) return;

    const store = RAGPipeline.getStoreForAgent(this.app, this.selectedAgent);
    await store.clear();
    RAGPipeline.clearStoreCache(this.selectedAgent.folderPath);

    new Notice(t("rag.indexCleared"));
    await this.refreshStats();
    await this.refreshChunkList();
  }

  // ---------------------------------------------------------------------------
  // Chunk browser
  // ---------------------------------------------------------------------------

  private async refreshChunkList(): Promise<void> {
    this.chunkListEl.empty();

    if (!this.selectedAgent) {
      createText(this.chunkListEl, {
        text: t("rag.selectAgentFirst"),
        cls: `${CLS}__empty-message`,
      });
      return;
    }

    const store = RAGPipeline.getStoreForAgent(this.app, this.selectedAgent);
    const index = await store.load();

    if (index.entries.length === 0) {
      createText(this.chunkListEl, {
        text: t("rag.noChunks"),
        cls: `${CLS}__empty-message`,
      });
      return;
    }

    for (const entry of index.entries) {
      this.renderChunkItem(entry.metadata.headingPath, entry.metadata.filePath, entry.metadata.content);
    }
  }

  private renderChunkItem(headingPath: string, filePath: string, content: string): void {
    const item = this.chunkListEl.createDiv({
      cls: `${CLS}__chunk-item`,
      attr: { "data-heading": headingPath.toLowerCase(), "data-file": filePath.toLowerCase() },
    });

    item.createEl("strong", { text: headingPath, cls: `${CLS}__chunk-heading` });
    createText(item, { tag: "span", text: filePath, cls: `${CLS}__chunk-source` });
    createText(item, {
      tag: "p",
      text: content.substring(0, 150) + (content.length > 150 ? "..." : ""),
      cls: `${CLS}__chunk-preview`,
    });
  }

  private filterChunks(query: string): void {
    const q = query.toLowerCase();
    const items = this.chunkListEl.querySelectorAll(`.${CLS}__chunk-item`);
    items.forEach((el) => {
      const heading = el.getAttribute("data-heading") || "";
      const file = el.getAttribute("data-file") || "";
      const visible = !q || heading.includes(q) || file.includes(q);
      (el as HTMLElement).setCssProps({ display: visible ? "" : "none" });
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
