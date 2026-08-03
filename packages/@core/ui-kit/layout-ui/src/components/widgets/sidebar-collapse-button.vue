<script setup lang="ts">
import { ChevronsLeft, ChevronsRight } from '@vben-core/icons';

const collapsed = defineModel<boolean>('collapsed');

function handleCollapsed() {
  collapsed.value = !collapsed.value;
}
</script>

<template>
  <div
    class="sidebar-bottom-control flex-center absolute bottom-2 left-3 z-10 cursor-pointer rounded-sm p-1 text-foreground/60 hover:text-foreground"
    @click.stop="handleCollapsed"
  >
    <ChevronsRight v-if="collapsed" class="size-4" />
    <ChevronsLeft v-else class="size-4" />
  </div>
</template>

<style scoped>
.sidebar-bottom-control {
  background-color: hsl(var(--sidebar-menu-background-color, var(--accent)));
}

.sidebar-bottom-control:hover {
  background-color: hsl(
    var(--sidebar-menu-hover-background-color, var(--accent-hover))
  );
}
</style>
