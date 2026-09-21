<script lang="ts" setup>
import type { DropdownMenuProps } from '@vben-core/ui/shadcn';

import { LayoutGrid } from '@vben-core/foundation/icons';
import { VbenDropdownMenu } from '@vben-core/ui/shadcn';

defineProps<DropdownMenuProps>();
</script>

<template>
  <VbenDropdownMenu :menus="menus" :modal="false">
    <div
      class="flex-center h-full cursor-pointer border-l border-border px-2 text-lg font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <LayoutGrid class="size-4" />
    </div>
  </VbenDropdownMenu>
</template>
