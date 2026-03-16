import { Modal, Setting } from "obsidian";

export class ConfirmModal extends Modal {
  private resolver?: (value: boolean) => void;

  constructor(
    app: Modal["app"],
    private readonly title: string,
    private readonly message: string,
    private readonly confirmLabel = "Confirm"
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => {
          this.closeWith(false);
        })
      )
      .addButton((button) =>
        button
          .setWarning()
          .setButtonText(this.confirmLabel)
          .onClick(() => {
            this.closeWith(true);
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    this.closeWith(false, false);
  }

  waitForDecision(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }

  private closeWith(value: boolean, shouldClose = true): void {
    const resolve = this.resolver;
    this.resolver = undefined;
    resolve?.(value);

    if (shouldClose) {
      this.close();
    }
  }
}
