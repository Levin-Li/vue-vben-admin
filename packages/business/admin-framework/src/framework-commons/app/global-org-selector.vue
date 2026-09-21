<script lang="ts" setup>
import type { UserOrgSelectorRecord } from '../shared/user-org-selector-types';

import { computed, ref, watch } from 'vue';

import { useUserStore } from '@vben/runtime/stores';

import UserOrgSelector from '../shared/user-org-selector.vue';
import { fetchCrudList } from '../api';
import {
  currentGlobalUserOrgRecords,
  setCurrentGlobalUserOrgRecords,
} from './global-org-context-state';
import { globalOrgSelectorRuntimeState } from './global-org-selector-runtime';

const userStore = useUserStore();
const loadedRecords = ref<UserOrgSelectorRecord[]>([]);
const hasLoadedRecords = ref(false);
const tenantOptions = ref<Array<{ label: string; value: string }>>([]);
const hasLoadedTenantOptions = ref(false);

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
  // 平台用户默认允许三类节点；非平台用户不产生跨租户根节点。
  selectableTypes:
    globalOrgSelectorRuntimeState.valueContent?.selectableTypes ||
    (isPlatformUser.value ? ['tenant', 'org', 'user'] : ['org', 'user']),
  maxSelectCount:
    globalOrgSelectorRuntimeState.valueContent?.multiple === true
      ? maxSelectCount.value
      : 1,
  multiple: globalOrgSelectorRuntimeState.valueContent?.multiple === true,
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
const isPlatformUser = computed(() => {
  const user = (userStore.userInfo || {}) as Record<string, any>;
  return user.platformUser === true || user.isPlatformUser === true || user.superAdmin === true || user.isSuperAdmin === true;
});

watch(isPlatformUser, (platformUser) => {
  // 身份切换后清空旧候选，下一次展开时按当前身份重新加载。
  hasLoadedTenantOptions.value = false;
  if (!platformUser) tenantOptions.value = [];
});

async function handleDropdownVisibleChange(visible: boolean) {
  // 平台租户名称只用于展开后的虚拟根展示，无需在页面初次进入时请求。
  if (!visible || !isPlatformUser.value || hasLoadedTenantOptions.value) return;

  try {
    const result = await fetchCrudList('/Tenant/list', { pageIndex: 1, pageSize: 500 }, '/com.levin.oak.base/V1/api');
    tenantOptions.value = result.items.map((item: any) => ({ label: String(item.name || item.id), value: String(item.id) }));
    hasLoadedTenantOptions.value = true;
  } catch {
    tenantOptions.value = [];
  }
}

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
    :show-tenant-nodes="isPlatformUser"
    :tenant-options="tenantOptions"
    @dropdown-visible-change="handleDropdownVisibleChange"
    @loaded="handleLoaded"
    @update:selected-records="handleSelectedRecords"
  />
</template>
