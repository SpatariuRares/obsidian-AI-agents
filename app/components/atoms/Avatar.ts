export interface AvatarOptions {
  emoji?: string;
  fallback?: string;
  cls?: string;
}

export function createAvatar(
  container: HTMLElement,
  options: AvatarOptions,
): HTMLElement {
  const avatar = container.createDiv({ cls: options.cls });
  avatar.setText(options.emoji || options.fallback || "");
  return avatar;
}
