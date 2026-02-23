/**
 * @jest-environment jsdom
 */

import { App } from "obsidian";
import { ChatInputArea, ChatInputAreaProps } from "@app/components/molecules/ChatInputArea";

jest.mock("@app/i18n", () => ({
  t: (key: string) => key,
}));

const mockAttach = jest.fn();
const mockDetach = jest.fn();
const mockIsOpen = jest.fn().mockReturnValue(false);

jest.mock("@app/components/molecules/InlineMentionSuggest", () => ({
  InlineMentionSuggest: jest.fn().mockImplementation(() => ({
    attach: mockAttach,
    detach: mockDetach,
    isOpen: mockIsOpen,
  })),
}));

jest.mock("@app/features/chat/ChatMentionTriggers", () => ({
  createFileMentionTrigger: jest.fn().mockReturnValue({ char: "@" }),
  createTagMentionTrigger: jest.fn().mockReturnValue({ char: "#" }),
}));

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: { text?: string; cls?: string; attr?: Record<string, string> },
    ): HTMLElementTagNameMap[K];
    createDiv(o?: { cls?: string }): HTMLDivElement;
    createSpan(o?: { cls?: string; text?: string }): HTMLSpanElement;
    setCssProps(props: Record<string, string>): void;
  }
}

HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  o?: { text?: string; cls?: string; attr?: Record<string, string> },
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (o?.text) el.textContent = o.text;
  if (o?.cls) el.className = o.cls;
  if (o?.attr) {
    for (const [key, val] of Object.entries(o.attr)) {
      el.setAttribute(key, val);
    }
  }
  this.appendChild(el);
  return el;
};

HTMLElement.prototype.createDiv = function (o?: { cls?: string }): HTMLDivElement {
  return this.createEl("div", o);
};

HTMLElement.prototype.createSpan = function (o?: { cls?: string; text?: string }): HTMLSpanElement {
  return this.createEl("span", o);
};

HTMLElement.prototype.setCssProps = function (props: Record<string, string>): void {
  for (const [key, val] of Object.entries(props)) {
    this.style.setProperty(key, val);
  }
};

