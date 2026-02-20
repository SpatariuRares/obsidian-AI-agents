import { App, Notice, Setting, TextComponent, TextAreaComponent } from "obsidian";
import { ParsedAgent, AgentConfig } from "@app/types/AgentTypes";
import { DEFAULT_CONFIG } from "@app/services/AgentConfig";
import { AgentWriter } from "@app/utils/AgentWriter";
import { AgentRegistry } from "@app/services/AgentRegistry";
import { PluginSettings } from "@app/types/PluginTypes";
import { PathSuggest } from "@app/features/common/suggest/PathSuggest";

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
        onCancel: () => void
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
        headerEl.createEl("h3", { text: this.isEdit ? `Edit Agent: ${this.config.name}` : "Create New Agent" });

        const formContainer = this.containerEl.createDiv({ cls: "ai-agents-chat__editor-form" });

        // --- GENERAL ---
        new Setting(formContainer).setHeading().setName("General Information");

        new Setting(formContainer)
            .setName("Folder/ID")
            .setDesc("The unique folder name for this agent (lowercase, no spaces).")
            .addText(text => {
                text.setValue(this.idInput);
                text.setDisabled(this.isEdit);
                text.onChange(value => { this.idInput = value.trim(); });
            });

        new Setting(formContainer)
            .setName("Name")
            .setDesc("The display name of the agent.")
            .addText(text => {
                text.setValue(this.config.name);
                text.onChange(value => { this.config.name = value; });
            });

        new Setting(formContainer)
            .setName("Description")
            .setDesc("A short description of what this agent does.")
            .addText(text => {
                text.setValue(this.config.description);
                text.onChange(value => { this.config.description = value; });
            });

        new Setting(formContainer)
            .setName("Author")
            .setDesc("Author of this agent.")
            .addText(text => {
                text.setValue(this.config.author || "");
                text.onChange(value => { this.config.author = value; });
            });

        new Setting(formContainer)
            .setName("Avatar")
            .setDesc("Emoji or short string (e.g., 🤖).")
            .addText(text => {
                text.setValue(this.config.avatar);
                text.onChange(value => { this.config.avatar = value; });
            });

        new Setting(formContainer)
            .setName("Enabled")
            .setDesc("If disabled, the agent won't show up in the selector.")
            .addToggle(toggle => {
                toggle.setValue(this.config.enabled);
                toggle.onChange(value => { this.config.enabled = value; });
            });

        new Setting(formContainer)
            .setName("Type")
            .addDropdown(dropdown => {
                dropdown.addOptions({ conversational: "Conversational", task: "Task", scheduled: "Scheduled" });
                dropdown.setValue(this.config.type);
                dropdown.onChange(value => { this.config.type = value as any; });
            });

        // --- AI SETTINGS ---
        new Setting(formContainer).setHeading().setName("AI & Model Settings");

        new Setting(formContainer)
            .setName("Provider")
            .addDropdown(dropdown => {
                dropdown.addOptions({ ollama: "Ollama", openrouter: "OpenRouter" });
                dropdown.setValue(this.config.provider);
                dropdown.onChange(value => { this.config.provider = value; });
            });

        new Setting(formContainer)
            .setName("Model")
            .addText(text => {
                text.setValue(this.config.model);
                text.onChange(value => { this.config.model = value; });
            });

        new Setting(formContainer)
            .setName("Stream Responses")
            .addToggle(toggle => {
                toggle.setValue(!!this.config.stream);
                toggle.onChange(value => { this.config.stream = value; });
            });

        new Setting(formContainer)
            .setName("Max Context Tokens")
            .addText(text => {
                text.setValue(this.config.max_context_tokens.toString());
                text.onChange(value => {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed)) this.config.max_context_tokens = parsed;
                });
            });

        new Setting(formContainer)
            .setName("Strategy")
            .addText(text => {
                text.setValue(this.config.strategy || "inject_all");
                text.onChange(value => { this.config.strategy = value; });
            });

        // --- KNOWLEDGE & PERMISSIONS ---
        new Setting(formContainer).setHeading().setName("Knowledge & File Permissions");

        const createPathListSetting = (name: string, desc: string, field: keyof AgentConfig) => {
            const arr = (this.config[field] as string[]) || [];

            const setting = new Setting(formContainer)
                .setName(name)
                .setDesc(desc);

            const container = setting.controlEl;
            container.empty();
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.alignItems = "flex-end";
            container.style.gap = "8px";
            container.style.width = "100%";
            container.style.maxWidth = "350px";

            const listContainer = container.createDiv();
            listContainer.style.display = "flex";
            listContainer.style.flexDirection = "column";
            listContainer.style.gap = "4px";
            listContainer.style.width = "100%";

            const renderList = () => {
                listContainer.empty();
                arr.forEach((item, index) => {
                    const pill = listContainer.createDiv();
                    pill.style.display = "flex";
                    pill.style.alignItems = "center";
                    pill.style.justifyContent = "space-between";
                    pill.style.background = "var(--background-secondary-alt)";
                    pill.style.padding = "4px 8px";
                    pill.style.borderRadius = "4px";
                    pill.style.fontSize = "12px";
                    pill.style.border = "1px solid var(--background-modifier-border)";

                    pill.createSpan({ text: item });

                    const removeBtn = pill.createSpan({ text: "✕" });
                    removeBtn.style.cursor = "pointer";
                    removeBtn.style.color = "var(--text-muted)";
                    removeBtn.addEventListener("click", () => {
                        arr.splice(index, 1);
                        // @ts-ignore
                        this.config[field] = [...arr];
                        renderList();
                    });
                });
            };
            renderList();

            const inputContainer = container.createDiv();
            inputContainer.style.display = "flex";
            inputContainer.style.gap = "8px";
            inputContainer.style.width = "100%";

            const input = inputContainer.createEl("input", { type: "text", placeholder: "Add path or glob..." });
            input.style.flex = "1";

            new PathSuggest(this.app, input);

            const addBtn = inputContainer.createEl("button", { text: "Add" });
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

        createPathListSetting("Sources", "Paths to include in the knowledge context.", "sources");
        createPathListSetting("Read Permissions", "Paths this agent can read.", "read");
        createPathListSetting("Write Permissions", "Paths this agent can write to.", "write");
        createPathListSetting("Create Permissions", "Paths this agent can create files in.", "create");
        createPathListSetting("Move Permissions", "Paths this agent can move/rename.", "move");
        createPathListSetting("Delete Permissions", "Paths this agent can delete.", "delete");

        new Setting(formContainer)
            .setName("Vault Root Access")
            .setDesc("Allow access beyond the specified folders.")
            .addToggle(toggle => {
                toggle.setValue(this.config.vault_root_access);
                toggle.onChange(value => { this.config.vault_root_access = value; });
            });

        new Setting(formContainer)
            .setName("Confirm Destructive")
            .setDesc("Require user confirmation for write, move, delete operations.")
            .addToggle(toggle => {
                toggle.setValue(this.config.confirm_destructive);
                toggle.onChange(value => { this.config.confirm_destructive = value; });
            });

        // --- LOGGING ---
        new Setting(formContainer).setHeading().setName("Logging");

        new Setting(formContainer)
            .setName("Enable Logging")
            .addToggle(toggle => {
                toggle.setValue(this.config.logging_enabled);
                toggle.onChange(value => { this.config.logging_enabled = value; });
            });

        new Setting(formContainer)
            .setName("Logging Path")
            .addText(text => {
                text.setValue(this.config.logging_path);
                text.onChange(value => { this.config.logging_path = value; });
            });

        new Setting(formContainer)
            .setName("Logging Format")
            .addDropdown(dropdown => {
                dropdown.addOptions({ daily: "Daily", per_session: "Per Session", single: "Single File" });
                dropdown.setValue(this.config.logging_format);
                dropdown.onChange(value => { this.config.logging_format = value as any; });
            });

        new Setting(formContainer)
            .setName("Include Metadata")
            .addToggle(toggle => {
                toggle.setValue(this.config.logging_include_metadata);
                toggle.onChange(value => { this.config.logging_include_metadata = value; });
            });

        // --- PROMPT ---
        const promptSetting = new Setting(formContainer)
            .setName("System Prompt")
            .setHeading();

        promptSetting.descEl.createEl("p", {
            text: "The main instructions for this agent. Supports variables like {{user_name}}, {{date}}, etc.",
            cls: "setting-item-description"
        });

        const textareaContainer = formContainer.createDiv({ cls: "ai-agents-chat__editor-prompt-container" });
        const textarea = new TextAreaComponent(textareaContainer);
        textarea.setValue(this.promptTemplate);
        textarea.inputEl.style.width = "100%";
        textarea.inputEl.style.minHeight = "200px";
        textarea.onChange(value => {
            this.promptTemplate = value;
        });

        // --- ACTIONS ---
        const actionsContainer = this.containerEl.createDiv({ cls: "ai-agents-chat__editor-actions" });

        const cancelBtn = actionsContainer.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.onCancel());

        const saveBtn = actionsContainer.createEl("button", { text: "Save Agent", cls: "mod-cta" });
        saveBtn.addEventListener("click", () => this.handleSave());
    }

    private async handleSave() {
        if (!this.idInput) {
            new Notice("Folder/ID is required.");
            return;
        }

        if (!this.config.name || !this.config.model) {
            new Notice("Name and Model are required.");
            return;
        }

        try {
            await AgentWriter.saveAgent(
                this.app,
                this.settings.agentsFolder,
                this.idInput,
                this.config,
                this.promptTemplate
            );

            await this.agentRegistry.scan(this.settings.agentsFolder);
            new Notice(`Agent '${this.config.name}' saved successfully!`);
            this.onSave(this.idInput);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            new Notice(`Failed to save agent: ${msg}`);
            console.error(error);
        }
    }
}
