<script setup lang="ts">
import { Pin, PinOff } from '@vben-core/icons';

const expandOnHover = defineModel<boolean>('expandOnHover');

function toggleFixed() {
  expandOnHover.value = !expandOnHover.value;
}
</script>

<template>
  <div
    class="sidebar-bottom-control flex-center absolute bottom-2 right-3 z-10 cursor-pointer rounded-sm p-[5px] text-foreground/60 transition-all duration-300 hover:text-foreground"
    @click="toggleFixed"
  >
    <PinOff v-if="!expandOnHover" class="size-3.5" />
    <Pin v-else class="size-3.5" />
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
