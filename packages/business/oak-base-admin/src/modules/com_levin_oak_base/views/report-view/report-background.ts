/** 仅把受限位图数据转换为 CSS；任何 URL、SVG 或非 Base64 文本均不进入样式。 */
export function backgroundImage(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length > 350_000 ||
    !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return undefined;
  return `url("${value}")`;
}

/** 校验颜色和渐变；客户端数据也不能直接拼接为任意样式。 */
export function isReportColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value);
}

export function isReportGradient(value: unknown): value is { from: string; to: string; direction: 'HORIZONTAL' | 'VERTICAL' | 'DIAGONAL' } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every((key) => ['from', 'to', 'direction'].includes(key))
    && isReportColor(item.from) && isReportColor(item.to)
    && typeof item.direction === 'string' && ['HORIZONTAL', 'VERTICAL', 'DIAGONAL'].includes(item.direction);
}

/** 仅允许十六进制颜色及预定义方向，不拼接任意 CSS。 */
export function reportBackground(value: unknown, overridePreset = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as { color?: unknown; image?: unknown; gradient?: unknown };
  const color = isReportColor(input.color) ? input.color : undefined;
  const image = backgroundImage(input.image);
  const gradient = isReportGradient(input.gradient) ? input.gradient : undefined;
  const angle = gradient?.direction === 'HORIZONTAL' ? '90deg'
    : gradient?.direction === 'VERTICAL' ? '180deg' : gradient ? '135deg' : undefined;
  const linear = angle && gradient ? `linear-gradient(${angle}, ${gradient.from}, ${gradient.to})` : undefined;
  const layers = [image, linear].filter(Boolean).join(', ');
  return { backgroundColor: color, backgroundImage: layers || (overridePreset && color ? 'none' : undefined) };
}
