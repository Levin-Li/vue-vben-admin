import type { CSSProperties } from 'vue';
import type { CrudPageDisplayActionConfig } from './types';

// 尺寸只约束当前按钮；非正数表示沿用按钮默认尺寸。
export function resolveActionButtonStyle(
  config?: CrudPageDisplayActionConfig,
): CSSProperties {
  const positive = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0
      ? `${value}px`
      : undefined;
  return {
    width: positive(config?.width),
    minWidth: positive(config?.minWidth),
    maxWidth: positive(config?.maxWidth),
    ...(config?.overflowStrategy === 'wrap'
      ? { whiteSpace: 'normal', overflowWrap: 'anywhere', height: 'auto' }
      : config?.overflowStrategy === 'ellipsis'
        ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
        : {}),
  };
}

// 脚本优先于别名；执行失败或空结果时保持可读的按钮名称。
export function resolveActionButtonLabel(
  config: CrudPageDisplayActionConfig | undefined,
  fallback: string,
  evaluate: (expression: string) => unknown,
) {
  const defaultLabel = config?.title?.trim() || fallback;
  if (
    config?.valueDisplay?.mode !== 'script' ||
    !config.valueDisplay.expression?.trim()
  )
    return defaultLabel;
  try {
    const result = evaluate(config.valueDisplay.expression);
    return result == null
      ? defaultLabel
      : String(result).trim() || defaultLabel;
  } catch {
    return defaultLabel;
  }
}
