<script lang="ts" setup>
defineOptions({
  name: 'LayoutFooter',
});
</script>

<template>
  <div
    class="footer-font-scale flex-center text-muted-foreground relative h-full w-full text-xs"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
.footer-font-scale {
  font-size: var(--font-size-footer);
}

.footer-font-scale :deep(:is(a, div, p, span)) {
  font-size: inherit !important;
}
</style>
