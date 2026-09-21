<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed } from 'vue';

interface Props {
  /** 上边框宽度 */
  borderTopWidth?: number;
  /** 右边框宽度 */
  borderRightWidth?: number;
  /** 下边框宽度 */
  borderBottomWidth?: number;
  /** 左边框宽度 */
  borderLeftWidth?: number;
  /**
   * 是否固定在底部
   */
  fixed?: boolean;
  height: number;
  /**
   * 是否显示
   * @default true
   */
  show?: boolean;
  width: string;
  zIndex: number;
}

const props = withDefaults(defineProps<Props>(), { show: true });

const style = computed((): CSSProperties => {
  const {
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    fixed,
    height,
    show,
    width,
    zIndex,
  } = props;
  const hasBorder = [
    borderTopWidth,
    borderRightWidth,
    borderBottomWidth,
    borderLeftWidth,
  ].some((value) => typeof value === 'number' && value > 0);

  return {
    backgroundColor: 'var(--footer-background, hsl(var(--background-deep)))',
    borderRadius:
      'var(--footer-radius-top-left, 0px) var(--footer-radius-top-right, 0px) var(--footer-radius-bottom-right, 0px) var(--footer-radius-bottom-left, 0px)',
    ...(hasBorder
      ? {
          borderBottomWidth: `${borderBottomWidth || 0}px`,
          borderColor: 'hsl(var(--border))',
          borderLeftWidth: `${borderLeftWidth || 0}px`,
          borderRightWidth: `${borderRightWidth || 0}px`,
          borderStyle: 'solid',
          borderTopWidth: `${borderTopWidth || 0}px`,
        }
      : {}),
    height: `${height}px`,
    marginTop: 'var(--footer-margin-top, 0px)',
    marginRight: 'var(--footer-margin-right, 0px)',
    marginBottom: show ? 'var(--footer-margin-bottom, 0px)' : `-${height}px`,
    marginLeft: 'var(--footer-margin-left, 0px)',
    position: fixed ? 'fixed' : 'static',
    width: `calc(${width} - var(--footer-margin-left, 0px) - var(--footer-margin-right, 0px))`,
    zIndex,
  };
});
</script>

<template>
  <footer :style="style" class="bottom-0 w-full transition-all duration-200">
    <slot></slot>
  </footer>
</template>
