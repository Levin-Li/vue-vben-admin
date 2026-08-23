<script setup lang="ts">
import { $t } from '@vben/locales';

import SwitchItem from '../switch-item.vue';
import NumberFieldItem from '../number-field-item.vue';
import ShellStyle from './shell-style.vue';

const footerEnable = defineModel<boolean>('footerEnable');
const footerFixed = defineModel<boolean>('footerFixed');
const footerHeight = defineModel<number>('footerHeight');
const footerMarginTop = defineModel<number>('footerMarginTop');
const footerMarginRight = defineModel<number>('footerMarginRight');
const footerMarginBottom = defineModel<number>('footerMarginBottom');
const footerMarginLeft = defineModel<number>('footerMarginLeft');
const footerRadiusTopLeft = defineModel<number>('footerRadiusTopLeft');
const footerRadiusTopRight = defineModel<number>('footerRadiusTopRight');
const footerRadiusBottomRight = defineModel<number>('footerRadiusBottomRight');
const footerRadiusBottomLeft = defineModel<number>('footerRadiusBottomLeft');
</script>

<template>
  <SwitchItem v-model="footerEnable">
    {{ $t('preferences.footer.visible') }}
  </SwitchItem>
  <SwitchItem v-model="footerFixed" :disabled="!footerEnable">
    {{ $t('preferences.footer.fixed') }}
  </SwitchItem>
  <NumberFieldItem
    v-model="footerHeight"
    :disabled="!footerEnable"
    :max="120"
    :min="24"
  >
    {{ $t('preferences.tabbar.height') }}
  </NumberFieldItem>
  <ShellStyle
    v-model:margin-top="footerMarginTop"
    v-model:margin-right="footerMarginRight"
    v-model:margin-bottom="footerMarginBottom"
    v-model:margin-left="footerMarginLeft"
    v-model:radius-top-left="footerRadiusTopLeft"
    v-model:radius-top-right="footerRadiusTopRight"
    v-model:radius-bottom-right="footerRadiusBottomRight"
    v-model:radius-bottom-left="footerRadiusBottomLeft"
    :disabled="!footerEnable"
  />
</template>
