<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { App, ConfigProvider, theme } from 'ant-design-vue';

import { antdLocale } from '@levin/admin-framework/framework-commons/app/locales';

import DraggableFloatingPanelHost from '../shared/draggable-floating-panel-host.vue';
import { shouldShowDraggableFloatingPanelHost } from './floating-panel-visibility';

defineOptions({ name: 'App' });

const { isDark } = usePreferences();
const { tokens } = useAntdDesignTokens();
const accessStore = useAccessStore();
const route = useRoute();

const tokenTheme = computed(() => {
  const algorithm = isDark.value
    ? [theme.darkAlgorithm]
    : [theme.defaultAlgorithm];

  // antd 紧凑模式算法
  if (preferences.app.compact) {
    algorithm.push(theme.compactAlgorithm);
  }

  return {
    algorithm,
    token: tokens,
  };
});

const showDraggableFloatingPanelHost = computed(() =>
  shouldShowDraggableFloatingPanelHost(accessStore.accessToken, route.path),
);
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <App>
      <RouterView />
      <DraggableFloatingPanelHost v-if="showDraggableFloatingPanelHost" />
    </App>
  </ConfigProvider>
</template>
