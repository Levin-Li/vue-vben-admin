<script setup lang="ts">
import type { Component } from 'vue';

import { computed } from 'vue';

import { $t } from '@vben/locales';

import { ContentCompact, ContentWide } from '../../icons';
import ShellStyle from './shell-style.vue';

defineOptions({
  name: 'PreferenceLayoutContent',
});

const modelValue = defineModel<string>({ default: 'wide' });
const contentMarginTop = defineModel<number>('contentMarginTop');
const contentMarginRight = defineModel<number>('contentMarginRight');
const contentMarginBottom = defineModel<number>('contentMarginBottom');
const contentMarginLeft = defineModel<number>('contentMarginLeft');
const contentRadiusTopLeft = defineModel<number>('contentRadiusTopLeft');
const contentRadiusTopRight = defineModel<number>('contentRadiusTopRight');
const contentRadiusBottomRight = defineModel<number>(
  'contentRadiusBottomRight',
);
const contentRadiusBottomLeft = defineModel<number>('contentRadiusBottomLeft');
const contentBorderTopWidth = defineModel<number>('contentBorderTopWidth');
const contentBorderRightWidth = defineModel<number>('contentBorderRightWidth');
const contentBorderBottomWidth = defineModel<number>(
  'contentBorderBottomWidth',
);
const contentBorderLeftWidth = defineModel<number>('contentBorderLeftWidth');

const components: Record<string, Component> = {
  compact: ContentCompact,
  wide: ContentWide,
};

const PRESET = computed(() => [
  {
    name: $t('preferences.wide'),
    type: 'wide',
  },
  {
    name: $t('preferences.compact'),
    type: 'compact',
  },
]);

function activeClass(theme: string): string[] {
  return theme === modelValue.value ? ['outline-box-active'] : [];
}
</script>

<template>
  <div class="flex w-full gap-5">
    <template v-for="theme in PRESET" :key="theme.name">
      <div
        class="flex w-[100px] cursor-pointer flex-col"
        @click="modelValue = theme.type"
      >
        <div :class="activeClass(theme.type)" class="outline-box flex-center">
          <component :is="components[theme.type]" />
        </div>
        <div class="text-muted-foreground mt-2 text-center text-xs">
          {{ theme.name }}
        </div>
      </div>
    </template>
  </div>
  <ShellStyle
    v-model:border-bottom-width="contentBorderBottomWidth"
    v-model:border-left-width="contentBorderLeftWidth"
    v-model:border-right-width="contentBorderRightWidth"
    v-model:border-top-width="contentBorderTopWidth"
    v-model:margin-bottom="contentMarginBottom"
    v-model:margin-left="contentMarginLeft"
    v-model:margin-right="contentMarginRight"
    v-model:margin-top="contentMarginTop"
    v-model:radius-top-left="contentRadiusTopLeft"
    v-model:radius-top-right="contentRadiusTopRight"
    v-model:radius-bottom-right="contentRadiusBottomRight"
    v-model:radius-bottom-left="contentRadiusBottomLeft"
    class="mt-3"
  />
</template>
