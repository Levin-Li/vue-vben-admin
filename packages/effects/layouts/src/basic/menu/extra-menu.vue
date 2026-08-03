<script lang="ts" setup>
import type { StyleValue } from 'vue';

import type { MenuRecordRaw, ThemeModeType } from '@vben/types';

import { useRoute } from 'vue-router';

import { Menu } from '@vben-core/menu-ui';

import { useNavigation } from './use-navigation';

interface Props {
  accordion?: boolean;
  collapse?: boolean;
  collapseShowTitle?: boolean;
  defaultOpeneds?: string[];
  menus?: MenuRecordRaw[];
  mode?: 'horizontal' | 'vertical';
  popupStyle?: StyleValue;
  rounded?: boolean;
  scrollToActive?: boolean;
  theme?: ThemeModeType;
}

withDefaults(defineProps<Props>(), {
  accordion: true,
  menus: () => [],
});

const route = useRoute();
const { navigation } = useNavigation();

async function handleSelect(key: string) {
  await navigation(key);
}
</script>

<template>
  <Menu
    :accordion="accordion"
    :collapse="collapse"
    :default-active="route.meta?.activePath || route.path"
    :menus="menus"
    :popup-style="popupStyle"
    :rounded="rounded"
    :theme="theme"
    mode="vertical"
    @select="handleSelect"
  />
</template>
