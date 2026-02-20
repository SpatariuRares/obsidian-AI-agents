import { App, Notice, Setting, TextAreaComponent } from "obsidian";
import { ParsedAgent, AgentConfig } from "@app/types/AgentTypes";
import { DEFAULT_CONFIG } from "@app/services/AgentConfig";
import { AgentWriter } from "@app/utils/AgentWriter";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { PluginSettings } from "@app/types/PluginTypes";
import { PathSuggest } from "@app/features/common/suggest/PathSuggest";
import { t } from "@app/i18n";
import { CONSTANTS } from "@app/types/constants";

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
    headerEl.createEl("h3", {
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

    new Setting(formContainer).setName(t("editor.strategy")).addText((text) => {
      text.setValue(this.config.strategy || CONSTANTS.DEFAULT_AGENT_STRATEGY);
      text.onChange((value) => {
        this.config.strategy = value;
      });
    });

    // --- KNOWLEDGE & PERMISSIONS ---
    new Setting(formContainer).setHeading().setName(t("editor.permissionsHeading"));

    const createPathListSetting = (name: string, desc: string, field: keyof AgentConfig) => {
      const arr = (this.config[field] as string[]) || [];

      const setting = new Setting(formContainer).setName(name).setDesc(desc);

      const container = setting.controlEl;
      container.empty();
      container.addClass("ai-agents-chat__editor-permissions-control");

      const listContainer = container.createDiv({ cls: "ai-agents-chat__editor-permissions-list" });

      const renderList = () => {
        listContainer.empty();
        arr.forEach((item, index) => {
          const pill = listContainer.createDiv({ cls: "ai-agents-chat__editor-permissions-pill" });

          pill.createSpan({ text: item });

          const removeBtn = pill.createSpan({
            text: "✕",
            cls: "ai-agents-chat__editor-permissions-remove",
          });
          removeBtn.addEventListener("click", () => {
            arr.splice(index, 1);
            // @ts-ignore
            this.config[field] = [...arr];
            renderList();
          });
        });
      };
      renderList();

      const inputContainer = container.createDiv({
        cls: "ai-agents-chat__editor-permissions-input-container",
      });

      const input = inputContainer.createEl("input", {
        type: "text",
        placeholder: t("editor.pathPlaceholder"),
        cls: "ai-agents-chat__editor-permissions-input",
      });

      new PathSuggest(this.app, input);

      const addBtn = inputContainer.createEl("button", { text: t("editor.addBtn") });
      addBtn.addEventListener("click", () => {
        const val = input.value.trim();
        if (val && !arr.includes(val)) {
          arr.push(val);
          // @ts-ignore
          this.config[field] = [...arr];
          input.value = "";
          renderList();
        }
      });
    };

    createPathListSetting(t("editor.sources"), t("editor.sourcesDesc"), "sources");
    createPathListSetting(t("editor.readPermissions"), t("editor.readPermissionsDesc"), "read");
    createPathListSetting(t("editor.writePermissions"), t("editor.writePermissionsDesc"), "write");
    createPathListSetting(
      t("editor.createPermissions"),
      t("editor.createPermissionsDesc"),
      "create",
    );
    createPathListSetting(t("editor.movePermissions"), t("editor.movePermissionsDesc"), "move");
    createPathListSetting(
      t("editor.deletePermissions"),
      t("editor.deletePermissionsDesc"),
      "delete",
    );

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

    // --- PROMPT ---
    const promptSetting = new Setting(formContainer).setName(t("editor.systemPrompt")).setHeading();

    promptSetting.descEl.createEl("p", {
      text: t("editor.systemPromptDesc"),
      cls: "setting-item-description",
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

    // --- ACTIONS ---
    const actionsContainer = this.containerEl.createDiv({ cls: "ai-agents-chat__editor-actions" });

    const cancelBtn = actionsContainer.createEl("button", { text: t("editor.cancelBtn") });
    cancelBtn.addEventListener("click", () => this.onCancel());

    const saveBtn = actionsContainer.createEl("button", {
      text: t("editor.saveBtn"),
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", () => this.handleSave());
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
