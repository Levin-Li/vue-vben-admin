<script lang="ts" setup>
import type { DropdownMenuProps } from '../../../shadcn/components/dropdown-menu/interface';

import { LayoutGrid } from '@vben-core/foundation/icons';
import { VbenDropdownMenu } from '@vben-core/ui/shadcn';

defineProps<DropdownMenuProps>();
</script>

<template>
  <VbenDropdownMenu :menus="menus" :modal="false">
    <div
      class="flex-center border-border text-muted-foreground hover:bg-muted hover:text-foreground h-full cursor-pointer border-l px-2 text-lg font-semibold"
    >
      <LayoutGrid class="size-4" />
    </div>
  </VbenDropdownMenu>
</template>
