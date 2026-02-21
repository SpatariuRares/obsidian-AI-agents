/**
 * @fileoverview ToolTestView - Dynamic testing view for file operation tools.
 *
 * Reads tool definitions from `allTools` and generates the UI entirely from
 * each tool's JSON-schema `parameters`. Adding a new tool to allTools is
 * enough — this view picks it up automatically.
 */

/* eslint-disable i18next/no-literal-string */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { ToolHandler } from "@app/services/ToolHandler";
import { AgentConfig } from "@app/types/AgentTypes";
import { DEFAULT_CONFIG } from "@app/services/AgentConfig";
import { allTools } from "@app/services/tools/allTools";
import { BaseTool } from "@app/services/tools/BaseTool";
import { createHeading } from "@app/components/atoms/Heading";
import { createButton } from "@app/components/atoms/Button";
import { createText } from "@app/components/atoms/Text";
import { createSelect } from "@app/components/atoms/Select";
import { createInput } from "@app/components/atoms/Input";
import { createTextarea } from "@app/components/atoms/Textarea";
import { createCheckbox } from "@app/components/atoms/Checkbox";
import { createFormField } from "@app/components/molecules/FormField";

export const VIEW_TYPE_TOOL_TEST = "ai-agents-tool-test";

const CLS = "ai-agents-tool-test";

/** Permissive config that grants all permissions for testing. */
const TEST_CONFIG: AgentConfig = {
  ...DEFAULT_CONFIG,
  name: "ToolTestView",
  read: ["**"],
  write: ["**"],
  create: ["**"],
  move: ["**"],
  delete: ["**"],
  vault_root_access: true,
  confirm_destructive: false,
};

interface ParamProperty {
  type: string;
  description?: string;
  enum?: string[];
}

export class ToolTestView extends ItemView {
  private formEl!: HTMLElement;
  private outputEl!: HTMLPreElement;
  private runBtn!: HTMLButtonElement;
  private descriptionEl!: HTMLElement;
  private inputMap: Map<string, HTMLElement> = new Map();
  private selectedTool: BaseTool | null = null;

  getViewType(): string {
    return VIEW_TYPE_TOOL_TEST;
  }

  getDisplayText(): string {
    return "Tool test view";
  }

  getIcon(): string {
    return "wrench";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass(CLS);

    // Header
    createHeading(container, { level: "h4", text: "Tool test view", cls: `${CLS}__title` });

    // Tool selector
    const selectorRow = container.createDiv({ cls: `${CLS}__selector` });
    createText(selectorRow, { tag: "label", text: "Tool", cls: `${CLS}__label` });

    createSelect(selectorRow, {
      options: allTools.map((tool) => ({
        value: tool.definition.name,
        text: tool.definition.name,
      })),
      placeholder: "Select a tool...",
      cls: `${CLS}__select`,
      onChange: (value) => this.onToolSelected(value),
    });

    // Description
    this.descriptionEl = container.createDiv({ cls: `${CLS}__description` });

    // Dynamic form area
    this.formEl = container.createDiv({ cls: `${CLS}__form` });

    // Run button
    this.runBtn = createButton(container, {
      text: "Run",
      cls: `${CLS}__run-btn`,
      disabled: true,
      onClick: () => this.runSelectedTool(),
    });

    // Output
    createText(
      container.createDiv({ cls: `${CLS}__output-header` }),
      { tag: "label", text: "Output", cls: `${CLS}__label` },
    );
    this.outputEl = container.createEl("pre", { cls: `${CLS}__output` });
    this.outputEl.setText("Results will appear here...");
  }

  async onClose(): Promise<void> {
    this.inputMap.clear();
  }

  /** Called when the user picks a different tool from the select. */
  private onToolSelected(toolName: string): void {
    const tool = allTools.find((t) => t.definition.name === toolName);
    if (!tool) return;

    this.selectedTool = tool;
    this.inputMap.clear();
    this.formEl.empty();
    this.outputEl.setText("Results will appear here...");
    this.outputEl.classList.remove(`${CLS}__output--error`, `${CLS}__output--success`);

    // Show description
    this.descriptionEl.empty();
    this.descriptionEl.setText(tool.definition.description);

    // Build form fields from parameter schema
    const params = tool.definition.parameters;
    const properties: Record<string, ParamProperty> = params?.properties ?? {};
    const required: string[] = params?.required ?? [];

    for (const [paramName, schema] of Object.entries(properties)) {
      const isRequired = required.includes(paramName);
      this.buildField(paramName, schema, isRequired);
    }

    this.runBtn.disabled = false;
    this.runBtn.setText(`Run ${tool.definition.name}`);
  }

  /** Builds a single form field from a JSON-schema property. */
  private buildField(name: string, schema: ParamProperty, isRequired: boolean): void {
    createFormField(this.formEl, {
      label: name,
      required: isRequired,
      description: schema.description,
      cls: `${CLS}__field`,
      renderInput: (inputContainer) => {
        let inputEl: HTMLElement;

        if (schema.enum) {
          inputEl = createSelect(inputContainer, {
            options: schema.enum.map((val) => ({ value: val, text: val })),
            cls: `${CLS}__input`,
          });
        } else if (schema.type === "boolean") {
          const checkRow = inputContainer.createDiv({ cls: `${CLS}__check-row` });
          inputEl = createCheckbox(checkRow, { cls: `${CLS}__checkbox` });
          createText(checkRow, { text: "enabled" });
        } else if (name === "content") {
          inputEl = createTextarea(inputContainer, {
            placeholder: name,
            rows: 4,
            cls: `${CLS}__input ${CLS}__textarea`,
          });
        } else {
          inputEl = createInput(inputContainer, {
            placeholder: name,
            cls: `${CLS}__input`,
          });
        }

        this.inputMap.set(name, inputEl);
      },
    });
  }

  /** Collects form values and executes the selected tool. */
  private async runSelectedTool(): Promise<void> {
    if (!this.selectedTool) return;

    const args: Record<string, unknown> = {};
    for (const [name, el] of this.inputMap.entries()) {
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        args[name] = el.checked;
      } else if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        args[name] = el.value;
      }
    }

    this.outputEl.classList.remove(`${CLS}__output--error`, `${CLS}__output--success`);
    this.outputEl.setText("Running...");
    this.runBtn.disabled = true;

    try {
      const result = await ToolHandler.executeTool(
        this.app,
        TEST_CONFIG,
        this.selectedTool.definition.name,
        args,
      );
      const isSuccess = result?.success === true;
      this.outputEl.classList.toggle(`${CLS}__output--success`, isSuccess);
      this.outputEl.classList.toggle(`${CLS}__output--error`, !isSuccess);
      this.outputEl.setText(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.outputEl.classList.add(`${CLS}__output--error`);
      this.outputEl.setText("Error: " + msg);
    } finally {
      this.runBtn.disabled = false;
    }
  }
}
