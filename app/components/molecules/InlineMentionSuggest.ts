/**
 * @fileoverview InlineMentionSuggest — inline @file and #tag mention dropdown
 *
 * Attaches to a <textarea> and provides IDE-style inline mention suggestions.
 * Trigger characters (@ or #) open a filtered dropdown above the input area.
 * Keyboard and mouse navigation select items; selection replaces the trigger+query
 * text in the textarea.
 *
 * DOM is built exclusively with createEl/createDiv (no innerHTML).
 * BEM prefix: .ai-agents-mention-suggest__
 */

import { App, setIcon } from "obsidian";
import { t } from "@app/i18n";

export interface MentionItem {
  label: string;
  description?: string;
  value: string;
}

export interface MentionTrigger {
  char: string;
  icon: string;
  getSuggestions: (app: App) => MentionItem[];
  formatInsertion: (item: MentionItem) => string;
}

interface ActiveQuery {
  trigger: MentionTrigger;
  startIndex: number;
  query: string;
}

const MAX_RESULTS = 20;

export class InlineMentionSuggest {
  private app: App;
  private inputEl: HTMLTextAreaElement;
  private containerEl: HTMLElement;
  private triggers: MentionTrigger[];

  private dropdownEl: HTMLElement | null = null;
  private activeQuery: ActiveQuery | null = null;
  private selectedIndex = 0;
  private filteredItems: MentionItem[] = [];

