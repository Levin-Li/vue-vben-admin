<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed } from 'vue';

interface Props {
  /** 背景色 */
  backgroundColor?: string;
  /** 下边框宽度 */
  borderBottomWidth?: number;
  /** 左边框宽度 */
  borderLeftWidth?: number;
  /** 右边框宽度 */
  borderRightWidth?: number;
  /** 上边框宽度 */
  borderTopWidth?: number;
  /**
   * 高度
   */
  height: number;
  /** 布局为侧边栏预留的左侧偏移 */
  layoutMarginLeft?: number;
  /** 布局为侧边栏预留的宽度 */
  layoutWidthOffset?: number;
  /** 下外边距 */
  marginBottom?: number;
  /** 左外边距 */
  marginLeft?: number;
  /** 右外边距 */
  marginRight?: number;
  /** 上外边距 */
  marginTop?: number;
  /** 左下圆角 */
  radiusBottomLeft?: number;
  /** 右下圆角 */
  radiusBottomRight?: number;
  /** 左上圆角 */
  radiusTopLeft?: number;
  /** 右上圆角 */
  radiusTopRight?: number;
}

const props = withDefaults(defineProps<Props>(), {
  backgroundColor: 'hsl(var(--background))',
  borderBottomWidth: 1,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderTopWidth: 0,
  layoutMarginLeft: 0,
  layoutWidthOffset: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  radiusBottomLeft: 0,
  radiusBottomRight: 0,
  radiusTopLeft: 0,
  radiusTopRight: 0,
});

const style = computed((): CSSProperties => {
  const {
    backgroundColor,
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    height,
    layoutMarginLeft,
    layoutWidthOffset,
    marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    radiusBottomLeft,
    radiusBottomRight,
    radiusTopLeft,
    radiusTopRight,
  } = props;
  const horizontalMargin = marginLeft + marginRight;
  return {
    backgroundColor,
    borderBottomLeftRadius: `${radiusBottomLeft}px`,
    borderBottomRightRadius: `${radiusBottomRight}px`,
    borderColor: 'hsl(var(--border))',
    borderLeftWidth: `${borderLeftWidth}px`,
    borderRightWidth: `${borderRightWidth}px`,
    borderStyle: 'solid',
    borderTopLeftRadius: `${radiusTopLeft}px`,
    borderTopRightRadius: `${radiusTopRight}px`,
    borderTopWidth: `${borderTopWidth}px`,
    borderBottomWidth: `${borderBottomWidth}px`,
    height: `${height}px`,
    marginBottom: `${marginBottom}px`,
    marginLeft: `${layoutMarginLeft + marginLeft}px`,
    marginRight: `${marginRight}px`,
    marginTop: `${marginTop}px`,
    width: `calc(100% - ${layoutWidthOffset + horizontalMargin}px)`,
  };
});
</script>

<template>
  <section :style="style" class="flex transition-all">
    <slot></slot>
  </section>
</template>
