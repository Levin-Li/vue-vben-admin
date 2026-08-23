<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed } from 'vue';

interface Props {
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

const props = withDefaults(defineProps<Props>(), {
  show: true,
});

const style = computed((): CSSProperties => {
  const { fixed, height, show, width, zIndex } = props;
  return {
    backgroundColor: 'var(--footer-background, hsl(var(--background-deep)))',
    borderRadius:
      'var(--footer-radius-top-left, 0px) var(--footer-radius-top-right, 0px) var(--footer-radius-bottom-right, 0px) var(--footer-radius-bottom-left, 0px)',
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
