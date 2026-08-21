import { TinyColor } from '@vben-core/shared/color';

/**
 * 将背景色转换为带 alpha 的 CSS 颜色，避免对容器使用 opacity 而影响内部内容。
 */
function resolveBackgroundColor(color: string, transparency = 0): string {
  const parsedColor = new TinyColor(color);
  if (!parsedColor.isValid) {
    return color;
  }

  return parsedColor
    .setAlpha(1 - Math.min(100, Math.max(0, transparency)) / 100)
    .toHslString();
}

export { resolveBackgroundColor };
