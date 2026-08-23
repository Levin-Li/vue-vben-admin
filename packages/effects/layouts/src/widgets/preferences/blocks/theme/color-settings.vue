<script setup lang="ts">
import type { BuiltinThemeType } from '@vben/types';

import { computed, ref, watch } from 'vue';

import { Palette, RotateCw } from '@vben/icons';
import { $t } from '@vben/locales';
import { BUILT_IN_THEME_PRESETS, preferencesManager } from '@vben/preferences';
import { convertToHsl, TinyColor } from '@vben/utils';

import { useVbenModal } from '@vben-core/popup-ui';
import { Input, VbenButton } from '@vben-core/shadcn-ui';

import BackgroundSettings from './background-settings.vue';
import BuiltinTheme from './builtin.vue';

type ColorTarget =
  | 'baseBackground'
  | 'contentBackground'
  | 'destructive'
  | 'footerBackground'
  | 'header'
  | 'headerMenuBackground'
  | 'headerMenuTheme'
  | 'menuBackground'
  | 'primary'
  | 'sidebar'
  | 'success'
  | 'tabbarBackground'
  | 'warning';

defineOptions({
  name: 'PreferenceColorSettings',
});

const props = defineProps<{ isDark: boolean }>();

const themeColorPrimary = defineModel<string>('themeColorPrimary');
const themeColorDestructive = defineModel<string>('themeColorDestructive');
const themeColorSuccess = defineModel<string>('themeColorSuccess');
const themeColorWarning = defineModel<string>('themeColorWarning');
const themeBaseBackgroundColor = defineModel<string>(
  'themeBaseBackgroundColor',
);
const themeBaseBackgroundTransparency = defineModel<number>(
  'themeBaseBackgroundTransparency',
);
const themeContentBackgroundColor = defineModel<string>(
  'themeContentBackgroundColor',
);
const themeContentBackgroundTransparency = defineModel<number>(
  'themeContentBackgroundTransparency',
);
const themeBuiltinType = defineModel<BuiltinThemeType>('themeBuiltinType', {
  default: 'default',
});
const themeSemiDarkSidebarColor = defineModel<string>(
  'themeSemiDarkSidebarColor',
);
const themeSemiDarkSidebarColorTransparency = defineModel<number>(
  'themeSemiDarkSidebarColorTransparency',
);
const themeSemiDarkHeaderColor = defineModel<string>(
  'themeSemiDarkHeaderColor',
);
const themeSemiDarkHeaderColorTransparency = defineModel<number>(
  'themeSemiDarkHeaderColorTransparency',
);
const themeHeaderMenuThemeColor = defineModel<string>(
  'themeHeaderMenuThemeColor',
);
const themeHeaderMenuBackgroundColor = defineModel<string>(
  'themeHeaderMenuBackgroundColor',
);
const themeHeaderMenuBackgroundColorTransparency = defineModel<number>(
  'themeHeaderMenuBackgroundColorTransparency',
);
const themeSidebarMenuBackgroundColor = defineModel<string>(
  'themeSidebarMenuBackgroundColor',
);
const themeSidebarMenuBackgroundColorTransparency = defineModel<number>(
  'themeSidebarMenuBackgroundColorTransparency',
);
const tabbarBackgroundColor = defineModel<string>('tabbarBackgroundColor');
const footerBackgroundColor = defineModel<string>('footerBackgroundColor');
const footerBackgroundTransparency = defineModel<number>(
  'footerBackgroundTransparency',
);
const tabbarBackgroundTransparency = defineModel<number>(
  'tabbarBackgroundTransparency',
);

const activeTarget = ref<ColorTarget>('primary');
const editorBuiltinType = ref<BuiltinThemeType>('default');
const editorColor = ref('');

const [Modal, modalApi] = useVbenModal({
  footer: true,
  fullscreenButton: false,
  showCancelButton: false,
  showConfirmButton: false,
});

const activeColor = computed(() => {
  switch (activeTarget.value) {
    case 'baseBackground': {
      return themeBaseBackgroundColor.value;
    }
    case 'contentBackground': {
      return themeContentBackgroundColor.value;
    }
    case 'destructive': {
      return themeColorDestructive.value;
    }
    case 'footerBackground': {
      return footerBackgroundColor.value;
    }
    case 'header': {
      return themeSemiDarkHeaderColor.value;
    }
    case 'headerMenuBackground': {
      return themeHeaderMenuBackgroundColor.value;
    }
    case 'headerMenuTheme': {
      return themeHeaderMenuThemeColor.value;
    }
    case 'menuBackground': {
      return themeSidebarMenuBackgroundColor.value;
    }
    case 'sidebar': {
      return themeSemiDarkSidebarColor.value;
    }
    case 'success': {
      return themeColorSuccess.value;
    }
    case 'tabbarBackground': {
      return tabbarBackgroundColor.value;
    }
    case 'warning': {
      return themeColorWarning.value;
    }
    default: {
      return themeColorPrimary.value;
    }
  }
});

