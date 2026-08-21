<script setup lang="ts">
import type {
  LayoutHeaderMenuAlignType,
  LayoutHeaderModeType,
  SelectOption,
} from '@vben/types';

import { $t } from '@vben/locales';

import NumberFieldItem from '../number-field-item.vue';
import SelectItem from '../select-item.vue';
import SwitchItem from '../switch-item.vue';
import ToggleItem from '../toggle-item.vue';
import ShellStyle from './shell-style.vue';

defineProps<{ disabled: boolean }>();

const headerEnable = defineModel<boolean>('headerEnable');
const headerHeight = defineModel<number>('headerHeight');
const headerMode = defineModel<LayoutHeaderModeType>('headerMode');
const headerMenuAlign =
  defineModel<LayoutHeaderMenuAlignType>('headerMenuAlign');
const headerMarginTop = defineModel<number>('headerMarginTop');
const headerMarginRight = defineModel<number>('headerMarginRight');
const headerMarginBottom = defineModel<number>('headerMarginBottom');
const headerMarginLeft = defineModel<number>('headerMarginLeft');
const headerRadiusTopLeft = defineModel<number>('headerRadiusTopLeft');
const headerRadiusTopRight = defineModel<number>('headerRadiusTopRight');
const headerRadiusBottomRight = defineModel<number>('headerRadiusBottomRight');
const headerRadiusBottomLeft = defineModel<number>('headerRadiusBottomLeft');
const headerBorderTopWidth = defineModel<number>('headerBorderTopWidth');
const headerBorderRightWidth = defineModel<number>('headerBorderRightWidth');
const headerBorderBottomWidth = defineModel<number>('headerBorderBottomWidth');
const headerBorderLeftWidth = defineModel<number>('headerBorderLeftWidth');

const localeItems: SelectOption[] = [
  {
    label: $t('preferences.header.modeStatic'),
    value: 'static',
  },
  {
    label: $t('preferences.header.modeFixed'),
    value: 'fixed',
  },
  {
    label: $t('preferences.header.modeAuto'),
    value: 'auto',
  },
  {
    label: $t('preferences.header.modeAutoScroll'),
    value: 'auto-scroll',
  },
];

const headerMenuAlignItems: SelectOption[] = [
  {
    label: $t('preferences.header.menuAlignStart'),
    value: 'start',
  },
  {
    label: $t('preferences.header.menuAlignCenter'),
    value: 'center',
  },
  {
    label: $t('preferences.header.menuAlignEnd'),
    value: 'end',
  },
];
</script>

<template>
  <SwitchItem v-model="headerEnable" :disabled="disabled">
    {{ $t('preferences.header.visible') }}
  </SwitchItem>
  <NumberFieldItem
    v-model="headerHeight"
    :disabled="!headerEnable || disabled"
    :max="160"
    :min="40"
    :step="2"
  >
    {{ $t('preferences.header.height') }}
  </NumberFieldItem>
  <SelectItem
    v-model="headerMode"
    :disabled="!headerEnable"
    :items="localeItems"
  >
    {{ $t('preferences.mode') }}
  </SelectItem>
  <ToggleItem
    v-model="headerMenuAlign"
    :disabled="!headerEnable"
    :items="headerMenuAlignItems"
  >
    {{ $t('preferences.header.menuAlign') }}
  </ToggleItem>
  <ShellStyle
    v-model:border-bottom-width="headerBorderBottomWidth"
    v-model:border-left-width="headerBorderLeftWidth"
    v-model:border-right-width="headerBorderRightWidth"
    v-model:border-top-width="headerBorderTopWidth"
    v-model:margin-bottom="headerMarginBottom"
    v-model:margin-left="headerMarginLeft"
    v-model:margin-right="headerMarginRight"
    v-model:margin-top="headerMarginTop"
    v-model:radius-top-left="headerRadiusTopLeft"
    v-model:radius-top-right="headerRadiusTopRight"
    v-model:radius-bottom-right="headerRadiusBottomRight"
    v-model:radius-bottom-left="headerRadiusBottomLeft"
    :disabled="!headerEnable || disabled"
  />
</template>
