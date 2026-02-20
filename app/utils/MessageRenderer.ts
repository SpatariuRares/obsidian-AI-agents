import { App, Component, MarkdownRenderer } from "obsidian";

/**
 * MessageRenderer
 * 
 * Handles the rendering of markdown content inside chat message bubbles.
 * Uses Obsidian's native MarkdownRenderer to support all standard Obsidian
 * markdown features, including code blocks, latex, and plugins.
 */
export class MessageRenderer {
  /**
   * Renders the given markdown string into the container element.
   * 
   * @param app The main Obsidian App instance.
   * @param content The markdown string to render.
   * @param containerEl The HTML element where the content will be injected.
   * @param sourcePath The path for resolving relative links (empty string for chat).
   * @param component The parent component for lifecycle management (e.g., unloading code blocks).
   */
  static async render(
    app: App,
    content: string,
    containerEl: HTMLElement,
    sourcePath: string,
    component: Component
  ): Promise<void> {
    try {
      containerEl.empty();
      await MarkdownRenderer.render(app, content, containerEl, sourcePath, component);
    } catch (_error) {
      containerEl.empty();
      containerEl.createDiv({
        text: "Error rendering message. Showing raw text:",
        cls: "ai-agents-chat__error-text"
      });
      containerEl.createEl("pre", { text: content });
    }
  }
}
