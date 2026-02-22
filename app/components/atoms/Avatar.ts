export interface AvatarOptions {
  emoji?: string;
  fallback?: string;
  cls?: string;
}

const BASE_CLS = "ai-agents-avatar";

export function createAvatar(
  container: HTMLElement,
  options: AvatarOptions,
): HTMLElement {
  const cls = options.cls ? `${BASE_CLS} ${options.cls}` : BASE_CLS;
  const avatar = container.createDiv({ cls });
  avatar.setText(options.emoji || options.fallback || "");
  return avatar;
}
