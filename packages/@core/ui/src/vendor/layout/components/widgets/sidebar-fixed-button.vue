<script setup lang="ts">
import { Pin, PinOff } from '@vben-core/foundation/icons';

const expandOnHover = defineModel<boolean>('expandOnHover');

function toggleFixed() {
  expandOnHover.value = !expandOnHover.value;
}
</script>

<template>
  <div
    class="sidebar-bottom-control flex-center absolute bottom-2 right-3 z-10 cursor-pointer rounded-md p-2 text-foreground/60 transition-colors duration-200 hover:text-foreground"
    @click="toggleFixed"
  >
    <PinOff v-if="!expandOnHover" class="size-3.5" />
    <Pin v-else class="size-3.5" />
  </div>
</template>

<style scoped>
.sidebar-bottom-control {
  background-color: transparent;
}

.sidebar-bottom-control:hover {
  /* 与顶部菜单按钮共用同一主题悬浮层，确保在定制主题下效果一致。 */
  background-color: var(
    --header-control-background-hover,
    hsl(var(--primary) / 36%)
  );
}
</style>
