/**
 * @jest-environment jsdom
 */

import { createAvatar, AvatarOptions } from "@app/components/atoms/Avatar";

declare global {
  interface HTMLElement {
    createDiv(o?: { cls?: string }): HTMLDivElement;
    setText(text: string): void;
  }
}

HTMLElement.prototype.createDiv = function (o?: { cls?: string }): HTMLDivElement {
  const el = document.createElement("div");
  if (o?.cls) el.className = o.cls;
  this.appendChild(el);
  return el;
};

HTMLElement.prototype.setText = function (text: string): void {
  this.textContent = text;
};

describe("createAvatar", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("should create an avatar and append to container", () => {
    const avatar = createAvatar(container, {});
    expect(avatar.tagName).toBe("DIV");
    expect(container.contains(avatar)).toBe(true);
  });

  it("should display emoji when provided", () => {
    const avatar = createAvatar(container, { emoji: "🤖" });
    expect(avatar.textContent).toBe("🤖");
  });

  it("should display fallback when no emoji", () => {
    const avatar = createAvatar(container, { fallback: "?" });
    expect(avatar.textContent).toBe("?");
  });

  it("should prefer emoji over fallback", () => {
    const avatar = createAvatar(container, { emoji: "🤖", fallback: "?" });
    expect(avatar.textContent).toBe("🤖");
  });

  it("should display empty string when no emoji or fallback", () => {
    const avatar = createAvatar(container, {});
    expect(avatar.textContent).toBe("");
  });

  it("should apply css class", () => {
    const avatar = createAvatar(container, { cls: "my-avatar" });
    expect(avatar.className).toBe("ai-agents-avatar my-avatar");
  });
});
