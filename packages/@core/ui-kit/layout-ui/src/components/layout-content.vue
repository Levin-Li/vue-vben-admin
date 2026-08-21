<script setup lang="ts">
import type { CSSProperties } from 'vue';

import type { ContentCompactType } from '@vben-core/typings';

import { computed } from 'vue';

import { useLayoutContentStyle } from '@vben-core/composables';
import { Slot } from '@vben-core/shadcn-ui';

interface Props {
  /**
   * 内容区域定宽
   */
  contentCompact: ContentCompactType;
  /**
   * 定宽布局宽度
   */
  contentCompactWidth: number;
  /** 内容区域背景色 */
  backgroundColor?: string;
  /** 固定顶栏预留的结构性偏移 */
  offsetTop?: number;
  padding: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  radiusTopLeft?: number;
  radiusTopRight?: number;
  radiusBottomRight?: number;
  radiusBottomLeft?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  backgroundColor: 'transparent',
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderTopWidth: 0,
  offsetTop: 0,
  radiusTopLeft: 0,
  radiusTopRight: 0,
  radiusBottomRight: 0,
  radiusBottomLeft: 0,
});

// @ts-expect-error unused
const { contentElement, overlayStyle } = useLayoutContentStyle();

const style = computed((): CSSProperties => {
  const {
    contentCompact,
    offsetTop,
    padding,
    marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    radiusTopLeft,
    radiusTopRight,
    radiusBottomRight,
    radiusBottomLeft,
    borderTopWidth,
    borderRightWidth,
    borderBottomWidth,
    borderLeftWidth,
  } = props;

  const keepCompactCentered =
    contentCompact === 'compact' && marginLeft === 0 && marginRight === 0;
  const compactStyle: CSSProperties =
    contentCompact === 'compact' ? { width: `${props.contentCompactWidth}px` } : {};

  return {
    ...compactStyle,
    flex: 1,
    backgroundColor: props.backgroundColor,
    boxSizing: 'border-box',
    borderColor: 'hsl(var(--border))',
    borderStyle: 'solid',
    borderTopWidth: `${borderTopWidth}px`,
    borderRightWidth: `${borderRightWidth}px`,
    borderBottomWidth: `${borderBottomWidth}px`,
    borderLeftWidth: `${borderLeftWidth}px`,
    borderRadius: `${radiusTopLeft}px ${radiusTopRight}px ${radiusBottomRight}px ${radiusBottomLeft}px`,
    padding: `${padding}px`,
    marginBottom: `${marginBottom}px`,
    marginLeft: keepCompactCentered ? 'auto' : `${marginLeft}px`,
    marginRight: keepCompactCentered ? 'auto' : `${marginRight}px`,
    marginTop: `${offsetTop + marginTop}px`,
    ...(radiusTopLeft || radiusTopRight || radiusBottomRight || radiusBottomLeft
      ? { overflow: 'hidden' }
      : {}),
  };
});
</script>

<template>
  <main ref="contentElement" :style="style" class="relative">
    <Slot :style="overlayStyle">
      <slot name="overlay"></slot>
    </Slot>
    <slot></slot>
  </main>
</template>
