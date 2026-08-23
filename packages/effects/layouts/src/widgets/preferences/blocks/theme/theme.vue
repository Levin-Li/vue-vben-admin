<script setup lang="ts">
import type { Component } from 'vue';

import type { BuiltinThemeType, ThemeModeType } from '@vben/types';

import { computed, watch } from 'vue';

import { MoonStar, Sun, SunMoon } from '@vben/icons';
import { $t } from '@vben/locales';
import { BUILT_IN_THEME_PRESETS, usePreferences } from '@vben/preferences';
import { TinyColor } from '@vben/utils';

import SwitchItem from '../switch-item.vue';

type ThemeColorTarget =
  | 'baseBackground'
  | 'contentBackground'
  | 'footerBackground'
  | 'headerMenuBackground'
  | 'headerMenuTheme'
  | 'menuBackground'
  | 'tabbarBackground';

defineOptions({
  name: 'PreferenceTheme',
});

const emit = defineEmits<{
  openColorSettings: [target: 'header' | 'sidebar' | ThemeColorTarget];
}>();
const modelValue = defineModel<string>({ default: 'auto' });
const themeBaseBackgroundColor = defineModel<string>(
  'themeBaseBackgroundColor',
);
const themeBaseBackgroundColorCustom = defineModel<boolean>(
  'themeBaseBackgroundColorCustom',
);
const themeContentBackgroundColor = defineModel<string>(
  'themeContentBackgroundColor',
);
const themeContentBackgroundColorCustom = defineModel<boolean>(
  'themeContentBackgroundColorCustom',
);
const tabbarBackgroundColor = defineModel<string>('tabbarBackgroundColor');
const tabbarBackgroundColorCustom = defineModel<boolean>(
  'tabbarBackgroundColorCustom',
);
const footerBackgroundColor = defineModel<string>('footerBackgroundColor');
const footerBackgroundColorCustom = defineModel<boolean>(
  'footerBackgroundColorCustom',
);
const themeSemiDarkSidebar = defineModel<boolean>('themeSemiDarkSidebar');
const themeSemiDarkSidebarColor = defineModel<string>(
  'themeSemiDarkSidebarColor',
);
const themeSemiDarkSidebarSub = defineModel<boolean>('themeSemiDarkSidebarSub');
const themeSemiDarkHeader = defineModel<boolean>('themeSemiDarkHeader');
const themeSemiDarkHeaderColor = defineModel<string>(
  'themeSemiDarkHeaderColor',
);
const themeHeaderMenuThemeColor = defineModel<string>(
  'themeHeaderMenuThemeColor',
);
const themeHeaderMenuThemeColorCustom = defineModel<boolean>(
  'themeHeaderMenuThemeColorCustom',
);
const themeHeaderMenuBackgroundColor = defineModel<string>(
  'themeHeaderMenuBackgroundColor',
);
const themeHeaderMenuBackgroundColorCustom = defineModel<boolean>(
  'themeHeaderMenuBackgroundColorCustom',
);
const themeSidebarMenuBackgroundColor = defineModel<string>(
  'themeSidebarMenuBackgroundColor',
);
const themeSidebarMenuBackgroundColorCustom = defineModel<boolean>(
  'themeSidebarMenuBackgroundColorCustom',
);

const { layout } = usePreferences();

const semiDarkSidebarColorName = computed(() =>
  getColorPresetName(themeSemiDarkSidebarColor.value),
);
const semiDarkHeaderColorName = computed(() =>
  getColorPresetName(themeSemiDarkHeaderColor.value),
);

