import { App, Notice, Setting, TextAreaComponent } from "obsidian";
import { ParsedAgent, AgentConfig, AgentStrategy } from "@app/types/AgentTypes";
import { DEFAULT_CONFIG } from "@app/services/AgentConfig";
import { AgentWriter } from "@app/utils/AgentWriter";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { PluginSettings } from "@app/types/PluginTypes";
import { PathSuggest } from "@app/features/common/suggest/PathSuggest";
import { t } from "@app/i18n";
import { CONSTANTS } from "@app/types/constants";
import { allTools } from "@app/services/tools/allTools";
import { PillListControl } from "@app/components/molecules/PillListControl";
import { createHeading } from "@app/components/atoms/Heading";
import { createButton } from "@app/components/atoms/Button";
import { createText } from "@app/components/atoms/Text";
import { createSelect } from "@app/components/atoms/Select";
import { createInput } from "@app/components/atoms/Input";
import { createActionFooter } from "@app/components/molecules/ActionFooter";

/**
 * Maps tool names to the AgentConfig permission field they require.
 * Used to conditionally show permission inputs based on selected tools.
 */
const TOOL_PERMISSION_MAP: Record<string, keyof AgentConfig> = {
  read_file: "read",
  list_files: "read",
  write_file: "write",
  create_file: "create",
  move_file: "move",
  delete_file: "delete",
};

export class AgentEditor {
  private app: App;
  private containerEl: HTMLElement;
  private agentRegistry: AgentRegistry;
  private settings: PluginSettings;

  private onSave: (agentId: string) => void;
  private onCancel: () => void;

  private isEdit: boolean;
  private originalAgentId: string | null;

  // Form state
  private config: AgentConfig;
  private promptTemplate: string;
  private idInput: string;

  /** Container for dynamically rendered tool-specific permission fields */
  private permissionFieldsEl: HTMLElement | null = null;

  /** Container for RAG-specific configuration fields */
  private ragFieldsEl: HTMLElement | null = null;

  constructor(
    app: App,
    containerEl: HTMLElement,
    agentRegistry: AgentRegistry,
    settings: PluginSettings,
    agentToEdit: ParsedAgent | null,
    onSave: (agentId: string) => void,
    onCancel: () => void,
  ) {
    this.app = app;
    this.containerEl = containerEl;
    this.agentRegistry = agentRegistry;
    this.settings = settings;
    this.onSave = onSave;
    this.onCancel = onCancel;

    this.isEdit = agentToEdit !== null;
    this.originalAgentId = agentToEdit ? agentToEdit.id : null;

    if (agentToEdit) {
      // Deep copy to avoid mutating the original until save
      this.config = JSON.parse(JSON.stringify(agentToEdit.config));
      this.promptTemplate = agentToEdit.promptTemplate;
      this.idInput = agentToEdit.id;
    } else {
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.config.name = "New Agent";
      this.promptTemplate = "You are a helpful assistant.";
      this.idInput = "new-agent";
    }
  }

