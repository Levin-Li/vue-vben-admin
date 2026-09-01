<script lang="ts" setup>
import type { UserOrgSelectorRecord } from '../shared/user-org-selector-types';

import { computed } from 'vue';

import { useUserStore } from '@vben/stores';

import UserOrgSelector from '../shared/user-org-selector.vue';
import {
  currentGlobalUserOrgRecord,
  setCurrentGlobalUserOrgRecord,
} from './global-org-context-state';
import { globalOrgSelectorRuntimeState } from './global-org-selector-runtime';

const userStore = useUserStore();

const selectorConfig = computed<Record<string, any>>(() => ({
  ...globalOrgSelectorRuntimeState.valueContent,
  maxSelectCount: 1,
  multiple: false,
  valueMode: 'record' as const,
}));

const visible = computed(() => globalOrgSelectorRuntimeState.enabled);
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
  if (
    isAdmin.value ||
    selectorConfig.value.disabled === true ||
    currentGlobalUserOrgRecord.value ||
    records.length !== 1
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
    v-if="visible"
    v-bind="selectorConfig"
    :model-value="currentGlobalUserOrgRecord"
    class="w-full min-w-[260px]"
    @loaded="handleLoaded"
    @update:selected-records="handleSelectedRecords"
  />
</template>
