<script setup lang="ts">
import type { NavigationVisualStyleType, SelectOption } from '@vben/types';

import { $t } from '@vben/locales';

import SwitchItem from '../switch-item.vue';
import ToggleItem from '../toggle-item.vue';

defineOptions({
  name: 'PreferenceNavigationConfig',
});

defineProps<{ disabled?: boolean; disabledNavigationSplit?: boolean }>();

const navigationStyleType = defineModel<string>('navigationStyleType');
const navigationVisualStyle = defineModel<NavigationVisualStyleType>(
  'navigationVisualStyle',
);
const navigationSplit = defineModel<boolean>('navigationSplit');
const navigationAccordion = defineModel<boolean>('navigationAccordion');

const stylesItems: SelectOption[] = [
  { label: $t('preferences.rounded'), value: 'rounded' },
  { label: $t('preferences.plain'), value: 'plain' },
];
const visualStyleItems: SelectOption[] = [
  { label: '品牌渐变', value: 'brand-gradient' },
  { label: '极简留白', value: 'minimal' },
  { label: '柔和卡片', value: 'soft-card' },
];
</script>

<template>
  <ToggleItem
    v-model="navigationStyleType"
    :disabled="disabled"
    :items="stylesItems"
  >
    {{ $t('preferences.navigationMenu.style') }}
  </ToggleItem>
  <ToggleItem
    v-model="navigationVisualStyle"
    :disabled="disabled"
    :items="visualStyleItems"
  >
    导航主题
  </ToggleItem>
  <SwitchItem
    v-model="navigationSplit"
    :disabled="disabledNavigationSplit || disabled"
  >
    {{ $t('preferences.navigationMenu.split') }}
    <template #tip>
      {{ $t('preferences.navigationMenu.splitTip') }}
    </template>
  </SwitchItem>
  <SwitchItem v-model="navigationAccordion" :disabled="disabled">
    {{ $t('preferences.navigationMenu.accordion') }}
  </SwitchItem>
</template>