  render() {
    this.containerEl.empty();

    const headerEl = this.containerEl.createDiv({ cls: "ai-agents-chat__editor-header" });
    createHeading(headerEl, {
      level: "h3",
      text: this.isEdit
        ? t("editor.editTitle", { name: this.config.name })
        : t("editor.createTitle"),
    });

    const formContainer = this.containerEl.createDiv({ cls: "ai-agents-chat__editor-form" });

    // --- GENERAL ---
    new Setting(formContainer).setHeading().setName(t("editor.generalHeading"));

    new Setting(formContainer)
      .setName(t("editor.folderId"))
      .setDesc(t("editor.folderIdDesc"))
      .addText((text) => {
        text.setValue(this.idInput);
        text.setDisabled(this.isEdit);
        text.onChange((value) => {
          this.idInput = value.trim();
        });
      });

    new Setting(formContainer)
      .setName(t("editor.name"))
      .setDesc(t("editor.nameDesc"))
      .addText((text) => {
        text.setValue(this.config.name);
        text.onChange((value) => {
          this.config.name = value;
        });
      });

    new Setting(formContainer)
      .setName(t("editor.description"))
      .setDesc(t("editor.descriptionDesc"))
      .addText((text) => {
        text.setValue(this.config.description);
        text.onChange((value) => {
          this.config.description = value;
        });
      });

    new Setting(formContainer)
      .setName(t("editor.author"))
      .setDesc(t("editor.authorDesc"))
      .addText((text) => {
        text.setValue(this.config.author || "");
        text.onChange((value) => {
          this.config.author = value;
        });
      });

    new Setting(formContainer)
      .setName(t("editor.avatar"))
      .setDesc(t("editor.avatarDesc"))
      .addText((text) => {
        text.setValue(this.config.avatar);
        text.onChange((value) => {
          this.config.avatar = value;
        });
      });

    new Setting(formContainer)
      .setName(t("editor.enabled"))
      .setDesc(t("editor.enabledDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.config.enabled);
        toggle.onChange((value) => {
          this.config.enabled = value;
        });
      });

    new Setting(formContainer).setName(t("editor.type")).addDropdown((dropdown) => {
      dropdown.addOptions({
        conversational: t("editor.typeConversational"),
        task: t("editor.typeTask"),
        scheduled: t("editor.typeScheduled"),
      });
      dropdown.setValue(this.config.type);
      dropdown.onChange((value) => {
        this.config.type = value as any;
      });
    });

    // --- PROMPT ---
    const promptSetting = new Setting(formContainer).setName(t("editor.systemPrompt")).setHeading();

    createText(promptSetting.descEl, {
      tag: "p",
      text: t("editor.systemPromptDesc"),
      cls: "ai-agents-setting-item-description",
    });

    const textareaContainer = formContainer.createDiv({
      cls: "ai-agents-chat__editor-prompt-container",
    });
    const textarea = new TextAreaComponent(textareaContainer);
    textarea.setValue(this.promptTemplate);
    textarea.inputEl.addClass("ai-agents-chat__editor-prompt-textarea");
    textarea.onChange((value) => {
      this.promptTemplate = value;
    });

    // --- AI SETTINGS ---
    new Setting(formContainer).setHeading().setName(t("editor.aiHeading"));

    new Setting(formContainer).setName(t("editor.provider")).addDropdown((dropdown) => {
      dropdown.addOptions({ ollama: "Ollama", openrouter: "OpenRouter" });
      dropdown.setValue(this.config.provider);
      dropdown.onChange((value) => {
        this.config.provider = value;
      });
    });

    new Setting(formContainer).setName(t("editor.model")).addText((text) => {
      text.setValue(this.config.model);
      text.onChange((value) => {
        this.config.model = value;
      });
    });

    new Setting(formContainer).setName(t("editor.streamResponses")).addToggle((toggle) => {
      toggle.setValue(!!this.config.stream);
      toggle.onChange((value) => {
        this.config.stream = value;
      });
    });

    new Setting(formContainer).setName(t("editor.maxContextTokens")).addText((text) => {
      text.setValue(this.config.max_context_tokens.toString());
      text.onChange((value) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) this.config.max_context_tokens = parsed;
      });
    });

    new Setting(formContainer).setName(t("editor.strategy")).addDropdown((dropdown) => {
      dropdown.addOptions({
        inject_all: AgentStrategy.INJECT_ALL,
        RAG: AgentStrategy.RAG,
      });
      dropdown.setValue(this.config.strategy || CONSTANTS.DEFAULT_AGENT_STRATEGY);
      dropdown.onChange((value) => {
        this.config.strategy = value as AgentStrategy;
        this.renderRAGFields();
      });
    });

    // --- RAG CONFIG (conditional) ---
    this.ragFieldsEl = formContainer.createDiv();
    this.renderRAGFields();

    // --- KNOWLEDGE ---
    new Setting(formContainer).setHeading().setName(t("editor.permissionsHeading"));

    this.createPathListSetting(
      formContainer,
      t("editor.sources"),
      t("editor.sourcesDesc"),
      "sources",
    );

    // --- TOOLS & PERMISSIONS ---
    new Setting(formContainer).setHeading().setName(t("editor.toolsHeading"));

    const toolsSetting = new Setting(formContainer)
      .setName(t("editor.tools"))
      .setDesc(t("editor.toolsDesc"));

    const toolsContainer = toolsSetting.controlEl;
    toolsContainer.empty();

    new PillListControl({
      container: toolsContainer,
      items: this.config.tools || [],
      onChange: (items) => {
        this.config.tools = items;
        this.renderPermissionFields();
      },
      formatPillText: (toolName) => (toolName === "*" ? t("editor.allToolsWildcard") : toolName),
      renderInput: (inputContainer, onAdd, currentItems) => {
        const toolOptions = [];
        if (!currentItems.includes("*")) {
          toolOptions.push({
            value: "*",
            text: t("editor.allToolsWildcard"),
            title: t("editor.allToolsWildcardTitle"),
          });
        }
        allTools.forEach((tool) => {
          if (!currentItems.includes(tool.definition.name)) {
            toolOptions.push({
              value: tool.definition.name,
              text: tool.definition.name,
              title: tool.definition.description,
            });
          }
        });

        const selectInput = createSelect(inputContainer, {
          options: toolOptions,
          placeholder: t("editor.selectTool"),
          cls: "ai-agents-chat__editor-permissions-input dropdown",
        });

        createButton(inputContainer, {
          text: t("editor.addToolBtn"),
          onClick: () => {
            const val = selectInput.value;
            if (val) onAdd(val);
          },
        });
      },
    });

    // Dynamic container for tool-specific permission fields
    this.permissionFieldsEl = formContainer.createDiv();
    this.renderPermissionFields();

    new Setting(formContainer)
      .setName(t("editor.vaultRootAccess"))
      .setDesc(t("editor.vaultRootAccessDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.config.vault_root_access);
        toggle.onChange((value) => {
          this.config.vault_root_access = value;
        });
      });

    new Setting(formContainer)
      .setName(t("editor.confirmDestructive"))
      .setDesc(t("editor.confirmDestructiveDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.config.confirm_destructive);
        toggle.onChange((value) => {
          this.config.confirm_destructive = value;
        });
      });

    // --- MEMORY ---
    new Setting(formContainer).setHeading().setName(t("editor.memoryHeading"));

    new Setting(formContainer)
      .setName(t("editor.enableMemory"))
      .setDesc(t("editor.enableMemoryDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.config.memory);
        toggle.onChange((value) => {
          this.config.memory = value;
        });
      });

    // --- ACTIONS ---
    createActionFooter(this.containerEl, {
      buttons: [
        { text: t("editor.cancelBtn"), onClick: () => this.onCancel() },
        { text: t("editor.saveBtn"), variant: "primary", onClick: () => this.handleSave() },
      ],
      cls: "ai-agents-chat__editor-actions",
    });
  }

  /**
   * Renders RAG-specific configuration fields (embedding model, top-k, threshold).
   * Only visible when strategy is RAG.
   */
  private renderRAGFields(): void {
    if (!this.ragFieldsEl) return;
    this.ragFieldsEl.empty();

    if (this.config.strategy !== AgentStrategy.RAG) return;

    new Setting(this.ragFieldsEl).setHeading().setName(t("editor.ragHeading"));

    new Setting(this.ragFieldsEl)
      .setName(t("editor.ragEmbeddingModel"))
      .setDesc(t("editor.ragEmbeddingModelDesc"))
      .addText((text) => {
        // eslint-disable-next-line i18next/no-literal-string, obsidianmd/ui/sentence-case -- model identifier
        text.setPlaceholder("nomic-embed-text");
        text.setValue(this.config.rag_embedding_model || "");
        text.onChange((value) => {
          this.config.rag_embedding_model = value || undefined;
        });
      });

    new Setting(this.ragFieldsEl)
      .setName(t("editor.ragTopK"))
      .setDesc(t("editor.ragTopKDesc"))
      .addText((text) => {
        text.setPlaceholder("5");
        text.setValue(this.config.rag_top_k?.toString() || "");
        text.onChange((value) => {
          const parsed = parseInt(value, 10);
          this.config.rag_top_k = !isNaN(parsed) && parsed > 0 ? parsed : undefined;
        });
      });

    new Setting(this.ragFieldsEl)
      .setName(t("editor.ragSimilarityThreshold"))
      .setDesc(t("editor.ragSimilarityThresholdDesc"))
      .addText((text) => {
        text.setPlaceholder("0.7");
        text.setValue(this.config.rag_similarity_threshold?.toString() || "");
        text.onChange((value) => {
          const parsed = parseFloat(value);
          this.config.rag_similarity_threshold =
            !isNaN(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
        });
      });
  }

  /**
   * Returns the set of permission fields required by the currently selected tools.
   * Always returns an empty set if no tools are selected.
   * Returns all permission fields when "*" (all tools) is selected.
   */
  private getRequiredPermissionFields(): Set<string> {
    const tools = this.config.tools || [];
    if (tools.includes("*")) {
      return new Set(Object.values(TOOL_PERMISSION_MAP));
    }
    const fields = new Set<string>();
    for (const tool of tools) {
      const field = TOOL_PERMISSION_MAP[tool];
      if (field) fields.add(field);
    }
    return fields;
  }

  /**
   * Re-renders the tool-specific permission fields (read, write, create, move, delete)
   * based on which tools are currently selected.
   */
  private renderPermissionFields(): void {
    if (!this.permissionFieldsEl) return;
    this.permissionFieldsEl.empty();

    const requiredFields = this.getRequiredPermissionFields();

    const permissionEntries: { name: string; desc: string; field: keyof AgentConfig }[] = [
      { name: t("editor.readPermissions"), desc: t("editor.readPermissionsDesc"), field: "read" },
      {
        name: t("editor.writePermissions"),
        desc: t("editor.writePermissionsDesc"),
        field: "write",
      },
      {
        name: t("editor.createPermissions"),
        desc: t("editor.createPermissionsDesc"),
        field: "create",
      },
      { name: t("editor.movePermissions"), desc: t("editor.movePermissionsDesc"), field: "move" },
      {
        name: t("editor.deletePermissions"),
        desc: t("editor.deletePermissionsDesc"),
        field: "delete",
      },
    ];

    for (const entry of permissionEntries) {
      if (requiredFields.has(entry.field)) {
        this.createPathListSetting(this.permissionFieldsEl, entry.name, entry.desc, entry.field);
      }
    }
  }

  /** Creates a path list setting with PillListControl and PathSuggest. */
  private createPathListSetting(
    container: HTMLElement,
    name: string,
    desc: string,
    field: keyof AgentConfig,
  ): void {
    const setting = new Setting(container).setName(name).setDesc(desc);

    new PillListControl({
      container: setting.controlEl,
      items: (this.config[field] as string[]) || [],
      onChange: (items: string[]) => {
        // @ts-ignore
        this.config[field] = items;
      },
      renderInput: (inputContainer, onAdd) => {
        const input = createInput(inputContainer, {
          placeholder: t("editor.pathPlaceholder"),
          cls: "ai-agents-chat__editor-permissions-input",
        });

        new PathSuggest(this.app, input);

        createButton(inputContainer, {
          text: t("editor.addBtn"),
          onClick: () => {
            const val = input.value.trim();
            if (val) {
              onAdd(val);
              input.value = "";
            }
          },
        });
      },
    });
  }

  private async handleSave() {
    if (!this.idInput) {
      new Notice(t("notices.folderIdRequired"));
      return;
    }

    if (!this.config.name) {
      new Notice(t("notices.nameRequired"));
      return;
    }

    try {
      await AgentWriter.saveAgent(
        this.app,
        this.settings.agentsFolder,
        this.idInput,
        this.config,
        this.promptTemplate,
      );

      await this.agentRegistry.scan(this.settings.agentsFolder);
      new Notice(t("notices.agentSaved", { name: this.config.name }));
      this.onSave(this.idInput);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(t("notices.agentSaveFailed", { message: msg }));
      // console.error(error);
    }
  }
}
