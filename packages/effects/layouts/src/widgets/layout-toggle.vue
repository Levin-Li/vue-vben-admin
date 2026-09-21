<script setup lang="ts">
import type { AuthPageLayoutType } from '@vben/runtime/types';

import type { VbenDropdownMenuItem } from '@vben-core/ui/shadcn';

import { computed } from 'vue';

import { InspectionPanel, PanelLeft, PanelRight } from '@vben/runtime/icons';
import { $t } from '@vben/runtime/locales';
import {
  preferences,
  updatePreferences,
  usePreferences,
} from '@vben-core/foundation/preferences';

import { VbenDropdownRadioMenu, VbenIconButton } from '@vben-core/ui/shadcn';

defineOptions({
  name: 'AuthenticationLayoutToggle',
});

const menus = computed((): VbenDropdownMenuItem[] => [
  {
    icon: PanelLeft,
    label: $t('authentication.layout.alignLeft'),
    value: 'panel-left',
  },
  {
    icon: InspectionPanel,
    label: $t('authentication.layout.center'),
    value: 'panel-center',
  },
  {
    icon: PanelRight,
    label: $t('authentication.layout.alignRight'),
    value: 'panel-right',
  },
]);

const { authPanelCenter, authPanelLeft, authPanelRight } = usePreferences();

function handleUpdate(value: string | undefined) {
  if (!value) return;
  updatePreferences({
    app: {
      authPageLayout: value as AuthPageLayoutType,
    },
  });
}
</script>

<template>
  <VbenDropdownRadioMenu
    :menus="menus"
    :model-value="preferences.app.authPageLayout"
    @update:model-value="handleUpdate"
  >
    <VbenIconButton>
      <PanelRight v-if="authPanelRight" class="size-4" />
      <PanelLeft v-if="authPanelLeft" class="size-4" />
      <InspectionPanel v-if="authPanelCenter" class="size-4" />
    </VbenIconButton>
  </VbenDropdownRadioMenu>
</template>