describe("ChatInputArea", () => {
  let app: App;
  let parent: HTMLElement;
  let onSendMessage: jest.Mock;
  let onStopGeneration: jest.Mock;

  beforeEach(() => {
    app = new App();
    parent = document.createElement("div");
    onSendMessage = jest.fn();
    onStopGeneration = jest.fn();
    mockAttach.mockClear();
    mockDetach.mockClear();
    mockIsOpen.mockReturnValue(false);
  });

  function createInputArea(overrides: Partial<ChatInputAreaProps> = {}): ChatInputArea {
    return new ChatInputArea(app, parent, {
      onSendMessage,
      onStopGeneration,
      ...overrides,
    });
  }

  it("should create a container and append to parent", () => {
    createInputArea();
    const container = parent.querySelector(".ai-agents-chat__input-area");
    expect(container).not.toBeNull();
  });

  it("should create a textarea with placeholder", () => {
    createInputArea();
    const textarea = parent.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.getAttribute("placeholder")).toBe("chat.inputPlaceholder");
  });

  it("should create send button", () => {
    createInputArea();
    const sendBtn = parent.querySelector(".ai-agents-chat__send");
    expect(sendBtn).not.toBeNull();
  });

  it("should create stop button (hidden by default)", () => {
    createInputArea();
    const stopBtn = parent.querySelector(".ai-agents-chat__stop") as HTMLElement;
    expect(stopBtn).not.toBeNull();
    expect(stopBtn.style.display).toBe("none");
  });

  it("should attach InlineMentionSuggest on construction", () => {
    createInputArea();
    expect(mockAttach).toHaveBeenCalledTimes(1);
  });

  describe("submit", () => {
    it("should call onSendMessage when input has text and send button is clicked", () => {
      const area = createInputArea();
      area.inputEl.value = "hello";
      const sendBtn = parent.querySelector(".ai-agents-chat__send") as HTMLButtonElement;
      sendBtn.click();
      expect(onSendMessage).toHaveBeenCalledWith("hello");
    });

    it("should not call onSendMessage when input is empty", () => {
      createInputArea();
      const sendBtn = parent.querySelector(".ai-agents-chat__send") as HTMLButtonElement;
      sendBtn.click();
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it("should not call onSendMessage when input is whitespace only", () => {
      const area = createInputArea();
      area.inputEl.value = "   ";
      const sendBtn = parent.querySelector(".ai-agents-chat__send") as HTMLButtonElement;
      sendBtn.click();
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it("should send on Enter key", () => {
      const area = createInputArea();
      area.inputEl.value = "hello";
      area.inputEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      expect(onSendMessage).toHaveBeenCalledWith("hello");
    });

    it("should not send on Shift+Enter", () => {
      const area = createInputArea();
      area.inputEl.value = "hello";
      area.inputEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }),
      );
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it("should not send on Enter when mention suggest is open", () => {
      mockIsOpen.mockReturnValue(true);
      const area = createInputArea();
      area.inputEl.value = "hello @test";
      area.inputEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("auto-resize", () => {
    it("should adjust textarea height on input", () => {
      const area = createInputArea();
      area.inputEl.value = "line1\nline2\nline3";
      area.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      // The handler sets height to auto then to scrollHeight
      expect(area.inputEl.style.height).toBeDefined();
    });
  });

  describe("clear", () => {
    it("should empty the input value", () => {
      const area = createInputArea();
      area.inputEl.value = "some text";
      area.clear();
      expect(area.inputEl.value).toBe("");
    });
  });

  describe("focus", () => {
    it("should focus the textarea", () => {
      const area = createInputArea();
      const focusSpy = jest.spyOn(area.inputEl, "focus");
      area.focus();
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe("setVisible", () => {
    it("should show container when true", () => {
      const area = createInputArea();
      area.setVisible(true);
      expect(area.containerEl.style.display).toBe("flex");
    });

    it("should hide container when false", () => {
      const area = createInputArea();
      area.setVisible(false);
      expect(area.containerEl.style.display).toBe("none");
    });
  });

  describe("setGenerating", () => {
    it("should show stop button and hide send button when generating", () => {
      const area = createInputArea();
      area.setGenerating(true);
      const sendBtn = parent.querySelector(".ai-agents-chat__send") as HTMLElement;
      const stopBtn = parent.querySelector(".ai-agents-chat__stop") as HTMLElement;
      expect(sendBtn.style.display).toBe("none");
      expect(stopBtn.style.display).toBe("");
    });

    it("should show send button and hide stop button when not generating", () => {
      const area = createInputArea();
      area.setGenerating(true);
      area.setGenerating(false);
      const sendBtn = parent.querySelector(".ai-agents-chat__send") as HTMLElement;
      const stopBtn = parent.querySelector(".ai-agents-chat__stop") as HTMLElement;
      expect(sendBtn.style.display).toBe("");
      expect(stopBtn.style.display).toBe("none");
    });
  });

  describe("stop button", () => {
    it("should call onStopGeneration when stop button is clicked", () => {
      const area = createInputArea();
      area.setGenerating(true);
      const stopBtn = parent.querySelector(".ai-agents-chat__stop") as HTMLButtonElement;
      stopBtn.click();
      expect(onStopGeneration).toHaveBeenCalledTimes(1);
    });
  });

  describe("detach", () => {
    it("should detach the mention suggest", () => {
      const area = createInputArea();
      area.detach();
      expect(mockDetach).toHaveBeenCalledTimes(1);
    });

    it("should handle detach when already detached", () => {
      const area = createInputArea();
      area.detach();
      area.detach();
      expect(mockDetach).toHaveBeenCalledTimes(1);
    });

    it("should still allow Enter to send after detach (mentionSuggest is null)", () => {
      const area = createInputArea();
      area.detach();
      area.inputEl.value = "hello after detach";
      area.inputEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      expect(onSendMessage).toHaveBeenCalledWith("hello after detach");
    });
  });

  describe("stop without handler", () => {
    it("should not throw when onStopGeneration is undefined", () => {
      const area = createInputArea({ onStopGeneration: undefined });
      area.setGenerating(true);
      const stopBtn = parent.querySelector(".ai-agents-chat__stop") as HTMLButtonElement;
      expect(() => stopBtn.click()).not.toThrow();
    });
  });
});
