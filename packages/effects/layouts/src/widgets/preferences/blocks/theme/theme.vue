<script setup lang="ts">
import type { Component } from 'vue';

import type { ThemeModeType } from '@vben/types';

import { computed, watch } from 'vue';

import { MoonStar, Sun, SunMoon } from '@vben/icons';
import { $t } from '@vben/locales';
import { usePreferences } from '@vben/preferences';
import { convertToHsl, TinyColor } from '@vben/utils';

import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@vben-core/shadcn-ui';

import SwitchItem from '../switch-item.vue';

defineOptions({
  name: 'PreferenceTheme',
});

const modelValue = defineModel<string>({ default: 'auto' });
const themeSemiDarkSidebar = defineModel<boolean>('themeSemiDarkSidebar');
const themeSemiDarkSidebarColor = defineModel<string>(
  'themeSemiDarkSidebarColor',
);
const sidebarWidth = defineModel<number>('sidebarWidth', { default: 224 });
const themeSemiDarkSidebarSub = defineModel<boolean>('themeSemiDarkSidebarSub');
const themeSemiDarkHeader = defineModel<boolean>('themeSemiDarkHeader');
const themeSemiDarkHeaderColor = defineModel<string>(
  'themeSemiDarkHeaderColor',
);
const headerHeight = defineModel<number>('headerHeight', { default: 50 });

const { layout } = usePreferences();

const SIDEBAR_WIDTH_MIN = 160;
const SIDEBAR_WIDTH_MAX = 480;
const HEADER_HEIGHT_MIN = 40;
const HEADER_HEIGHT_MAX = 160;

function clampSize(value: number | undefined, min: number, max: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(Math.max(numericValue, min), max);
}

const boundedSidebarWidth = computed({
  get() {
    return clampSize(sidebarWidth.value, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
  },
  set(value: number | undefined) {
    sidebarWidth.value = clampSize(value, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
  },
});

const boundedHeaderHeight = computed({
  get() {
    return clampSize(headerHeight.value, HEADER_HEIGHT_MIN, HEADER_HEIGHT_MAX);
  },
  set(value: number | undefined) {
    headerHeight.value = clampSize(value, HEADER_HEIGHT_MIN, HEADER_HEIGHT_MAX);
  },
});

watch(
  () => themeSemiDarkSidebar.value,
  () => {
    if (!themeSemiDarkSidebar.value) {
      themeSemiDarkSidebarSub.value = themeSemiDarkSidebar.value;
    }
  },
);

watch(
  () => sidebarWidth.value,
  (value) => {
    const nextValue = clampSize(value, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
    if (value !== nextValue) {
      sidebarWidth.value = nextValue;
    }
  },
  { immediate: true },
);

watch(
  () => headerHeight.value,
  (value) => {
    const nextValue = clampSize(value, HEADER_HEIGHT_MIN, HEADER_HEIGHT_MAX);
    if (value !== nextValue) {
      headerHeight.value = nextValue;
    }
  },
  { immediate: true },
);

const THEME_PRESET: Array<{ icon: Component; name: ThemeModeType }> = [
  {
    icon: Sun,
    name: 'light',
  },
  {
    icon: MoonStar,
    name: 'dark',
  },
  {
    icon: SunMoon,
    name: 'auto',
  },
];

function activeClass(theme: string): string[] {
  return theme === modelValue.value ? ['outline-box-active'] : [];
}

function nameView(name: string) {
  switch (name) {
    case 'auto': {
      return $t('preferences.followSystem');
    }
    case 'dark': {
      return $t('preferences.theme.dark');
    }
    case 'light': {
      return $t('preferences.theme.light');
    }
  }
}

function getColorInputValue(value?: string) {
  return new TinyColor(value || '').toHexString();
}

function updateSemiDarkColor(
  field: 'header' | 'sidebar',
  event: Event,
) {
  const target = event.target as HTMLInputElement;
  const value = convertToHsl(target.value);

  if (field === 'header') {
    themeSemiDarkHeaderColor.value = value;
  } else {
    themeSemiDarkSidebarColor.value = value;
  }
}
</script>

<template>
  <div class="flex w-full flex-wrap justify-between">
    <template v-for="theme in THEME_PRESET" :key="theme.name">
      <div
        class="flex cursor-pointer flex-col"
        @click="modelValue = theme.name"
      >
        <div
          :class="activeClass(theme.name)"
          class="outline-box flex-center py-4"
        >
          <component :is="theme.icon" class="mx-9 size-5" />
        </div>
        <div class="text-muted-foreground mt-2 text-center text-xs">
          {{ nameView(theme.name) }}
        </div>
      </div>
    </template>

    <SwitchItem
      v-model="themeSemiDarkSidebar"
      :disabled="
        modelValue === 'dark' ||
        layout === 'header-nav' ||
        layout === 'full-content'
      "
      :tip="$t('preferences.theme.darkSidebarTip')"
      class="mt-6"
    >
      {{ $t('preferences.theme.darkSidebar') }}
      <template #shortcut>
        <span class="semi-dark-shortcut">
          <NumberField
            v-model="boundedSidebarWidth"
            :aria-label="$t('preferences.theme.darkSidebarWidth')"
            :max="SIDEBAR_WIDTH_MAX"
            :min="SIDEBAR_WIDTH_MIN"
            :step="10"
            class="semi-dark-size-field"
            @click.stop
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
          <input
            :aria-label="$t('preferences.theme.darkSidebarColor')"
            :value="getColorInputValue(themeSemiDarkSidebarColor)"
            class="semi-dark-color-input"
            type="color"
            @click.stop
            @input="updateSemiDarkColor('sidebar', $event)"
          />
        </span>
      </template>
    </SwitchItem>
    <SwitchItem
      v-model="themeSemiDarkSidebarSub"
      :disabled="
        modelValue === 'dark' ||
        (layout !== 'header-mixed-nav' && layout !== 'sidebar-mixed-nav') ||
        !themeSemiDarkSidebar
      "
      :tip="$t('preferences.theme.darkSidebarSubTip')"
    >
      {{ $t('preferences.theme.darkSidebarSub') }}
    </SwitchItem>
    <SwitchItem v-model="themeSemiDarkHeader" :disabled="modelValue === 'dark'">
      {{ $t('preferences.theme.darkHeader') }}
      <template #shortcut>
        <span class="semi-dark-shortcut">
          <NumberField
            v-model="boundedHeaderHeight"
            :aria-label="$t('preferences.theme.darkHeaderHeight')"
            :max="HEADER_HEIGHT_MAX"
            :min="HEADER_HEIGHT_MIN"
            :step="1"
            class="semi-dark-size-field"
            @click.stop
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
          <input
            :aria-label="$t('preferences.theme.darkHeaderColor')"
            :value="getColorInputValue(themeSemiDarkHeaderColor)"
            class="semi-dark-color-input"
            type="color"
            @click.stop
            @input="updateSemiDarkColor('header', $event)"
          />
        </span>
      </template>
    </SwitchItem>
  </div>
</template>

<style scoped>
.semi-dark-shortcut {
  align-items: center;
  display: inline-flex;
  gap: 8px;
}

.semi-dark-size-field {
  width: 92px;
}

.semi-dark-size-field :deep(input) {
  height: 28px;
}

.semi-dark-color-input {
  background: transparent;
  border: 0;
  cursor: pointer;
  height: 28px;
  padding: 0;
  width: 56px;
}

.semi-dark-color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.semi-dark-color-input::-webkit-color-swatch {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