const isBackgroundTarget = computed(() =>
  [
    'baseBackground',
    'contentBackground',
    'footerBackground',
    'header',
    'headerMenuBackground',
    'menuBackground',
    'sidebar',
    'tabbarBackground',
  ].includes(activeTarget.value),
);

const activeBackgroundTransparency = computed({
  get: () => {
    switch (activeTarget.value) {
      case 'baseBackground': {
        return themeBaseBackgroundTransparency.value ?? 0;
      }
      case 'contentBackground': {
        return themeContentBackgroundTransparency.value ?? 0;
      }
      case 'footerBackground': {
        return footerBackgroundTransparency.value ?? 0;
      }
      case 'header': {
        return themeSemiDarkHeaderColorTransparency.value ?? 0;
      }
      case 'headerMenuBackground': {
        return themeHeaderMenuBackgroundColorTransparency.value ?? 0;
      }
      case 'menuBackground': {
        return themeSidebarMenuBackgroundColorTransparency.value ?? 0;
      }
      case 'sidebar': {
        return themeSemiDarkSidebarColorTransparency.value ?? 0;
      }
      case 'tabbarBackground': {
        return tabbarBackgroundTransparency.value ?? 0;
      }
      default: {
        return 0;
      }
    }
  },
  set: (value: number) => {
    const transparency = Math.min(100, Math.max(0, Number(value) || 0));
    switch (activeTarget.value) {
      case 'baseBackground': {
        themeBaseBackgroundTransparency.value = transparency;
        break;
      }
      case 'contentBackground': {
        themeContentBackgroundTransparency.value = transparency;
        break;
      }
      case 'footerBackground': {
        footerBackgroundTransparency.value = transparency;
        break;
      }
      case 'header': {
        themeSemiDarkHeaderColorTransparency.value = transparency;
        break;
      }
      case 'headerMenuBackground': {
        themeHeaderMenuBackgroundColorTransparency.value = transparency;
        break;
      }
      case 'menuBackground': {
        themeSidebarMenuBackgroundColorTransparency.value = transparency;
        break;
      }
      case 'sidebar': {
        themeSemiDarkSidebarColorTransparency.value = transparency;
        break;
      }
      case 'tabbarBackground': {
        tabbarBackgroundTransparency.value = transparency;
        break;
      }
    }
  },
});

const currentColorInputLabel = computed(() => {
  if (activeTarget.value === 'primary') {
    return $t('preferences.theme.customColorInput');
  }
  return getColorTargetLabel(activeTarget.value);
});

const currentColorSettingsTitle = computed(() => {
  if (activeTarget.value === 'primary') {
    return $t('preferences.theme.themeColor');
  }
  return getColorTargetLabel(activeTarget.value);
});

const semanticColorItems = computed(() => {
  return [
    {
      color: themeColorSuccess.value,
      label: $t('preferences.theme.successColor'),
      target: 'success' as ColorTarget,
    },
    {
      color: themeColorWarning.value,
      label: $t('preferences.theme.warningColor'),
      target: 'warning' as ColorTarget,
    },
    {
      color: themeColorDestructive.value,
      label: $t('preferences.theme.destructiveColor'),
      target: 'destructive' as ColorTarget,
    },
  ];
});

function getColorTargetLabel(target: ColorTarget) {
  switch (target) {
    case 'baseBackground': {
      return $t('preferences.theme.baseBackgroundColor');
    }
    case 'contentBackground': {
      return $t('preferences.theme.contentBackgroundColor');
    }
    case 'destructive': {
      return $t('preferences.theme.destructiveColor');
    }
    case 'footerBackground': {
      return $t('preferences.footer.backgroundColor');
    }
    case 'header': {
      return $t('preferences.theme.darkHeaderColor');
    }
    case 'headerMenuBackground': {
      return $t('preferences.theme.headerNavigationMenuBackgroundColor');
    }
    case 'headerMenuTheme': {
      return $t('preferences.theme.headerThemeColor');
    }
    case 'menuBackground': {
      return $t('preferences.theme.navigationMenuBackgroundColor');
    }
    case 'sidebar': {
      return $t('preferences.theme.darkSidebarColor');
    }
    case 'success': {
      return $t('preferences.theme.successColor');
    }
    case 'tabbarBackground': {
      return $t('preferences.tabbar.backgroundColor');
    }
    case 'warning': {
      return $t('preferences.theme.warningColor');
    }
    default: {
      return $t('preferences.theme.themeColor');
    }
  }
}

