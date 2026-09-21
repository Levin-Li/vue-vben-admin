<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed, useSlots } from 'vue';

interface Props {
  /**
   * 横屏
   */
  fullWidth: boolean;
  /**
   * 高度
   */
  height: number;
  /** 上外边距 */
  marginTop?: number;
  /** 右外边距 */
  marginRight?: number;
  /** 下外边距 */
  marginBottom?: number;
  /** 左外边距 */
  marginLeft?: number;
  /** 左上圆角 */
  radiusTopLeft?: number;
  /** 右上圆角 */
  radiusTopRight?: number;
  /** 右下圆角 */
  radiusBottomRight?: number;
  /** 左下圆角 */
  radiusBottomLeft?: number;
  /** 上边框宽度 */
  borderTopWidth?: number;
  /** 右边框宽度 */
  borderRightWidth?: number;
  /** 下边框宽度 */
  borderBottomWidth?: number;
  /** 左边框宽度 */
  borderLeftWidth?: number;
  /**
   * 是否移动端
   */
  isMobile: boolean;
  /**
   * 是否显示
   */
  show: boolean;
  /**
   * 侧边菜单宽度
   */
  sidebarWidth: number;
  /**
   * 主题
   */
  theme: string | undefined;
  /**
   * 主题色
   */
  themeColor?: string;
  /**
   * 宽度
   */
  width: string;
  /**
   * zIndex
   */
  zIndex: number;
}

const props = withDefaults(defineProps<Props>(), {
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderTopWidth: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  radiusTopLeft: 0,
  radiusTopRight: 0,
  radiusBottomRight: 0,
  radiusBottomLeft: 0,
});

const slots = useSlots();

const style = computed((): CSSProperties => {
  const {
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    fullWidth,
    height,
    marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    radiusTopLeft,
    radiusTopRight,
    radiusBottomRight,
    radiusBottomLeft,
    show,
    theme,
    themeColor,
  } = props;
  const right = !show || !fullWidth ? undefined : 0;

  const hasCustomDarkTheme = theme === 'dark' && Boolean(themeColor);

  return {
    ...(hasCustomDarkTheme
      ? {
          '--header': themeColor,
          '--header-control-background': 'transparent',
          '--header-control-background-hover':
            'hsl(var(--header-menu-theme-color, var(--primary)))',
          '--header-control-border': 'hsl(var(--primary-foreground) / 24%)',
          '--header-control-foreground': 'hsl(var(--primary-foreground))',
          '--header-control-muted-foreground':
            'hsl(var(--primary-foreground) / 72%)',
          '--header-control-shortcut-background':
            'hsl(var(--primary-foreground) / 16%)',
          '--header-control-surface':
            'hsl(var(--header-menu-background, var(--header)))',
        }
      : {}),
    height: `${height}px`,
    boxSizing: 'border-box',
    borderColor: 'hsl(var(--border))',
    borderStyle: 'solid',
    borderTopWidth: `${borderTopWidth}px`,
    borderRightWidth: `${borderRightWidth}px`,
    borderBottomWidth: `${borderBottomWidth}px`,
    borderLeftWidth: `${borderLeftWidth}px`,
    borderRadius: `${radiusTopLeft}px ${radiusTopRight}px ${radiusBottomRight}px ${radiusBottomLeft}px`,
    width: `calc(100% - ${marginLeft + marginRight}px)`,
    marginTop: show ? `${marginTop}px` : `-${height}px`,
    marginRight: `${marginRight}px`,
    marginBottom: `${marginBottom}px`,
    marginLeft: `${marginLeft}px`,
    right,
  } as CSSProperties;
});

const logoStyle = computed((): CSSProperties => {
  return {
    minWidth: `${props.isMobile ? 40 : props.sidebarWidth}px`,
  };
});
</script>

<template>
  <header
    :class="theme"
    :style="style"
    class="top-0 flex w-full flex-[0_0_auto] items-center bg-header transition-[margin-top] duration-200"
  >
    <div v-if="slots.logo" :style="logoStyle">
      <slot name="logo"></slot>
    </div>

    <slot name="toggle-button"> </slot>

    <slot></slot>
  </header>
</template>