  // Bound handlers for cleanup
  private handleInput: () => void;
  private handleKeydown: (e: KeyboardEvent) => void;
  private handleBlur: () => void;
  private blurTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    app: App,
    inputEl: HTMLTextAreaElement,
    containerEl: HTMLElement,
    triggers: MentionTrigger[],
  ) {
    this.app = app;
    this.inputEl = inputEl;
    this.containerEl = containerEl;
    this.triggers = triggers;

    this.handleInput = this.onInput.bind(this);
    this.handleKeydown = this.onKeydown.bind(this);
    this.handleBlur = this.onBlur.bind(this);
  }

  attach(): void {
    this.inputEl.addEventListener("input", this.handleInput);
    // Capture phase so we intercept Enter/ArrowUp/ArrowDown before ChatView's handler
    this.inputEl.addEventListener("keydown", this.handleKeydown, true);
    this.inputEl.addEventListener("blur", this.handleBlur);
  }

  detach(): void {
    this.inputEl.removeEventListener("input", this.handleInput);
    this.inputEl.removeEventListener("keydown", this.handleKeydown, true);
    this.inputEl.removeEventListener("blur", this.handleBlur);
    this.dismiss();
  }

  isOpen(): boolean {
    return this.dropdownEl !== null;
  }

  // ---------------------------------------------------------------------------
  // Input handling — detect trigger character and build query
  // ---------------------------------------------------------------------------

  private onInput(): void {
    const cursorPos = this.inputEl.selectionStart;
    const text = this.inputEl.value;

    const query = this.detectTrigger(text, cursorPos);

    if (query) {
      this.activeQuery = query;
      this.updateSuggestions();
    } else {
      this.dismiss();
    }
  }

  /**
   * Scans backward from cursor to find a trigger character preceded by
   * whitespace or start-of-text. Returns null if no trigger is active.
   */
  detectTrigger(text: string, cursorPos: number): ActiveQuery | null {
    for (const trigger of this.triggers) {
      // Search backward from cursor for the trigger char
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (text[i] === trigger.char) {
          // Trigger must be at start of text or preceded by whitespace
          if (i > 0 && !/\s/.test(text[i - 1])) {
            break;
          }

          const queryStr = text.slice(i + 1, cursorPos);

          // Dismiss if query contains a space (user moved past the mention)
          if (queryStr.includes(" ")) {
            break;
          }

          return {
            trigger,
            startIndex: i,
            query: queryStr,
          };
        }

        // Stop scanning if we hit whitespace (no trigger in this word)
        if (/\s/.test(text[i])) {
          break;
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Suggestion filtering and dropdown rendering
  // ---------------------------------------------------------------------------

  private updateSuggestions(): void {
    if (!this.activeQuery) return;

    const allItems = this.activeQuery.trigger.getSuggestions(this.app);
    const query = this.activeQuery.query.toLowerCase();

    this.filteredItems = query
      ? allItems
          .filter(
            (item) =>
              item.label.toLowerCase().includes(query) ||
              (item.description?.toLowerCase().includes(query) ?? false),
          )
          .slice(0, MAX_RESULTS)
      : allItems.slice(0, MAX_RESULTS);

    this.selectedIndex = 0;
    this.renderDropdown();
  }

  private renderDropdown(): void {
    if (!this.dropdownEl) {
      this.dropdownEl = document.createElement("div");
      this.dropdownEl.className = "ai-agents-mention-suggest__container";
      this.containerEl.appendChild(this.dropdownEl);
    }

    // Clear previous content
    this.dropdownEl.empty();

    if (this.filteredItems.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "ai-agents-mention-suggest__empty";
      emptyEl.textContent = t("mentions.noResults");
      this.dropdownEl.appendChild(emptyEl);
      return;
    }

    this.filteredItems.forEach((item, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = "ai-agents-mention-suggest__item";
      if (index === this.selectedIndex) {
        itemEl.classList.add("ai-agents-mention-suggest__item--selected");
      }

      // Icon
      const iconEl = document.createElement("span");
      iconEl.className = "ai-agents-mention-suggest__item-icon";
      setIcon(iconEl, this.activeQuery!.trigger.icon);
      itemEl.appendChild(iconEl);

      // Content column
      const contentEl = document.createElement("div");
      contentEl.className = "ai-agents-mention-suggest__item-content";

      const labelEl = document.createElement("span");
      labelEl.className = "ai-agents-mention-suggest__item-label";
      labelEl.textContent = item.label;
      contentEl.appendChild(labelEl);

      if (item.description) {
        const descEl = document.createElement("span");
        descEl.className = "ai-agents-mention-suggest__item-description";
        descEl.textContent = item.description;
        contentEl.appendChild(descEl);
      }

      itemEl.appendChild(contentEl);

      // Mouse selection
      itemEl.addEventListener("mousedown", (e: MouseEvent) => {
        e.preventDefault(); // Prevent blur
        this.selectItem(index);
      });

      // Hover to highlight
      itemEl.addEventListener("mouseenter", () => {
        this.selectedIndex = index;
        this.updateSelectedClass();
      });

      this.dropdownEl!.appendChild(itemEl);
    });

    this.scrollSelectedIntoView();
  }

  private updateSelectedClass(): void {
    if (!this.dropdownEl) return;

    const items = this.dropdownEl.querySelectorAll(".ai-agents-mention-suggest__item");
    items.forEach((el, i) => {
      el.classList.toggle("ai-agents-mention-suggest__item--selected", i === this.selectedIndex);
    });
  }

  private scrollSelectedIntoView(): void {
    if (!this.dropdownEl) return;

    const items = this.dropdownEl.querySelectorAll(".ai-agents-mention-suggest__item");
    const selectedEl = items[this.selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  private onKeydown(e: KeyboardEvent): void {
    if (!this.isOpen()) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        if (this.filteredItems.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
          this.updateSelectedClass();
          this.scrollSelectedIntoView();
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        if (this.filteredItems.length > 0) {
          this.selectedIndex =
            (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
          this.updateSelectedClass();
          this.scrollSelectedIntoView();
        }
        break;

      case "Enter":
      case "Tab":
        if (this.filteredItems.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          this.selectItem(this.selectedIndex);
        }
        break;

      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.dismiss();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Selection and text insertion
  // ---------------------------------------------------------------------------

  private selectItem(index: number): void {
    if (!this.activeQuery || index < 0 || index >= this.filteredItems.length) return;

    const item = this.filteredItems[index];
    const insertion = this.activeQuery.trigger.formatInsertion(item);
    const { startIndex } = this.activeQuery;
    const cursorPos = this.inputEl.selectionStart;

    const text = this.inputEl.value;
    const before = text.slice(0, startIndex);
    const after = text.slice(cursorPos);

    this.inputEl.value = before + insertion + after;

    // Position cursor after the insertion
    const newCursorPos = startIndex + insertion.length;
    this.inputEl.selectionStart = newCursorPos;
    this.inputEl.selectionEnd = newCursorPos;

    // Dispatch input event so auto-resize and other listeners react
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));

    this.dismiss();
    this.inputEl.focus();
  }

  // ---------------------------------------------------------------------------
  // Dismissal
  // ---------------------------------------------------------------------------

  private onBlur(): void {
    // Delay to allow mousedown on dropdown items to fire first
    this.blurTimeout = setTimeout(() => {
      this.dismiss();
    }, 150);
  }

  dismiss(): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }

    if (this.dropdownEl) {
      this.dropdownEl.remove();
      this.dropdownEl = null;
    }

    this.activeQuery = null;
    this.filteredItems = [];
    this.selectedIndex = 0;
  }
}
