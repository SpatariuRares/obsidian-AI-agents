/**
 * @fileoverview ExampleView - Example Code Block Processor
 *
 * Demonstrates the embedded code block processor pattern in Obsidian.
 *
 * --- How to register this processor in main.ts ---
 * ```typescript
 * this.registerMarkdownCodeBlockProcessor(
 *   'example-block',         // The code block language identifier
 *   (source, el, ctx) => {
 *     const view = new ExampleView(source, el);
 *     ctx.addChild(view);    // Registers lifecycle with Obsidian
 *   }
 * );
 * ```
 *
 * Users then write blocks in their notes like:
 * ````markdown
 * ```example-block
 * title: My Example
 * color: accent
 * ```
 * ````
 */

import { MarkdownRenderChild, parseYaml } from "obsidian";

/**
 * Parameters parsed from the YAML code block source.
 *
 * --- How to extend for real features ---
 * Add new optional fields here, then extract and validate them in
 * parseSource() below. Use specific types (string, number, boolean)
 * rather than `any` so TypeScript enforces correctness at usage sites.
 */
interface ExampleBlockParams {
  /** The title to display in the rendered block header */
  title?: string;
  /**
   * A colour hint for the block:
   *   'accent'  → var(--interactive-accent)
   *   'warning' → var(--text-warning)
   *   'error'   → var(--text-error)
   *   or any valid CSS colour string (e.g. '#ff6600', 'royalblue')
   */
  color?: string;
}

/**
 * ExampleView - Renders an `example-block` code fence as rich HTML.
 *
 * Extends MarkdownRenderChild so Obsidian manages the lifecycle:
 * - Calling `ctx.addChild(view)` in the processor callback registers
 *   this child with Obsidian's render pipeline.
 * - `onload()` fires after registration — build the DOM here.
 * - `onunload()` fires when the note is closed or the block is removed —
 *   clean up subscriptions, timers, and other external resources here.
 */
export class ExampleView extends MarkdownRenderChild {
  private source: string;

  /**
   * @param source    - Raw YAML string from inside the code block
   * @param container - The DOM element Obsidian provides for the block output
   */
  constructor(source: string, container: HTMLElement) {
    // MarkdownRenderChild requires the container element.
    // super() registers this instance in Obsidian's render lifecycle so
    // onload() and onunload() are called at the right times.
    super(container);
    this.source = source;
  }

  /**
   * onload() is called by Obsidian after the child is registered.
   *
   * Always build the DOM here rather than in the constructor — Obsidian
   * controls the timing of onload() and the container element is guaranteed
   * to be attached to the document at this point.
   */
  onload(): void {
    const params = this.parseSource(this.source);
    this.render(this.containerEl, params);
  }

  /**
   * onunload() is called by Obsidian when the note is closed or the block
   * is removed from the document.
   *
   * Use it to clean up anything that onload() created:
   * - Cancel intervals/timeouts
   * - Remove event listeners not managed by registerEvent()
   * - Destroy any external library instances created in onload()
   *
   * In this minimal example nothing external was created, but the hook is
   * shown here so you know exactly where to add teardown logic.
   */
  onunload(): void {
    // Example: cancel a refresh interval started in onload():
    //   clearInterval(this.refreshInterval);
    //
    // Example: destroy an external library instance:
    //   this.myLibInstance?.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse the raw YAML code block source into a typed params object.
   *
   * --- How YAML parsing works ---
   * Obsidian bundles a YAML parser and exposes it as `parseYaml` from the
   * 'obsidian' module. It accepts the raw string and returns a plain
   * JavaScript object (typed as `unknown`). We cast and validate each field
   * before use — never trust raw parsed data.
   *
   * Defaults are applied for every field so the block renders even when the
   * user provides an empty or partial YAML body.
   *
   * --- How to extend ---
   * 1. Add a new field to ExampleBlockParams (e.g. `count?: number`)
   * 2. Extract + validate it here   (e.g. `count: typeof parsed.count === 'number' ? parsed.count : 1`)
   * 3. Use the new field in render()
   *
   * @param source - Raw YAML string from the code block
   * @returns Parsed and validated params; unknown fields are ignored
   */
  private parseSource(source: string): ExampleBlockParams {
    // Provide sensible defaults — every field is optional so the block
    // renders even when the user writes an entirely empty code fence.
    const defaults: Required<ExampleBlockParams> = {
      title: "Example Block",
      color: "accent",
    };

    if (!source.trim()) {
      return defaults;
    }

    try {
      // parseYaml() returns `unknown` — always validate before use.
      const parsed = parseYaml(source) as Record<string, unknown>;

      return {
        title: typeof parsed.title === "string" ? parsed.title : defaults.title,
        color: typeof parsed.color === "string" ? parsed.color : defaults.color,
      };
    } catch {
      // Invalid YAML — fall back to defaults rather than crashing the note.
      return defaults;
    }
  }

  /**
   * Build and attach the rendered DOM for the code block.
   *
   * --- DOM safety rules ---
   * - Always use createEl() / createDiv() — NEVER innerHTML or
   *   insertAdjacentHTML. These helpers prevent XSS vulnerabilities.
   * - Set user-supplied text via .textContent (never string interpolation
   *   into HTML attributes or tag content).
   *
   * @param container - Root element to render into (provided by Obsidian)
   * @param params    - Validated block parameters from parseSource()
   */
  private render(container: HTMLElement, params: ExampleBlockParams): void {
    // Clear previous content — defensive; Obsidian normally provides a fresh
    // element, but calling empty() ensures no double-rendering on re-mount.
    container.empty();

    // Outer wrapper — attach a BEM root class for CSS targeting.
    // createDiv() is shorthand for createEl('div', ...).
    const wrapper = container.createDiv({ cls: "example-block" });

    // ── Header ────────────────────────────────────────────────────────────
    const header = wrapper.createDiv({ cls: "example-block__header" });

    // Title — set via .textContent (not .innerHTML) to prevent XSS.
    // createEl(tag, opts) is a typed Obsidian helper that wraps document.createElement.
    const titleEl = header.createEl("h3", { cls: "example-block__title" });
    titleEl.textContent = params.title ?? "Example Block";

    // ── Body ──────────────────────────────────────────────────────────────
    const body = wrapper.createDiv({ cls: "example-block__body" });

    // Apply the colour hint as a CSS custom property so the stylesheet can
    // respond without us hard-coding colour values in JavaScript.
    // Obsidian CSS variables keep the block theme-aware automatically.
    const colorMap: Record<string, string> = {
      accent: "var(--interactive-accent)",
      warning: "var(--text-warning)",
      error: "var(--text-error)",
    };
    const resolvedColor =
      params.color !== undefined
        ? (colorMap[params.color] ?? params.color) // named token or raw CSS
        : colorMap["accent"];
    body.style.setProperty("--example-block-color", resolvedColor);

    // Descriptive content paragraph.
    const content = body.createEl("p", { cls: "example-block__content" });
    content.textContent =
      "This block is rendered by ExampleView. " +
      "Edit the YAML above to customise the title and colour.";

    // Badge showing the active colour token — useful during development.
    const badge = body.createEl("span", { cls: "example-block__badge" });
    badge.textContent = `color: ${params.color ?? "accent"}`;
  }
}
