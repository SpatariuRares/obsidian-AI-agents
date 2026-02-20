/**
 * @fileoverview PermissionModal - UI modal to ask user for permission for file operations
 */

import { App, Modal, Setting } from "obsidian";
import { FileOperationType } from "@app/services/PermissionGuard";
import { t } from "@app/i18n";

export class PermissionModal extends Modal {
  private agentName: string;
  private operation: FileOperationType;
  private path: string;
  private description: string;

  private resolvePromise!: (value: boolean) => void;

  constructor(
    app: App,
    agentName: string,
    operation: FileOperationType,
    path: string,
    description?: string,
  ) {
    super(app);
    this.agentName = agentName;
    this.operation = operation;
    this.path = path;
    this.description =
      description ||
      t("permission.defaultDescription", {
        agentName: this.agentName,
        operation: this.operation,
        path: this.path,
      });
  }

  /**
   * Opens the modal and returns a promise that resolves to true if accepted, false if rejected.
   */
  async requestPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: t("permission.title") });

    contentEl.createEl("p", { text: this.description });
    contentEl.createEl("p", { text: t("permission.confirmQuestion") });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText(t("permission.decline"))
          .setCta()
          .onClick(() => {
            this.resolvePromise(false);
            this.close();
          }),
      )
      .addButton((btn) =>
        btn
          .setButtonText(t("permission.allow"))
          .setWarning()
          .onClick(() => {
            this.resolvePromise(true);
            this.close();
          }),
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    // In case the user closes the modal by clicking outside
    if (this.resolvePromise) {
      this.resolvePromise(false);
    }
  }
}
