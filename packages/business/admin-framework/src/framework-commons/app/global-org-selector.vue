<script lang="ts" setup>
import type { UserOrgSelectorRecord } from '../shared/user-org-selector-types';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import UserOrgSelector from '../shared/user-org-selector.vue';
import {
  currentGlobalUserOrgRecord,
  setCurrentGlobalUserOrgRecord,
} from './global-org-context-state';
import { globalOrgSelectorRuntimeState } from './global-org-selector-runtime';

const userStore = useUserStore();
const loadedRecords = ref<UserOrgSelectorRecord[]>([]);

const selectorConfig = computed<Record<string, any>>(() => ({
  ...globalOrgSelectorRuntimeState.valueContent,
  maxSelectCount: 1,
  multiple: false,
  allowClear:
    globalOrgSelectorRuntimeState.valueContent?.allowClear !== false &&
    isAdmin.value,
  valueMode: 'record' as const,
}));

const visible = computed(
  () =>
    globalOrgSelectorRuntimeState.enabled &&
    (isAdmin.value || loadedRecords.value.length !== 1),
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

function handleLoaded(records: UserOrgSelectorRecord[]) {
  loadedRecords.value = records;
  if (
    isAdmin.value ||
    selectorConfig.value.disabled === true ||
    currentGlobalUserOrgRecord.value ||
    records.length === 0
  ) {
    return;
  }

  setCurrentGlobalUserOrgRecord(records[0]);
}

function handleSelectedRecords(records: UserOrgSelectorRecord[]) {
  setCurrentGlobalUserOrgRecord(records[0]);
}
</script>

<template>
  <UserOrgSelector
    v-show="globalOrgSelectorRuntimeState.enabled"
    v-bind="selectorConfig"
    :model-value="currentGlobalUserOrgRecord"
    :class="visible ? 'w-full min-w-[220px]' : 'hidden'"
    @loaded="handleLoaded"
    @update:selected-records="handleSelectedRecords"
  />
</template>
