import type { NavigationVisualStyleType } from '@vben/types';

const NAVIGATION_VISUAL_STYLES = new Set<NavigationVisualStyleType>([
  'brand-gradient',
  'minimal',
]);

export function resolveNavigationVisualStyle(
  value: unknown,
): NavigationVisualStyleType {
  // 服务端或历史本地缓存可能包含未知值，统一回退不带额外装饰的默认主题。
  return NAVIGATION_VISUAL_STYLES.has(value as NavigationVisualStyleType)
    ? (value as NavigationVisualStyleType)
    : 'minimal';
}

export function getNavigationVisualThemeClass(value: unknown) {
  return `admin-navigation-theme-${resolveNavigationVisualStyle(value)}`;
}
