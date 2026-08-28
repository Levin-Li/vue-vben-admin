<script setup lang="ts">
import { SUPPORT_LANGUAGES } from '@vben/constants';
import { $t } from '@vben/locales';

import InputItem from '../input-item.vue';
import SelectItem from '../select-item.vue';
import SwitchItem from '../switch-item.vue';

const emit = defineEmits<{
  openColorSettings: [target: 'watermark'];
}>();

defineOptions({
  name: 'PreferenceGeneralConfig',
});

const appLocale = defineModel<string>('appLocale');
const appDynamicTitle = defineModel<boolean>('appDynamicTitle');
const appWatermark = defineModel<boolean>('appWatermark');
const appWatermarkColor = defineModel<string>('appWatermarkColor');
const appWatermarkColorCustom = defineModel<boolean>('appWatermarkColorCustom');
const appWatermarkContent = defineModel<string>('appWatermarkContent');
const appEnableCheckUpdates = defineModel<boolean>('appEnableCheckUpdates');
</script>

<template>
  <SelectItem v-model="appLocale" :items="SUPPORT_LANGUAGES">
    {{ $t('preferences.language') }}
  </SelectItem>
  <SwitchItem v-model="appDynamicTitle">
    {{ $t('preferences.dynamicTitle') }}
  </SwitchItem>
  <SwitchItem
    v-model="appWatermark"
    @update:model-value="
      (val) => {
        if (!val) appWatermarkContent = '';
      }
    "
  >
    {{ $t('preferences.watermark') }}
  </SwitchItem>
  <InputItem
    v-if="appWatermark"
    v-model="appWatermarkContent"
    :placeholder="$t('preferences.watermarkContent')"
  >
    {{ $t('preferences.watermarkContent') }}
  </InputItem>
  <SwitchItem
    v-if="appWatermark"
    v-model="appWatermarkColorCustom"
    shortcut-class="semi-dark-shortcut"
  >
    {{ $t('preferences.watermarkColor') }}
    <template #before-switch>
      <span class="semi-dark-color-name">
        {{ $t('preferences.watermarkColorCustom') }}
      </span>
    </template>
    <template #shortcut>
      <button
        :aria-label="$t('preferences.watermarkColor')"
        :disabled="!appWatermarkColorCustom"
        class="navigation-menu-color-preview"
        type="button"
        @click.stop
        @click="emit('openColorSettings', 'watermark')"
      >
        <span :style="{ backgroundColor: appWatermarkColor }"></span>
      </button>
    </template>
  </SwitchItem>
  <SwitchItem v-model="appEnableCheckUpdates">
    {{ $t('preferences.checkUpdates') }}
  </SwitchItem>
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
}
</style>
