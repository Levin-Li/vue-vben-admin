<script setup lang="ts">
import type { LayoutType } from '@vben/types';

import { onMounted } from 'vue';

import { $t } from '@vben/locales';

import CheckboxItem from '../checkbox-item.vue';
import NumberFieldItem from '../number-field-item.vue';
import SwitchItem from '../switch-item.vue';
import ShellStyle from './shell-style.vue';

defineProps<{ currentLayout?: LayoutType; disabled: boolean }>();

const sidebarEnable = defineModel<boolean>('sidebarEnable');
const sidebarWidth = defineModel<number>('sidebarWidth');
const sidebarMixedMenuGap = defineModel<number>('sidebarMixedMenuGap');
const sidebarMenuItemGap = defineModel<number>('sidebarMenuItemGap');
const sidebarCollapsedShowTitle = defineModel<boolean>(
  'sidebarCollapsedShowTitle',
);
const sidebarAutoActivateChild = defineModel<boolean>(
  'sidebarAutoActivateChild',
);
const sidebarCollapsed = defineModel<boolean>('sidebarCollapsed');
const sidebarExpandOnHover = defineModel<boolean>('sidebarExpandOnHover');

const sidebarButtons = defineModel<string[]>('sidebarButtons', { default: [] });
const sidebarCollapsedButton = defineModel<boolean>('sidebarCollapsedButton');
const sidebarFixedButton = defineModel<boolean>('sidebarFixedButton');
const sidebarMarginTop = defineModel<number>('sidebarMarginTop');
const sidebarMarginRight = defineModel<number>('sidebarMarginRight');
const sidebarMarginBottom = defineModel<number>('sidebarMarginBottom');
const sidebarMarginLeft = defineModel<number>('sidebarMarginLeft');
const sidebarRadiusTopLeft = defineModel<number>('sidebarRadiusTopLeft');
const sidebarRadiusTopRight = defineModel<number>('sidebarRadiusTopRight');
const sidebarRadiusBottomRight = defineModel<number>(
  'sidebarRadiusBottomRight',
);
const sidebarRadiusBottomLeft = defineModel<number>('sidebarRadiusBottomLeft');
const sidebarBorderTopWidth = defineModel<number>('sidebarBorderTopWidth');
const sidebarBorderRightWidth = defineModel<number>('sidebarBorderRightWidth');
const sidebarBorderBottomWidth = defineModel<number>(
  'sidebarBorderBottomWidth',
);
const sidebarBorderLeftWidth = defineModel<number>('sidebarBorderLeftWidth');

onMounted(() => {
  if (
    sidebarCollapsedButton.value &&
    !sidebarButtons.value.includes('collapsed')
  ) {
    sidebarButtons.value.push('collapsed');
  }
  if (sidebarFixedButton.value && !sidebarButtons.value.includes('fixed')) {
    sidebarButtons.value.push('fixed');
  }
});

const handleCheckboxChange = () => {
  sidebarCollapsedButton.value = !!sidebarButtons.value.includes('collapsed');
  sidebarFixedButton.value = !!sidebarButtons.value.includes('fixed');
};
</script>

<template>
  <SwitchItem v-model="sidebarEnable" :disabled="disabled">
    {{ $t('preferences.sidebar.visible') }}
  </SwitchItem>
  <SwitchItem v-model="sidebarCollapsed" :disabled="!sidebarEnable || disabled">
    {{ $t('preferences.sidebar.collapsed') }}
  </SwitchItem>
  <SwitchItem
    v-model="sidebarExpandOnHover"
    :disabled="!sidebarEnable || disabled || !sidebarCollapsed"
    :tip="$t('preferences.sidebar.expandOnHoverTip')"
  >
    {{ $t('preferences.sidebar.expandOnHover') }}
  </SwitchItem>
  <SwitchItem
    v-model="sidebarCollapsedShowTitle"
    :disabled="!sidebarEnable || disabled || !sidebarCollapsed"
  >
    {{ $t('preferences.sidebar.collapsedShowTitle') }}
  </SwitchItem>
  <SwitchItem
    v-model="sidebarAutoActivateChild"
    :disabled="
      !sidebarEnable ||
      !['sidebar-mixed-nav', 'mixed-nav', 'header-mixed-nav'].includes(
        currentLayout as string,
      ) ||
      disabled
    "
    :tip="$t('preferences.sidebar.autoActivateChildTip')"
  >
    {{ $t('preferences.sidebar.autoActivateChild') }}
  </SwitchItem>
  <CheckboxItem
    :items="[
      { label: $t('preferences.sidebar.buttonCollapsed'), value: 'collapsed' },
      { label: $t('preferences.sidebar.buttonFixed'), value: 'fixed' },
    ]"
    multiple
    v-model="sidebarButtons"
    :on-btn-click="handleCheckboxChange"
  >
    {{ $t('preferences.sidebar.buttons') }}
  </CheckboxItem>
  <NumberFieldItem
    v-model="sidebarWidth"
    :disabled="!sidebarEnable || disabled"
    :max="480"
    :min="160"
    :step="10"
  >
    {{ $t('preferences.sidebar.width') }}
  </NumberFieldItem>
  <NumberFieldItem
  v-model="sidebarMenuItemGap"
  :disabled="!sidebarEnable || disabled"
  :max="24"
  :min="0"
    :step="1"
  >
    {{ $t('preferences.sidebar.menuItemGap') }}
  </NumberFieldItem>
  <NumberFieldItem
    v-if="['sidebar-mixed-nav', 'header-mixed-nav'].includes(currentLayout as string)"
  v-model="sidebarMixedMenuGap"
  :disabled="!sidebarEnable || disabled"
  :max="10"
  :min="6"
    :step="1"
  >
    {{ $t('preferences.sidebar.mixedMenuGap') }}
  </NumberFieldItem>
  <ShellStyle
    v-model:border-bottom-width="sidebarBorderBottomWidth"
    v-model:border-left-width="sidebarBorderLeftWidth"
    v-model:border-right-width="sidebarBorderRightWidth"
    v-model:border-top-width="sidebarBorderTopWidth"
    v-model:margin-bottom="sidebarMarginBottom"
    v-model:margin-left="sidebarMarginLeft"
    v-model:margin-right="sidebarMarginRight"
    v-model:margin-top="sidebarMarginTop"
    v-model:radius-top-left="sidebarRadiusTopLeft"
    v-model:radius-top-right="sidebarRadiusTopRight"
    v-model:radius-bottom-right="sidebarRadiusBottomRight"
    v-model:radius-bottom-left="sidebarRadiusBottomLeft"
    :disabled="!sidebarEnable || disabled"
  />
</template>
