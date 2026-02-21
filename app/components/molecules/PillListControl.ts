import { createText } from "@app/components/atoms/Text";

export interface PillListControlProps {
  container: HTMLElement;
  items: string[];
  onChange: (items: string[]) => void;
  renderInput?: (
    inputContainer: HTMLElement,
    onAdd: (val: string) => void,
    currentItems: string[],
  ) => void;
  formatPillText?: (item: string) => string;
}

export class PillListControl {
  private items: string[];
  private listContainer: HTMLElement;
  private inputContainer?: HTMLElement;
  private onChange: (items: string[]) => void;
  private formatPillText: (item: string) => string;
  private renderInputFn?: PillListControlProps["renderInput"];

  constructor(props: PillListControlProps) {
    this.items = [...props.items];
    this.onChange = props.onChange;
    this.formatPillText = props.formatPillText || ((item) => item);
    this.renderInputFn = props.renderInput;

    props.container.addClass("ai-agents-chat__editor-permissions-control");

    this.listContainer = props.container.createDiv({
      cls: "ai-agents-chat__editor-permissions-list",
    });

    if (props.renderInput) {
      this.inputContainer = props.container.createDiv({
        cls: "ai-agents-chat__editor-permissions-input-container",
      });
    }

    this.render();
  }

  private handleAdd(val: string) {
    if (val && !this.items.includes(val)) {
      this.items.push(val);
      this.onChange([...this.items]);
      this.render();
    }
  }

  public setItems(items: string[]) {
    this.items = [...items];
    this.render();
  }

  private render() {
    this.listContainer.empty();
    this.items.forEach((item, index) => {
      const pill = this.listContainer.createDiv({
        cls: "ai-agents-chat__editor-permissions-pill",
      });

      createText(pill, { text: this.formatPillText(item) });

      const removeBtn = pill.createSpan({
        text: "✕",
        cls: "ai-agents-chat__editor-permissions-remove",
      });

      removeBtn.addEventListener("click", () => {
        this.items.splice(index, 1);
        this.onChange([...this.items]);
        this.render();
      });
    });

    if (this.inputContainer && this.renderInputFn) {
      this.inputContainer.empty();
      this.renderInputFn(this.inputContainer, this.handleAdd.bind(this), this.items);
    }
  }
}
