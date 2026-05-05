<script lang="ts" setup>
import type { MenuRecordRaw } from '@vben/types';

import { Menu } from '@vben-core/menu-ui';

interface Props {
  accordion?: boolean;
  collapse?: boolean;
  collapseShowTitle?: boolean;
  defaultActive?: string;
  defaultOpeneds?: string[];
  menus?: MenuRecordRaw[];
  mode?: 'horizontal' | 'vertical';
  rounded?: boolean;
  scrollToActive?: boolean;
  theme?: string;
}

const props = withDefaults(defineProps<Props>(), {
  accordion: true,
  menus: () => [],
});

const emit = defineEmits<{
  open: [string, string[]];
  select: [string, string?];
}>();

function handleMenuSelect(key: string) {
  emit('select', key, props.mode);
}

function handleMenuOpen(key: string, path: string[]) {
  emit('open', key, path);
}
</script>

<template>
  <Menu
    :accordion="accordion"
    :collapse="collapse"
    :collapse-show-title="collapseShowTitle"
    :default-active="defaultActive"
    :menus="menus"
    :mode="mode"
    :rounded="rounded"
    scroll-to-active
    :theme="theme"
    @open="handleMenuOpen"
    @select="handleMenuSelect"
  />
</template>