watch(
  () => themeSemiDarkSidebar.value,
  () => {
    if (!themeSemiDarkSidebar.value) {
      themeSemiDarkSidebarSub.value = themeSemiDarkSidebar.value;
    }
  },
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

function builtinThemeName(name: BuiltinThemeType) {
  switch (name) {
    case 'custom': {
      return $t('preferences.theme.builtin.custom');
    }
    case 'deep-blue': {
      return $t('preferences.theme.builtin.deepBlue');
    }
    case 'deep-green': {
      return $t('preferences.theme.builtin.deepGreen');
    }
    case 'gray': {
      return $t('preferences.theme.builtin.gray');
    }
    case 'green': {
      return $t('preferences.theme.builtin.green');
    }
    case 'neutral': {
      return $t('preferences.theme.builtin.neutral');
    }
    case 'orange': {
      return $t('preferences.theme.builtin.orange');
    }
    case 'pink': {
      return $t('preferences.theme.builtin.pink');
    }
    case 'rose': {
      return $t('preferences.theme.builtin.rose');
    }
    case 'sky-blue': {
      return $t('preferences.theme.builtin.skyBlue');
    }
    case 'slate': {
      return $t('preferences.theme.builtin.slate');
    }
    case 'violet': {
      return $t('preferences.theme.builtin.violet');
    }
    case 'yellow': {
      return $t('preferences.theme.builtin.yellow');
    }
    case 'zinc': {
      return $t('preferences.theme.builtin.zinc');
    }
    default: {
      return $t('preferences.theme.builtin.default');
    }
  }
}

function getColorPresetName(value?: string) {
  const valueColor = new TinyColor(value || '');

  if (!valueColor.isValid) {
    return $t('preferences.theme.builtin.custom');
  }

  const valueHex = valueColor.toHexString();
  const preset = BUILT_IN_THEME_PRESETS.find((item) => {
    if (!item.color) {
      return false;
    }
    return new TinyColor(item.color).toHexString() === valueHex;
  });

  return preset
    ? builtinThemeName(preset.type)
    : $t('preferences.theme.builtin.custom');
}

function openColorSettings(target: 'header' | 'sidebar' | ThemeColorTarget) {
  emit('openColorSettings', target);
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
      v-model="themeBaseBackgroundColorCustom"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.theme.baseBackgroundColor') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ $t('preferences.theme.builtin.custom') }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="$t('preferences.theme.baseBackgroundColor')"
          :disabled="!themeBaseBackgroundColorCustom"
          class="navigation-menu-color-preview"
          type="button"
          @click.stop="openColorSettings('baseBackground')"
        >
          <span :style="{ backgroundColor: themeBaseBackgroundColor }"></span>
        </button>
      </template>
    </SwitchItem>

    <SwitchItem
      v-model="themeContentBackgroundColorCustom"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.theme.contentBackgroundColor') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ $t('preferences.theme.builtin.custom') }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="$t('preferences.theme.contentBackgroundColor')"
          :disabled="!themeContentBackgroundColorCustom"
          class="navigation-menu-color-preview"
          type="button"
          @click.stop="openColorSettings('contentBackground')"
        >
          <span
            :style="{ backgroundColor: themeContentBackgroundColor }"
          ></span>
        </button>
      </template>
    </SwitchItem>

    <SwitchItem
      v-model="tabbarBackgroundColorCustom"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.tabbar.backgroundColor') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ $t('preferences.theme.builtin.custom') }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="$t('preferences.tabbar.backgroundColor')"
          :disabled="!tabbarBackgroundColorCustom"
          class="navigation-menu-color-preview"
          type="button"
          @click.stop="openColorSettings('tabbarBackground')"
        >
          <span :style="{ backgroundColor: tabbarBackgroundColor }"></span>
        </button>
      </template>
    </SwitchItem>


    <SwitchItem
      v-model="themeSemiDarkSidebar"
      :disabled="
        modelValue === 'dark' ||
        layout === 'header-nav' ||
        layout === 'full-content'
      "
      :tip="$t('preferences.theme.darkSidebarTip')"
      class="mt-6"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.theme.darkSidebar') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ semiDarkSidebarColorName }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="$t('preferences.theme.darkSidebarColor')"
          :disabled="!themeSemiDarkSidebar || modelValue === 'dark'"
          class="semi-dark-color-button semi-dark-color-preview-button"
          type="button"
          @click.stop="openColorSettings('sidebar')"
        >
          <span
            :style="{ backgroundColor: themeSemiDarkSidebarColor }"
            class="semi-dark-color-preview"
          ></span>
        </button>
      </template>
    </SwitchItem>
    <SwitchItem
      v-model="themeSidebarMenuBackgroundColorCustom"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.theme.navigationMenuBackgroundColor') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ $t('preferences.theme.builtin.custom') }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="$t('preferences.theme.navigationMenuBackgroundColor')"
          :disabled="!themeSidebarMenuBackgroundColorCustom"
          class="navigation-menu-color-preview"
          type="button"
          @click.stop="openColorSettings('menuBackground')"
        >
          <span
            :style="{ backgroundColor: themeSidebarMenuBackgroundColor }"
          ></span>
        </button>
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
    <SwitchItem
      v-model="themeSemiDarkHeader"
      :disabled="modelValue === 'dark'"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.theme.darkHeader') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ semiDarkHeaderColorName }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="$t('preferences.theme.darkHeaderColor')"
          :disabled="!themeSemiDarkHeader || modelValue === 'dark'"
          class="semi-dark-color-button semi-dark-color-preview-button"
          type="button"
          @click.stop="openColorSettings('header')"
        >
          <span
            :style="{ backgroundColor: themeSemiDarkHeaderColor }"
            class="semi-dark-color-preview"
          ></span>
        </button>
      </template>
    </SwitchItem>
    <SwitchItem
      v-model="themeHeaderMenuThemeColorCustom"
      :disabled="modelValue === 'dark' || !themeSemiDarkHeader"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.theme.headerThemeColor') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ $t('preferences.theme.builtin.custom') }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="$t('preferences.theme.headerThemeColor')"
          :disabled="
            !themeHeaderMenuThemeColorCustom ||
            !themeSemiDarkHeader ||
            modelValue === 'dark'
          "
          class="semi-dark-color-button semi-dark-color-preview-button"
          type="button"
          @click.stop="openColorSettings('headerMenuTheme')"
        >
          <span
            :style="{ backgroundColor: themeHeaderMenuThemeColor }"
            class="semi-dark-color-preview"
          ></span>
        </button>
      </template>
    </SwitchItem>
    <SwitchItem
      v-model="themeHeaderMenuBackgroundColorCustom"
      :disabled="modelValue === 'dark' || !themeSemiDarkHeader"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.theme.headerNavigationMenuBackgroundColor') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ $t('preferences.theme.builtin.custom') }}
        </span>
      </template>
      <template #shortcut>
        <button
          :aria-label="
            $t('preferences.theme.headerNavigationMenuBackgroundColor')
          "
          :disabled="
            !themeHeaderMenuBackgroundColorCustom ||
            !themeSemiDarkHeader ||
            modelValue === 'dark'
          "
          class="semi-dark-color-button semi-dark-color-preview-button"
          type="button"
          @click.stop="openColorSettings('headerMenuBackground')"
        >
          <span
            :style="{ backgroundColor: themeHeaderMenuBackgroundColor }"
            class="semi-dark-color-preview"
          ></span>
        </button>
      </template>
    </SwitchItem>

    <SwitchItem
      v-model="footerBackgroundColorCustom"
      shortcut-class="semi-dark-shortcut"
    >
      {{ $t('preferences.footer.backgroundColor') }}
      <template #before-switch>
        <span class="semi-dark-color-name">
          {{ $t('preferences.theme.builtin.custom') }}
        </span>
      </template>
      <template #shortcut>
        <button
          :disabled="!footerBackgroundColorCustom"
          class="navigation-menu-color-preview"
          type="button"
          @click.stop="openColorSettings('footerBackground')"
        >
          <span :style="{ backgroundColor: footerBackgroundColor }"></span>
        </button>
      </template>
    </SwitchItem>
  </div>
</template>

<style scoped>
:deep(.semi-dark-shortcut) {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  margin-left: 12px;
  margin-right: 0;
  min-width: 0;
}

.semi-dark-color-button {
  align-items: center;
  color: hsl(var(--foreground));
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  justify-content: flex-end;
  max-width: 150px;
  min-width: 112px;
}

.semi-dark-color-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.semi-dark-color-preview {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  flex: 0 0 auto;
  height: 28px;
  width: 56px;
}

.semi-dark-color-preview-button {
  min-width: 56px;
}

.semi-dark-color-name {
  font-size: 12px;
  max-width: 72px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navigation-menu-color-preview {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  height: 28px;
  overflow: hidden;
  width: 56px;
}

.navigation-menu-color-preview:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.navigation-menu-color-preview span {
  display: block;
  height: 100%;
  min-width: 0;
  width: 100%;
}
</style>
