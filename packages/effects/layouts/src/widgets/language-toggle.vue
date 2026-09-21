<script setup lang="ts">
import type { SupportedLanguagesType } from '@vben/runtime/locales';

import { SUPPORT_LANGUAGES } from '@vben/runtime/constants';
import { Languages } from '@vben/runtime/icons';
import { loadLocaleMessages } from '@vben/runtime/locales';
import { preferences, updatePreferences } from '@vben-core/foundation/preferences';

import { VbenDropdownRadioMenu, VbenIconButton } from '@vben-core/ui/shadcn';

defineOptions({
  name: 'LanguageToggle',
});

async function handleUpdate(value: string | undefined) {
  if (!value) return;
  const locale = value as SupportedLanguagesType;
  updatePreferences({
    app: {
      locale,
    },
  });
  await loadLocaleMessages(locale);
}
</script>

<template>
  <div>
    <VbenDropdownRadioMenu
      :menus="SUPPORT_LANGUAGES"
      :model-value="preferences.app.locale"
      @update:model-value="handleUpdate"
    >
      <VbenIconButton class="hover:animate-[shrink_0.3s_ease-in-out]">
        <Languages class="text-foreground size-4" />
      </VbenIconButton>
    </VbenDropdownRadioMenu>
  </div>
</template>
