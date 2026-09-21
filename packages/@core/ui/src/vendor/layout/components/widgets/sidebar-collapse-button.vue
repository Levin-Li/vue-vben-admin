<script setup lang="ts">
import { ChevronsLeft, ChevronsRight } from '@vben-core/foundation/icons';

const collapsed = defineModel<boolean>('collapsed');

function handleCollapsed() {
  collapsed.value = !collapsed.value;
}
</script>

<template>
  <div
    class="sidebar-bottom-control flex-center absolute bottom-2 left-3 z-10 cursor-pointer rounded-md p-2 text-foreground/60 transition-colors duration-200 hover:text-foreground"
    @click.stop="handleCollapsed"
  >
    <ChevronsRight v-if="collapsed" class="size-4" />
    <ChevronsLeft v-else class="size-4" />
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