const currentThemeName = computed(() =>
  getBuiltinThemeName(themeBuiltinType.value),
);

function getBuiltinThemeName(name: BuiltinThemeType) {
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

function getBuiltinColorName(value?: string) {
  const valueColor = new TinyColor(value || '');

  if (!valueColor.isValid) {
    return;
  }

  const valueHex = valueColor.toHexString();
  const preset = BUILT_IN_THEME_PRESETS.find((item) => {
    if (!item.color) {
      return false;
    }

    return new TinyColor(item.color).toHexString() === valueHex;
  });

  return preset ? getBuiltinThemeName(preset.type) : undefined;
}

function getColorSummaryName(value?: string) {
  const color = new TinyColor(value || '');

  if (!color.isValid) {
    return $t('preferences.theme.builtin.custom');
  }

  const builtinColorName = getBuiltinColorName(value);

  if (builtinColorName) {
    return builtinColorName;
  }

  return color.toHexString();
}

function open(target: ColorTarget = 'primary') {
  activeTarget.value = target;
  editorBuiltinType.value =
    target === 'primary' ? themeBuiltinType.value || 'default' : 'custom';
  editorColor.value = activeColor.value || '';
  modalApi.open();
}

function getColorInputValue(value?: string) {
  return new TinyColor(value || '').toHexString();
}

function normalizeColor(value: string) {
  const color = new TinyColor(value);

  if (!color.isValid) {
    return;
  }

  return convertToHsl(color.toHexString());
}

function applyColor(value: string, custom = false) {
  const normalizedColor = normalizeColor(value);

  if (!normalizedColor) {
    return;
  }

  editorColor.value = normalizedColor;
  if (custom) {
    editorBuiltinType.value = 'custom';
  }
}

function updateColorFromEvent(event: Event) {
  const target = event.target as HTMLInputElement;
  applyColor(target.value, true);
}

function resetThemeColors() {
  const initialPreferences = preferencesManager.getInitialPreferences();
  const initialTheme = initialPreferences.theme;

  if (activeTarget.value === 'baseBackground') {
    editorColor.value = initialTheme.baseBackgroundColor;
    return;
  }

  if (activeTarget.value === 'contentBackground') {
    editorColor.value = initialTheme.contentBackgroundColor;
    return;
  }

  if (activeTarget.value === 'tabbarBackground') {
    editorColor.value = initialPreferences.tabbar.backgroundColor;
    return;
  }

  if (activeTarget.value === 'footerBackground') {
    editorColor.value = initialPreferences.footer.backgroundColor;
    return;
  }

  if (activeTarget.value === 'destructive') {
    editorColor.value = initialTheme.colorDestructive;
    return;
  }

  if (activeTarget.value === 'header') {
    editorColor.value = initialTheme.semiDarkHeaderColor;
    return;
  }

  if (activeTarget.value === 'headerMenuTheme') {
    editorColor.value = initialTheme.headerMenuThemeColor;
    return;
  }

  if (activeTarget.value === 'headerMenuBackground') {
    editorColor.value = initialTheme.headerMenuBackgroundColor;
    return;
  }

  if (activeTarget.value === 'menuBackground') {
    editorColor.value = initialTheme.sidebarMenuBackgroundColor;
    return;
  }

  if (activeTarget.value === 'sidebar') {
    editorColor.value = initialTheme.semiDarkSidebarColor;
    return;
  }

  if (activeTarget.value === 'success') {
    editorColor.value = initialTheme.colorSuccess;
    return;
  }

  if (activeTarget.value === 'warning') {
    editorColor.value = initialTheme.colorWarning;
    return;
  }

  editorBuiltinType.value = initialTheme.builtinType;
  editorColor.value = initialTheme.colorPrimary;
}

watch(editorBuiltinType, (value) => {
  if (activeTarget.value === 'primary') {
    themeBuiltinType.value = value;
  }
});

watch(editorColor, (value) => {
  switch (activeTarget.value) {
    case 'baseBackground': {
      themeBaseBackgroundColor.value = value;

      break;
    }
    case 'contentBackground': {
      themeContentBackgroundColor.value = value;

      break;
    }
    case 'footerBackground': {
      footerBackgroundColor.value = value;

      break;
    }
    case 'destructive': {
      themeColorDestructive.value = value;

      break;
    }
    case 'header': {
      themeSemiDarkHeaderColor.value = value;

      break;
    }
    case 'headerMenuBackground': {
      themeHeaderMenuBackgroundColor.value = value;

      break;
    }
    case 'headerMenuTheme': {
      themeHeaderMenuThemeColor.value = value;

      break;
    }
    case 'menuBackground': {
      themeSidebarMenuBackgroundColor.value = value;

      break;
    }
    case 'sidebar': {
      themeSemiDarkSidebarColor.value = value;

      break;
    }
    case 'success': {
      themeColorSuccess.value = value;

      break;
    }
    case 'tabbarBackground': {
      tabbarBackgroundColor.value = value;

      break;
    }
    case 'warning': {
      themeColorWarning.value = value;

      break;
    }
    default: {
      themeColorPrimary.value = value;
    }
  }
});

defineExpose({ open });
</script>

<template>
  <div>
    <button
      class="color-settings-entry"
      type="button"
      @click="() => open('primary')"
    >
      <span class="flex items-center gap-2 text-sm">
        <Palette class="size-4" />
        {{ $t('preferences.theme.themeColor') }}
      </span>
      <span class="color-settings-summary">
        <span
          :style="{ backgroundColor: themeColorPrimary }"
          class="color-settings-preview"
        ></span>
        <span class="min-w-0 truncate text-xs">{{ currentThemeName }}</span>
      </span>
    </button>

    <div class="semantic-color-list">
      <button
        v-for="item in semanticColorItems"
        :key="item.target"
        class="color-settings-entry"
        type="button"
        @click="() => open(item.target)"
      >
        <span class="flex items-center gap-2 text-sm">
          <Palette class="size-4" />
          {{ item.label }}
        </span>
        <span class="color-settings-summary">
          <span
            :style="{ backgroundColor: item.color }"
            class="color-settings-preview"
          ></span>
          <span class="min-w-0 truncate text-xs">
            {{ getColorSummaryName(item.color) }}
          </span>
        </span>
      </button>
    </div>

    <Modal
      :title="currentColorSettingsTitle"
      class="w-[min(640px,calc(100vw-32px))]"
      content-class="px-5 pb-4 pt-1"
      footer-class="border-t px-5 py-3"
    >
      <div class="space-y-5">
        <section class="space-y-3">
          <h4 class="text-sm font-medium">
            {{ $t('preferences.theme.builtin.title') }}
          </h4>
          <BuiltinTheme
            v-model="editorBuiltinType"
            v-model:theme-color-primary="editorColor"
            :is-dark="props.isDark"
          />
          <div class="color-value-row">
            <span class="text-sm">
              {{ currentColorInputLabel }}
            </span>
            <input
              :aria-label="currentColorInputLabel"
              :value="getColorInputValue(editorColor)"
              class="color-native-input"
              type="color"
              @input="updateColorFromEvent"
            />
            <Input
              :model-value="getColorInputValue(editorColor)"
              :placeholder="$t('preferences.theme.colorValuePlaceholder')"
              class="h-8"
              @change="updateColorFromEvent"
              @keydown.enter="updateColorFromEvent"
            />
          </div>
        </section>
        <BackgroundSettings
          v-if="isBackgroundTarget"
          v-model:transparency="activeBackgroundTransparency"
        />
      </div>

      <template #footer>
        <VbenButton
          class="w-full"
          type="button"
          variant="outline"
          @click="resetThemeColors"
        >
          <RotateCw class="mr-2 size-4" />
          {{ $t('preferences.theme.resetColors') }}
        </VbenButton>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.color-settings-entry {
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  display: flex;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 10px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
  width: 100%;
}

.color-settings-entry > span:first-child {
  flex: 1 1 auto;
  min-width: 0;
}

.color-settings-entry:hover {
  background: hsl(var(--accent));
}

.semantic-color-list {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}

.color-settings-summary {
  align-items: center;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-left: auto;
  max-width: 48%;
  min-width: 146px;
  text-align: right;
}

.color-settings-summary > span:last-child {
  flex: 0 1 74px;
  min-width: 0;
}

.color-settings-preview {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  flex: 0 0 auto;
  height: 28px;
  width: 56px;
}

.color-value-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(100px, 1fr) 56px minmax(150px, 190px);
}

.color-native-input {
  background: transparent;
  border: 0;
  cursor: pointer;
  height: 32px;
  padding: 0;
  width: 56px;
}

.color-native-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-native-input::-webkit-color-swatch {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 640px) {
  .color-settings-entry {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }

  .color-settings-summary {
    align-self: flex-end;
    max-width: 100%;
    min-width: 0;
  }

  .color-value-row {
    align-items: stretch;
    grid-template-columns: 1fr 56px;
  }

  .color-value-row :deep(input:not([type='color'])) {
    grid-column: 1 / -1;
  }
}
</style>
