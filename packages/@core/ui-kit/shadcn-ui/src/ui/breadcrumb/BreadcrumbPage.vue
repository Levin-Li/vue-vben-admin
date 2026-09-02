<script lang="ts" setup>
import { cn } from '@vben-core/shared/utils';

const props = defineProps<{
  class?: any;
}>();
</script>

<template>
  <span
    :class="
      cn(
        'block min-w-0 overflow-hidden whitespace-nowrap font-normal text-foreground',
        props.class,
      )
    "
    aria-current="page"
    aria-disabled="true"
    role="link"
  >
    <slot></slot>
  </span>
</template>
