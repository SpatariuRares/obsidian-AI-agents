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
    container.createEl("h4", { text: "Tool test view", cls: `${CLS}__title` });

    // Tool selector
    const selectorRow = container.createDiv({ cls: `${CLS}__selector` });
    selectorRow.createEl("label", { text: "Tool", cls: `${CLS}__label` });

    const select = selectorRow.createEl("select", { cls: `${CLS}__select` });
    select.createEl("option", {
      text: "Select a tool...",
      attr: { value: "", disabled: "true", selected: "true" },
    });
    for (const tool of allTools) {
      select.createEl("option", {
        text: tool.definition.name,
        attr: { value: tool.definition.name },
      });
    }
    select.addEventListener("change", () => this.onToolSelected(select.value));

    // Description
    this.descriptionEl = container.createDiv({ cls: `${CLS}__description` });

    // Dynamic form area
    this.formEl = container.createDiv({ cls: `${CLS}__form` });

    // Run button
    this.runBtn = container.createEl("button", {
      text: "Run",
      cls: `${CLS}__run-btn`,
    });
    this.runBtn.disabled = true;
    this.runBtn.addEventListener("click", () => this.runSelectedTool());

    // Output
    container
      .createDiv({ cls: `${CLS}__output-header` })
      .createEl("label", { text: "Output", cls: `${CLS}__label` });
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
    const fieldEl = this.formEl.createDiv({ cls: `${CLS}__field` });

    // Label
    const labelRow = fieldEl.createDiv({ cls: `${CLS}__field-label` });
    labelRow.createSpan({ text: name });
    if (isRequired) {
      labelRow.createSpan({ text: "*", cls: `${CLS}__required` });
    }

    // Description hint
    if (schema.description) {
      fieldEl.createDiv({ text: schema.description, cls: `${CLS}__hint` });
    }

    // Input element — choose based on schema type/enum
    let inputEl: HTMLElement;

    if (schema.enum) {
      // Dropdown for enum fields
      const sel = fieldEl.createEl("select", { cls: `${CLS}__input` });
      for (const val of schema.enum) {
        sel.createEl("option", { text: val, attr: { value: val } });
      }
      inputEl = sel;
    } else if (schema.type === "boolean") {
      // Checkbox row for booleans
      const checkRow = fieldEl.createDiv({ cls: `${CLS}__check-row` });
      const cb = checkRow.createEl("input", {
        attr: { type: "checkbox" },
        cls: `${CLS}__checkbox`,
      });
      checkRow.createSpan({ text: "enabled" });
      inputEl = cb;
    } else if (name === "content") {
      // Textarea for content-like string fields
      const ta = fieldEl.createEl("textarea", {
        attr: { placeholder: name, rows: "4" },
        cls: `${CLS}__input ${CLS}__textarea`,
      });
      inputEl = ta;
    } else {
      // Default text input
      const inp = fieldEl.createEl("input", {
        attr: { type: "text", placeholder: name },
        cls: `${CLS}__input`,
      });
      inputEl = inp;
    }

    this.inputMap.set(name, inputEl);
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
