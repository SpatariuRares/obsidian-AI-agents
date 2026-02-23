/**
 * @fileoverview TypingIndicator - Animated "thinking" bubble shown during streaming.
 *
 * Displays an assistant-style bubble with three animated dots and the agent's name.
 * Call `show(agentName)` to reveal it, `hide()` to remove it.
 * The element is appended to the provided container and kept at the bottom of the
 * message list; `hide()` removes it from the DOM entirely.
 */

import { createText } from "@app/components/atoms/Text";
import { t } from "@app/i18n";

export class TypingIndicator {
    private container: HTMLElement;
    private el: HTMLElement | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    /**
     * Appends the indicator bubble to the container.
     * If it is already visible, just updates the agent name label.
     */
    show(agentName?: string): void {
        // Avoid duplicating the indicator if show() is called more than once
        if (this.el) {
            const label = this.el.querySelector(".ai-agents-chat__message-label");
            if (label) {
                label.textContent = agentName ?? t("chat.assistantLabel");
            }
            return;
        }

        const bubble = this.container.createDiv({
            cls: "ai-agents-chat__message ai-agents-chat__message--assistant ai-agents-chat__message--typing",
        });

        createText(bubble, {
            tag: "div",
            text: agentName ?? t("chat.assistantLabel"),
            cls: "ai-agents-chat__message-label",
        });

        const dotsWrapper = bubble.createDiv({ cls: "ai-agents-chat__typing-dots" });
        dotsWrapper.createDiv({ cls: "ai-agents-chat__typing-dot" });
        dotsWrapper.createDiv({ cls: "ai-agents-chat__typing-dot" });
        dotsWrapper.createDiv({ cls: "ai-agents-chat__typing-dot" });

        this.el = bubble;

        // Keep indicator at the bottom while scrolling
        this.container.scrollTop = this.container.scrollHeight;
    }

    /**
     * Removes the indicator bubble from the DOM.
     */
    hide(): void {
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
    }

    /**
     * Returns true if the indicator is currently visible.
     */
    isVisible(): boolean {
        return this.el !== null;
    }
}
