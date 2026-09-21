<script lang="ts" setup>
import type { UserOrgSelectorRecord } from '../shared/user-org-selector-types';

import { computed, ref, watch } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import UserOrgSelector from '../shared/user-org-selector.vue';
import {
  currentGlobalUserOrgRecords,
  setCurrentGlobalUserOrgRecords,
} from './global-org-context-state';
import { globalOrgSelectorRuntimeState } from './global-org-selector-runtime';

const userStore = useUserStore();
const loadedRecords = ref<UserOrgSelectorRecord[]>([]);
const hasLoadedRecords = ref(false);

const selectedValue = computed(() =>
  selectorConfig.value.multiple === true
    ? currentGlobalUserOrgRecords.value
    : currentGlobalUserOrgRecords.value[0],
);

const maxSelectCount = computed(() => {
  const configured = Number(
    globalOrgSelectorRuntimeState.valueContent?.maxSelectCount,
  );
  return Number.isInteger(configured) && configured > 0 ? configured : 0;
});

const selectorConfig = computed<Record<string, any>>(() => ({
  ...globalOrgSelectorRuntimeState.valueContent,
  // 全局运行时配置缺少这两个开关时，显式保留组件的默认“组织和用户均可选”语义。
  allowSelectOrg:
    globalOrgSelectorRuntimeState.valueContent?.allowSelectOrg !== false,
  allowSelectUser:
    globalOrgSelectorRuntimeState.valueContent?.allowSelectUser !== false,
  maxSelectCount:
    globalOrgSelectorRuntimeState.valueContent?.multiple === true
      ? maxSelectCount.value
      : 1,
  multiple: globalOrgSelectorRuntimeState.valueContent?.multiple === true,
  mode: globalOrgSelectorRuntimeState.valueContent?.mode || 'both',
  allowClear:
    globalOrgSelectorRuntimeState.valueContent?.allowClear !== false &&
    isAdmin.value,
  valueMode: 'record' as const,
}));

const visible = computed(
  () =>
    globalOrgSelectorRuntimeState.enabled &&
    (isAdmin.value ||
      (hasLoadedRecords.value && loadedRecords.value.length > 1)),
);
const isAdmin = computed(() => {
  const user = (userStore.userInfo || {}) as Record<string, any>;
  return (
    user.admin === true ||
    user.isAdmin === true ||
    user.superAdmin === true ||
    user.isSuperAdmin === true ||
    user.topSuperAdmin === true ||
    user.isTopSuperAdmin === true
  );
});

watch(
  () => globalOrgSelectorRuntimeState.valueContent,
  () => {
    hasLoadedRecords.value = false;
    loadedRecords.value = [];
  },
);

function handleLoaded(records: UserOrgSelectorRecord[]) {
  // 关闭后忽略已发出请求的迟到响应，避免重新自动选中。
  if (!globalOrgSelectorRuntimeState.enabled) return;

  loadedRecords.value = records;
  hasLoadedRecords.value = true;
  // 默认空选；只有候选失效时才清理已有上下文。
  const available = new Set(
    records.map((record) => `${record.kind}:${record.id}`),
  );
  if (
    currentGlobalUserOrgRecords.value.some(
      (record) => !available.has(`${record.kind}:${record.id}`),
    )
  ) {
    setCurrentGlobalUserOrgRecords([], selectorConfig.value.multiple === true);
  }
}

function handleSelectedRecords(records: UserOrgSelectorRecord[]) {
  // 组件卸载前排队的事件也不能恢复已关闭的上下文。
  if (!globalOrgSelectorRuntimeState.enabled) return;

  setCurrentGlobalUserOrgRecords(
    records,
    selectorConfig.value.multiple === true,
  );
}
</script>

<template>
  <UserOrgSelector
    v-if="globalOrgSelectorRuntimeState.enabled"
    v-bind="selectorConfig"
    :model-value="selectedValue"
    data-testid="global-user-org-selector"
    :class="visible ? 'w-full min-w-[220px]' : 'hidden'"
    @loaded="handleLoaded"
    @update:selected-records="handleSelectedRecords"
  />
</template>
